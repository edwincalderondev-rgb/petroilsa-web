// ============================================
// BARRA DE PROGRESO LÍQUIDA + RUTA ENERGÉTICA DINÁMICA
// Un solo cálculo de scroll alimenta: la barra líquida superior (con
// "desestabilización" al reanudar el movimiento y calma tras ~1s quieto),
// la compactación del header, y el llenado progresivo de los nodos/línea
// de la ruta de navegación (ya no se queda fijo en "Innovación").
//
// También incluye, por ser utilidades del mismo header/nav sitewide:
// reveal-on-scroll, el dropdown de idioma y el drawer lateral móvil.
// ============================================
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const siteHeader = document.getElementById('siteHeader');
const progressFill = document.getElementById('scrollProgress');
const routeLinksAll = document.querySelectorAll('.route-link[data-section], .drawer-link[data-section]');
const fillLineH = document.getElementById('routeFillLine');
const fillLineV = document.getElementById('routeFillLineV');

// Cada "parada" de la ruta se vincula a la sección real que debe vigilarse
// para el scroll-spy (data-section), que puede ser distinta del href de
// navegación real del enlace (ej. "¿Quiénes somos?" navega a
// quienes-somos.html, pero su avance se sigue contra el resumen "#nosotros"
// que sí existe en esta página).
const desktopStops = Array.from(document.querySelectorAll('#navLinks .route-link[data-section]'))
  .map(link => ({ link, target: document.querySelector(link.dataset.section), node: link.querySelector('.route-node') }))
  .filter(item => item.target && item.node);

const mobileStops = Array.from(document.querySelectorAll('.drawer-route .drawer-link[data-section]'))
  .map(link => ({ link, target: document.querySelector(link.dataset.section), node: link.querySelector('.drawer-node') }))
  .filter(item => item.target && item.node);

let desktopCenters = [];
let mobileCenters = [];
// Límites reales de la línea (inicio/fin), leídos directamente del CSS
// (::before) para no duplicar valores "a mano": son los tramos que antes
// no se usaban —antes de "Servicios" y después de "¿Quiénes somos?"— y que
// ahora también se iluminan, igual que la barra líquida superior.
let desktopEdges = null;
let mobileEdges = null;

function measureCenters(){
  const navLinksEl = document.getElementById('navLinks');
  if(navLinksEl && desktopStops.length){
    const containerRect = navLinksEl.getBoundingClientRect();
    desktopCenters = desktopStops.map(({ node }) => {
      const r = node.getBoundingClientRect();
      return (r.left + r.width / 2) - containerRect.left;
    });
    // Centro vertical real del primer nodo: la línea se posiciona con esto
    // (variable --route-line-y) para que atraviese los círculos en vez de
    // pasar entre el texto y el nodo, sin importar el grosor elegido en
    // el CSS ni el alto que ocupe la etiqueta.
    const firstNodeRect = desktopStops[0].node.getBoundingClientRect();
    const lineY = (firstNodeRect.top + firstNodeRect.height / 2) - containerRect.top;
    navLinksEl.style.setProperty('--route-line-y', lineY + 'px');
    const lineStyle = getComputedStyle(navLinksEl, '::before');
    const left = parseFloat(lineStyle.left) || 0;
    const right = parseFloat(lineStyle.right) || 0;
    desktopEdges = { start: left, end: containerRect.width - right };
  }
  const drawerRouteEl = document.querySelector('.drawer-route');
  if(drawerRouteEl && mobileStops.length){
    const containerRect = drawerRouteEl.getBoundingClientRect();
    mobileCenters = mobileStops.map(({ node }) => {
      const r = node.getBoundingClientRect();
      return (r.top + r.height / 2) - containerRect.top;
    });
    // Mismo criterio en vertical: centro horizontal real del primer nodo.
    const firstNodeRect = mobileStops[0].node.getBoundingClientRect();
    const lineX = (firstNodeRect.left + firstNodeRect.width / 2) - containerRect.left;
    drawerRouteEl.style.setProperty('--route-line-x', lineX + 'px');
    const lineStyle = getComputedStyle(drawerRouteEl, '::before');
    const top = parseFloat(lineStyle.top) || 0;
    const bottom = parseFloat(lineStyle.bottom) || 0;
    mobileEdges = { start: top, end: containerRect.height - bottom };
  }
}

let isSettled = true;
let lastScrollY = window.scrollY;
let settleTimer = null;
let scrollTicking = false;

