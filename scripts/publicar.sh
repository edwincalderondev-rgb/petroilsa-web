#!/bin/bash
# Publica el sitio desde un clon de Git del servidor hacia su carpeta web.
# Lo ejecuta cPanel (Git Version Control → "Deploy HEAD Commit") vía .cpanel.yml.
#
#   ~/repositorios/petroilsa-web      →  ~/public_html                                (producción)
#   ~/repositorios/petroilsa-pruebas  →  ~/public_html/pruebas/pruebas.petroilsa.com  (ensayo)
#
# Garantías (cada una tiene su prueba en scripts/plantilla-dist/probar-publicar.mjs):
#  1. Sin ~/repositorios/<clon>.AUTORIZADO no cambia nada: solo escribe en
#     ~/repositorios/<clon>-informe.txt lo que haría (ENSAYO). En producción el
#     archivo tiene que decir qué commit se autoriza (el que muestra el informe)
#     y se gasta: cada despliegue real necesita una autorización nueva.
#  2. Publica exactamente un commit: el clon no puede tener cambios locales.
#  3. Revisa todo antes de tocar el primer archivo; ante cualquier problema se
#     detiene sin cambiar nada.
#  4. En la raíz del destino nunca borra. Solo sincroniza con borrado las
#     carpetas del sitio, y solo si son del sitio: llevan la marca
#     .sitio-petroilsa, estaban vacías o no existían.
#  5. No sigue enlaces simbólicos, ni del destino ni del repositorio.
#  6. No cambia la configuración de PHP de cPanel: los bloques "cPanel-generated"
#     del .htaccess nuevo y del actual tienen que ser idénticos.
#  7. Respalda el .htaccess actual, deja index.html y .htaccess para el final
#     y cambia cada archivo de la raíz de golpe (sin instantes a medio escribir).

set -euo pipefail
umask 022
export LC_ALL=C

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
NOMBRE="$(basename "$REPO")"
BASE="$HOME/repositorios"
AUTORIZACION="$BASE/$NOMBRE.AUTORIZADO"
INFORME="$BASE/$NOMBRE-informe.txt"
MARCA=".sitio-petroilsa"
NOMBRE_VALIDO='^[a-z0-9][a-z0-9-]*$'
RESERVADAS='^(pruebas|anterior|repositorios|cgi-bin|wp-.*)$'
CPANEL_INICIO='^# (php -- )?BEGIN cPanel-generated'
CPANEL_FIN='^# (php -- )?END cPanel-generated'

LINEAS=("Despliegue de $NOMBRE · $(date '+%Y-%m-%d %H:%M:%S')")
CAMBIANDO=0
NPROBLEMAS=0

nota() { LINEAS+=("$*"); printf '%s\n' "$*"; }
problema() { NPROBLEMAS=$((NPROBLEMAS + 1)); nota "PROBLEMA: $*"; }
fallo() { nota "ERROR: $*"; exit 1; }
# CAMBIANDO: 0 = aún no se toca el destino · 1 = cambiándolo · 2 = sitio completo, quedan pasos finales.
cerrar() {
  local codigo=$?
  if [ "$codigo" -ne 0 ]; then
    case "$CAMBIANDO" in
      1) LINEAS+=("" "ERROR A MITAD DEL DESPLIEGUE: el destino pudo quedar a medias (arriba está lo que alcanzó a hacer). El .htaccess anterior está en $BASE/respaldos-htaccess/.") ;;
      2) LINEAS+=("" "El sitio quedó desplegado completo, pero falló un paso posterior (ver arriba).") ;;
      *) LINEAS+=("" "No se cambió nada en el destino.") ;;
    esac
  fi
  if [ -d "$BASE" ]; then printf '%s\n' "${LINEAS[@]}" > "$INFORME" || true; fi
  exit "$codigo"
}
trap cerrar EXIT

