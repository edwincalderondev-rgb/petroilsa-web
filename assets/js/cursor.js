// ============================================
// CURSOR PERSONALIZADO — gota de agua con resplandor
// Añade un <div class="cursor-drop-wrap"> (gota SVG + resplandor) que sigue
// el puntero con una inercia mínima (lerp alto) calculada en
// requestAnimationFrame. El cursor nativo del sistema NUNCA se oculta; todo
// el conjunto es decorativo, con pointer-events:none, por lo que no puede
// interferir con clics, foco ni con el comportamiento normal de la página.
//
// Se desactiva por completo (no se crea ningún elemento ni se registra
// ningún listener) en dos casos:
//   1) prefers-reduced-motion: reduce
//   2) dispositivos sin puntero fino (táctiles), detectados con
//      matchMedia('(hover: hover) and (pointer: fine)') — más fiable que
//      revisar 'ontouchstart' en window, ya que varios portátiles táctiles
//      sí tienen puntero fino y sí deben conservar el efecto.
//
// Este archivo declara su propio "prefersReducedMotion" (en vez de asumir
// el de nav.js) para funcionar sin importar el orden de carga de scripts.
// ============================================
(function initCustomCursor(){
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(prefersReducedMotion || !supportsFinePointer) return;

  const wrap = document.createElement('div');
  wrap.className = 'cursor-drop-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML =
    '<div class="cursor-glow"></div>' +
    '<div class="cursor-drop">' +
      '<svg viewBox="0 0 24 28" xmlns="http://www.w3.org/2000/svg">' +
        '<path class="cursor-drop-path" d="M12 1C12 1 2.5 14 2.5 19.5A9.5 9.5 0 0012 29a9.5 9.5 0 009.5-9.5C21.5 14 12 1 12 1z"/>' +
      '</svg>' +
    '</div>';
  document.body.appendChild(wrap);

  // Elementos "interactivos": la gota crece y el resplandor se intensifica
  // sobre ellos (botones, enlaces, tarjetas clicables, controles de la ruta
  // de navegación, tabs del mapa, checkboxes/radios del PQRSF...).
  const GROW_SELECTOR = [
    'a', 'button', '[role="button"]',
    '.product-card', '.pillar-card', '.use-card', '.stat-card', '.news-card',
    '.doc-card', '.commit-card', '.pqrsf-type-card', '.pds-side-card', '.pds-visual-card',
    '.route-link', '.drawer-link', '.map-tab', '.lang-btn', '.quick-btn', '.hamburger',
    'input[type="checkbox"]', 'input[type="radio"]', 'input[type="submit"]'
  ].join(', ');

  // Elementos de texto y formulario: la gota se oculta para no estorbar la
  // lectura ni el cursor de texto (I-beam) nativo del navegador.
  const HIDE_SELECTOR = [
    'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"])',
    'textarea', 'select', '[contenteditable="true"]',
    'p', 'li', 'h1', 'h2', 'h3', 'h4', 'span', 'label'
  ].join(', ');

  let mouseX = 0, mouseY = 0;
  let posX = 0, posY = 0;
  let tilt = 0;
  let rafId = null;
  let visible = false;
  const dropEl = wrap.querySelector('.cursor-drop');

  function render(){
    // Suavizado por interpolación lineal, con un factor alto (0.42) para
    // que la gota alcance al puntero real casi de inmediato: se percibe
    // mucho menos "delay" que un seguimiento con lerp bajo, pero conserva
    // un mínimo de inercia para que no se sienta clavada al puntero.
    //
    // ¿Cómo ajustar la velocidad de seguimiento (el "delay")?
    //   -> Sube este 0.42 (máx. ~1) para que la gota alcance el puntero
    //      casi sin retraso; bájalo (ej. 0.15) para más inercia/flotación.
    const dx = mouseX - posX;
    const dy = mouseY - posY;
    posX += dx * 0.62;
    posY += dy * 0.62;

    // Balanceo lateral según la velocidad horizontal: refuerza la
    // sensación de "gota líquida" en movimiento.
    //
    // ¿Cómo ajustar qué tan marcado es el balanceo?
    //   1) TILT_SENSITIVITY -> multiplica el desplazamiento horizontal (dx).
    //      Súbelo para que un mismo movimiento del mouse incline mucho más
    //      la gota; bájalo para un balanceo más discreto.
    //   2) TILT_MAX -> el ángulo máximo (en grados) que puede inclinarse
    //      la gota, hacia cada lado. Súbelo para permitir giros más
    //      dramáticos; bájalo para limitar la inclinación.
    //   3) El 0.5 al final de "tilt += (targetTilt - tilt) * 0.5" controla
    //      qué tan rápido reacciona la inclinación al movimiento: más alto
    //      = respuesta más inmediata y "nerviosa"; más bajo = balanceo más
    //      suave y con más rebote.
    const TILT_SENSITIVITY = 6.4;
    const TILT_MAX = 92;
    const targetTilt = Math.max(-TILT_MAX, Math.min(TILT_MAX, dx * TILT_SENSITIVITY));
    tilt += (targetTilt - tilt) * 0.5;

    wrap.style.transform = 'translate3d(' + posX + 'px, ' + posY + 'px, 0)';
    dropEl.style.transform = 'rotate(' + tilt.toFixed(1) + 'deg)';
    rafId = requestAnimationFrame(render);
  }

  function handlePointerMove(e){
    mouseX = e.clientX;
    mouseY = e.clientY;
    if(!visible){
      visible = true;
      posX = mouseX; posY = mouseY; // evita que "viaje" desde la esquina la primera vez
      wrap.style.transform = 'translate3d(' + posX + 'px, ' + posY + 'px, 0)';
      wrap.classList.add('is-visible');
    }
    const growTarget = e.target.closest(GROW_SELECTOR);
    const hideTarget = !growTarget && e.target.closest(HIDE_SELECTOR);
    wrap.classList.toggle('is-grow', !!growTarget);
    wrap.classList.toggle('is-hidden', !!hideTarget);
  }

  window.addEventListener('pointermove', handlePointerMove, { passive: true });

  // Oculta el conjunto si el puntero sale de la ventana (ej. hacia la barra
  // de pestañas) y lo restaura al volver a entrar, evitando que quede
  // "flotando" sobre un punto obsoleto.
  document.addEventListener('mouseleave', () => {
    wrap.classList.remove('is-visible');
    visible = false;
  });

  // Pequeña "salpicadura" al hacer clic: un anillo que se expande y se
  // desvanece en el punto exacto del clic, en línea con el motivo líquido
  // ya presente en el sitio (barra de progreso líquida). Se limita a
  // clics con el botón principal para no dispararse en cada scroll táctil
  // ni en clics secundarios.
  function spawnSplash(x, y){
    const splash = document.createElement('div');
    splash.className = 'cursor-splash';
    // Importante: la posición se fija con left/top (no con transform),
    // porque la animación CSS de la salpicadura también anima "transform"
    // (para el escalado) y lo sobrescribiría por completo, haciendo que
    // la salpicadura "desaparezca" en la esquina superior izquierda.
    splash.style.left = x + 'px';
    splash.style.top = y + 'px';
    document.body.appendChild(splash);
    splash.addEventListener('animationend', () => splash.remove(), { once: true });
  }
  window.addEventListener('pointerdown', (e) => {
    if(e.button === 0 && e.pointerType !== 'touch') spawnSplash(e.clientX, e.clientY);
  });

  // Ahorro de batería/CPU: se detiene el bucle de animación cuando la
  // pestaña no está visible, y se retoma solo si ya hubo movimiento real
  // del puntero en esta página.
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){
      if(rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if(!rafId){
      rafId = requestAnimationFrame(render);
    }
  });

  rafId = requestAnimationFrame(render);
})();
