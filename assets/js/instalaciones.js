// ============================================
// INSTALACIONES (instalaciones/*.html) — refinería de Santa Marta y Esquivensa.
//
// Mejora progresiva: sin este script la página se ve completa (cifras ya
// escritas en el HTML, video del recorrido con sus controles nativos).
// Lo que añade:
//   1) Video de fondo del hero: se pausa si la persona pidió menos
//      movimiento o ahorro de datos (queda el póster) y cuando el hero sale
//      de la pantalla, para no gastar batería decodificando algo que no se ve.
//   2) Cifras del hero: cuentan hasta su valor la primera vez que se ven, con
//      el separador de miles del idioma activo (166.100 en ES y PT, 166,100
//      en EN). Se reescriben al cambiar de idioma (evento petroil:i18n).
//      Marcado: <span data-count="166100" data-prefix="+" data-suffix="…">.
//      Los años (data-plain) nunca llevan separador: "2007", no "2.007".
//   3) Recorrido aéreo: póster con botón de reproducir propio. El botón va
//      con [hidden] en el HTML y aquí se muestra; sin JS se ve el <video>
//      nativo con sus controles.
// ============================================
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var LOCALES = { es: 'es-CO', en: 'en-US', pt: 'pt-BR' };

  function locale() {
    var lang = (document.documentElement.getAttribute('lang') || 'es').slice(0, 2);
    return LOCALES[lang] || 'es-CO';
  }

  /* ---------- 1 · Video de fondo del hero ---------- */
  var heroVideo = document.querySelector('.inst-hero video');
  if (heroVideo) {
    if (reduceMotion || saveData) {
      heroVideo.removeAttribute('autoplay');
      heroVideo.pause();
      heroVideo.preload = 'none';
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { var p = heroVideo.play(); if (p && p.catch) p.catch(function () {}); }
          else heroVideo.pause();
        });
      }, { threshold: 0.05 }).observe(heroVideo);
    }
  }

  /* ---------- 2 · Cifras animadas ---------- */
  var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));

  function render(el, value) {
    var plain = el.hasAttribute('data-plain');
    var txt = plain ? String(Math.round(value)) : Math.round(value).toLocaleString(locale());
    el.textContent = (el.getAttribute('data-prefix') || '') + txt + (el.getAttribute('data-suffix') || '');
  }

  function animate(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    if (reduceMotion) { render(el, target); el.setAttribute('data-done', '1'); return; }
    var start = null, DURATION = 1600;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / DURATION);
      var eased = 1 - Math.pow(1 - t, 3); // ease-out cúbico: arranca rápido, frena al llegar
      render(el, target * eased);
      if (t < 1) requestAnimationFrame(step);
      else el.setAttribute('data-done', '1');
    }
    requestAnimationFrame(step);
  }

  if (counters.length) {
    var canAnimate = 'IntersectionObserver' in window && !reduceMotion;
    // Sin animación se pinta ya el valor con el formato del idioma activo (el
    // HTML trae el de ES). Con animación no: pintar el final y luego contar
    // desde 0 daría un parpadeo; el conteo arranca solo al entrar en pantalla.
    if (!canAnimate) counters.forEach(function (el) { render(el, parseFloat(el.getAttribute('data-count')) || 0); });
    if (canAnimate) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          animate(e.target);
        });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { io.observe(el); });
    }
    // Al cambiar de idioma solo se reescriben las cifras ya terminadas: las
    // que están contando leen el idioma en cada fotograma, y las que aún no
    // se ven tomarán el formato correcto al empezar su conteo.
    document.addEventListener('petroil:i18n', function () {
      counters.forEach(function (el) {
        if (!canAnimate || el.getAttribute('data-done') === '1') render(el, parseFloat(el.getAttribute('data-count')) || 0);
      });
    });
  }

  /* ---------- Tooltip de la barra de capacidades ----------
     El texto del tooltip vive en data-tip (CSS no puede leer otra cosa) y
     i18n.js no traduce atributos: se rehace a partir de la etiqueta del
     segmento, que sí se traduce, más su porcentaje. */
  function syncBarTips() {
    document.querySelectorAll('.inst-bar-seg[data-pct]').forEach(function (seg) {
      var label = seg.querySelector('.inst-bar-txt');
      if (label) seg.setAttribute('data-tip', label.textContent.trim() + ' · ' + seg.getAttribute('data-pct') + ' %');
    });
  }
  syncBarTips();
  document.addEventListener('petroil:i18n', syncBarTips);

  /* ---------- 3 · Recorrido aéreo ---------- */
  document.querySelectorAll('.inst-film-frame').forEach(function (frame) {
    var video = frame.querySelector('video');
    var poster = frame.querySelector('.inst-film-poster');
    if (!video || !poster) return;
    poster.hidden = false;
    video.removeAttribute('controls');
    poster.addEventListener('click', function () {
      frame.classList.add('is-playing');
      video.setAttribute('controls', '');
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
      video.focus({ preventScroll: true });
    });
    video.addEventListener('ended', function () {
      frame.classList.remove('is-playing');
      video.removeAttribute('controls');
      video.currentTime = 0;
      poster.focus({ preventScroll: true });
    });
  });
})();
