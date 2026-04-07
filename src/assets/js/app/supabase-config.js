window.SupabaseApp = window.SupabaseApp || {};

(function (global) {
  const SB_CONFIG = {
    URL: 'https://izugqcbdlpttsmpvbfkc.supabase.co',
    KEY: 'sb_publishable_zLphTUg2K_vE9nNBc_tx7g_Twfh5LRi'
  };

  const supabaseClient = supabase.createClient(SB_CONFIG.URL, SB_CONFIG.KEY, {
    global: { headers: { apikey: SB_CONFIG.KEY } }
  });

  global.SupabaseApp.config = SB_CONFIG;
  global.SupabaseApp.supabaseClient = supabaseClient;
  window.supabaseClient = supabaseClient;
  window.SUPABASE_CONFIG = SB_CONFIG;
})(window);
