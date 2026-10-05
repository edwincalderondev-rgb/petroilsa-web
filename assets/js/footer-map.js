// Pestañas del mapa del footer (Bogotá / Santa Marta / Esquivensa Barranquilla) — presente en el footer sitewide.
//
// Cada sede cambia tres cosas a la vez: el mapa embebido (OpenStreetMap), el enlace
// "Abrir en Google Maps" y la dirección escrita debajo de ese enlace.
//   · Los enlaces de Google Maps son los cortos oficiales que entregó la empresa
//     (2026-10-01). Las coordenadas del embed salen de esos mismos enlaces, para que
//     el pin del mapa y el de Google Maps caigan en el mismo punto.
//   · La dirección NO se escribe desde aquí: los tres <span data-map-address> ya
//     están en el HTML (traducidos por i18n.js) y esto solo muestra el de la sede
//     activa. Antes vivían en una columna "Contacto" del pie, que se retiró.
const mapFrame = document.getElementById('mapFrame');
const gmapsLink = document.getElementById('gmapsLink');
const osm = (lat, lon) =>
  'https://www.openstreetmap.org/export/embed.html?bbox=' +
  (lon - 0.01).toFixed(4) + '%2C' + (lat - 0.01).toFixed(4) + '%2C' +
  (lon + 0.01).toFixed(4) + '%2C' + (lat + 0.01).toFixed(4) +
  '&layer=mapnik&marker=' + lat.toFixed(4) + '%2C' + lon.toFixed(4);
const maps = {
  bogota:     { src: osm(4.6908, -74.0386),  gmaps: 'https://maps.app.goo.gl/X6YV8dd6fGqJEsPR6' },
  santamarta: { src: osm(11.2215, -74.1658), gmaps: 'https://maps.app.goo.gl/vgEdgvvcWjUFqFLZ8' },
  esquivensa: { src: osm(10.9573, -74.7611), gmaps: 'https://maps.app.goo.gl/vyEt6SVBJ9c6eANa7' }
};
if(mapFrame){
  const tabs = document.querySelectorAll('.map-tab');
  const addresses = document.querySelectorAll('[data-map-address]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.map;
      if(!maps[key]) return;
      tabs.forEach(t => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      mapFrame.src = maps[key].src;
      if(gmapsLink) gmapsLink.href = maps[key].gmaps;
      addresses.forEach(a => { a.hidden = a.dataset.mapAddress !== key; });
    });
  });
}
