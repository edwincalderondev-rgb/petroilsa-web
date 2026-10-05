// ============================================
// PQRSF (legal/pqrsf.html) — radicación de peticiones, quejas, reclamos,
// sugerencias y felicitaciones.
//
// Igual que contacto.js, el sitio es estático (sin backend): NO se envía nada
// a un servidor. Flujo:
//   1) Formulario en 4 pasos con progreso y un "ticket" lateral que se llena
//      en vivo (referencia, tipo, solicitante, asunto, plazo de respuesta).
//   2) Validación en línea; la aceptación de la política de datos es
//      obligatoria antes de poder revisar/enviar.
//   3) Diálogo "Revisa y envía": muestra el correo ya redactado y deja elegir
//      Gmail · Outlook.com · Outlook (Microsoft 365) · app predeterminada
//      (mailto:) · copiar texto. Destino ÚNICO: pqrsf@petroilsa.com
//      (por decisión de dirección, PQRSF no usa WhatsApp ni teléfono).
//   4) El usuario presiona "Enviar" en su correo (y adjunta soportes si tiene).
//
// Preselección por URL (valor sin tildes, insensible a mayúsculas):
//   legal/pqrsf.html?tipo=reclamo#radicar
// ============================================
const pqForm = document.getElementById('pqForm');

