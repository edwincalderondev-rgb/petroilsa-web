// Hero particles (aire que asciende) — heros de todo el sitio.
// 1) #heroParticles: el hero de cada página (22 partículas, como siempre).
// 2) Cualquier otro contenedor con data-particles="N" (N = cantidad, 14 por
//    defecto): para reutilizar el mismo "burbujeo" en fondos azules que no
//    son el hero (p. ej. "Ruta 2031", tarjeta del Chairman y CTA de
//    nosotros/quienes-somos.html). El contenedor debe usar la clase
//    .hero-particles (hero.css) y su padre, position:relative + overflow:hidden.
function fillParticles(host, n){
  for(let i=0;i<n;i++){
    const p = document.createElement('span');
    p.className = 'particle';
    const size = 4 + Math.random()*10;
    p.style.width = size+'px';
    p.style.height = size+'px';
    p.style.left = Math.random()*100+'%';
    p.style.animationDuration = (7 + Math.random()*8)+'s';
    p.style.animationDelay = (Math.random()*10)+'s';
    host.appendChild(p);
  }
}

const particleHost = document.getElementById('heroParticles');
if(particleHost) fillParticles(particleHost, 22);

document.querySelectorAll('[data-particles]').forEach(host => {
  if(host === particleHost) return;
  fillParticles(host, parseInt(host.getAttribute('data-particles'), 10) || 14);
});
