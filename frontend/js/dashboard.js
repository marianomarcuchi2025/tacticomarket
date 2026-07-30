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
      mostrarEstadoViaje('No se pudo obtener tu ubicación. Revisá los permisos del navegador.', true);
    }
  );
}

function mostrarEstadoViaje(texto, esError) {
  const el = document.getElementById('estado');
  el.innerText = texto;
  el.classList.toggle('error-text', !!esError);
}

async function crearViaje() {
  const destino = document.getElementById('destino').value.trim();
  if (!destino) {
    mostrarEstadoViaje('Ingresá un destino antes de pedir el viaje.', true);
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
    mostrarEstadoViaje('No se pudo publicar: ' + error.message, true);
    return;
  }
  mostrarEstadoViaje(`Viaje a "${destino}" publicado en Movilidad. Otros miembros ya pueden verlo y escribirte.`, false);
}

document.getElementById('pedirViajeBtn')?.addEventListener('click', crearViaje);

initMap();