function getScrollPercent(){
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  if(max <= 0) return 0;
  return Math.min(100, Math.max(0, (h.scrollTop / max) * 100));
}

// Umbrales con histéresis: se activa el modo compacto al superar
// HEADER_COMPACT_ON y solo se desactiva al bajar de HEADER_COMPACT_OFF.
// La "zona muerta" entre ambos evita que, al llegar casi arriba del todo,
// pequeñas oscilaciones del scroll (inercia táctil, rueda del mouse,
// rubber-band en iOS) crucen un único umbral una y otra vez —eso era lo
// que hacía "temblar" el navbar: cada cruce reiniciaba a la mitad las
// transiciones de padding/alto del logo/sombra.
const HEADER_COMPACT_ON = 40;
const HEADER_COMPACT_OFF = 16;
let headerCompact = false;

function updateHeaderCompaction(){
  if(!siteHeader) return;
  const y = window.scrollY;
  if(!headerCompact && y > HEADER_COMPACT_ON) headerCompact = true;
  else if(headerCompact && y < HEADER_COMPACT_OFF) headerCompact = false;
  siteHeader.classList.toggle('navbar-scrolled', headerCompact);
}

// ============================================
// SEGUNDO ESCALÓN: RETIRADA DE LA FRANJA BLANCA
// Cuando el visitante sigue bajando después de que el header ya se compactó,
// el header ENTERO se desliza hacia arriba la altura exacta de .navbar-top:
// la franja blanca sale por encima del viewport y la ruta oscura queda
// pegada al tope, con el logotipo en negativo (blanco/gris) como única
// identidad visible. Al primer gesto hacia arriba vuelve la franja blanca.
//
// Se hace con transform y no colapsando alturas: el header sigue ocupando
// lo mismo en el flujo, así que no hay reflow ni salto del scroll.
// ============================================
const headerTopBar = siteHeader ? siteHeader.querySelector('.navbar-top') : null;
// El estado solo se activa en páginas que llevan el logotipo negativo dentro
// de .navbar-route (#routeLogo): sin él, la página se quedaría sin franja
// blanca Y sin logotipo, que es peor que no tener el efecto.
const routeLogoEl = document.getElementById('routeLogo');
// Por debajo de 721px .navbar-route está oculta y la franja blanca ES el
// header entero: retirarla dejaría la página sin ninguna barra. Mismo
// breakpoint que el @media del CSS.
const wideHeader = window.matchMedia('(min-width:721px)');

// Umbral de bajada mínimo antes de poder esconder la franja (por encima del
// de compactación: primero encoge, luego desaparece), umbral por debajo del
// cual siempre vuelve, y píxeles acumulados en un sentido que hacen falta
// para dar el gesto por intencional (filtra la inercia táctil y el rebote).
const HEADER_HIDE_AT = 170;
const HEADER_SHOW_AT = 90;
const HEADER_DIR_THRESHOLD = 10;
// Hueco mínimo entre el logotipo y el primer tramo de la ruta.
const ROUTE_LOGO_GAP = 36;
let topHidden = false;
let dirAccum = 0;
let retractUntil = 0;
let retractRaf = null;
let routeLogoFits = false;

// La distancia a subir es la altura real de la franja, que cambia entre el
// estado normal (~121px) y el compacto (~101px) y podría cambiar más si se
// retoca el logo o las fuentes tardan en asentarse. Un ResizeObserver la
// mantiene al día sola, incluso a mitad de la transición de compactación.
function syncTopBarHeight(){
  if(!siteHeader || !headerTopBar) return;
  siteHeader.style.setProperty('--navbar-top-h', headerTopBar.offsetHeight + 'px');
}

// ¿Cabe el logotipo sin chocar con el primer tramo de la ruta?
// Esto NO se puede escribir como un breakpoint: cada página tiene su propia
// ruta —de 2 tramos ("Descripción / Contacto") a 6 largos ("1. Responsable
// … 6. Documento")— y .nav-links los centra, así que cuanto más ancha es la
// ruta más se acerca su primer tramo al borde izquierdo, justo donde va el
// logotipo. Además i18n.js reescribe las etiquetas al cambiar de idioma y
// las anchuras cambian otra vez. Por eso se mide en vez de suponerse, y se
// vuelve a medir al redimensionar y al cambiar de idioma.
//
// Se usa offsetLeft/offsetWidth y no getBoundingClientRect() a propósito:
// los offsets ignoran los transform, así que la medida es la misma esté el
// logotipo visible, a medio desvanecer o desplazado por su transición.
function measureRouteLogoFit(){
  const navLinksEl = document.getElementById('navLinks');
  const firstLink = navLinksEl ? navLinksEl.querySelector('.route-link') : null;
  if(!routeLogoEl || !firstLink){ routeLogoFits = false; return; }
  const logoRight = routeLogoEl.offsetLeft + routeLogoEl.offsetWidth;
  const linkLeft = navLinksEl.offsetLeft + firstLink.offsetLeft;
  // Con .navbar-route oculta (móvil) todos los offsets son 0 y la resta da
  // 0: el caso se descarta solo, sin comprobar el display.
  routeLogoFits = (linkLeft - logoRight) >= ROUTE_LOGO_GAP;
}

