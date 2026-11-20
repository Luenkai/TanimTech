(() => {
  const pendingStyle = document.createElement("style");
  pendingStyle.textContent = "html[data-auth-pending='true'] body{visibility:hidden}";
  document.head.append(pendingStyle);
  const loginPage = "index.html";
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const isPublicPage = currentPage === loginPage || currentPage === "login.html" || currentPage === "signup.html";
  const redirectToLogin = () => {
    window.location.replace(`${loginPage}?next=${encodeURIComponent(nextPath)}`);
  };

  window.tanimtechAuth = {
    async signOut() {
      const supabaseClient = await window.tanimtechGetSupabaseClient?.();
      if (supabaseClient) {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
      }
      [
        "tanimtech-profile-name",
        "tanimtech-current-user",
        "tanimtech-field-inputs",
        "tanimtech-local-profiles",
        "tanimtech-saved-recommendations",
        "tanimtech-saved-shortlist",
        "tanimtech-crop-plans",
      ].forEach((key) => window.localStorage.removeItem(key));
      window.location.href = loginPage;
    },
  };

  if (!isPublicPage) {
    document.documentElement.dataset.authPending = "true";
    const revealPage = () => delete document.documentElement.dataset.authPending;
    if (!window.tanimtechSupabaseConfigured) {
      console.error("Supabase Auth must be configured before opening private pages.");
      redirectToLogin();
    } else {
      window.tanimtechGetSupabaseClient()
        .then(async (client) => {
          if (!client) throw new Error("Supabase Auth is configured but unavailable.");
          const { data, error } = await client.auth.getUser();
          if (error) throw error;
          if (!data.user) {
            redirectToLogin();
            return;
          }
          revealPage();
        })
        .catch((error) => {
          console.error("Could not validate the Supabase session.", error);
          redirectToLogin();
        });
    }
  }
})();