if(pqForm){
  const MAIL_TO = 'pqrsf@petroilsa.com';
  const MSG_MIN = 20;

  // Letra de la referencia, clase de color y plazo de respuesta (días hábiles).
  const TYPES = {
    'Petición':     { letter:'P', cls:'pq-c--p', days:15 },
    'Queja':        { letter:'Q', cls:'pq-c--q', days:15 },
    'Reclamo':      { letter:'R', cls:'pq-c--r', days:15 },
    'Sugerencia':   { letter:'S', cls:'pq-c--s', days:8 },
    'Felicitación': { letter:'F', cls:'pq-c--f', days:8 }
  };
  const TYPE_CLASSES = Object.values(TYPES).map(x => x.cls);

  const $ = (id) => document.getElementById(id);
  const t = (key, fallback) => (window.PetroilI18n && window.PetroilI18n.t(key)) || fallback;
  const els = pqForm.elements;

  const tipoRadios = Array.from(pqForm.querySelectorAll('input[name="tipo"]'));
  const typesGroup = pqForm.querySelector('.pq-types');
  const typeInfos = Array.from(pqForm.querySelectorAll('.pq-type-info [data-for]'));
  const conditionalFields = Array.from(pqForm.querySelectorAll('[data-when]'));
  const progressFill = $('pqProgressFill');
  const progressSteps = Array.from(pqForm.querySelectorAll('.pq-progress-steps li'));
  const consentBox = $('pqConsent');
  const privacidad = $('pqPrivacidad');
  const empresaField = $('pqEmpresaField');
  const telOpt = $('pqTelOpt');
  const telReq = $('pqTelReq');
  const countEl = $('pqCount');
  const counterEl = $('pqCounter');

  const ticket = $('pqTicket');
  const tk = { ref:$('tkRef'), tipo:$('tkTipo'), nombre:$('tkNombre'), asunto:$('tkAsunto'), plazo:$('tkPlazo'), fecha:$('tkFecha'), meter:$('tkMeter'), steps:$('tkSteps') };

  const successPanel = $('pqSuccess');
  const successTitle = $('pqSuccessTitle');
  const successText = $('pqSuccessText');
  const successRef = $('pqSuccessRef');
  const next3 = $('pqNext3');
  const reopenBtn = $('pqReopen');
  const dialog = $('pqReview');
  const previewEl = $('pqPreview');
  const copyBtn = $('pqCopy');
  const copyLabel = copyBtn ? copyBtn.querySelector('span') : null;
  const toast = $('toast');

  let refSeed = makeSeed();
  let attempted = false;   // tras el primer intento de envío se valida en vivo
  let current = null;      // { ref, data } de la solicitud en revisión
  let lastChannel = null;

  // ---------- Utilidades ----------
  const val = (name) => (els[name] ? String(els[name].value || '').trim() : '');
  const radioVal = (name) => (pqForm.querySelector('input[name="' + name + '"]:checked') || {}).value || '';
  const isJuridica = () => radioVal('persona') === 'Persona jurídica';
  const wantsCall = () => radioVal('respuesta') === 'Llamada telefónica';
  const typeLabel = (tipo) => {
    const radio = tipoRadios.find(r => r.value === tipo);
    const name = radio && radio.parentElement.querySelector('.pq-type-name');
    return name ? name.textContent.trim() : tipo;
  };
  const daysLabel = (n) => t('ticket.dias', '{n} días hábiles').replace('{n}', n);

  function makeSeed(){
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + Math.floor(1000 + Math.random() * 9000);
  }
  const makeRef = (tipo) => 'PQRSF-' + (TYPES[tipo] ? TYPES[tipo].letter : '•') + '-' + refSeed;
  const nowLabel = () => new Date().toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const dateLabel = () => new Date().toLocaleDateString(document.documentElement.lang || 'es', { day:'2-digit', month:'short', year:'numeric' });

  function showToast(msg){
    if(!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  async function copy(text){
    try { await navigator.clipboard.writeText(text); return true; }
    catch(e){
      // Respaldo para navegadores sin Clipboard API (o file://)
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      (dialog.open ? dialog : document.body).appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch(err){ ok = false; }
      ta.remove();
      return ok;
    }
  }

  // ---------- Validación ----------
  const errorFor = (input) => input && $(input.getAttribute('aria-describedby')?.split(' ')[0] || '');

  function setFieldError(input, message){
    const err = errorFor(input);
    input.classList.toggle('is-invalid', !!message);
    input.classList.toggle('is-valid', !message && !!input.value.trim());
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if(err){
      err.hidden = !message;
      if(message) err.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg><span></span>';
      if(message) err.querySelector('span').textContent = message;
    }
  }

  // Devuelve el mensaje de error del campo ('' si es válido).
  function fieldMessage(input){
    const v = input.value.trim();
    const required = input.required;
    if(required && !v) return t('err.required', 'Este campo es obligatorio.');
    if(!v) return '';
    if(input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return t('err.email', 'Escribe un correo válido, por ejemplo nombre@correo.com.');
    if(input.type === 'tel' && !/^[0-9+()\s-]{7,20}$/.test(v)) return t('err.tel', 'Usa solo números, espacios y los signos + ( ) -, mínimo 7 dígitos.');
    if(input.name === 'mensaje' && v.length < MSG_MIN) return t('err.min', 'Cuéntanos un poco más: mínimo {n} caracteres.').replace('{n}', MSG_MIN);
    return '';
  }

  const textInputs = () => ['empresa', 'nombre', 'correo', 'telefono', 'asunto', 'mensaje'].map(n => els[n]).filter(Boolean);

  function validateAll(){
    let first = null;
    const flag = (el) => { if(!first) first = el; };

    const tipoOk = !!radioVal('tipo');
    typesGroup.classList.toggle('is-invalid', !tipoOk);
    $('errTipo').hidden = tipoOk;
    if(!tipoOk) flag(tipoRadios[0]);

    textInputs().forEach(input => {
      if(input.closest('[hidden]')) { setFieldError(input, ''); return; }
      const msg = fieldMessage(input);
      setFieldError(input, msg);
      if(msg) flag(input);
    });

    const consentOk = privacidad.checked;
    $('errPrivacidad').hidden = consentOk;
    consentBox.classList.remove('is-invalid');
    if(!consentOk){
      void consentBox.offsetWidth; // reinicia la animación de "shake"
      consentBox.classList.add('is-invalid');
      flag(privacidad);
    }

    if(first){
      const target = first === privacidad ? consentBox : (first.closest('.pq-field') || typesGroup);
      target.scrollIntoView({ behavior:'smooth', block:'center' });
      first.focus({ preventScroll:true });
      return false;
    }
    return true;
  }

  // ---------- Estado visual ----------
  function stepsDone(){
    const ok = (input) => input && !fieldMessage(input);
    return [
      !!radioVal('tipo'),
      ok(els.nombre) && ok(els.correo) && (!isJuridica() || ok(els.empresa)) && ok(els.telefono),
      ok(els.asunto) && ok(els.mensaje),
      privacidad.checked
    ];
  }

  function refresh(){
    const done = stepsDone();
    const count = done.filter(Boolean).length;
    progressSteps.forEach((li, i) => li.classList.toggle('done', done[i]));
    progressFill.style.width = (count / 4 * 100) + '%';

    const tipo = radioVal('tipo');
    const info = TYPES[tipo];
    ticket.classList.remove(...TYPE_CLASSES);
    if(info) ticket.classList.add(info.cls);
    tk.ref.textContent = makeRef(tipo);
    tk.tipo.classList.toggle('is-set', !!info);
    tk.tipo.textContent = info ? typeLabel(tipo) : t('ticket.noType', 'Sin tipo seleccionado');
    setTk(tk.nombre, isJuridica() && val('empresa') ? val('empresa') : val('nombre'));
    setTk(tk.asunto, val('asunto'));
    setTk(tk.plazo, info ? daysLabel(info.days) : '');
    setTk(tk.fecha, dateLabel());
    tk.meter.style.width = (count / 4 * 100) + '%';
    tk.steps.textContent = count + ' / 4';

    consentBox.classList.toggle('is-checked', privacidad.checked);
  }

  function setTk(el, text){
    const next = text || '—';
    if(el.textContent === next) return;
    el.textContent = next;
    el.title = text || '';
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  function applyType(){
    const tipo = radioVal('tipo');
    typeInfos.forEach(box => { box.hidden = box.dataset.for !== tipo; });
    conditionalFields.forEach(field => {
      field.hidden = !tipo || !field.dataset.when.split(' ').includes(tipo);
    });
    if(tipo){
      typesGroup.classList.remove('is-invalid');
      $('errTipo').hidden = true;
      els.mensaje.placeholder = t('msg.ph.' + TYPES[tipo].letter.toLowerCase(), els.mensaje.placeholder);
    }
    refresh();
  }

  function applyPersona(){
    const jur = isJuridica();
    empresaField.hidden = !jur;
    els.empresa.required = jur;
    if(!jur) setFieldError(els.empresa, '');
    refresh();
  }

  function applyRespuesta(){
    const call = wantsCall();
    els.telefono.required = call;
    telOpt.hidden = call;
    telReq.hidden = !call;
    if(attempted || !call) setFieldError(els.telefono, fieldMessage(els.telefono));
    refresh();
  }

  function updateCounter(){
    const n = els.mensaje.value.length;
    countEl.textContent = n;
    counterEl.classList.toggle('near', n > 1400);
  }

  // ---------- Mensaje ----------
  function collect(){
    const doc = val('documento');
    return {
      tipo: radioVal('tipo'),
      persona: radioVal('persona'),
      empresa: isJuridica() ? val('empresa') : '',
      nombre: val('nombre'),
      documento: doc ? val('docTipo') + ' ' + doc : '',
      correo: val('correo'),
      telefono: val('telefono'),
      ciudad: val('ciudad'),
      relacion: val('relacion'),
      asunto: val('asunto'),
      pedido: els.pedido.closest('[hidden]') ? '' : val('pedido'),
      fechaHecho: els.fechaHecho.closest('[hidden]') ? '' : val('fechaHecho'),
      mensaje: val('mensaje'),
      respuesta: radioVal('respuesta'),
      fecha: nowLabel()
    };
  }

  // El correo SIEMPRE va en español: lo recibe el equipo local de Petroil.
  const emailSubject = (ref, d) => 'PQRSF · ' + d.tipo + ' — ' + d.asunto + ' · Ref. ' + ref;

  function emailText(ref, d){
    const L = [];
    const plazo = TYPES[d.tipo] ? TYPES[d.tipo].days : 15;
    L.push('Señores Petroil S.A. — Atención PQRSF:');
    L.push('');
    L.push('Por medio de este mensaje presento la siguiente solicitud a través del sitio web.');
    L.push('');
    L.push('TIPO DE SOLICITUD: ' + d.tipo.toUpperCase());
    L.push('REFERENCIA: ' + ref);
    L.push('ASUNTO: ' + d.asunto);
    L.push('');
    L.push('DATOS DEL SOLICITANTE');
    L.push('- Tipo de persona: ' + d.persona);
    if(d.empresa) L.push('- Razón social: ' + d.empresa);
    L.push('- Nombre: ' + d.nombre);
    if(d.documento) L.push('- Documento: ' + d.documento);
    L.push('- Correo: ' + d.correo);
    if(d.telefono) L.push('- Teléfono: ' + d.telefono);
    if(d.ciudad) L.push('- Ciudad: ' + d.ciudad);
    if(d.relacion) L.push('- Relación con Petroil: ' + d.relacion);
    if(d.pedido || d.fechaHecho){
      L.push('');
      L.push('DATOS DEL CASO');
      if(d.pedido) L.push('- Pedido / remisión / factura: ' + d.pedido);
      if(d.fechaHecho) L.push('- Fecha en que ocurrió: ' + d.fechaHecho.split('-').reverse().join('/'));
    }
    L.push('');
    L.push('DESCRIPCIÓN');
    L.push(d.mensaje);
    L.push('');
    L.push('MEDIO DE RESPUESTA PREFERIDO: ' + d.respuesta);
    L.push('PLAZO DE RESPUESTA: máximo ' + plazo + ' días hábiles.');
    L.push('');
    L.push('AUTORIZACIÓN DE TRATAMIENTO DE DATOS PERSONALES');
    L.push('Declaro que he leído y acepto la Política de protección de datos personales de Petroil S.A. y autorizo el tratamiento de mis datos para gestionar esta solicitud, conforme a la Ley 1581 de 2012. Aceptado el ' + d.fecha + '.');
    L.push('');
    L.push('Cordialmente,');
    L.push(d.nombre + (d.empresa ? ' — ' + d.empresa : ''));
    return L.join('\n');
  }

  // ---------- Canales ----------
  const enc = encodeURIComponent;
  const withEmail = (s) => s.replace(/\{email\}/g, MAIL_TO);
  const channels = {
    gmail: {
      label: 'Gmail',
      url: (ref, d) => 'https://mail.google.com/mail/?view=cm&fs=1&to=' + enc(MAIL_TO) + '&su=' + enc(emailSubject(ref, d)) + '&body=' + enc(emailText(ref, d)),
      get done(){ return withEmail(t('channel.gmail.done', 'Abrimos Gmail con tu PQRSF lista para <b>{email}</b>. Revisa, adjunta tus soportes si los tienes y <b>presiona «Enviar»</b>.')); }
    },
    outlook: {
      label: 'Outlook.com',
      url: (ref, d) => 'https://outlook.live.com/mail/0/deeplink/compose?to=' + enc(MAIL_TO) + '&subject=' + enc(emailSubject(ref, d)) + '&body=' + enc(emailText(ref, d)),
      get done(){ return withEmail(t('channel.outlook.done', 'Abrimos Outlook con tu PQRSF lista para <b>{email}</b>. Revisa, adjunta tus soportes si los tienes y <b>presiona «Enviar»</b>.')); }
    },
    outlook365: {
      label: 'Outlook (Microsoft 365)',
      url: (ref, d) => 'https://outlook.office.com/mail/deeplink/compose?to=' + enc(MAIL_TO) + '&subject=' + enc(emailSubject(ref, d)) + '&body=' + enc(emailText(ref, d)),
      get done(){ return withEmail(t('channel.outlook365.done', 'Abrimos Outlook de tu cuenta empresarial con tu PQRSF lista para <b>{email}</b>. Revisa y <b>presiona «Enviar»</b>.')); }
    },
    mailto: {
      label: t('channel.mailto.short', 'tu app de correo'),
      url: (ref, d) => 'mailto:' + MAIL_TO + '?subject=' + enc(emailSubject(ref, d)) + '&body=' + enc(emailText(ref, d)),
      sameTab: true,
      get done(){ return t('channel.mailto.done', 'Intentamos abrir la aplicación de correo de tu equipo. Si no se abrió ninguna, elige Gmail u Outlook, o copia el texto y envíalo a pqrsf@petroilsa.com.'); }
    }
  };

  function openChannel(key){
    const ch = channels[key];
    if(!ch || !current) return;
    const url = ch.url(current.ref, current.data);
    if(ch.sameTab) window.location.href = url;
    else window.open(url, '_blank', 'noopener');
    lastChannel = key;
    showSuccess(key);
  }

  // ---------- Diálogo y éxito ----------
  const openDialog = () => { if(typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); };
  const closeDialog = () => { if(dialog.open) (typeof dialog.close === 'function') ? dialog.close() : dialog.removeAttribute('open'); };

  function openReview(){
    const data = collect();
    current = { ref: makeRef(data.tipo), data };
    $('pqRef').textContent = current.ref; // se busca cada vez: i18n reemplaza ese <b> al traducir review.ref
    previewEl.textContent = 'Para: ' + MAIL_TO + '\nAsunto: ' + emailSubject(current.ref, data) + '\n\n' + emailText(current.ref, data);
    previewEl.scrollTop = 0;
    if(copyLabel) copyLabel.textContent = t('review.copyText', 'Copiar texto');
    openDialog();
  }

  function showSuccess(key){
    closeDialog();
    const ch = channels[key];
    const days = TYPES[current.data.tipo].days;
    successTitle.textContent = key === 'mailto' ? t('success.titleMailto', 'Tu correo está listo') : t('success.title', '¡Tu PQRSF está lista para enviar!');
    successText.innerHTML = ch.done;
    successRef.textContent = current.ref;
    next3.innerHTML = t('success.next3days', '<b>Recibe nuestra respuesta</b> en máximo {n} días hábiles por el medio que elegiste.').replace('{n}', days);
    reopenBtn.querySelector('span').textContent = t('success.reopenWith', 'Abrir {channel} de nuevo').replace('{channel}', ch.label);
    pqForm.hidden = true;
    successPanel.hidden = false;
    successPanel.scrollIntoView({ behavior:'smooth', block:'start' });
    successTitle.focus({ preventScroll:true });
  }

  function resetAll(){
    pqForm.reset();
    attempted = false;
    refSeed = makeSeed();
    current = null; lastChannel = null;
    pqForm.querySelectorAll('.is-invalid, .is-valid').forEach(el => el.classList.remove('is-invalid', 'is-valid'));
    pqForm.querySelectorAll('.pq-error').forEach(el => { el.hidden = true; });
    consentBox.classList.remove('is-invalid');
    successPanel.hidden = true;
    pqForm.hidden = false;
    applyPersona(); applyRespuesta(); applyType(); updateCounter();
    $('radicar').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  // ---------- Eventos ----------
  tipoRadios.forEach(r => r.addEventListener('change', applyType));
  pqForm.querySelectorAll('input[name="persona"]').forEach(r => r.addEventListener('change', applyPersona));
  pqForm.querySelectorAll('input[name="respuesta"]').forEach(r => r.addEventListener('change', applyRespuesta));

  textInputs().forEach(input => {
    input.addEventListener('input', () => {
      // Mientras escribe solo se QUITA el error; se marca de nuevo al salir del campo.
      if(input.classList.contains('is-invalid') && !fieldMessage(input)) setFieldError(input, '');
      if(input === els.mensaje) updateCounter();
      refresh();
    });
    input.addEventListener('blur', () => {
      if(attempted || input.value.trim()) setFieldError(input, fieldMessage(input));
    });
  });
  ['documento', 'ciudad', 'relacion', 'pedido', 'fechaHecho'].forEach(n => els[n] && els[n].addEventListener('change', refresh));

  privacidad.addEventListener('change', () => {
    if(privacidad.checked){ $('errPrivacidad').hidden = true; consentBox.classList.remove('is-invalid'); }
    refresh();
  });

  pqForm.addEventListener('submit', (e) => {
    e.preventDefault();
    attempted = true;
    if(validateAll()) openReview();
  });

  // Tarjetas P·Q·R·S·F del hero: preseleccionan el tipo y bajan al formulario.
  document.querySelectorAll('[data-pick]').forEach(link => {
    link.addEventListener('click', () => {
      const radio = tipoRadios.find(r => r.value === link.dataset.pick);
      if(radio){ radio.checked = true; applyType(); }
      if(!pqForm.hidden) setTimeout(() => radio && radio.focus({ preventScroll:true }), 500);
    });
  });

  dialog.querySelectorAll('[data-channel]').forEach(btn => btn.addEventListener('click', () => openChannel(btn.dataset.channel)));
  dialog.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeDialog));
  dialog.addEventListener('click', (e) => { if(e.target === dialog) closeDialog(); });

  if(copyBtn){
    copyBtn.addEventListener('click', async () => {
      if(!current) return;
      const ok = await copy('Para: ' + MAIL_TO + '\nAsunto: ' + emailSubject(current.ref, current.data) + '\n\n' + emailText(current.ref, current.data));
      if(copyLabel) copyLabel.textContent = ok ? t('review.copySuccess', '¡Copiado! Pégalo en un correo a pqrsf@petroilsa.com') : t('review.copyError', 'No se pudo copiar');
    });
  }

  reopenBtn.addEventListener('click', () => { if(lastChannel) openChannel(lastChannel); });
  $('pqOtherChannel').addEventListener('click', () => { if(current) openDialog(); });
  $('pqReset').addEventListener('click', resetAll);

  $('pqCopyRef').addEventListener('click', async () => {
    if(current && await copy(current.ref)) showToast(t('toast.refCopied', 'Número de referencia copiado'));
  });
  const copyMailBtn = $('pqCopyMail');
  if(copyMailBtn){
    copyMailBtn.addEventListener('click', async () => {
      if(await copy(MAIL_TO)) showToast(t('toast.mailCopied', 'Correo copiado: pqrsf@petroilsa.com'));
    });
  }

  // La fecha del hecho no puede ser futura. Fecha LOCAL (en-CA da AAAA-MM-DD):
  // toISOString() usa UTC y desde las 7 p. m. en Colombia ya devolvía mañana.
  if(els.fechaHecho) els.fechaHecho.max = new Date().toLocaleDateString('en-CA');

  // Preselección por URL: ?tipo=reclamo
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const preTipo = new URLSearchParams(window.location.search).get('tipo');
  if(preTipo){
    const radio = tipoRadios.find(r => norm(r.value) === norm(preTipo));
    if(radio) radio.checked = true;
  }

  applyPersona(); applyRespuesta(); applyType(); updateCounter();
  // i18n.js traduce después de cargar sus JSON: se refresca el ticket para
  // que tome los textos ya traducidos (tipo seleccionado, "días hábiles").
  window.addEventListener('load', () => { setTimeout(applyType, 300); setTimeout(applyType, 1200); });
  document.querySelectorAll('.lang-dropdown a[data-lang]').forEach(a => a.addEventListener('click', () => setTimeout(applyType, 50)));
}
