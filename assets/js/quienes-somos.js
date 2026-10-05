// ============================================================
// QUIÉNES SOMOS — interacciones propias de la página
// (se carga después de nav.js y aira.js, que ya manejan navbar,
// scroll progress, reveal, menú móvil, idioma y chat)
// ============================================================

// ============================================================
// Perfiles del equipo directivo — modal (no acordeón inline).
// Se eligió modal en vez de expandir la tarjeta porque expandir
// inline: (a) hacía que la foto del Chairman tapara el texto al
// no crecer la columna de foto al mismo ritmo que el texto, y
// (b) generaba huecos en blanco en las tarjetas vecinas no
// seleccionadas, que también se estiraban visualmente. El modal
// mantiene todas las tarjetas del grid con altura fija siempre.
const leaderModalOverlay = document.getElementById('leaderModalOverlay');
const leaderModalClose = document.getElementById('leaderModalClose');
const leaderModalPhoto = document.getElementById('leaderModalPhoto');
const leaderModalChip = document.getElementById('leaderModalChip');
const leaderModalName = document.getElementById('leaderModalName');
const leaderModalRole = document.getElementById('leaderModalRole');
const leaderModalBio = document.getElementById('leaderModalBio');

let leaderModalReturnFocus = null;

function openLeaderModal(card){
  const photo = card.querySelector('.leader-photo img');
  const chip = card.querySelector('.leader-chip');
  const name = card.querySelector('.leader-name');
  const role = card.querySelector('.leader-role');
  const bio = card.querySelector('.bio-full');
  if(!leaderModalOverlay || !photo || !bio) return;

  leaderModalPhoto.src = photo.src;
  leaderModalPhoto.alt = photo.alt;
  leaderModalChip.innerHTML = chip.innerHTML;
  leaderModalName.textContent = name.textContent;
  leaderModalRole.textContent = role.textContent;
  leaderModalBio.innerHTML = bio.innerHTML;

  leaderModalReturnFocus = document.activeElement;
  leaderModalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  if(leaderModalClose) leaderModalClose.focus({ preventScroll:true });
}

function closeLeaderModal(){
  if(!leaderModalOverlay) return;
  if(!leaderModalOverlay.classList.contains('open')) return;
  leaderModalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  if(leaderModalReturnFocus && leaderModalReturnFocus.focus) leaderModalReturnFocus.focus({ preventScroll:true });
  leaderModalReturnFocus = null;
}

document.querySelectorAll('.bio-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const card = btn.closest('.leader-card');
    if(card) openLeaderModal(card);
  });
});

if(leaderModalClose) leaderModalClose.addEventListener('click', closeLeaderModal);
if(leaderModalOverlay){
  leaderModalOverlay.addEventListener('click', (e) => {
    if(e.target === leaderModalOverlay) closeLeaderModal();
  });
}
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') closeLeaderModal();
});

// Dibuja la línea de ascenso de "La ruta a 2031" conectando cada parada
// (se recalcula si cambia el tamaño de ventana; en móvil no se usa)
const routeTrack = document.querySelector('.qs-route-track');
const routeLine = document.querySelector('.qs-route-line');

function drawRouteLine(){
  if(!routeTrack || !routeLine) return;
  if(window.innerWidth <= 820){ routeLine.innerHTML = ''; return; }

  const stops = routeTrack.querySelectorAll('.qs-route-stop');
  const trackRect = routeTrack.getBoundingClientRect();
  const points = [];
  stops.forEach(stop => {
    const dot = stop.querySelector('.qs-route-dot');
    const r = dot.getBoundingClientRect();
    const x = (r.left + r.width / 2) - trackRect.left;
    const y = (r.top + r.height / 2) - trackRect.top;
    points.push(x + ',' + y);
  });

  routeLine.innerHTML =
    '<svg width="100%" height="100%" style="position:absolute; inset:0; overflow:visible;">' +
      '<polyline points="' + points.join(' ') + '" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/>' +
    '</svg>';
}

window.addEventListener('load', drawRouteLine);
window.addEventListener('resize', () => {
  clearTimeout(window.__routeResizeT);
  window.__routeResizeT = setTimeout(drawRouteLine, 150);
});

// Reveal on scroll también aplica a los elementos con clase .reveal
// dentro de esta página (el IntersectionObserver de nav.js ya cubre
// document.querySelectorAll('.reveal'), no se duplica aquí).
