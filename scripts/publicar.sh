#!/bin/bash
# Publica el sitio desde un clon de Git del servidor hacia su carpeta web.
# Lo ejecuta cPanel (Git Version Control → "Deploy HEAD Commit") vía .cpanel.yml.
#
#   ~/repositorios/petroilsa-web      →  ~/public_html                      (producción)
#   ~/repositorios/petroilsa-pruebas  →  ~/pruebas/pruebas.petroilsa.com    (ensayo)
#
# Este repo (petroilsa-web, público) ya contiene SOLO lo publicable: lo arma
# el Action del repo privado (.github/workflows/publicar-dist.yml) con
# `git archive` + export-ignore, así que aquí no hace falta filtrar por
# nombre de archivo — se copia todo el árbol menos .git/.cpanel.yml/scripts.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$(basename "$REPO")" in
  petroilsa-web)     DESTINO="$HOME/public_html" ;;
  petroilsa-pruebas)
    DESTINO="$HOME/pruebas/pruebas.petroilsa.com"
    # Variante por si cPanel exige que la raíz del subdominio esté dentro de public_html.
    [ -d "$DESTINO" ] || DESTINO="$HOME/public_html/pruebas/pruebas.petroilsa.com" ;;
  *) echo "ERROR: clon no reconocido ($REPO). No se publicó nada." >&2; exit 1 ;;
esac

if [ ! -d "$DESTINO" ]; then
  echo "ERROR: no existe $DESTINO. No se publicó nada." >&2
  exit 1
fi

cd "$REPO"

if command -v rsync >/dev/null 2>&1; then
  # --delete: lo que se borra en el repo dist se borra en el servidor.
  rsync -rlt --delete --chmod=D755,F644 \
    --exclude='.git' --exclude='.cpanel.yml' --exclude='scripts' \
    "$REPO/" "$DESTINO/"
else
  echo "ERROR: se necesita rsync en el servidor." >&2
  exit 1
fi

COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
LINEA="$(date '+%Y-%m-%d %H:%M:%S') | $(basename "$REPO") | commit $COMMIT | → $DESTINO"
echo "$LINEA" >> "$HOME/repositorios/publicaciones.log" 2>/dev/null || true
echo "Publicado: $LINEA"
