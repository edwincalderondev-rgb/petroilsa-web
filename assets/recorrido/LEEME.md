# Recorrido guiado — función temporal

Vista guiada de petroilsa.com para un invitado concreto: Ala de Sable lo acompaña
por 12 paradas repartidas en 4 páginas, explicando qué cambió respecto del sitio
anterior (archivado en `anterior.petroilsa.com`) y por qué.

**Nace con fecha de muerte.** Está hecha para poder quitarse de un tirón, sin dejar
rastro en el sitio. Si estás leyendo esto para darla de baja, salta al final.

---

## Cómo se enciende

```
https://petroilsa.com/recorrido/?i=lah
```

1. `recorrido/index.html` es una página puente de 20 líneas. No guarda nada: existe
   para que el enlace tenga **su propia tarjeta de vista previa** (`og:`) en el correo
   y en WhatsApp, y para pasarle el token a la portada del sitio.
2. El bloque del final de `assets/js/nav.js` ve el `?i=` (o un estado ya guardado) y
   solo entonces carga `visita.css` y `visita.js`. **Sin token no se descarga ni un
   byte**: un visitante normal no paga por esta función.
3. `visita.js` guarda el estado en `localStorage` y **limpia la dirección** con
   `history.replaceState`. De ahí en adelante el modo viaja como el idioma: sin
   aparecer en la URL.

Si el invitado copia la dirección de la barra y se la pasa a alguien, esa persona ve
el sitio normal. **No hay ningún botón para activar el modo.** Pero conviene saberlo:
el token no es un secreto — el JS se descarga al navegador y el repositorio es
público. Esto es *no descubrible*, no privado.

## Invitados y caducidad

Ambas cosas, arriba del todo en `visita.js`:

```js
var CADUCA = '2027-01-15';     // después de esta fecha el modo no se activa
var INVITADOS = {
  lah:    { trato: 'Señor', nombre: 'Luis Alberto Hincapié', corto: 'Señor Hincapié' },
  ensayo: { trato: '', nombre: '', corto: '' }    // para probar sin usar el del jefe
};
```

Pasada la fecha, el token deja de activar nada y el estado guardado se borra solo en
el siguiente arranque. **La función se apaga aunque nadie se acuerde de bajarla.**

Para agregar otro invitado basta con otra línea en `INVITADOS`; el enlace sería
`/recorrido/?i=<llave>`.

## ⚠ Pendiente antes de enviar el enlace

```js
var WHATSAPP = 'PENDIENTE';    // ej. '573001234567' — internacional, sin signos
```

Es el destino del botón "Escribirle al ingeniero Calderón" de la última parada.
Mientras diga `PENDIENTE`, el botón abre el correo (`CORREO`) en vez de WhatsApp,
así que **nunca queda roto** — pero el mensaje no llega por donde se quería.

## Qué hay en esta carpeta

| Archivo | Qué es |
|---|---|
| `visita.js` | Motor y guion. Las 12 paradas están en el arreglo `PARADAS`, con su texto. |
| `visita.css` | Estilos. Todo con prefijo `.rg-` y bajo la clase `.rg-on` del `<html>`. |
| `poses/` | 18 poses del colibrí ilustrado (WebP con transparencia, ~512 px de alto). |
| `antes/` | Las 6 capturas de las comparaciones antes/hoy. |

Las capturas se tomaron del espejo del WordPress
(`Documents/PetroilWeb/Despliegue/sitio-anterior/`) y del sitio nuevo **con el mismo
viewport y el mismo scroll**, por CDP, para que el comparador cuadre pixel a pixel.
Las dos mitades de cada par tienen que medir exactamente lo mismo o la cortina se
deforma.

## Ayudas en la consola del navegador

```js
VISITA.ir(5)       // saltar a una parada
VISITA.estado()    // ver el estado guardado
VISITA.borrar()    // apagar el modo en este navegador
AIRA.match('…')    // comprobar que una pregunta del recorrido gana a las del sitio
```

## Lo que toca fuera de esta carpeta

Son tres sitios, y nada más:

1. **`assets/js/nav.js`** — el bloque del final, `RECORRIDO GUIADO (función temporal)`.
2. **`assets/js/aira.js`** — `AIRA.extend(entries, cat)` y el `KB.saludo` de `welcome()`.
   `extend()` empuja las entradas y **reconstruye `INDEX`**, porque el índice del
   corrector de erratas se precalcula al arrancar: sin eso las entradas nuevas
   puntúan, pero sus palabras no corrigen erratas. `KB.saludo` permite reemplazar la
   presentación del chat sin tocar `aira.js` otra vez.
   Es la excepción documentada a la regla de *"para enseñarle algo a AIRA se edita
   solo `aira-kb.js`"*: el capítulo del recorrido **no puede** vivir en `aira-kb.js`,
   porque entonces lo tendrían todos los visitantes.
3. **`scripts/publicar.sh`** — `recorrido` en la lista `CARPETAS`.

Más `assets/img/og/og-recorrido.jpg`, la tarjeta de vista previa del enlace.

---

## Cómo darla de baja

```bash
rm -rf assets/recorrido recorrido assets/img/og/og-recorrido.jpg
```

Después, a mano:

- `assets/js/nav.js` — borrar el bloque final `RECORRIDO GUIADO (función temporal)`.
- `assets/js/aira.js` — se puede dejar tal cual: `extend()` y `KB.saludo` son dos
  ganchos genéricos de 6 líneas que no hacen nada si nadie los llama. Si se quieren
  quitar, hay que devolver `welcome()` a su texto fijo.
- `scripts/publicar.sh` — sacar `recorrido` de `CARPETAS`.
- `CLAUDE.md` — borrar la sección del recorrido.

No hace falta tocar `sitemap.xml`: la página puente lleva `noindex`, así que
`scripts/generar-sitemap.mjs` nunca la incluyó.

**Nada se rompe si queda a medias.** Si se borra la carpeta y alguien conserva la
bandera en su `localStorage`, el cargador de `nav.js` pide un archivo que ya no
existe, falla en silencio y la página sigue normal.