case "$NOMBRE" in
  petroilsa-web)     PRODUCCION=1; DESTINO="$HOME/public_html" ;;
  petroilsa-pruebas) PRODUCCION=0; DESTINO="$HOME/public_html/pruebas/pruebas.petroilsa.com" ;;
  *) fallo "clon no reconocido ($NOMBRE): solo se publica desde petroilsa-web o petroilsa-pruebas." ;;
esac
if [ -L "$DESTINO" ] || [ ! -d "$DESTINO" ]; then fallo "no existe la carpeta de destino $DESTINO (o es un enlace)."; fi
if ! command -v rsync >/dev/null 2>&1; then fallo "falta rsync en el servidor."; fi

# El git del sistema o, si no está en el PATH, el que trae cPanel.
GIT="$(command -v git 2>/dev/null || true)"
if [ -z "$GIT" ] && [ -x /usr/local/cpanel/3rdparty/bin/git ]; then GIT=/usr/local/cpanel/3rdparty/bin/git; fi
COMMIT_COMPLETO=''
if [ -n "$GIT" ]; then COMMIT_COMPLETO="$(cd "$REPO" && "$GIT" rev-parse HEAD 2>/dev/null)" || COMMIT_COMPLETO=''; fi
COMMIT="${COMMIT_COMPLETO:0:7}"

AUTORIZA=''
if [ -f "$AUTORIZACION" ]; then
  MODO=REAL
  # Lo primero con forma de commit (7 a 40 cifras hexadecimales); tolera espacios, saltos de línea y BOM.
  AUTORIZA="$(grep -oE '[0-9a-fA-F]{7,40}' "$AUTORIZACION" | sed -n 1p | tr 'A-F' 'a-f')" || AUTORIZA=''
else
  MODO=ENSAYO
fi

nota "Commit ${COMMIT:-?} → $DESTINO"
if [ "$MODO" = REAL ]; then
  nota "Modo: REAL (existe $AUTORIZACION${AUTORIZA:+, autoriza $AUTORIZA})."
elif [ "$PRODUCCION" = 1 ]; then
  nota "Modo: ENSAYO. No se cambia nada. Para desplegar ESTE commit de verdad, crea $AUTORIZACION con el texto ${COMMIT:-?} y vuelve a desplegar."
else
  nota "Modo: ENSAYO. No se cambia nada; para desplegar de verdad hay que crear $AUTORIZACION."
fi
nota "Herramientas: bash $BASH_VERSION · $(rsync --version 2>/dev/null | sed -n 1p) · $(if [ -n "$GIT" ]; then "$GIT" --version 2>/dev/null; else echo 'sin git'; fi)"
nota ""

cd "$REPO"

# ---- Revisión del repositorio (cualquier fallo aquí es definitivo) ----
for a in index.html .htaccess; do
  if [ ! -f "$a" ] || [ -L "$a" ]; then fallo "falta $a en el repositorio."; fi
done

CARPETAS=()
NCARPETAS=0
for c in */; do
  c="${c%/}"
  if [ ! -d "$c" ] || [ "$c" = scripts ]; then continue; fi
  if [ -L "$c" ]; then fallo "en el repositorio, '$c' es un enlace simbólico."; fi
  if ! [[ "$c" =~ $NOMBRE_VALIDO ]] || [[ "$c" =~ $RESERVADAS ]]; then fallo "carpeta no permitida en el sitio: '$c'."; fi
  if [ -n "$(find "$c" -type l -print -quit)" ]; then fallo "la carpeta '$c' del repositorio contiene enlaces simbólicos."; fi
  CARPETAS+=("$c")
  NCARPETAS=$((NCARPETAS + 1))
done
if [ "$NCARPETAS" -eq 0 ]; then fallo "el repositorio no trae carpetas del sitio."; fi

ARCHIVOS=()
for a in *; do
  if [ -L "$a" ]; then fallo "en el repositorio, '$a' es un enlace simbólico."; fi
  if [ ! -f "$a" ] || [ "$a" = index.html ]; then continue; fi
  ARCHIVOS+=("$a")
