function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function cargarPendientes(supabase) {
  const contenedor = document.getElementById('pendientes');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, user_type, fuerza, unidad_destino, callsign, avalado_por, created_at')
    .eq('verified', false)
    .order('created_at', { ascending: true });

  if (error) {
    contenedor.innerHTML = '<p class="hint">No se pudo cargar la lista.</p>';
    return;
  }

  if (data.length === 0) {
    contenedor.innerHTML = '<p class="hint">No hay cuentas pendientes.</p>';
    return;
  }

  contenedor.innerHTML = data.map((p) => `
    <div class="listing-card">
      <span class="listing-title">${escapeHtml(p.full_name || '(sin nombre)')}</span>
      <p class="listing-meta">${escapeHtml(p.user_type)} · ${escapeHtml(p.fuerza || '-')} · ${escapeHtml(p.unidad_destino || '-')}</p>
      <p class="listing-meta">Alias: ${escapeHtml(p.callsign || '-')}${p.avalado_por ? ' · avalado por otro miembro' : ''}</p>
      <button type="button" class="btn mt-sm" data-approve="${p.id}">Aprobar</button>
    </div>
  `).join('');

  contenedor.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerText = 'Aprobando...';
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ verified: true })
        .eq('id', btn.dataset.approve);
      if (updateError) {
        alert('No se pudo aprobar: ' + updateError.message);
        btn.disabled = false;
        btn.innerText = 'Aprobar';
        return;
      }
      await cargarPendientes(supabase);
    });
  });
}

(async () => {
  const supabase = await getSupabaseClient();
  const profile = await requireAuth().then(() => getProfile());
  if (!profile || profile.rol !== 'admin') {
    window.location.href = 'publicaciones.html';
    return;
  }

  await cargarPendientes(supabase);

  document.getElementById('agregarPuntoBtn').addEventListener('click', async () => {
    const msgEl = document.getElementById('puntoMsg');
    const nombre = document.getElementById('puntoNombre').value.trim();
    if (!nombre) {
      msgEl.textContent = 'El nombre es obligatorio.';
      return;
    }
    const { error } = await supabase.from('safe_points').insert({
      name: nombre,
      type: document.getElementById('puntoTipo').value,
      address: document.getElementById('puntoDireccion').value.trim() || null,
      province: document.getElementById('puntoProvincia').value.trim() || null
    });
    if (error) {
      msgEl.textContent = 'No se pudo agregar: ' + error.message;
      return;
    }
    msgEl.textContent = '¡Agregado!';
    document.getElementById('puntoNombre').value = '';
    document.getElementById('puntoDireccion').value = '';
  });
})();
