const categoriaSelect = document.getElementById('categoria');
const campoPrecio = document.getElementById('campoPrecio');
const campoColecta = document.getElementById('campoColecta');
const errorEl = document.getElementById('publicarError');

categoriaSelect.addEventListener('change', () => {
  const esAyuda = categoriaSelect.value === 'ayuda';
  campoColecta.hidden = !esAyuda;
  campoPrecio.hidden = esAyuda;
});

document.getElementById('formPublicacion').addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.style.display = 'none';

  const profile = await requireVerified();
  if (!profile) return;

  const supabase = await getSupabaseClient();
  const categoria = categoriaSelect.value;
  const esAyuda = categoria === 'ayuda';

  const payload = {
    user_id: profile.id,
    type: categoria,
    title: document.getElementById('titulo').value.trim(),
    descripcion: document.getElementById('descripcion').value.trim(),
    province: document.getElementById('ubicacion').value.trim() || null,
    seller_callsign: profile.callsign || profile.full_name,
    price: esAyuda ? 0 : (Number(document.getElementById('precio').value) || 0),
    unit: esAyuda ? null : (document.getElementById('unidad').value.trim() || null),
    crowdfunding_goal: esAyuda ? Number(document.getElementById('metaColecta').value) || null : null
  };

  if (esAyuda && !payload.crowdfunding_goal) {
    errorEl.textContent = 'Ingresá una meta para la colecta.';
    errorEl.style.display = 'block';
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

    const archivo = document.getElementById('imagen').files[0];
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
    errorEl.textContent = error.message || 'No se pudo crear la publicación.';
    errorEl.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.innerText = 'Publicar';
  }
});
