const BACKEND_URL = window.location.origin;
const META_DONACIONES = 500000;

let montoSeleccionado = null;

function mostrarMensajeDonacion(texto, tipo) {
  const msgEl = document.getElementById('donarMsg');
  msgEl.textContent = texto;
  msgEl.classList.remove('hidden', 'error-text', 'success-text');
  if (tipo) msgEl.classList.add(tipo === 'error' ? 'error-text' : 'success-text');
}

async function cargarStatsDonaciones() {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from('donation_totals').select('total_aprobado').single();
    if (error) throw error;
    const total = Number(data.total_aprobado) || 0;
    const pct = Math.min(100, Math.round((total / META_DONACIONES) * 100));
    document.getElementById('progressFill').style.width = `${pct}%`;
    document.getElementById('stats').textContent =
      `Recaudado: $${total.toLocaleString('es-AR')} / Meta: $${META_DONACIONES.toLocaleString('es-AR')}`;
  } catch (error) {
    console.error('No se pudo cargar el total de donaciones:', error);
  }
}

document.querySelectorAll('.monto-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('.monto-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    montoSeleccionado = parseInt(btn.dataset.monto, 10);
    document.getElementById('customMonto').value = '';
  };
});

document.getElementById('donarBtn').onclick = async () => {
  let monto = montoSeleccionado;
  const custom = parseInt(document.getElementById('customMonto').value, 10);
  if (custom > 0) monto = custom;

  if (!monto || monto < 100) {
    mostrarMensajeDonacion('El monto mínimo es $100 ARS.', 'error');
    return;
  }

  const nombre = document.getElementById('donanteNombre').value;
  const mensaje = document.getElementById('mensaje').value;

  const btn = document.getElementById('donarBtn');
  btn.innerText = '⏳ Procesando...';
  btn.disabled = true;
  document.getElementById('donarMsg').classList.add('hidden');

  try {
    const response = await fetch(`${BACKEND_URL}/api/create-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: monto, donorName: nombre, message: mensaje })
    });

    const data = await response.json();

    if (data.init_point) {
      window.open(data.init_point, '_blank');
      mostrarMensajeDonacion('Te redirigimos a Mercado Pago en una pestaña nueva para completar la donación.', 'success');
    } else {
      mostrarMensajeDonacion(data.error || 'No se pudo iniciar el pago.', 'error');
    }
  } catch (error) {
    mostrarMensajeDonacion('No se pudo conectar con el servidor: ' + error.message, 'error');
  }

  btn.innerText = '💚 DONAR CON MERCADO PAGO';
  btn.disabled = false;
};

cargarStatsDonaciones();

fetch(`${BACKEND_URL}/api/health`)
  .then((r) => r.json())
  .then((data) => console.log('✅ Backend conectado:', data))
  .catch((e) => console.log('❌ Backend no responde:', e));
