(() => {
  // Use the project URL and publishable key; never put a service_role key in the browser.
  window.TANIMTECH_SUPABASE_CONFIG = window.TANIMTECH_SUPABASE_CONFIG || {
    url: "",
    publishableKey: "",
  };

  const config = window.TANIMTECH_SUPABASE_CONFIG;
  const configured = Boolean(config.url || config.publishableKey);
  let clientPromise;

  window.tanimtechSupabaseConfigured = configured;
  window.tanimtechGetSupabaseClient = () => {
    if (!configured) return Promise.resolve(null);
    if (!config.url || !config.publishableKey) {
      return Promise.reject(new Error("Add both the Supabase project URL and publishable key in js/supabase-config.js."));
    }

    if (!clientPromise) {
      clientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
        .then(({ createClient }) => createClient(config.url, config.publishableKey));
    }
    return clientPromise;
  };
})();
