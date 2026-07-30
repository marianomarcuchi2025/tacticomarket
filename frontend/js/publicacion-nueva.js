const categoriaSelect = document.getElementById('categoria');
const campoPrecio = document.getElementById('campoPrecio');
const campoColecta = document.getElementById('campoColecta');
const errorEl = document.getElementById('publicarError');
const imagenInput = document.getElementById('imagen');
const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;

categoriaSelect.addEventListener('change', () => {
  const esAyuda = categoriaSelect.value === 'ayuda';
  campoColecta.hidden = !esAyuda;
  campoPrecio.hidden = esAyuda;
});

imagenInput.addEventListener('change', () => {
  const archivo = imagenInput.files[0];
  if (archivo && archivo.size > MAX_IMAGEN_BYTES) {
    errorEl.textContent = `La imagen pesa ${(archivo.size / 1024 / 1024).toFixed(1)}MB, el máximo es 5MB.`;
    errorEl.classList.remove('hidden');
    imagenInput.value = '';
  } else {
    errorEl.classList.add('hidden');
  }
});

function mostrarError(texto) {
  errorEl.textContent = texto;
  errorEl.classList.remove('hidden');
}

document.getElementById('formPublicacion').addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.classList.add('hidden');

  const profile = await requireVerified();
  if (!profile) return;

  const supabase = await getSupabaseClient();
  const categoria = categoriaSelect.value;
  const esAyuda = categoria === 'ayuda';

  const titulo = document.getElementById('titulo').value.trim();
  const descripcion = document.getElementById('descripcion').value.trim();

  if (!titulo) {
    mostrarError('El título es obligatorio.');
    return;
  }
  if (!descripcion) {
    mostrarError('La descripción es obligatoria.');
    return;
  }

  const archivo = imagenInput.files[0];
  if (archivo && archivo.size > MAX_IMAGEN_BYTES) {
    mostrarError(`La imagen pesa ${(archivo.size / 1024 / 1024).toFixed(1)}MB, el máximo es 5MB.`);
    return;
  }

  const payload = {
    user_id: profile.id,
    type: categoria,
    title: titulo,
    descripcion,
    province: document.getElementById('ubicacion').value.trim() || null,
    seller_callsign: profile.callsign || profile.full_name,
    price: esAyuda ? 0 : (Number(document.getElementById('precio').value) || 0),
    unit: esAyuda ? null : (document.getElementById('unidad').value.trim() || null),
    crowdfunding_goal: esAyuda ? Number(document.getElementById('metaColecta').value) || null : null
  };

  if (esAyuda && !payload.crowdfunding_goal) {
    mostrarError('Ingresá una meta para la colecta.');
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerText = 'Publicando...';

  try {
    const { data: inserted, error: insertError } = await supabase
      .from('listings')
      .insert(payload)
      .select('id')
      .single();
    if (insertError) throw insertError;

    if (archivo) {
      const extension = archivo.name.split('.').pop();
      const ruta = `${profile.id}/${inserted.id}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('listing-images')
        .upload(ruta, archivo, { upsert: true });
      if (uploadError) {
        console.error('No se pudo subir la imagen:', uploadError);
      } else {
        const { data: publicUrlData } = supabase.storage.from('listing-images').getPublicUrl(ruta);
        await supabase.from('listings').update({ image_url: publicUrlData.publicUrl }).eq('id', inserted.id);
      }
    }

    window.location.href = `publicacion.html?id=${inserted.id}`;
  } catch (error) {
    mostrarError(error.message || 'No se pudo crear la publicación.');
    submitBtn.disabled = false;
    submitBtn.innerText = 'Publicar';
  }
});