// Con el logotipo a la izquierda, la línea de la ruta arranca más a la
// derecha para no pasar por debajo, y ese `left` del ::before viaja en una
// transición de .34s. measureCenters() lo lee ya calculado, así que durante
// la transición devuelve el valor intermedio de ese instante: remidiendo en
// cada frame mientras dura, el líquido acompaña al logotipo en vez de dar
// un salto al final (que es lo que pasaba midiendo una sola vez).
function trackRetractTransition(){
  retractUntil = performance.now() + 480;
  if(retractRaf) return;
  const step = () => {
    measureCenters();
    updateRouteFill();
    if(performance.now() < retractUntil){ retractRaf = requestAnimationFrame(step); }
    else { retractRaf = null; }
  };
  retractRaf = requestAnimationFrame(step);
}

function setTopHidden(next){
  if(!siteHeader || next === topHidden) return;
  topHidden = next;
  siteHeader.classList.toggle('navbar-hidetop', topHidden);
  trackRetractTransition();
}

function updateTopRetraction(y, delta){
  if(!siteHeader || !headerTopBar || !routeLogoEl) return;
  // routeLogoFits se consulta cacheado, no se mide aquí: esto corre en cada
  // frame de scroll y leer offsetLeft fuerza un reflow.
  if(!wideHeader.matches || !routeLogoFits){ setTopHidden(false); return; }
  if(delta){
    // El acumulado se reinicia al cambiar de sentido: así basta un gesto
    // corto hacia arriba para recuperar la franja aunque se venga de
    // miles de píxeles de bajada.
    if((delta > 0) !== (dirAccum > 0)) dirAccum = 0;
    dirAccum += delta;
  }
  if(y <= HEADER_SHOW_AT) setTopHidden(false);
  else if(dirAccum <= -HEADER_DIR_THRESHOLD) setTopHidden(false);
  else if(dirAccum >= HEADER_DIR_THRESHOLD && y > HEADER_HIDE_AT) setTopHidden(true);
}

function refreshRouteLogoFit(){
  measureRouteLogoFit();
  updateTopRetraction(window.scrollY, 0);
}

if(headerTopBar && routeLogoEl){
  syncTopBarHeight();
  measureRouteLogoFit();
  if('ResizeObserver' in window) new ResizeObserver(syncTopBarHeight).observe(headerTopBar);
  else window.addEventListener('resize', syncTopBarHeight);

  // Las etiquetas de la ruta cambian de ancho al cambiar de idioma, y con
  // ellas la posición del primer tramo.
  document.addEventListener('petroil:i18n', refreshRouteLogoFit);
  // Las fuentes pueden terminar de asentarse después de la primera medida.
  window.addEventListener('load', refreshRouteLogoFit);

  // Los enlaces de la franja (idioma, Contacto...) siguen siendo
  // tabulables cuando está fuera de pantalla: si el foco entra ahí por
  // teclado, la franja vuelve para que se vea dónde está el foco.
  headerTopBar.addEventListener('focusin', () => { dirAccum = 0; setTopHidden(false); });
}

wideHeader.addEventListener('change', refreshRouteLogoFit);

