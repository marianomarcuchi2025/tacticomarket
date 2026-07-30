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

async function crearViaje() {
  const destino = document.getElementById('destino').value.trim();
  if (!destino) {
    alert('Ingresá un destino');
    return;
  }

  const profile = await requireVerified();
  if (!profile) return;

  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('listings').insert({
    user_id: profile.id,
    type: 'movilidad',
    title: `Viaje a ${destino}`,
    descripcion: `Solicitud de viaje/movilidad hacia ${destino}.`,
    price: 0,
    seller_callsign: profile.callsign || profile.full_name
  });

  if (error) {
    document.getElementById('estado').innerText = 'No se pudo publicar: ' + error.message;
    return;
  }
  document.getElementById('estado').innerText = `Viaje a "${destino}" publicado en Movilidad. Otros miembros ya pueden verlo y escribirte.`;
}

document.getElementById('pedirViajeBtn')?.addEventListener('click', crearViaje);

initMap();
