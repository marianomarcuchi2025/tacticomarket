let cachedProfile = null;

async function getSession() {
  const supabase = await getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function getProfile() {
  if (cachedProfile) return cachedProfile;
  const supabase = await getSupabaseClient();
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  if (error) {
    console.error('No se pudo cargar el perfil:', error);
    return null;
  }
  cachedProfile = data;
  return data;
}

async function signUp({ email, password, fullName, userType, fuerza, unidad, callsign }) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        user_type: userType,
        fuerza: fuerza || null,
        unidad_destino: unidad || null,
        callsign: callsign || null
      }
    }
  });
  if (error) throw error;
  return data;
}

async function signIn({ email, password }) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  cachedProfile = null;
  return data;
}

async function signOut() {
  const supabase = await getSupabaseClient();
  await supabase.auth.signOut();
  cachedProfile = null;
  window.location.href = 'login.html';
}

async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

async function requireVerified() {
  const session = await requireAuth();
  if (!session) return null;
  const profile = await getProfile();
  if (!profile || !profile.verified) {
    window.location.href = 'pendiente.html';
    return null;
  }
  return profile;
}

document.getElementById('logoutBtn')?.addEventListener('click', signOut);
