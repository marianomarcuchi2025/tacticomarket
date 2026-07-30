let supabaseClientPromise = null;

function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = fetch('/api/public-config')
      .then((res) => res.json())
      .then(({ supabaseUrl, supabaseAnonKey }) => {
        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Supabase no está configurado en el servidor.');
        }
        return window.supabase.createClient(supabaseUrl, supabaseAnonKey);
      });
  }
  return supabaseClientPromise;
}
