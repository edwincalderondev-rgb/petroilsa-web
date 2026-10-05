// Visor de galería a pantalla completa (lightbox).
//
// Mejora progresiva: convierte CUALQUIER `.photo-gallery` de la página en una
// galería navegable. Sin este script las fotos siguen viéndose en la rejilla,
// solo que no se amplían — por eso no hay marcado del visor en el HTML.
//
// Lo usan `sostenibilidad/compromiso-social.html` y la nota de prensa de la
// visita de la embajada. Para añadirlo a una página nueva basta con enlazar
// este archivo; el CSS vive en `assets/css/article.css` (junto a
// `.photo-gallery`), así que esa hoja también tiene que estar cargada.
//
// Cada <img> de la rejilla admite dos atributos opcionales:
//   data-full     → ruta de una versión mayor que la de la rejilla (si no, usa src)
//   data-cap-key  → clave de i18n para el pie de foto (si no, usa el alt)
//
// Accesibilidad: cada foto pasa a ser un <button>, el visor es un diálogo modal
// con el foco atrapado, se cierra con Esc y devuelve el foco a la foto de origen.
// Se navega con ← →, con las flechas, con las miniaturas o deslizando el dedo.
//
// El visor se cuelga de <body> a propósito y NUNCA dentro de la sección: un
// `transform` en un ancestro (p. ej. `.reveal`) rompe `position:fixed`. Ver CLAUDE.md.
(function () {
  const galleries = Array.from(document.querySelectorAll('.photo-gallery'));
  if (!galleries.length) return;

  // Traducción con respaldo en español: PetroilI18n todavía no tiene su
  // diccionario cuando se construye el visor (lo trae por fetch), y bajo
  // file:// no lo carga nunca.
  function t(key, fallback) {
    const v = window.PetroilI18n && window.PetroilI18n.t(key);
    return v || fallback;
  }

  const TXT = {
    dialog: ['gallery.dialog', 'Visor de fotos'],
    open:   ['gallery.open',   'Ampliar foto'],
    close:  ['gallery.close',  'Cerrar el visor'],
    prev:   ['gallery.prev',   'Foto anterior'],
    next:   ['gallery.next',   'Foto siguiente'],
    goTo:   ['gallery.goTo',   'Ir a la foto'],
  };
  const tx = (k) => t(TXT[k][0], TXT[k][1]);

  const SVG_X    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const SVG_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const SVG_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  const SVG_ZOOM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/></svg>';

  // ── 1. Rejilla: cada foto pasa a ser un botón ───────────────────────────
  const items = [];   // { src, cap, capKey }
  const openers = []; // el botón que abrió el visor, para devolverle el foco

  galleries.forEach((grid) => {
    Array.from(grid.querySelectorAll('img')).forEach((img) => {
      const i = items.length;
      items.push({
        src: img.getAttribute('data-full') || img.getAttribute('src'),
        cap: img.getAttribute('alt') || '',
        capKey: img.getAttribute('data-cap-key') || '',
      });

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'photo-gallery-item';
      btn.setAttribute('aria-haspopup', 'dialog');
      img.parentNode.insertBefore(btn, img);
      btn.appendChild(img);
      btn.insertAdjacentHTML('beforeend', '<span class="photo-gallery-zoom" aria-hidden="true">' + SVG_ZOOM + '</span>');
      btn.addEventListener('click', () => open(i));
      openers.push(btn);
    });
  });

  if (!items.length) return;

  // ── 2. El visor ─────────────────────────────────────────────────────────
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.id = 'photoLightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.hidden = true;
  lb.innerHTML =
    '<div class="lightbox-backdrop" data-lb-dismiss></div>' +
    '<div class="lightbox-inner">' +
      '<div class="lightbox-bar">' +
        '<span class="lightbox-count" aria-hidden="true"><b class="lightbox-i">1</b> / <span class="lightbox-n">1</span></span>' +
        '<button type="button" class="lightbox-btn lightbox-close">' + SVG_X + '</button>' +
      '</div>' +
      '<div class="lightbox-stage" data-lb-dismiss>' +
        '<button type="button" class="lightbox-arrow lightbox-prev">' + SVG_PREV + '</button>' +
        '<figure class="lightbox-figure">' +
          '<img class="lightbox-img" alt="" decoding="async">' +
          '<figcaption class="lightbox-cap"></figcaption>' +
        '</figure>' +
        '<button type="button" class="lightbox-arrow lightbox-next">' + SVG_NEXT + '</button>' +
      '</div>' +
      '<div class="lightbox-thumbs"></div>' +
    '</div>' +
    '<p class="lightbox-live" role="status" aria-live="polite"></p>';
  document.body.appendChild(lb);

  const elImg    = lb.querySelector('.lightbox-img');
  const elCap    = lb.querySelector('.lightbox-cap');
  const elI      = lb.querySelector('.lightbox-i');
  const elN      = lb.querySelector('.lightbox-n');
  const elThumbs = lb.querySelector('.lightbox-thumbs');
  const elLive   = lb.querySelector('.lightbox-live');
  const btnClose = lb.querySelector('.lightbox-close');
  const btnPrev  = lb.querySelector('.lightbox-prev');
  const btnNext  = lb.querySelector('.lightbox-next');

  elN.textContent = String(items.length);

  // Miniaturas y flechas solo tienen sentido con más de una foto.
  if (items.length > 1) {
    items.forEach((it, i) => {
      const th = document.createElement('button');
      th.type = 'button';
      th.className = 'lightbox-thumb';
      th.innerHTML = '<img src="' + it.src + '" alt="" loading="lazy" decoding="async">';
      th.addEventListener('click', () => show(i));
      elThumbs.appendChild(th);
    });
  } else {
    elThumbs.remove();
    btnPrev.remove();
    btnNext.remove();
  }

  const thumbs = Array.from(lb.querySelectorAll('.lightbox-thumb'));
  let index = 0;
  let lastFocus = null;

  function capOf(it) {
    return (it.capKey && t(it.capKey, '')) || it.cap;
  }

  function labels() {
    lb.setAttribute('aria-label', tx('dialog'));
    btnClose.setAttribute('aria-label', tx('close'));
    if (btnPrev.isConnected) btnPrev.setAttribute('aria-label', tx('prev'));
    if (btnNext.isConnected) btnNext.setAttribute('aria-label', tx('next'));
    thumbs.forEach((th, i) => th.setAttribute('aria-label', tx('goTo') + ' ' + (i + 1)));
    openers.forEach((btn, i) => {
      const c = capOf(items[i]);
      btn.setAttribute('aria-label', tx('open') + (c ? ': ' + c : ''));
    });
  }

  function show(i) {
    index = (i + items.length) % items.length;
    const it = items[index];
    const cap = capOf(it);
    elImg.src = it.src;
    elImg.alt = cap;
    elCap.textContent = cap;
    elCap.hidden = !cap;
    elI.textContent = String(index + 1);
    elLive.textContent = (index + 1) + ' / ' + items.length + (cap ? ' — ' + cap : '');
    thumbs.forEach((th, n) => {
      const on = n === index;
      th.classList.toggle('is-active', on);
      th.setAttribute('aria-current', on ? 'true' : 'false');
      if (on) th.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
  }

  function open(i) {
    lastFocus = document.activeElement;
    labels();
    show(i);
    lb.hidden = false;
    void lb.offsetWidth; // reflow: sin esto la transición de entrada no se ve
    lb.classList.add('is-open');
    document.body.classList.add('lightbox-open');
    btnClose.focus();
  }

  function close() {
    lb.classList.remove('is-open');
    document.body.classList.remove('lightbox-open');
    const done = () => { lb.hidden = true; elImg.removeAttribute('src'); };
    // Espera al fundido de salida; si no hay animación, cierra ya.
    const ms = parseFloat(getComputedStyle(lb).transitionDuration) * 1000;
    if (ms > 0) setTimeout(done, ms); else done();
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }

  // ── 3. Interacción ──────────────────────────────────────────────────────
  btnClose.addEventListener('click', close);
  if (btnPrev.isConnected) btnPrev.addEventListener('click', () => show(index - 1));
  if (btnNext.isConnected) btnNext.addEventListener('click', () => show(index + 1));

  // Clic en el fondo o en la zona vacía del escenario: cierra.
  lb.addEventListener('click', (e) => {
    if (e.target.hasAttribute && e.target.hasAttribute('data-lb-dismiss')) close();
  });

  lb.addEventListener('keydown', (e) => {
    if (e.key === 'Escape')     { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); show(index - 1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); return; }
    if (e.key !== 'Tab') return;
    // Foco atrapado: el visor es modal, el Tab no debe volver a la página.
    const f = Array.from(lb.querySelectorAll('button')).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Deslizar con el dedo (móvil).
  let x0 = null;
  lb.addEventListener('touchstart', (e) => { x0 = e.changedTouches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 45) show(index + (dx < 0 ? 1 : -1));
  }, { passive: true });

  // Al cambiar de idioma hay que rehacer etiquetas y pie de foto.
  document.addEventListener('petroil:i18n', () => {
    labels();
    if (!lb.hidden) show(index);
  });

  labels();
})();