done
RAIZ=(${ARCHIVOS[@]+"${ARCHIVOS[@]}"} index.html .htaccess)

# ---- Qué commit se publica (se anota todo; luego se decide) ----
if [ -z "$COMMIT_COMPLETO" ]; then
  problema "no se pudo leer el commit del clon (${GIT:-git no está instalado}): no se puede garantizar qué se publica."
else
  if ! SUCIO="$("$GIT" status --porcelain 2>/dev/null)"; then
    problema "no se pudo consultar con git si el clon tiene cambios locales."
  elif [ -n "$SUCIO" ]; then
    problema "el clon tiene cambios locales que no están en el commit ${COMMIT} (cPanel tampoco despliega así):"
    while IFS= read -r l; do nota "      $l"; done <<< "$SUCIO"
  fi
fi
if [ "$MODO" = REAL ] && [ "$PRODUCCION" = 1 ]; then
  if [ -z "$AUTORIZA" ] || [ -z "$COMMIT_COMPLETO" ] || [ "${COMMIT_COMPLETO#"$AUTORIZA"}" = "$COMMIT_COMPLETO" ]; then
    problema "la autorización (${AUTORIZA:-vacía}) no corresponde al commit del clon (${COMMIT:-?}): solo se despliega el commit autorizado. Revisa este informe y, si es lo que quieres publicar, escribe ${COMMIT:-el commit} en $AUTORIZACION."
  fi
fi

# ---- Revisión del destino ----
ADOPTAR=()
MALAS=" "
mala() { MALAS="$MALAS$1 "; problema "$2"; }
for c in "${CARPETAS[@]}"; do
  d="$DESTINO/$c"
  if [ -L "$d" ]; then mala "$c" "'$c' es un enlace simbólico en el destino: no se sigue."; continue; fi
  if [ ! -e "$d" ]; then continue; fi
  if [ ! -d "$d" ]; then mala "$c" "'$c' existe en el destino y no es una carpeta."; continue; fi
  if [ ! -r "$d" ] || [ ! -x "$d" ]; then mala "$c" "no se puede leer la carpeta '$c' del destino."; continue; fi
  if [ -L "$d/$MARCA" ]; then mala "$c" "la marca de '$c' en el destino es un enlace simbólico."; continue; fi
  if [ -f "$d/$MARCA" ]; then continue; fi
  if ! contenido="$(ls -A -- "$d")"; then mala "$c" "no se pudo listar la carpeta '$c' del destino."; continue; fi
  if [ -z "$contenido" ]; then ADOPTAR+=("$c"); continue; fi
  if [ "$PRODUCCION" = 1 ]; then
    mala "$c" "ya existe en el destino una carpeta '$c' que no creó este sitio (no tiene $MARCA): no se toca."
  else
    ADOPTAR+=("$c")
  fi
done

for a in "${RAIZ[@]}"; do
  f="$DESTINO/$a"
  if [ -L "$f" ]; then problema "'$a' es un enlace simbólico en el destino."; continue; fi
  if [ -e "$f" ] && [ ! -f "$f" ]; then problema "'$a' existe en el destino y no es un archivo."; fi
  if [ -L "$DESTINO/.$a.publicando" ] || [ -d "$DESTINO/.$a.publicando" ]; then problema "en el destino estorba '.$a.publicando'."; fi
done

bloques_cpanel() {
  awk -v ini="$CPANEL_INICIO" -v fin="$CPANEL_FIN" '
    $0 ~ ini { dentro = 1; b = "" }
    dentro { l = $0; sub(/\r$/, "", l); sub(/[ \t]+$/, "", l); b = b l "\037" }
    dentro && $0 ~ fin { print b; dentro = 0 }
  ' "$1"
}
contar() { grep -cE "$1" "$2" || true; }
lista_bloques() { while IFS= read -r linea; do nota "      $linea"; done < <(printf '%s\n' "$1" | tr '\037' '\n'); }