function updateLiquidBar(pct, direction){
  if(!progressFill) return;
  progressFill.style.width = pct + '%';
  progressFill.classList.toggle('is-complete', pct >= 99.5);

  if(prefersReducedMotion) return;

  // El mismo pulso "de agua en movimiento" de la barra superior se aplica
  // también a las líneas de la ruta (escritorio y móvil), para que el
  // puntero que las recorre luzca igual mientras hay scroll activo.
  const liquidEls = [progressFill, fillLineH, fillLineV].filter(Boolean);
  liquidEls.forEach(el => {
    el.classList.add('is-scrolling');
    el.classList.remove('is-settled');
  });

  // El líquido solo se "desestabiliza" en el instante en que el movimiento
  // se reanuda después de haber estado quieto (no en cada evento de scroll).
  // El "squish" de la ola queda solo en la barra superior: en la ruta, los
  // tramos saltan de nodo en nodo y ese meneo se vería como un tirón.
  if(isSettled && direction){
    isSettled = false;
    progressFill.classList.remove('wobble-up', 'wobble-down');
    void progressFill.offsetWidth; // fuerza reflow para poder reiniciar la animación
    progressFill.classList.add(direction === 'down' ? 'wobble-down' : 'wobble-up');
  }

  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    isSettled = true;
    progressFill.classList.remove('wobble-up', 'wobble-down');
    liquidEls.forEach(el => {
      el.classList.remove('is-scrolling');
      el.classList.add('is-settled');
    });
  }, 1000);
}

// Calcula, para una lista ordenada de paradas (ya en el mismo orden en que
// aparecen en la página), cuánto se ha llenado cada tramo entre una parada
// y la siguiente. El líquido avanza de nodo en nodo exactamente cuando el
// scroll cruza esa sección real, nunca como una proporción genérica de
// toda la página.
function computeRouteState(stops, markerY){
  return stops.map(({ target }, i) => {
    const rect = target.getBoundingClientRect();
    let state = 'upcoming';
    if(rect.bottom <= markerY) state = 'passed';
    else if(rect.top <= markerY) state = 'current';

    // Fracción de avance del tramo que va DESDE esta parada HACIA la
    // siguiente (0 = aún no se llega a esta sección, 1 = ya se alcanzó
    // por completo el inicio de la siguiente sección).
    let segmentFraction = 0;
    const next = stops[i + 1];
    if(state === 'passed'){
      segmentFraction = 1;
    } else if(state === 'current' && next){
      const nextRect = next.target.getBoundingClientRect();
      const span = nextRect.top - rect.top;
      segmentFraction = span > 0 ? Math.min(1, Math.max(0, (markerY - rect.top) / span)) : 1;
    } else if(state === 'current'){
      segmentFraction = 1; // es la última parada: al alcanzarla, quedó "llena"
    }
    return { state, segmentFraction, rect };
  });
}

function applyRouteLine(stops, states, centers, fillLine, axisProp, markerY, edges){
  if(!fillLine || !centers.length || !edges) return;
  const lastIndex = centers.length - 1;
  const scrollY = window.scrollY;
  let endPx;

  if(states[0].state === 'upcoming'){
    // ANTES de "Servicios": igual que la barra superior, el trazo ya se
    // enciende antes de llegar, en proporción al scroll real que falta
    // para alcanzar esa sección (no es un valor fijo: se recalcula con la
    // posición absoluta real de la sección, así que se adapta si cambia el
    // contenido de más arriba).
    const firstRect = states[0].rect;
    const neededScroll = (firstRect.top + scrollY) - markerY;
    const fraction = neededScroll > 0 ? Math.min(1, Math.max(0, scrollY / neededScroll)) : 1;
    endPx = edges.start + fraction * (centers[0] - edges.start);
  } else if(states[lastIndex].state === 'passed'){
    // DESPUÉS de "¿Quiénes somos?": el trazo sigue llenándose con el resto
    // del scroll de la página hasta el final, en vez de quedarse fijo en
    // el último nodo como antes.
    const lastRect = states[lastIndex].rect;
    const startScroll = (lastRect.bottom + scrollY) - markerY;
    const doc = document.documentElement;
    const maxScroll = doc.scrollHeight - doc.clientHeight;
    const fraction = maxScroll > startScroll
      ? Math.min(1, Math.max(0, (scrollY - startScroll) / (maxScroll - startScroll)))
      : 1;
    endPx = centers[lastIndex] + fraction * (edges.end - centers[lastIndex]);
  } else {
    // Tramo intermedio (comportamiento original, sin cambios): el trazo
    // avanza de nodo en nodo exactamente cuando el scroll cruza esa
    // sección real, nunca como una simple proporción de toda la página.
    let progressIndex = 0;
    for(let i = 0; i < states.length; i++){
      if(states[i].state === 'passed'){ progressIndex = i + 1; continue; }
      if(states[i].state === 'current'){ progressIndex = i + states[i].segmentFraction; break; }
      break;
    }
    const clamped = Math.min(lastIndex, Math.max(0, progressIndex));
    const lowerIdx = Math.floor(clamped);
    const upperIdx = Math.min(lastIndex, lowerIdx + 1);
    const localFraction = clamped - lowerIdx;
    endPx = centers[lowerIdx] + (centers[upperIdx] - centers[lowerIdx]) * localFraction;
  }

  const startPx = edges.start;
  if(axisProp === 'width'){
    fillLine.style.left = startPx + 'px';
    fillLine.style.width = Math.max(0, endPx - startPx) + 'px';
  } else {
    fillLine.style.top = startPx + 'px';
    fillLine.style.height = Math.max(0, endPx - startPx) + 'px';
  }

  // "Choque" contra un círculo: mientras la punta cae dentro del radio
  // visual del nodo, la gota Y el círculo se ponen verde-lima juntos (ver
  // .at-node en el CSS). Es UN solo cálculo (posición en píxeles) el que
  // manda sobre ambos elementos a la vez, para que nunca queden
  // desincronizados —antes el círculo dependía del umbral de scroll-spy
  // (current/passed) y la gota de la cercanía en píxeles, y podían
  // desfasarse por un instante durante el scroll suave del clic—.
  const NODE_HIT_TOLERANCE = 8; // px, ~radio real del círculo renderizado
  const atNodeIndex = centers.findIndex(c => Math.abs(endPx - c) <= NODE_HIT_TOLERANCE);
  fillLine.classList.toggle('at-node', atNodeIndex !== -1);
  stops.forEach(({ link }, i) => {
    link.classList.toggle('at-node', i === atNodeIndex);
  });
}

