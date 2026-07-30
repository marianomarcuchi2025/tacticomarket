const CATEGORIA_LABELS = {
  venta: 'Venta', servicio: 'Servicio', mudanza: 'Mudanza',
  alquiler: 'Alquiler', movilidad: 'Movilidad', ayuda: 'Ayuda / colecta', otro: 'Otro'
};

const CATEGORIA_ICONS = {
  venta: '🛒', servicio: '🛠️', mudanza: '📦',
  alquiler: '🏠', movilidad: '🚗', ayuda: '🤝', otro: '✨'
};

const params = new URLSearchParams(window.location.search);
const listingId = params.get('id');

// Nombrado "sb" (no "supabase") a propósito: el UMD del CDN ya define un
// global `supabase`, y un `let supabase` acá arriba choca con esa
// declaración (SyntaxError silencioso que mata todo el script).
let sb;
let miPerfil;
let listing;
let esDueno;
let otraParte = null; // id de la contraparte del chat/calificación
let chatIntervalId = null;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function mostrarMsg(id, texto, tipo) {
  const el = document.getElementById(id);
  el.textContent = texto;
  el.classList.remove('hidden', 'error-text', 'success-text');
  if (tipo) el.classList.add(tipo === 'error' ? 'error-text' : 'success-text');
}

function renderDetalle() {
  const perfil = listing.profiles || {};
  const nombreVendedor = perfil.callsign || perfil.full_name || 'Miembro';
  const esAyuda = listing.type === 'ayuda' && listing.crowdfunding_goal;

  let precioHtml;
  if (esAyuda) {
    const pct = Math.min(100, Math.round((listing.crowdfunding_current / listing.crowdfunding_goal) * 100));
    precioHtml = `<div class="progress-bar"><div class="progress-fill" data-pct="${pct}"></div></div>
      <p class="listing-meta">Recaudado $${Number(listing.crowdfunding_current).toLocaleString('es-AR')} / $${Number(listing.crowdfunding_goal).toLocaleString('es-AR')}</p>`;
  } else if (listing.price > 0) {
    precioHtml = `<p class="listing-meta">$${Number(listing.price).toLocaleString('es-AR')}${listing.unit ? ' · ' + listing.unit : ''}</p>`;
  } else {
    precioHtml = '<p class="listing-meta">A coordinar</p>';
  }

  document.getElementById('detalle').innerHTML = `
    <span class="badge">${CATEGORIA_LABELS[listing.type] || listing.type}</span>
    <h1>${escapeHtml(listing.title)}</h1>
    ${listing.image_url
      ? `<img class="listing-thumb" src="${listing.image_url}" alt="">`
      : `<div class="listing-thumb-placeholder">${CATEGORIA_ICONS[listing.type] || '✨'}</div>`}
    <p class="mt-sm">${escapeHtml(listing.descripcion)}</p>
    <p class="listing-meta mt-sm">${escapeHtml(listing.province || '')}</p>
    ${precioHtml}
    <p class="listing-meta mt-sm">Publicado por ${escapeHtml(nombreVendedor)} ·
      <span class="stars">★ ${((perfil.reputation || 0) / 20).toFixed(1)}</span>
      ${perfil.trust_badge ? ' <span class="badge badge-outline">✓ Confianza</span>' : ''}
    </p>`;

  document.querySelectorAll('#detalle .progress-fill[data-pct]').forEach((el) => {
    el.style.width = `${el.dataset.pct}%`;
  });

  if (esAyuda) {
    document.getElementById('seccionColecta').hidden = false;
  }
}

async function cargarListing() {
  const { data, error } = await sb
    .from('listings')
    .select('*, profiles!listings_user_id_profiles_fkey(full_name, callsign, reputation, trust_badge)')
    .eq('id', listingId)
    .single();

  if (error || !data) {
    document.getElementById('detalle').innerHTML = '<p class="hint">No se encontró la publicación.</p>';
    throw error || new Error('not found');
  }
  listing = data;
  renderDetalle();
}

