const BACKEND_URL = window.location.origin;

let mp = null;
let montoSeleccionado = null;

async function initMercadoPago() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/public-config`);
    const { publicKey } = await res.json();
    if (publicKey) {
      mp = new MercadoPago(publicKey, { locale: 'es-AR' });
    } else {
      console.warn('MP_PUBLIC_KEY no configurada en el backend.');
    }
  } catch (error) {
    console.error('No se pudo obtener la configuración pública:', error);
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
    alert('⚠️ El monto mínimo es $100 ARS');
    return;
  }

  const nombre = document.getElementById('donanteNombre').value;
  const mensaje = document.getElementById('mensaje').value;

  const btn = document.getElementById('donarBtn');
  btn.innerText = '⏳ Procesando...';
  btn.disabled = true;

  try {
    const response = await fetch(`${BACKEND_URL}/api/create-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: monto, donorName: nombre, message: mensaje })
    });

    const data = await response.json();

    if (data.init_point) {
      window.open(data.init_point, '_blank');
      alert('💚 Redirigiendo a Mercado Pago para completar tu donación.');
    } else {
      alert('❌ Error: ' + (data.error || JSON.stringify(data)));
    }
  } catch (error) {
    alert('❌ Error al conectar con el servidor.\n\n' + error.message);
  }

  btn.innerText = '💚 DONAR CON MERCADO PAGO';
  btn.disabled = false;
};

initMercadoPago();

fetch(`${BACKEND_URL}/api/health`)
  .then((r) => r.json())
  .then((data) => console.log('✅ Backend conectado:', data))
  .catch((e) => console.log('❌ Backend no responde:', e));