function updateRouteFill(){
  const markerY = window.innerHeight * 0.35;
  if(desktopStops.length){
    const states = computeRouteState(desktopStops, markerY);
    desktopStops.forEach(({ link }, i) => {
      link.classList.remove('passed', 'current');
      link.removeAttribute('aria-current');
      if(states[i].state === 'passed') link.classList.add('passed');
      else if(states[i].state === 'current'){ link.classList.add('current'); link.setAttribute('aria-current', 'page'); }
    });
    applyRouteLine(desktopStops, states, desktopCenters, fillLineH, 'width', markerY, desktopEdges);
  }
  if(mobileStops.length){
    const states = computeRouteState(mobileStops, markerY);
    mobileStops.forEach(({ link }, i) => {
      link.classList.remove('passed', 'current');
      link.removeAttribute('aria-current');
      if(states[i].state === 'passed') link.classList.add('passed');
      else if(states[i].state === 'current'){ link.classList.add('current'); link.setAttribute('aria-current', 'page'); }
    });
    applyRouteLine(mobileStops, states, mobileCenters, fillLineV, 'height', markerY, mobileEdges);
  }
}

function onScroll(){
  const currentY = window.scrollY;
  const delta = currentY - lastScrollY;
  const direction = delta > 0 ? 'down' : delta < 0 ? 'up' : null;
  lastScrollY = currentY;

  const pct = getScrollPercent();
  updateHeaderCompaction();
  updateTopRetraction(currentY, delta);
  updateLiquidBar(pct, direction);
  updateRouteFill();
  scrollTicking = false;
}

window.addEventListener('scroll', () => {
  if(!scrollTicking){
    window.requestAnimationFrame(onScroll);
    scrollTicking = true;
  }
}, { passive: true });

window.addEventListener('resize', () => {
  refreshRouteLogoFit();
  measureCenters();
  updateRouteFill();
});

// Limpia el nombre de la animación de "desestabilización" al terminar, para
// que pueda volver a dispararse en el siguiente ciclo de movimiento.
if(progressFill){
  progressFill.addEventListener('animationend', (e) => {
    if(e.animationName === 'liquidWobbleDown' || e.animationName === 'liquidWobbleUp'){
      progressFill.classList.remove('wobble-down', 'wobble-up');
    }
  });
}

// Estado inicial (por si la página carga ya desplazada, ej. con un ancla)
measureCenters();
onScroll();

// Las fuentes y ciertos estilos pueden terminar de asentarse después de la
// carga inicial del script; se vuelve a medir para que la línea de la ruta
// quede perfectamente alineada con los nodos.
window.addEventListener('load', () => {
  measureCenters();
  updateRouteFill();
});