// ---------- Colecta ----------
document.getElementById('colaborarBtn').addEventListener('click', async () => {
  const monto = Number(document.getElementById('montoColecta').value);
  if (!monto || monto < 100) {
    mostrarMsg('colectaMsg', 'El monto mínimo es $100 ARS.', 'error');
    return;
  }
  try {
    const response = await fetch('/api/create-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: monto, donorName: miPerfil.full_name, listingId })
    });
    const data = await response.json();
    if (data.init_point) {
      window.open(data.init_point, '_blank');
      mostrarMsg('colectaMsg', 'Te redirigimos a Mercado Pago en una pestaña nueva.', 'success');
    } else {
      mostrarMsg('colectaMsg', data.error || 'No se pudo iniciar el pago.', 'error');
    }
  } catch (error) {
    mostrarMsg('colectaMsg', 'No se pudo conectar con el servidor: ' + error.message, 'error');
  }
});

// ---------- Chat ----------
function renderMensajes(mensajes) {
  const thread = document.getElementById('chatThread');
  thread.innerHTML = mensajes.map((m) => `
    <div class="chat-bubble ${m.sender_id === miPerfil.id ? 'mine' : 'theirs'}">${escapeHtml(m.body)}</div>
  `).join('') || '<p class="hint">Todavía no hay mensajes.</p>';
  thread.scrollTop = thread.scrollHeight;
}

async function cargarMensajes() {
  if (!otraParte) return;
  const { data, error } = await sb
    .from('messages')
    .select('*')
    .eq('listing_id', listingId)
    .or(`and(sender_id.eq.${miPerfil.id},receiver_id.eq.${otraParte}),and(sender_id.eq.${otraParte},receiver_id.eq.${miPerfil.id})`)
    .order('created_at', { ascending: true });
  if (error) {
    console.error(error);
    return;
  }
  renderMensajes(data);
}

document.getElementById('formChat').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('mensajeInput');
  const body = input.value.trim();
  document.getElementById('chatMsg').classList.add('hidden');

  if (!body) {
    mostrarMsg('chatMsg', 'Escribí algo antes de enviar.', 'error');
    return;
  }
  if (!otraParte) {
    mostrarMsg('chatMsg', 'Todavía no hay con quién chatear en esta publicación.', 'error');
    return;
  }

  const { error } = await sb.from('messages').insert({
    listing_id: listingId,
    sender_id: miPerfil.id,
    receiver_id: otraParte,
    body
  });
  if (error) {
    mostrarMsg('chatMsg', 'No se pudo enviar el mensaje: ' + error.message, 'error');
    return;
  }
  input.value = '';
  await cargarMensajes();
});

function iniciarChatCon(contraparteId, tituloVisible) {
  otraParte = contraparteId;
  document.getElementById('seccionChat').hidden = false;
  document.getElementById('chatTitulo').textContent = `Chat con ${tituloVisible}`;
  cargarMensajes();
  if (chatIntervalId) clearInterval(chatIntervalId);
  chatIntervalId = setInterval(cargarMensajes, 4000);
  actualizarSeccionCalificar();
}

// ---------- Vista del dueño: elegir con quién cerrar el trato ----------
async function cargarInteresados() {
  const { data, error } = await sb
    .from('messages')
    .select('sender_id')
    .eq('listing_id', listingId)
    .eq('receiver_id', miPerfil.id);
  if (error) {
    console.error(error);
    return [];
  }
  return [...new Set(data.map((m) => m.sender_id))];
}

