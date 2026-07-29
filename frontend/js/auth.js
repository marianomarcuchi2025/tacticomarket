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
