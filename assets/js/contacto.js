// ============================================
// CONTACTO (contacto.html) — formulario de cotización / información /
// postulación ("Trabaja con nosotros").
//
// El sitio es estático (sin backend): el formulario NO envía datos a un
// servidor. Flujo:
//   1) Valida lo diligenciado.
//   2) Abre un diálogo "Revisa tu solicitud" con el mensaje ya redactado
//      (incluye un número de referencia) y deja elegir el canal:
//      WhatsApp · Gmail · Outlook.com · Outlook (Microsoft 365) ·
//      app de correo predeterminada (mailto:) · copiar el texto.
//   3) Abre el canal elegido con el mensaje listo; el usuario solo presiona
//      "Enviar" (ni WhatsApp ni los correos permiten enviarlo solos).
//
// Dos modos (2026-10-01), según la opción del paso 1:
//   · comercial — Cotización / Información técnica / Otra consulta: el flujo
//     de siempre, con productos, volumen y WhatsApp.
//   · empleo — "Trabaja con nosotros": perfil profesional en vez de productos,
//     y SOLO canales de correo. La hoja de vida no se sube aquí (no hay
//     servidor que la reciba): se adjunta en el correo que se abre. Por eso
//     el botón dice "Adjuntar HDV y enviar" y la revisión lo recuerda, para
//     que nadie dude de pulsarlo por no ver dónde adjuntar el archivo.
//   Los bloques de cada modo llevan data-only="comercial|empleo" en el HTML;
//   los fieldsets del modo inactivo además van disabled (un campo disabled
//   no se valida, así que sus "required" no estorban al otro modo).
//
// Por qué hay botones de Gmail/Outlook además de mailto: "mailto:" abre
// el cliente de correo PREDETERMINADO del sistema (en muchos Windows es
// Outlook de escritorio aunque el usuario use Gmail en el navegador).
//
// Preselección desde las fichas técnicas y el chat:
//   contacto.html?producto=P-50%2F10#formulario
//   contacto.html?producto=P-50%2F10&tipo=Información técnica
//   contacto.html?tipo=empleo#formulario   (también "trabaja" o "talento")
// ============================================
const contactForm = document.getElementById('contactForm');

