// Selector de idioma (ES / EN / PT) — traducción client-side por diccionario JSON.
// Ya implementado en todas las páginas del sitio. Ver CLAUDE.md.
//
// Cómo funciona:
// - <body data-i18n-page="assets/i18n/<pagina>.json"> apunta al diccionario de ESTA página
//   (textos exclusivos de esa página: hero, ficha técnica, artículo, etc.).
// - Además de ese diccionario, SIEMPRE se carga "common.json" (misma carpeta que <pagina>.json)
//   con las claves compartidas por toda la web (nav.*, footer.*, chat.*). El diccionario de la
//   página puede sobrescribir una clave de common.json si la necesita distinta.
// - Cualquier texto marcado con data-i18n="clave" se reemplaza (textContent) con el valor
//   de esa clave en el idioma activo.
// - Texto que necesita HTML interno (negritas, listas, <p>) usa data-i18n-html="clave" en
//   vez de data-i18n, y se aplica con innerHTML.
// - El placeholder de un <input>/<textarea> usa data-i18n-placeholder="clave".
// - El title (tooltip) de un elemento usa data-i18n-title="clave" — lo usa el "SGI"
//   del navbar para explicar la sigla al pasar el ratón.
// - El idioma elegido se guarda en localStorage y se reaplica en cada carga de página.
(function () {
  const STORAGE_KEY = 'petroil-lang';
  const DEFAULT_LANG = 'es';
  const SUPPORTED = ['es', 'en', 'pt'];

  function getSavedLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch (e) { /* localStorage no disponible (modo privado, etc.) */ }
    return DEFAULT_LANG;
  }

  function applyDict(dict, lang) {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const entry = dict[el.getAttribute('data-i18n')];
      if (entry && entry[lang]) el.textContent = entry[lang];
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const entry = dict[el.getAttribute('data-i18n-html')];
      if (entry && entry[lang]) el.innerHTML = entry[lang];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const entry = dict[el.getAttribute('data-i18n-placeholder')];
      if (entry && entry[lang]) el.setAttribute('placeholder', entry[lang]);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const entry = dict[el.getAttribute('data-i18n-title')];
      if (entry && entry[lang]) el.setAttribute('title', entry[lang]);
    });
    // Aviso para los textos que generan otros scripts (p. ej. el contador del
    // catálogo en productos.js): ya pueden pedir su traducción con t().
    document.dispatchEvent(new CustomEvent('petroil:i18n', { detail: { lang } }));
  }

  function updateLangUI(lang) {
    document.documentElement.setAttribute('lang', lang);
    document.querySelectorAll('[data-lang-current]').forEach((el) => {
      el.textContent = lang.toUpperCase();
    });
    document.querySelectorAll('.lang-dropdown a[data-lang]').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-lang') === lang);
    });
  }

  let currentDict = null;

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* noop */ }
    updateLangUI(lang);
    if (currentDict) applyDict(currentDict, lang);
  }

  function wireDropdowns() {
    document.querySelectorAll('.lang-dropdown a[data-lang]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        setLang(a.getAttribute('data-lang'));
        const select = a.closest('.lang-select');
        if (select) {
          select.classList.remove('open');
          select.querySelector('.lang-btn')?.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  function init() {
    const lang = getSavedLang();
    updateLangUI(lang);
    wireDropdowns();

    const dictPath = document.body.getAttribute('data-i18n-page');
    if (!dictPath) return; // página aún no tiene diccionario — el selector queda visible pero inactivo

    const commonPath = dictPath.replace(/[^/]+$/, 'common.json');

    function loadJson(path) {
      return fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error('i18n: no se pudo cargar ' + path))));
    }

    Promise.all([
      loadJson(commonPath).catch((err) => { console.warn(err); return {}; }),
      loadJson(dictPath).catch((err) => { console.warn(err); return {}; }),
    ]).then(([common, page]) => {
      currentDict = Object.assign({}, common, page);
      applyDict(currentDict, lang);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function t(key) {
    const entry = currentDict && currentDict[key];
    return entry && entry[getSavedLang()];
  }

  window.PetroilI18n = { setLang, t };
})();
