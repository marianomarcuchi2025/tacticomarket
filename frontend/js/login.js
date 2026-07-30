const tabIngresar = document.getElementById('tabIngresar');
const tabRegistrar = document.getElementById('tabRegistrar');
const formIngresar = document.getElementById('formIngresar');
const formRegistrar = document.getElementById('formRegistrar');
const authError = document.getElementById('authError');

function showError(message) {
  authError.textContent = message;
  authError.style.display = 'block';
}

function clearError() {
  authError.style.display = 'none';
}

tabIngresar.addEventListener('click', () => {
  tabIngresar.classList.add('active');
  tabRegistrar.classList.remove('active');
  formIngresar.hidden = false;
  formRegistrar.hidden = true;
  clearError();
});

tabRegistrar.addEventListener('click', () => {
  tabRegistrar.classList.add('active');
  tabIngresar.classList.remove('active');
  formRegistrar.hidden = false;
  formIngresar.hidden = true;
  clearError();
});

formIngresar.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  try {
    await signIn({
      email: document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value
    });
    window.location.href = 'publicaciones.html';
  } catch (error) {
    showError(error.message || 'No se pudo ingresar.');
  }
});

formRegistrar.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  try {
    await signUp({
      email: document.getElementById('regEmail').value.trim(),
      password: document.getElementById('regPassword').value,
      fullName: document.getElementById('regNombre').value.trim(),
      userType: document.getElementById('regTipo').value,
      fuerza: document.getElementById('regFuerza').value.trim(),
      unidad: document.getElementById('regUnidad').value.trim(),
      callsign: document.getElementById('regCallsign').value.trim()
    });
    window.location.href = 'pendiente.html';
  } catch (error) {
    showError(error.message || 'No se pudo crear la cuenta.');
  }
});