if(contactForm){
  const WA_NUMBER = '573113337046';
  const MAIL_TO = 'contacto@petroilsa.com';
  // Destino de las postulaciones. Hoy es el mismo buzón de contacto: si Petroil
  // abre uno de talento humano, basta con cambiar esta constante.
  const MAIL_TO_JOBS = 'contacto@petroilsa.com';
  const TIPO_SIN_PRODUCTO = 'Otra consulta';
  const TIPO_EMPLEO = 'Trabaja con nosotros';

  const productBoxes = Array.from(contactForm.querySelectorAll('input[name="productos"]'));
  const tipoRadios = Array.from(contactForm.querySelectorAll('input[name="tipo"]'));
  const productsGroup = document.getElementById('ctProductos');
  const productsError = document.getElementById('ctProductosError');
  const successPanel = document.getElementById('ctSuccess');
  const successTitle = document.getElementById('ctSuccessTitle');
  const successText = document.getElementById('ctSuccessText');
  // #ctRef y #ctSuccessRef (y sus gemelos *Job) NO se guardan en constantes:
  // viven dentro de un data-i18n-html y i18n.js los reemplaza al traducir, así
  // que una referencia tomada al cargar queda apuntando a un nodo desconectado
  // y el usuario veía "PTL-000000-0000" en vez de su número real.
  const setRef = (id, ref) => { const el = document.getElementById(id); if(el) el.textContent = ref; };
  const reopenBtn = document.getElementById('ctReopen');
  const resetBtn = document.getElementById('ctReset');
  const dialog = document.getElementById('ctReview');
  const previewEl = document.getElementById('ctPreview');
  const copyBtn = document.getElementById('ctCopy');
  const copyLabel = copyBtn ? copyBtn.querySelector('span') : null;
  // Todo lo que depende del modo, dentro y fuera del formulario (el diálogo y
  // el panel de éxito son hermanos del <form>).
  const modeScope = contactForm.closest('.ct-wrap') || document;
  const modeFieldsets = Array.from(contactForm.querySelectorAll('fieldset[data-only]'));

  let current = null;     // { ref, data, mode } de la solicitud en revisión
  let lastChannel = null; // último canal usado, para "volver a abrir"

  // Strings de la UI reactiva (después de enviar) traducidas vía i18n.js;
  // el mensaje que se ENVÍA a Petroil (whatsappText/emailText) se mantiene
  // siempre en español porque el equipo que lo recibe es local.
  const t = (key, fallback) => (window.PetroilI18n && window.PetroilI18n.t(key)) || fallback;

  // ---------- Utilidades ----------
  const field = (name) => (contactForm.elements[name] ? contactForm.elements[name].value.trim() : '');
  const tipoValue = () => (tipoRadios.find(r => r.checked) || {}).value || '';
  const modeOf = (tipo) => (tipo === TIPO_EMPLEO ? 'empleo' : 'comercial');

  function makeRef(mode){
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const rand = String(Math.floor(1000 + Math.random() * 9000));
    return (mode === 'empleo' ? 'TAL-' : 'PTL-') + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + rand;
  }

  function nowLabel(){
    return new Date().toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  function collect(){
    return {
      tipo: tipoValue(),
      nombre: field('nombre'),
      empresa: field('empresa'),
      correo: field('correo'),
      telefono: field('telefono'),
      ciudad: field('ciudad'),
      productos: productBoxes.filter(box => box.checked).map(box => box.dataset.label || box.value),
      volumen: field('volumen'),
      mensaje: field('mensaje'),
      // Modo empleo
      profesion: field('profesion'),
      formacion: field('formacion'),
      area: field('area'),
      experiencia: field('experiencia'),
      sede: field('sede'),
      perfilUrl: field('perfilUrl'),
      presentacion: field('presentacion'),
      fecha: nowLabel()
    };
  }

  // ---------- Modo del formulario ----------
  function applyMode(){
    const mode = modeOf(tipoValue());
    modeScope.dataset.ctMode = mode;
    // toggleAttribute y no el.hidden: los iconos del botón son <svg>, y en un
    // SVGElement la propiedad hidden no existe (asignarla no toca el atributo).
    modeScope.querySelectorAll('[data-only]').forEach(el => { el.toggleAttribute('hidden', el.dataset.only !== mode); });
    modeFieldsets.forEach(fs => { fs.disabled = fs.dataset.only !== mode; });
    if(mode === 'empleo'){
      // El aviso de "elige al menos un producto" no aplica a una postulación.
      productsGroup.classList.remove('is-invalid');
      productsError.hidden = true;
    }
  }

  // ---------- Mensajes ----------
  // WhatsApp: *negrita* y emojis como marcadores visuales de cada bloque.
  function whatsappText(ref, d){
    const L = [];
    L.push('Hola, equipo comercial de Petroil 👋');
    L.push('Les escribo desde el sitio web con la siguiente solicitud:');
    L.push('');
    L.push('📋 *' + d.tipo.toUpperCase() + '*');
    L.push('Ref: ' + ref);
    L.push('');
    L.push('👤 *Datos de contacto*');
    L.push('• Nombre: ' + d.nombre);
    if(d.empresa) L.push('• Empresa: ' + d.empresa);
    L.push('• Correo: ' + d.correo);
    L.push('• Teléfono: ' + d.telefono);
    if(d.ciudad) L.push('• Ciudad / entrega: ' + d.ciudad);
    if(d.productos.length){
      L.push('');
      L.push('⛽ *Producto(s) de interés*');
      d.productos.forEach(p => L.push('• ' + p));
    }
    if(d.volumen){
      L.push('');
      L.push('📦 *Volumen / frecuencia:* ' + d.volumen);
    }
    if(d.mensaje){
      L.push('');
      L.push('💬 *Mensaje*');
      L.push(d.mensaje);
    }
    L.push('');
    L.push('✅ Acepto la política de tratamiento de datos personales de Petroil S.A.');
    L.push('🕒 ' + d.fecha);
    return L.join('\n');
  }

  // Correo: texto plano sobrio (sin asteriscos ni emojis).
  function emailSubject(ref, d){
    if(modeOf(d.tipo) === 'empleo'){
      return 'Postulación «Trabaja con nosotros» — ' + d.nombre + (d.profesion ? ' (' + d.profesion + ')' : '') + ' · Ref. ' + ref;
    }
    return d.tipo + ' — ' + d.nombre + (d.empresa ? ' (' + d.empresa + ')' : '') + ' · Ref. ' + ref;
  }
  function emailText(ref, d){
    if(modeOf(d.tipo) === 'empleo') return jobEmailText(ref, d);
    const L = [];
    L.push('Hola, equipo comercial de Petroil:');
    L.push('');
    L.push('Les escribo desde el sitio web con la siguiente solicitud.');
    L.push('');
    L.push('TIPO DE SOLICITUD: ' + d.tipo);
    L.push('REFERENCIA: ' + ref);
    L.push('');
    L.push('DATOS DE CONTACTO');
    L.push('- Nombre: ' + d.nombre);
    if(d.empresa) L.push('- Empresa: ' + d.empresa);
    L.push('- Correo: ' + d.correo);
    L.push('- Teléfono: ' + d.telefono);
    if(d.ciudad) L.push('- Ciudad / entrega: ' + d.ciudad);
    if(d.productos.length){
      L.push('');
      L.push('PRODUCTO(S) DE INTERÉS');
      d.productos.forEach(p => L.push('- ' + p));
    }
    if(d.volumen){
      L.push('');
      L.push('VOLUMEN / FRECUENCIA: ' + d.volumen);
    }
    if(d.mensaje){
      L.push('');
      L.push('MENSAJE');
      L.push(d.mensaje);
    }
    L.push('');
    L.push('Acepto la política de tratamiento de datos personales de Petroil S.A.');
    L.push('Enviado el ' + d.fecha + (/\.$/.test(d.fecha) ? '' : '.')); // "p. m." ya trae punto
    L.push('');
    L.push('Saludos,');
    L.push(d.nombre);
    return L.join('\n');
  }
  // Postulación: la línea "Adjunto mi hoja de vida" queda escrita en el cuerpo
  // a propósito — es lo último que ve la persona antes de pulsar Enviar.
  function jobEmailText(ref, d){
    const L = [];
    L.push('Hola, equipo de Petroil:');
    L.push('');
    L.push('Les escribo desde el sitio web para postularme en «Trabaja con nosotros». Adjunto mi hoja de vida.');
    L.push('');
    L.push('REFERENCIA: ' + ref);
    L.push('');
    L.push('DATOS PERSONALES');
    L.push('- Nombre: ' + d.nombre);
    L.push('- Correo: ' + d.correo);
    L.push('- Teléfono: ' + d.telefono);
    if(d.ciudad) L.push('- Ciudad de residencia: ' + d.ciudad);
    L.push('');
    L.push('PERFIL PROFESIONAL');
    L.push('- Profesión u oficio: ' + d.profesion);
    L.push('- Nivel de formación: ' + d.formacion);
    L.push('- Área de interés: ' + d.area);
    L.push('- Experiencia: ' + d.experiencia);
    if(d.sede) L.push('- Sede de preferencia: ' + d.sede);
    if(d.perfilUrl) L.push('- LinkedIn / portafolio: ' + d.perfilUrl);
    if(d.presentacion){
      L.push('');
      L.push('PRESENTACIÓN');
      L.push(d.presentacion);
    }
    L.push('');
    L.push('ADJUNTO: hoja de vida.');
    L.push('');
    L.push('Acepto la política de tratamiento de datos personales de Petroil S.A. y autorizo el uso de mis datos para procesos de selección.');
    L.push('Enviado el ' + d.fecha + (/\.$/.test(d.fecha) ? '' : '.')); // "p. m." ya trae punto
    L.push('');
    L.push('Saludos,');
    L.push(d.nombre);
    return L.join('\n');
  }

  // ---------- Canales ----------
  const enc = encodeURIComponent;
  const mailTo = (d) => (modeOf(d.tipo) === 'empleo' ? MAIL_TO_JOBS : MAIL_TO);
  // Texto de "listo" de cada canal: en modo empleo recuerda adjuntar la HDV.
  const doneText = (key, fallback, jobFallback) => {
    const job = current && current.mode === 'empleo';
    const email = current ? mailTo(current.data) : MAIL_TO;
    return (job ? t('job.' + key + '.done', jobFallback) : t('channel.' + key + '.done', fallback)).replace(/\{email\}/g, email);
  };
  const channels = {
    whatsapp: {
      label: 'WhatsApp',
      url: (ref, d) => 'https://wa.me/' + WA_NUMBER + '?text=' + enc(whatsappText(ref, d)),
      get done() { return t('channel.whatsapp.done', 'Abrimos WhatsApp con tu solicitud ya escrita. <b>Presiona «Enviar» en WhatsApp</b> para que llegue a nuestro asesor comercial.'); }
    },
    gmail: {
      label: 'Gmail',
      url: (ref, d) => 'https://mail.google.com/mail/?view=cm&fs=1&to=' + enc(mailTo(d)) + '&su=' + enc(emailSubject(ref, d)) + '&body=' + enc(emailText(ref, d)),
      get done() { return doneText('gmail', 'Abrimos Gmail con el correo listo para {email}. <b>Revisa y presiona «Enviar»</b>. Si no habías iniciado sesión, Gmail te lo pedirá primero.', 'Abrimos Gmail con tu postulación lista para {email}. <b>Adjunta tu hoja de vida con el clip 📎 y presiona «Enviar»</b>. Si no habías iniciado sesión, Gmail te lo pedirá primero.'); }
    },
    outlook: {
      label: 'Outlook.com',
      url: (ref, d) => 'https://outlook.live.com/mail/0/deeplink/compose?to=' + enc(mailTo(d)) + '&subject=' + enc(emailSubject(ref, d)) + '&body=' + enc(emailText(ref, d)),
      get done() { return doneText('outlook', 'Abrimos Outlook con el correo listo para {email}. <b>Revisa y presiona «Enviar»</b>.', 'Abrimos Outlook con tu postulación lista para {email}. <b>Adjunta tu hoja de vida con el clip 📎 y presiona «Enviar»</b>.'); }
    },
    outlook365: {
      label: 'Outlook (Microsoft 365)',
      url: (ref, d) => 'https://outlook.office.com/mail/deeplink/compose?to=' + enc(mailTo(d)) + '&subject=' + enc(emailSubject(ref, d)) + '&body=' + enc(emailText(ref, d)),
      get done() { return doneText('outlook365', 'Abrimos Outlook de tu cuenta empresarial con el correo listo para {email}. <b>Revisa y presiona «Enviar»</b>.', 'Abrimos Outlook de tu cuenta empresarial con tu postulación lista para {email}. <b>Adjunta tu hoja de vida con el clip 📎 y presiona «Enviar»</b>.'); }
    },
    mailto: {
      label: 'tu aplicación de correo',
      url: (ref, d) => 'mailto:' + mailTo(d) + '?subject=' + enc(emailSubject(ref, d)) + '&body=' + enc(emailText(ref, d)),
      sameTab: true,
      get done() { return doneText('mailto', 'Intentamos abrir la aplicación de correo predeterminada de tu equipo. Si no se abrió ninguna, vuelve y elige Gmail u Outlook, o copia el texto.', 'Intentamos abrir la aplicación de correo predeterminada de tu equipo con tu postulación. <b>Adjunta tu hoja de vida antes de enviar.</b> Si no se abrió ninguna, vuelve y elige Gmail u Outlook, o copia el texto.'); }
    }
  };

  function openChannel(key){
    const ch = channels[key];
    if(!ch || !current) return;
    if(key === 'whatsapp' && current.mode === 'empleo') return; // la HDV va por correo
    const url = ch.url(current.ref, current.data);
    if(ch.sameTab) window.location.href = url;
    else window.open(url, '_blank', 'noopener');
    lastChannel = key;
    showSuccess(key);
  }

  // ---------- Validación ----------
  // Al menos un producto, salvo en una consulta general o una postulación.
  function validateProducts(){
    const tipo = tipoValue();
    const ok = tipo === TIPO_SIN_PRODUCTO || tipo === TIPO_EMPLEO || productBoxes.some(box => box.checked);
    productsGroup.classList.toggle('is-invalid', !ok);
    productsError.hidden = ok;
    return ok;
  }

  function validate(){
    const nativeOk = contactForm.checkValidity();
    const productsOk = validateProducts();
    if(!nativeOk){
      contactForm.reportValidity(); // enfoca y describe el primer campo inválido
    } else if(!productsOk){
      productsGroup.scrollIntoView({ behavior:'smooth', block:'center' });
      productBoxes[0]?.focus({ preventScroll:true });
    }
    return nativeOk && productsOk;
  }

  // ---------- UI ----------
  function openReview(){
    const data = collect();
    const mode = modeOf(data.tipo);
    current = { ref: makeRef(mode), data, mode };
    setRef(mode === 'empleo' ? 'ctRefJob' : 'ctRef', current.ref);
    previewEl.textContent = mode === 'empleo'
      ? emailText(current.ref, data)
      : whatsappText(current.ref, data).replace(/\*/g, '');
    if(copyLabel) copyLabel.textContent = t('review.copyText', 'Copiar texto');
    if(typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    // En modo empleo el botón con autofocus (WhatsApp) está oculto: el foco
    // va al primer canal de correo.
    if(mode === 'empleo') dialog.querySelector('[data-channel="gmail"]')?.focus();
  }

  function closeReview(){
    if(dialog.open) (typeof dialog.close === 'function') ? dialog.close() : dialog.removeAttribute('open');
  }

  function showSuccess(key){
    closeReview();
    const ch = channels[key];
    const job = current.mode === 'empleo';
    successTitle.textContent = job
      ? t('job.success.title', '¡Tu postulación está lista!')
      : (key === 'mailto' ? t('success.titleMailto', 'Tu correo está listo') : t('success.title', '¡Tu solicitud está lista!'));
    successText.innerHTML = ch.done;
    setRef(job ? 'ctSuccessRefJob' : 'ctSuccessRef', current.ref);
    reopenBtn.querySelector('span').textContent = t('success.reopenWith', 'Abrir {channel} de nuevo').replace('{channel}', ch.label);
    contactForm.hidden = true;
    successPanel.hidden = false;
    successPanel.scrollIntoView({ behavior:'smooth', block:'center' });
    successTitle.focus({ preventScroll:true });
  }

  async function copyText(){
    if(!current) return;
    const text = emailText(current.ref, current.data);
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch(e){
      // Respaldo para navegadores sin Clipboard API (o file://)
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      dialog.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch(err){ ok = false; }
      ta.remove();
    }
    if(copyLabel) copyLabel.textContent = ok ? t('review.copySuccess', '¡Copiado! Pégalo donde prefieras') : t('review.copyError', 'No se pudo copiar');
  }

  // ---------- Eventos ----------
  productBoxes.forEach(box => box.addEventListener('change', () => { if(!productsError.hidden) validateProducts(); }));
  tipoRadios.forEach(radio => radio.addEventListener('change', () => {
    applyMode();
    if(!productsError.hidden) validateProducts();
  }));

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if(validate()) openReview();
  });

  dialog.querySelectorAll('[data-channel]').forEach(btn => {
    btn.addEventListener('click', () => openChannel(btn.dataset.channel));
  });
  dialog.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeReview));
  // Clic en el fondo oscuro (fuera de la tarjeta) cierra el diálogo
  dialog.addEventListener('click', (e) => { if(e.target === dialog) closeReview(); });
  if(copyBtn) copyBtn.addEventListener('click', copyText);

  if(reopenBtn){
    reopenBtn.addEventListener('click', () => { if(lastChannel) openChannel(lastChannel); });
  }
  const otherChannelBtn = document.getElementById('ctOtherChannel');
  if(otherChannelBtn){
    otherChannelBtn.addEventListener('click', () => {
      if(!current) return;
      if(typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    });
  }

  if(resetBtn){
    resetBtn.addEventListener('click', () => {
      contactForm.reset();
      applyMode();
      productsGroup.classList.remove('is-invalid');
      productsError.hidden = true;
      successPanel.hidden = true;
      contactForm.hidden = false;
      current = null; lastChannel = null;
      contactForm.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  }

  // Preselección por URL
  const params = new URLSearchParams(window.location.search);
  const preProducto = params.get('producto');
  const preTipo = params.get('tipo');
  const TIPO_ALIAS = { empleo: TIPO_EMPLEO, trabaja: TIPO_EMPLEO, talento: TIPO_EMPLEO, hdv: TIPO_EMPLEO };
  if(preProducto) productBoxes.forEach(box => { if(box.value === preProducto) box.checked = true; });
  if(preTipo){
    const wanted = TIPO_ALIAS[preTipo.toLowerCase()] || preTipo;
    tipoRadios.forEach(radio => { if(radio.value === wanted) radio.checked = true; });
  }
  // También cubre el caso de un navegador que restaura la opción elegida al
  // volver atrás: el modo siempre sale de lo que esté marcado al cargar.
  applyMode();
}