// Pequeño "ping" visual sobre el nodo al hacer clic en un tramo de la ruta
if(!prefersReducedMotion){
  routeLinksAll.forEach(link => {
    link.addEventListener('click', event => {
      const target = document.querySelector(link.dataset.section);
      if(target){
        event.preventDefault();
        const markerY = window.innerHeight * 0.35;
        const targetTop = target.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(0, targetTop - markerY), behavior: 'smooth' });
      }
      link.classList.remove('pulse');
      void link.offsetWidth;
      link.classList.add('pulse');
      setTimeout(() => link.classList.remove('pulse'), 550);
    });
  });
} else {
  routeLinksAll.forEach(link => {
    link.addEventListener('click', event => {
      const target = document.querySelector(link.dataset.section);
      if(!target) return;
      event.preventDefault();
      const markerY = window.innerHeight * 0.35;
      const targetTop = target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, targetTop - markerY));
    });
  });
}

// Reveal on scroll
// Se revela cuando se ve el 15 % del elemento O cuando ocupa al menos el
// 15 % de la pantalla. Lo segundo es necesario para secciones más altas que
// el viewport (p. ej. "Equipo" de quienes-somos en móvil mide ~6.200 px):
// con solo threshold .15 necesitaban 900+ px visibles a la vez, algo que
// una pantalla de celular nunca muestra, y la sección quedaba invisible.
const revealEls = document.querySelectorAll('.reveal');
if(revealEls.length){
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      if (e.intersectionRatio >= .15 || e.intersectionRect.height >= window.innerHeight * .15) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: [0, .02, .05, .1, .15] });
  revealEls.forEach(el => io.observe(el));
}

// Language dropdown — soporta varias instancias (franja superior de escritorio
// y pie del drawer móvil) sin duplicar lógica.
const langSelects = document.querySelectorAll('.lang-select');
if(langSelects.length){
  langSelects.forEach(select => {
    const btn = select.querySelector('.lang-btn');
    if(!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = select.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
      langSelects.forEach(other => {
        if(other !== select){
          other.classList.remove('open');
          other.querySelector('.lang-btn')?.setAttribute('aria-expanded', 'false');
        }
      });
    });
  });
  document.addEventListener('click', (e) => {
    langSelects.forEach(select => {
      if(select.classList.contains('open') && !select.contains(e.target)){
        select.classList.remove('open');
        select.querySelector('.lang-btn')?.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

// Menú móvil: drawer lateral ("Petroil Energy Route") con overlay, cierre por
// Escape/overlay/X/selección de enlace, focus trap, bloqueo de scroll del
// body y limpieza de estados al volver a escritorio.
const hamburger = document.getElementById('hamburger');
const navDrawer = document.getElementById('navDrawer');
const navOverlay = document.getElementById('navOverlay');
const drawerClose = document.getElementById('drawerClose');

if(hamburger && navDrawer && navOverlay){
  let lastFocused = null;

  const getFocusable = () => Array.from(
    navDrawer.querySelectorAll('a[href], button:not([disabled])')
  );

  function onDrawerKeydown(e){
    if(e.key === 'Escape'){
      e.preventDefault();
      closeDrawer();
      return;
    }
    if(e.key === 'Tab'){
      const focusables = getFocusable();
      if(!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if(e.shiftKey && document.activeElement === first){
        e.preventDefault(); last.focus();
      } else if(!e.shiftKey && document.activeElement === last){
        e.preventDefault(); first.focus();
      }
    }
  }

  function openDrawer(){
    lastFocused = document.activeElement;
    navDrawer.classList.add('open');
    navOverlay.classList.add('open');
    hamburger.classList.add('active');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Cerrar menú');
    navDrawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('nav-drawer-open');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onDrawerKeydown);
    const focusables = getFocusable();
    if(focusables.length) focusables[0].focus();
  }

  function closeDrawer(){
    navDrawer.classList.remove('open');
    navOverlay.classList.remove('open');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Abrir menú');
    navDrawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('nav-drawer-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onDrawerKeydown);
    if(lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  hamburger.addEventListener('click', () => {
    if(navDrawer.classList.contains('open')) closeDrawer(); else openDrawer();
  });
  drawerClose?.addEventListener('click', closeDrawer);
  navOverlay.addEventListener('click', closeDrawer);
  navDrawer.querySelectorAll('.drawer-link').forEach(a => a.addEventListener('click', closeDrawer));

  // Si el usuario redimensiona la ventana hacia escritorio con el drawer
  // abierto, se cierra y se limpian todos los estados (scroll, aria, foco).
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if(window.innerWidth > 720 && navDrawer.classList.contains('open')) closeDrawer();
    }, 150);
  });
}