B_REPO="$(bloques_cpanel .htaccess)"
if [ -z "$B_REPO" ]; then fallo "el .htaccess del repositorio no trae el bloque de PHP de cPanel."; fi
nota "PHP en el .htaccess nuevo: $(grep -m1 -oE 'ea-php[0-9]+' .htaccess || echo 'sin versión')"
H="$DESTINO/.htaccess"
if [ -f "$H" ] && [ ! -L "$H" ]; then
  nota "PHP en el .htaccess actual: $(grep -m1 -oE 'ea-php[0-9]+' "$H" || echo 'sin versión')"
  B_DEST="$(bloques_cpanel "$H")"
  NB_DEST="$(printf '%s' "$B_DEST" | grep -c . || true)"
  if [ "$(contar "$CPANEL_INICIO" "$H")" != "$NB_DEST" ] || [ "$(contar "$CPANEL_FIN" "$H")" != "$NB_DEST" ]; then
    problema "el .htaccess actual tiene bloques de cPanel incompletos o mal cerrados: revísalo a mano."
  fi
  if [ -n "$B_DEST" ]; then
    FALTAN="$(comm -23 <(printf '%s\n' "$B_DEST" | sort -u) <(printf '%s\n' "$B_REPO" | sort -u))"
    if [ -n "$FALTAN" ]; then
      problema "el .htaccess actual trae configuración de cPanel que el nuevo no trae idéntica (cambiaría el PHP de todo lo que cuelga de esta carpeta):"
      lista_bloques "$FALTAN"
    fi
    SOBRAN="$(comm -13 <(printf '%s\n' "$B_DEST" | sort -u) <(printf '%s\n' "$B_REPO" | sort -u))"
    if [ -n "$SOBRAN" ]; then
      problema "el .htaccess nuevo trae configuración de cPanel que el actual no tiene (cambiaría el PHP de todo lo que cuelga de esta carpeta):"
      lista_bloques "$SOBRAN"
    fi
  elif [ "$PRODUCCION" = 1 ]; then
    problema "el .htaccess actual no trae el bloque de PHP de cPanel: no se puede saber qué versión de PHP usan las demás apps."
  fi
elif [ "$PRODUCCION" = 1 ]; then
  problema "no hay .htaccess en el destino (o es un enlace)."
fi

es_del_sitio() {
  local x
  for x in "${CARPETAS[@]}" "${RAIZ[@]}"; do
    if [ "$x" = "$1" ]; then return 0; fi
  done
  return 1
}
AJENOS=()
for e in "$DESTINO"/* "$DESTINO"/.[!.]* "$DESTINO"/..?*; do
  if [ ! -e "$e" ] && [ ! -L "$e" ]; then continue; fi
  n="${e##*/}"
  if es_del_sitio "$n"; then continue; fi
  AJENOS+=("$n")
done
nota "No se tocan: ${AJENOS[*]-(nada)}"

# ---- Plan (ENSAYO) o ejecución (REAL) ----
resumen() {
  local c="$1" salida="$2" nuevos cambian borran
  nuevos="$(printf '%s\n' "$salida" | grep -c '^>f+' || true)"
  cambian="$(printf '%s\n' "$salida" | grep -cE '^>f[^+]' || true)"
  borran="$(printf '%s\n' "$salida" | grep -c '^\*deleting' || true)"
  nota "  $c/: $nuevos nuevos, $cambian actualizados, $borran borrados"
  if [ "$borran" != 0 ]; then
    while IFS= read -r l; do nota "      borra $c/$l"; done < <(printf '%s\n' "$salida" | sed -n 's/^\*deleting  *//p')
  fi
}
# Las líneas de error de rsync (van mezcladas con la lista de cambios: se pide con 2>&1).
errores_rsync() { while IFS= read -r l; do nota "      $l"; done < <(printf '%s\n' "$1" | grep -E '^(rsync|cannot |file has vanished|IO error)' || true); }
SINCRONIZAR=(rsync -rlt --checksum --delete --itemize-changes --chmod=D755,F644 --exclude='.*')

