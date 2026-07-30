let map;
let marker;
let userPos;

function initMap() {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userPos = [pos.coords.latitude, pos.coords.longitude];
      map = L.map('map').setView(userPos, 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap'
      }).addTo(map);

      marker = L.marker(userPos).addTo(map).bindPopup('Tu ubicación').openPopup();
    },
    () => {
      document.getElementById('estado').innerText = 'No se pudo obtener tu ubicación.';
    }
  );
}

function crearViaje() {
  const destino = document.getElementById('destino').value.trim();
  if (!destino) {
    alert('Ingresá un destino');
    return;
  }
  document.getElementById('estado').innerText = `Viaje solicitado a "${destino}" (demo, sin backend real de matching todavía).`;
}

document.getElementById('pedirViajeBtn')?.addEventListener('click', crearViaje);

initMap();
