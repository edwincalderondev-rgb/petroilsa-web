// ============================================
// CATÁLOGO DE PRODUCTOS (productos.html)
// Filtra por familia (pestañas), por sector (selector), por texto
// (buscador) y pagina el resultado.
//
// Las 15 tarjetas viven en el HTML, no se generan aquí: así el catálogo
// completo sigue siendo visible e indexable si el JS falla o tarda, y
// este script solo se encarga de mostrar/ocultar y paginar.
// ============================================
const catalogSection = document.getElementById('catalogo');

if(catalogSection){
  const cards = Array.from(catalogSection.querySelectorAll('.product-card'));
  const tabs = Array.from(catalogSection.querySelectorAll('.pb-tab'));
  const searchInput = document.getElementById('prodSearch');
  const sectorSelect = document.getElementById('prodSector');
  const pagination = document.getElementById('prodPagination');
  const emptyState = document.getElementById('prodEmpty');
  const liveCount = document.getElementById('prodCount');
  const PER_PAGE = 10;

  const state = { cat:'todos', sector:'todos', query:'', page:1 };

  // Textos generados aquí (contador y paginación), traducidos con i18n.js.
  // El español queda como respaldo mientras carga el diccionario.
  const t = (key, fallback, vars) => {
    let s = (window.PetroilI18n && window.PetroilI18n.t(key)) || fallback;
    Object.keys(vars || {}).forEach(k => { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  };

  // Búsqueda tolerante a tildes y mayúsculas: "diesel" encuentra "Diésel".
  // Los diacríticos que .normalize('NFD') separa de su letra base son el
  // rango U+0300 a U+036F. La clase se arma con fromCharCode a propósito:
  // así el archivo queda en ASCII puro y no quedan caracteres combinantes
  // sueltos (invisibles) en el código fuente.
  const DIACRITICS = new RegExp(
    '[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']',
    'g'
  );
  const normalize = (str) => str
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '');

  function matches(card){
    if(state.cat !== 'todos' && card.dataset.cat !== state.cat) return false;
    if(state.sector !== 'todos'){
      const sectors = (card.dataset.sectors || '').split(' ');
      if(!sectors.includes(state.sector)) return false;
    }
    if(state.query && !normalize(card.dataset.search || '').includes(state.query)) return false;
    return true;
  }

  // Lista de páginas a dibujar, con elipsis cuando hay muchas
  // (con 15 productos son 2 páginas, pero el catálogo va a crecer).
  function pageList(total, current){
    if(total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const list = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if(start > 2) list.push('…');
    for(let i = start; i <= end; i++) list.push(i);
    if(end < total - 1) list.push('…');
    list.push(total);
    return list;
  }

  function arrowButton(direction, disabled, targetPage){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pb-page';
    btn.disabled = disabled;
    btn.setAttribute('aria-label', direction === 'prev' ? t('catalog.page.prev', 'Página anterior') : t('catalog.page.next', 'Página siguiente'));
    btn.innerHTML = direction === 'prev'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
    if(!disabled) btn.addEventListener('click', () => goToPage(targetPage));
    return btn;
  }

  function renderPagination(totalPages){
    pagination.innerHTML = '';
    if(totalPages <= 1) return;

    pagination.appendChild(arrowButton('prev', state.page === 1, state.page - 1));

    pageList(totalPages, state.page).forEach(item => {
      if(item === '…'){
        const dots = document.createElement('span');
        dots.className = 'pb-dots';
        dots.textContent = '…';
        pagination.appendChild(dots);
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pb-page';
      btn.textContent = item;
      if(item === state.page){
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.setAttribute('aria-label', t('catalog.page.goto', 'Ir a la página {n}', { n: item }));
        btn.addEventListener('click', () => goToPage(item));
      }
      pagination.appendChild(btn);
    });

    pagination.appendChild(arrowButton('next', state.page === totalPages, state.page + 1));
  }

  function render(){
    const visible = cards.filter(matches);
    const totalPages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
    if(state.page > totalPages) state.page = totalPages;

    const from = (state.page - 1) * PER_PAGE;
    const pageCards = visible.slice(from, from + PER_PAGE);

    cards.forEach(card => { card.hidden = !pageCards.includes(card); });

    emptyState.classList.toggle('is-visible', visible.length === 0);
    renderPagination(totalPages);

    if(liveCount){
      liveCount.textContent = visible.length === 0
        ? t('catalog.count.none', 'Ningún producto coincide con la búsqueda.')
        : (visible.length === 1
            ? t('catalog.count.one', '{n} producto encontrado', { n: 1 })
            : t('catalog.count.many', '{n} productos encontrados', { n: visible.length })) +
          (totalPages > 1 ? t('catalog.count.page', ' · página {page} de {total}', { page: state.page, total: totalPages }) : '');
    }
  }

  function scrollToCatalog(){
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const header = document.getElementById('siteHeader');
    const offset = header ? header.offsetHeight + 16 : 20;
    const top = catalogSection.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function goToPage(page){
    state.page = page;
    render();
    scrollToCatalog();
  }

  function setCategory(cat){
    state.cat = cat;
    state.page = 1;
    tabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.cat === cat)));
    render();
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => setCategory(tab.dataset.cat));
  });

  if(searchInput){
    searchInput.addEventListener('input', () => {
      state.query = normalize(searchInput.value.trim());
      state.page = 1;
      render();
    });
  }

  if(sectorSelect){
    sectorSelect.addEventListener('change', () => {
      state.sector = sectorSelect.value;
      state.page = 1;
      render();
    });
  }

  // Las tarjetas de familia y los íconos de sector son enlaces reales a
  // #catalogo (funcionan sin JS); con JS, además, dejan el catálogo ya
  // filtrado por lo que el usuario acaba de tocar.
  document.querySelectorAll('[data-go-cat]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if(sectorSelect){ sectorSelect.value = 'todos'; state.sector = 'todos'; }
      setCategory(link.dataset.goCat);
      scrollToCatalog();
    });
  });

  document.querySelectorAll('[data-go-sector]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      state.sector = link.dataset.goSector;
      if(sectorSelect) sectorSelect.value = state.sector;
      setCategory('todos');
      scrollToCatalog();
    });
  });

  // Filtros desde la URL, para llegar al catálogo ya filtrado desde otras
  // páginas: productos.html?sector=maritimo#catalogo (usos del index) o
  // productos.html?cat=fuel-oils#catalogo (fichas técnicas). Valores que no
  // existan en las pestañas/selector se ignoran.
  const urlParams = new URLSearchParams(window.location.search);
  const urlCat = urlParams.get('cat');
  const urlSector = urlParams.get('sector');
  if(urlCat && tabs.some(tab => tab.dataset.cat === urlCat)){
    state.cat = urlCat;
    tabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.cat === urlCat)));
  }
  if(urlSector && sectorSelect && Array.from(sectorSelect.options).some(opt => opt.value === urlSector)){
    state.sector = urlSector;
    sectorSelect.value = urlSector;
  }

  render();
  // i18n.js carga su diccionario después de este script (y el usuario puede
  // cambiar de idioma): se vuelve a pintar para traducir contador/paginación.
  document.addEventListener('petroil:i18n', render);
}
