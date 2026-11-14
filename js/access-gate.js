(() => {
  const loginPage = "index.html";
  const sessionKey = "tanimtech-login-session";
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const isLoggedIn = () => window.localStorage.getItem(sessionKey) === "true";
  const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  window.tanimtechAuth = {
    sessionKey,
    isLoggedIn,
    async signOut() {
      const supabaseClient = await window.tanimtechGetSupabaseClient?.();
      if (supabaseClient) {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
      }
      window.localStorage.removeItem(sessionKey);
      window.localStorage.removeItem("tanimtech-profile-name");
      window.localStorage.removeItem("tanimtech-current-user");
      window.location.href = loginPage;
    },
  };

  if (currentPage !== loginPage && currentPage !== "login.html" && currentPage !== "signup.html" && !isLoggedIn()) {
    window.location.replace(`${loginPage}?next=${encodeURIComponent(nextPath)}`);
  }
})();
