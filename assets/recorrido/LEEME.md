# Recorrido guiado — función temporal

Vista guiada de petroilsa.com para un invitado concreto: Ala de Sable lo recibe con
una portada propia y lo acompaña por **13 paradas en 5 páginas**, mostrando lo más
vistoso del sitio y explicando qué cambió respecto del anterior (archivado en
`anterior.petroilsa.com`) y por qué.

**Nace con fecha de muerte.** Está hecha para poder quitarse de un tirón, sin dejar
rastro en el sitio. Si estás leyendo esto para darla de baja, salta al final.

---

## Cómo se enciende

```
https://petroilsa.com/recorrido/lah/      ← el que se le envía al Sr. Hincapié
https://petroilsa.com/recorrido/?i=lah    ← equivalente, genérico (sirve para cualquier invitado)
```

1. `recorrido/lah/index.html` y `recorrido/index.html` son páginas puente. La personal
   deja el enlace limpio y pone su nombre en la vista previa; la genérica lee el invitado
   de `?i=`. No guarda nada: existe para que el
   enlace tenga **su propia tarjeta de vista previa** (`og:`) en el correo y en
   WhatsApp, y para pasarle el token a la portada del sitio.
2. El bloque del final de `assets/js/nav.js` ve el `?i=` (o un estado ya guardado) y
   solo entonces carga `visita.css` y `visita.js`. **Sin token no se descarga ni un
   byte**: un visitante normal no paga por esta función.
3. `visita.js` guarda el estado en `localStorage` y **limpia la dirección** con
   `history.replaceState`. De ahí en adelante el modo viaja como el idioma: sin
   aparecer en la URL.

Si el invitado copia la dirección de la barra y se la pasa a alguien, esa persona ve
el sitio normal. **No hay ningún botón para encender el modo.** Sí hay uno para
apagarlo —«Salir de la vista especial», en la pastilla y en el sello— que borra el
token y recarga como visitante normal; después, solo el enlace vuelve a encenderlo.

El token no es un secreto (el JS se descarga al navegador y el repositorio es
público): esto es *no descubrible*, no privado.

## Las 13 paradas

| # | Página | Tipo | Qué muestra |
|---|---|---|---|
| — | Portada | portada | Saludo por su nombre, aviso de vista especial |
| 1 | Portada | lámina | Antes/hoy de la portada, en un navegador en 3D |
| 2 | Portada | foco | Abanico del ecosistema |
| 3 | Portada | foco | ¿Por qué Petroil? (paneles) |
| 4 | Portada | foco | Nuevos horizontes (mapa satelital) |
| 5 | Portada | foco ×2 | Selector de idioma **y** título: botones para cambiarlo en vivo |
| 6 | Productos | lámina | Antes/hoy del catálogo |
| 7 | Productos | foco | Tarjeta del P-500 Marine: un cursor simulado vuela hasta ella y enciende su video |
| 8 | Ficha 50 10 | escena | Tucán pico de canoa y el combustible flotando |
| 9 | Ficha 50 10 | foco | El chat, con una pregunta en vivo |
| 10 | Refinería Santa Marta | escena | Video de dron y cifras |
| 11 | SGI | foco | Emblema de los propósitos |
| 12 | Portada | lámina | Antes/hoy en el celular, en un teléfono en 3D |
| 13 | Portada | lámina | Despedida con aurora boreal: tres botones para escribirle al ingeniero y su hoja de vida |

En la parada 7 el video no espera al invitado: un cursor simulado sale del colibrí y se
posa en la tarjeta. **Ojo:** el video lo arranca `home.js` con `mouseenter`, pero lo HACE
VISIBLE el `:hover` de `productos.css`, que un evento simulado no activa; por eso la
clase `rg-hover` replica esas reglas en `visita.css`. Si cambian en `productos.css`,
cámbialas también aquí: sin ellas el video corre escondido debajo de la foto fija (así
falló la primera versión).