nota ""
nota "Carpetas del sitio (dentro de cada una, lo que no está en el repositorio se borra):"
if [ "$MODO" = ENSAYO ] || [ "$NPROBLEMAS" -gt 0 ]; then
  for c in "${CARPETAS[@]}"; do
    case "$MALAS" in
      *" $c "*) nota "  $c/: no se simula (ver PROBLEMA arriba)."; continue ;;
    esac
    if salida="$("${SINCRONIZAR[@]}" --dry-run "$c/" "$DESTINO/$c/" 2>&1)"; then
      resumen "$c" "$salida"
    else
      problema "rsync no pudo simular la carpeta $c/:"
      errores_rsync "$salida"
    fi
  done
  for c in ${ADOPTAR[@]+"${ADOPTAR[@]}"}; do nota "  $c/: existe sin marca y vacía (o es de pruebas): se le pone la marca."; done
  nota ""
  nota "Archivos de la raíz, en este orden (index.html y .htaccess al final):"
  for a in "${RAIZ[@]}"; do
    f="$DESTINO/$a"
    if [ -f "$f" ] && [ ! -L "$f" ]; then
      if [ "$(cksum < "$a")" = "$(cksum < "$f")" ]; then q="igual al actual"; else q="REEMPLAZA al actual"; fi
    else
      q="nuevo"
    fi
    nota "  $a: $q"
  done
  nota ""
  if [ "$NPROBLEMAS" -gt 0 ]; then
    nota "Hay $NPROBLEMAS problema(s): no se cambió nada."
    exit 1
  fi
  nota "ENSAYO terminado: no se cambió nada."
  exit 0
fi

if [ -f "$DESTINO/.htaccess" ]; then
  mkdir -p -- "$BASE/respaldos-htaccess"
  RESPALDO="$BASE/respaldos-htaccess/$NOMBRE-$(date '+%Y%m%d-%H%M%S')-$$.htaccess"
  cp -p -- "$DESTINO/.htaccess" "$RESPALDO"
  nota "Respaldo del .htaccess anterior: $RESPALDO"
fi
CAMBIANDO=1
for c in "${CARPETAS[@]}"; do
  d="$DESTINO/$c"
  if [ ! -d "$d" ]; then mkdir -- "$d"; chmod 755 -- "$d"; fi
  if [ ! -f "$d/$MARCA" ]; then : > "$d/$MARCA"; chmod 644 -- "$d/$MARCA"; fi
  if ! salida="$("${SINCRONIZAR[@]}" "$c/" "$d/" 2>&1)"; then
    resumen "$c" "$salida"
    errores_rsync "$salida"
    fallo "rsync falló en la carpeta $c/ (lo que alcanzó a hacer está justo arriba)."
  fi
  resumen "$c" "$salida"
done
nota ""
nota "Archivos de la raíz:"
for a in "${RAIZ[@]}"; do
  t="$DESTINO/.$a.publicando"
  cp -- "$a" "$t"
  chmod 644 -- "$t"
  mv -f -- "$t" "$DESTINO/$a"
  nota "  $a"
done
CAMBIANDO=2

if [ "$PRODUCCION" = 1 ]; then
  rm -f -- "$AUTORIZACION"
  nota "Autorización gastada: el próximo despliegue a producción necesita una nueva."
fi
printf '%s\n' "$(date '+%Y-%m-%d %H:%M:%S') | $NOMBRE | commit ${COMMIT:-?} | → $DESTINO" >> "$BASE/publicaciones.log" 2>/dev/null || true
nota ""
nota "Listo: desplegado ${COMMIT:-?} en $DESTINO."
