#!/bin/bash
# Publica el sitio desde un clon de Git del servidor hacia su carpeta web.
# Lo ejecuta cPanel (Git Version Control → "Deploy HEAD Commit") vía .cpanel.yml.
#
#   ~/repositorios/petroilsa-web      →  ~/public_html                       (producción)
#   ~/repositorios/petroilsa-pruebas  →  la primera que exista de 3 rutas    (ensayo, ver abajo)
#
# Este repo (petroilsa-web) ya trae SOLO lo publicable. Pero public_html es
# COMPARTIDO: ahí viven las apps de otro técnico, los subdominios (pruebas,
# anterior…), .well-known y cgi-bin. Por eso en la raíz del destino NUNCA se
# borra nada: cada carpeta del sitio se sincroniza por su lado con
# rsync --delete, los archivos de la raíz se copian sin tocar los ajenos, y
# index.html y .htaccess van al final, en ese orden, para que el sitio anterior
# siga respondiendo hasta el último instante.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$(basename "$REPO")" in
  petroilsa-web) DESTINO="$HOME/public_html" ;;
  petroilsa-pruebas)
    # Este hosting no deja (o aplana) document roots fuera de public_html, así
    # que se prueban las tres formas que puede haber quedado el subdominio,
    # de la más aislada a la menos, y se usa la primera que exista de verdad.
    DESTINO=""
    for candidato in \
      "$HOME/pruebas/pruebas.petroilsa.com" \
      "$HOME/public_html/pruebas/pruebas.petroilsa.com" \
      "$HOME/public_html/pruebas.petroilsa.com"
    do
      if [ -d "$candidato" ]; then DESTINO="$candidato"; break; fi
    done ;;
  *) echo "ERROR: clon no reconocido ($REPO). No se publicó nada." >&2; exit 1 ;;
esac

if [ ! -d "$DESTINO" ]; then
  echo "ERROR: no existe $DESTINO. No se publicó nada." >&2
  exit 1
fi
command -v rsync >/dev/null 2>&1 || { echo "ERROR: se necesita rsync en el servidor. No se publicó nada." >&2; exit 1; }

cd "$REPO"

# Carpetas del sitio = las de primer nivel del repo. Se valida todo antes de
# copiar nada: una carpeta con punto en el nombre (las de dominios ajenos) o
# con nombre de sistema/subdominio nunca puede recibir un --delete.
CARPETAS=()
for c in */; do
  c="${c%/}"
  [ "$c" = "scripts" ] && continue
  if [[ ! "$c" =~ ^[a-z0-9][a-z0-9-]*$ ]] || [[ "$c" =~ ^(pruebas|anterior|repositorios|cgi-bin|wp-.*)$ ]]; then
    echo "ERROR: carpeta no permitida en el sitio: '$c'. No se publicó nada." >&2
    exit 1
  fi
  CARPETAS+=("$c")
done

ARCHIVOS=()
for a in *; do
  [ -f "$a" ] || continue
  [ "$a" = "index.html" ] && continue
  ARCHIVOS+=("$a")
done
for a in index.html .htaccess; do
  [ -f "$a" ] || { echo "ERROR: falta $a en el repositorio. No se publicó nada." >&2; exit 1; }
done

for c in "${CARPETAS[@]}"; do
  rsync -rlt --delete --chmod=D755,F644 --exclude='.*' "$c/" "$DESTINO/$c/"
done
for a in "${ARCHIVOS[@]}" index.html .htaccess; do
  cp -f "$a" "$DESTINO/$a"
  chmod 644 "$DESTINO/$a"
done

COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
LINEA="$(date '+%Y-%m-%d %H:%M:%S') | $(basename "$REPO") | commit $COMMIT | → $DESTINO"
echo "$LINEA" >> "$HOME/repositorios/publicaciones.log" 2>/dev/null || true
echo "Publicado: $LINEA"
