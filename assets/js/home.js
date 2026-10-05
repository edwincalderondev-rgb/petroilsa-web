// Product videos: se reproducen con el cursor (desktop) o con el toque (móvil).
// El resto del tiempo se ve la imagen (.product-poster). Lo usan index.html
// (tarjetas de home.css) y productos.html (tarjetas propias de productos.css):
// ambas conservan los mismos nombres de clase para reutilizar esta lógica.
const productVideos = document.querySelectorAll('.product-video');
if(productVideos.length){

  // Precarga en dos pasos, para no disparar 10 descargas completas a la vez:
  //  1) Cuando la tarjeta se acerca a la pantalla (300px antes) solo se
  //     piden los metadatos (preload="metadata", unos pocos KB).
  //  2) La descarga completa arranca con la intención real de verlo
  //     (pointerenter/focus/touch) — ver warmUp() más abajo.
  // Antes se hacía preload="auto" + load() en todas las tarjetas a 600px:
  // el navegador abría ~10 peticiones de video simultáneas y, al superar
  // su límite de conexiones por dominio o al recargar la página, las
  // abortaba — eran las filas en rojo "(canceled)" del inspector de red.
  // Nota: los videos siempre pueden mostrar alguna fila "canceled" en
  // Chrome/Edge: el navegador corta la primera petición y sigue con
  // peticiones por rangos (206). Eso es normal y no es un error.
  const preloadObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        const v = entry.target;
        if(v.preload === 'none'){ v.preload = 'metadata'; v.load(); }
        obs.unobserve(v);
      }
    });
  }, { rootMargin: '300px 0px', threshold: 0 });

  function warmUp(v){
    if(v.preload !== 'auto'){ v.preload = 'auto'; }
  }

  // Pausa automática cuando la tarjeta sale de pantalla (ahorra batería/datos,
  // sobre todo en móvil donde el video puede quedar reproduciéndose de fondo).
  const visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if(!entry.isIntersecting) entry.target.pause(); });
  }, { threshold: 0 });

  productVideos.forEach(v => {
    v.pause(); // por si el navegador intenta arrancarlo solo
    preloadObserver.observe(v);
    visibilityObserver.observe(v);

    const card = v.closest('.product-card');
    if(!card) return;

    function playVideo(){
      warmUp(v);
      try { v.currentTime = 0; } catch(e) { /* aún sin metadata cargada, se ignora */ }
      const p = v.play();
      if(p && typeof p.catch === 'function') p.catch(() => { /* autoplay bloqueado, sigue la imagen */ });
    }
    function pauseVideo(){ v.pause(); }

    // Desktop: mouse y teclado
    card.addEventListener('mouseenter', playVideo);
    card.addEventListener('mouseleave', pauseVideo);
    // Accesibilidad: la tarjeta es un <a>, navegable con teclado
    card.addEventListener('focus', playVideo);
    card.addEventListener('blur', pauseVideo);

    // Móvil: muchos navegadores activan el estado :hover del CSS con el
    // primer toque (por eso la imagen ya se ocultaba y el video "aparecía"),
    // pero nadie llamaba a .play(). Con este listener, el toque también
    // dispara la reproducción real, evitando la pantalla en blanco.
    card.addEventListener('touchstart', playVideo, { passive: true });
  });
}