En la parada 13 el fondo enciende la aurora boreal (`Fondo.aurora(1)`, con estrellas
fugaces) y el texto pasa a un panel de vidrio; a su lado, una tarjeta enlaza la hoja de
vida del ingeniero con una vista previa que pasa sola por cuatro capturas (`hdv/`). Al
terminar, la aurora estalla (`Fondo.aurora(1.8)`) mientras el colibrí vuela hasta el
lanzador del chat y la página queda en la
portada, desde arriba, con la burbuja «Aquí me encontrará siempre».

Los tipos: **foco** vela y desenfoca la página y deja nítido lo iluminado (puede
haber varios huecos); **escena** no vela, pone una viñeta de cine y una franja de
luz; **lámina** es pantalla completa sobre el fondo vivo.

## Invitados, caducidad y WhatsApp

Arriba del todo en `visita.js`:

```js
const CADUCA = '2027-01-15';                 // después de esta fecha el modo no se activa
const WHATSAPP = '573014099377';             // destino de los botones del cierre
const INVITADOS = {
  lah:    { trato: 'Señor', nombre: 'Luis Alberto Hincapié', corto: 'Señor Hincapié', sello: 'el Sr. Hincapié' },
  ensayo: { trato: '', nombre: '', corto: '', sello: 'un invitado' }   // para probar
};
```

Pasada la fecha, el token deja de activar nada y el estado guardado se borra solo en
el siguiente arranque. **La función se apaga aunque nadie se acuerde de bajarla.**
Si `WHATSAPP` se deja en `'PENDIENTE'`, los botones del cierre abren el correo.

## Qué hay en esta carpeta

| Archivo | Qué es |
|---|---|
| `visita.js` | Motor, guion (`PARADAS`), fondo WebGL y capítulo del chat. |
| `visita.css` | Estilos. Todo con prefijo `.rg-` y bajo la clase `.rg-on` del `<html>`. |
| `poses/` | 18 poses del colibrí ilustrado (WebP con transparencia, ~512 px). |
| `antes/` | Las 6 capturas de las comparaciones antes/hoy. |
| `hdv/` | 4 capturas de la hoja de vida del ingeniero (en español), para la tarjeta del cierre. |

**El fondo vivo** es un sombreador WebGL2 propio, sin librerías: aurora en los
colores de marca, chispas que suben y la Sierra Nevada en crestas de luz que se
acercan. Se dibuja a menos resolución que la pantalla, a ~30 fotogramas por segundo y
solo mientras hay una lámina, la portada o un pasaje a la vista. Sin WebGL2 queda un
degradado de CSS; con «reducir movimiento», un fotograma quieto.

**Las poses venían con un residuo blanco del recorte** (~8 px bajo el ave, invisible
sobre blanco y muy visible sobre el fondo oscuro). Se limpiaron midiendo píxeles en
un `<canvas>`, con decisión por fila: la «repisa» son filas anchas y casi blancas; la
cola, filas estrechas y oscuras. Si llegan poses nuevas, revísalas sobre fondo oscuro.

**Las capturas** se tomaron del espejo del WordPress
(`Documents/PetroilWeb/Despliegue/sitio-anterior/`) y del sitio nuevo **con el mismo
viewport y el mismo scroll**, por CDP. Las dos mitades de cada par tienen que medir
exactamente lo mismo o la cortina se deforma.

## La vista previa del enlace (WhatsApp, correo)

Las etiquetas `og:` de las páginas puente apuntan a **petroilsa.com**, y el robot de
vista previa de WhatsApp/Facebook **va a leer la tarjeta a la dirección de `og:url`**.
Por eso, mientras el sitio nuevo no esté publicado en petroilsa.com, **ningún enlace del
sitio muestra vista previa** (tampoco desde pruebas.petroilsa.com, que tiene contraseña:
el robot recibe un 401). En producción aparecen solas.

