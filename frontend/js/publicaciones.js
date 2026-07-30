const CATEGORIA_LABELS = {
  venta: 'Venta',
  servicio: 'Servicio',
  mudanza: 'Mudanza',
  alquiler: 'Alquiler',
  movilidad: 'Movilidad',
  ayuda: 'Ayuda / colecta',
  otro: 'Otro'
};

const CATEGORIA_ICONS = {
  venta: '🛒',
  servicio: '🛠️',
  mudanza: '📦',
  alquiler: '🏠',
  movilidad: '🚗',
  ayuda: '🤝',
  otro: '✨'
};

let todasLasPublicaciones = [];
let categoriaActiva = '';

function estrellas(reputation) {
  const sobreCinco = (reputation || 0) / 20;
  return `★ ${sobreCinco.toFixed(1)}`;
}

function renderListado() {
  const contenedor = document.getElementById('listado');
  const filtradas = categoriaActiva
    ? todasLasPublicaciones.filter((l) => l.type === categoriaActiva)
    : todasLasPublicaciones;

  if (filtradas.length === 0) {
    contenedor.innerHTML = '<p class="hint">No hay publicaciones todavía en esta categoría. ¡Sé el primero!</p>';
    return;
  }

  contenedor.innerHTML = filtradas.map((listing) => {
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

    return `
      <a href="publicacion.html?id=${listing.id}" class="card-link">
        <div class="listing-card">
          <span class="badge">${CATEGORIA_LABELS[listing.type] || listing.type}</span>
          <span class="listing-title">${escapeHtml(listing.title)}</span>
          ${listing.image_url
            ? `<img class="listing-thumb" src="${listing.image_url}" alt="">`
            : `<div class="listing-thumb-placeholder">${CATEGORIA_ICONS[listing.type] || '✨'}</div>`}
          <p class="listing-meta">${escapeHtml(listing.province || '')}</p>
          ${precioHtml}
          <p class="listing-meta">${escapeHtml(nombreVendedor)} · <span class="stars">${estrellas(perfil.reputation)}</span>${perfil.trust_badge ? ' <span class="badge badge-outline">✓ Confianza</span>' : ''}</p>
        </div>
      </a>`;
  }).join('');

  // El ancho de la barra de progreso se setea vía DOM style (no atributo
  // HTML inline) para que la CSP del backend no lo bloquee.
  contenedor.querySelectorAll('.progress-fill[data-pct]').forEach((el) => {
    el.style.width = `${el.dataset.pct}%`;
  });

  // Entrada escalonada de tarjetas (mismo motivo: vía DOM, no inline).
  contenedor.querySelectorAll('.listing-card').forEach((el, i) => {
    el.style.animationDelay = `${Math.min(i, 8) * 45}ms`;
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function cargarListado() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('listings')
    .select('*, profiles!listings_user_id_profiles_fkey(full_name, callsign, reputation, trust_badge)')
    .eq('estado', 'activa')
    .order('created_at', { ascending: false });

  if (error) {
    document.getElementById('listado').innerHTML = '<p class="hint">No se pudo cargar el listado.</p>';
    console.error(error);
    return;
  }

  todasLasPublicaciones = data;
  renderListado();
}

document.getElementById('categoryTabs').addEventListener('click', (event) => {
  const btn = event.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('#categoryTabs .tab-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  categoriaActiva = btn.dataset.categoria;
  renderListado();
});

(async () => {
  const profile = await getProfile();
  if (profile?.rol === 'admin') {
    document.getElementById('navAdmin').hidden = false;
  }
  await cargarListado();
})();