async function configurarVistaDueno() {
  document.getElementById('seccionVendedor').hidden = false;

  const interesadosIds = await cargarInteresados();
  const select = document.getElementById('selectComprador');

  if (interesadosIds.length === 0) {
    select.innerHTML = '<option value="">Todavía nadie te escribió</option>';
    return;
  }

  const { data: perfiles } = await sb
    .from('profiles')
    .select('id, full_name, callsign')
    .in('id', interesadosIds);

  select.innerHTML = perfiles.map((p) =>
    `<option value="${p.id}">${escapeHtml(p.callsign || p.full_name)}</option>`
  ).join('');

  const { data: puntos } = await sb.from('safe_points').select('id, name, type, province');
  const selectPunto = document.getElementById('selectPuntoSeguro');
  (puntos || []).forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.province || p.type})`;
    selectPunto.appendChild(opt);
  });

  const primerId = select.value;
  const primerNombre = perfiles.find((p) => p.id === primerId);
  if (primerId) iniciarChatCon(primerId, primerNombre?.callsign || primerNombre?.full_name || 'comprador');

  select.addEventListener('change', () => {
    const p = perfiles.find((pp) => pp.id === select.value);
    if (p) iniciarChatCon(p.id, p.callsign || p.full_name);
  });
}

document.getElementById('cerrarTratoBtn').addEventListener('click', async () => {
  const compradorId = document.getElementById('selectComprador').value;
  if (!compradorId) {
    mostrarMsg('vendedorMsg', 'Elegí con quién cerraste el trato.', 'error');
    return;
  }
  const monto = Number(document.getElementById('montoTrato').value) || listing.price || 0;
  const puntoSeguroId = document.getElementById('selectPuntoSeguro').value || null;

  const { error } = await sb.from('transactions').insert({
    listing_id: listingId,
    seller_id: miPerfil.id,
    buyer_id: compradorId,
    amount: monto,
    commission: 0,
    status: 'completed',
    tracking_code: Math.random().toString(36).slice(2, 8).toUpperCase(),
    punto_encuentro: puntoSeguroId
  });

  if (error) {
    mostrarMsg('vendedorMsg', 'No se pudo registrar: ' + error.message, 'error');
    return;
  }
  mostrarMsg('vendedorMsg', 'Trato cerrado. Ya podés calificar a la otra persona, y ella a vos.', 'success');
  actualizarSeccionCalificar();
});

// ---------- Calificación ----------
async function actualizarSeccionCalificar() {
  if (!otraParte) return;
  const { data, error } = await sb
    .from('transactions')
    .select('id')
    .eq('status', 'completed')
    .or(`and(buyer_id.eq.${miPerfil.id},seller_id.eq.${otraParte}),and(seller_id.eq.${miPerfil.id},buyer_id.eq.${otraParte})`)
    .limit(1);

  if (error || !data || data.length === 0) {
    document.getElementById('seccionCalificar').hidden = true;
    return;
  }

  const { data: perfilOtro } = await sb.from('profiles').select('full_name, callsign').eq('id', otraParte).single();
  document.getElementById('nombreACalificar').textContent = perfilOtro?.callsign || perfilOtro?.full_name || 'esta persona';
  document.getElementById('seccionCalificar').hidden = false;
}

document.getElementById('calificarBtn').addEventListener('click', async () => {
  const score = Number(document.getElementById('puntaje').value);
  const comment = document.getElementById('comentarioCalificacion').value.trim();

  const { error } = await sb.from('testimonials').insert({
    listing_id: listingId,
    reviewer_id: miPerfil.id,
    reviewed_id: otraParte,
    rating: score,
    comment: comment || null
  });

  if (error) {
    const texto = error.message.includes('duplicate') || error.code === '23505'
      ? 'Ya calificaste a esta persona por esta publicación.'
      : 'No se pudo enviar: ' + error.message;
    mostrarMsg('calificarMsg', texto, 'error');
    return;
  }
  mostrarMsg('calificarMsg', 'Gracias, tu calificación quedó registrada.', 'success');
});

// ---------- Init ----------
(async () => {
  sb = await getSupabaseClient();
  miPerfil = await requireVerified();
  if (!miPerfil) return;

  await cargarListing();
  esDueno = listing.user_id === miPerfil.id;

  if (esDueno) {
    await configurarVistaDueno();
  } else {
    const perfilVendedor = listing.profiles || {};
    iniciarChatCon(listing.user_id, perfilVendedor.callsign || perfilVendedor.full_name || 'el publicador');
  }
})();