Para verla antes, `scripts/prueba-vista-previa/` es una copia de la puente personal con
las etiquetas apuntando a GitHub Pages:
`https://edwincalderondev-rgb.github.io/PetroilSA/scripts/prueba-vista-previa/`. Vive en
`scripts/` porque `publicar.sh` no copia esa carpeta: nunca llega al servidor.

Las tarjetas (`assets/img/og/og-recorrido.jpg` y `og-recorrido-lah.jpg`) se generaron con
el **mismo sombreador** del recorrido, leído de `visita.js`, con la aurora encendida.

El correo para Outlook vive **fuera del repositorio**, en
`Para construccion/correcciones/Funcionalidad especial LAH/correo/`: una página con el
correo listo para copiar y pegar, con la tarjeta incrustada y enlazada (Outlook clásico
no genera vistas previas de enlaces; así se ve igual en todos).

## Ayudas en la consola del navegador

```js
VISITA.ir(5)       // saltar a una parada (0 = la primera)
VISITA.estado()    // ver el estado guardado
VISITA.borrar()    // salir del modo en este navegador (como el botón)
AIRA.match('…')    // comprobar que una pregunta del recorrido gana a las del sitio
```

Para probar idiomas o el pasaje entre páginas hay que servir por HTTP
(`scripts/devserver.ps1`). Ese servidor atiende **de a una petición**: en la portada,
`visita.js` llega en cola detrás de los videos y tarda varios segundos en arrancar.
Apache no tiene ese problema.

## Lo que toca fuera de esta carpeta

1. **`assets/js/nav.js`** — el bloque del final, `RECORRIDO GUIADO (función temporal)`.
   Además de cargar los dos archivos, si se llega desde un cambio de página del
   recorrido tapa la página con el mismo azul con que terminó la anterior (así no se
   ve el salto); `visita.js` la retira y, si no llegara a cargar, se retira sola a los 3 s.
2. **`assets/js/aira.js`** — `AIRA.extend(entries, cat)` y el `KB.saludo` de `welcome()`.
   `extend()` empuja las entradas y **reconstruye `INDEX`**, porque el índice del
   corrector de erratas se precalcula al arrancar. Es la excepción documentada a la
   regla de *"para enseñarle algo a AIRA se edita solo `aira-kb.js`"*: el capítulo
   del recorrido no puede vivir ahí, porque lo tendrían todos los visitantes.
3. **`scripts/publicar.sh`** — `recorrido` en la lista `CARPETAS`.

Más las dos tarjetas de vista previa, `assets/img/og/og-recorrido.jpg` y
`og-recorrido-lah.jpg`, y la página de prueba `scripts/prueba-vista-previa/`.

---

## Cómo darla de baja

```bash
rm -rf assets/recorrido recorrido scripts/prueba-vista-previa \n       assets/img/og/og-recorrido.jpg assets/img/og/og-recorrido-lah.jpg
```

Después, a mano:

- `assets/js/nav.js` — borrar el bloque final `RECORRIDO GUIADO (función temporal)`.
- `assets/js/aira.js` — se puede dejar tal cual: `extend()` y `KB.saludo` son dos
  ganchos genéricos que no hacen nada si nadie los llama. Si se quieren quitar, hay
  que devolver `welcome()` a su texto fijo.
- `scripts/publicar.sh` — sacar `recorrido` de `CARPETAS`.
- `CLAUDE.md` — borrar la sección del recorrido.

No hace falta tocar `sitemap.xml`: las páginas puente llevan `noindex`, así que
`scripts/generar-sitemap.mjs` nunca la incluyó.

**Nada se rompe si queda a medias.** Si se borra la carpeta y alguien conserva la
bandera en su `localStorage`, el cargador de `nav.js` pide un archivo que ya no
existe, falla en silencio y la página sigue normal (y la tapa del pasaje, si la
hubiera, se retira sola a los 3 segundos).
