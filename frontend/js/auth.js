function login() {
  const nombre = document.getElementById('nombre').value.trim();
  const fuerza = document.getElementById('fuerza').value.trim();

  if (!nombre || !fuerza) {
    alert('Completá todos los datos');
    return;
  }

  const user = { nombre, fuerza, fecha: new Date().toISOString() };
  localStorage.setItem('user', JSON.stringify(user));
  window.location.href = 'index.html';
}

function logout() {
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

function requireLogin() {
  if (!localStorage.getItem('user')) {
    window.location.href = 'login.html';
  }
}

document.getElementById('loginBtn')?.addEventListener('click', login);
document.getElementById('logoutBtn')?.addEventListener('click', logout);

// Botones de contacto/consulta en las pantallas de demo (mercado, movilidad):
// listado como data-demo-alert en vez de onclick inline, para que la CSP
// pueda bloquear scripts inline sin romper esta interacción.
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-demo-alert]');
  if (trigger) {
    alert(trigger.dataset.demoAlert);
  }
});
