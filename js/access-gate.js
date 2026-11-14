(() => {
  const loginPage = "login.html";
  const sessionKey = "tanimtech-login-session";
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const isLoggedIn = () => window.localStorage.getItem(sessionKey) === "true";
  const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  window.tanimtechAuth = {
    sessionKey,
    isLoggedIn,
    signOut() {
      window.localStorage.removeItem(sessionKey);
      window.localStorage.removeItem("tanimtech-profile-name");
      window.location.href = loginPage;
    },
  };

  if (currentPage !== loginPage && !isLoggedIn()) {
    window.location.replace(`${loginPage}?next=${encodeURIComponent(nextPath)}`);
  }
})();
