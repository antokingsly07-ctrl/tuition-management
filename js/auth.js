/* ---------- Auth ---------- */

const Auth = {
  current() {
    const raw = sessionStorage.getItem("tm_session");
    return raw ? JSON.parse(raw) : null;
  },

  /* call only after DB.init() has resolved */
  login(username, password) {
    const user = DB.load().users.find(u => u.username === username && u.password === password);
    if (!user) return null;
    const session = { id: user.id, name: user.name, role: user.role, section: user.section || null };
    sessionStorage.setItem("tm_session", JSON.stringify(session));
    return session;
  },

  logout() {
    sessionStorage.removeItem("tm_session");
    location.href = "index.html";
  },

  require() {
    const s = this.current();
    if (!s) location.href = "index.html";
    return s;
  }
};

/* ----- login page wiring ----- */
const loginForm = document.getElementById("login-form");
if (loginForm) {
  if (Auth.current()) location.href = "app.html";

  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const errBox = document.getElementById("login-error");
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    errBox.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in…";

    try {
      await DB.init();
      const user = Auth.login(username, password);
      if (user) {
        location.href = "app.html";
        return;
      }
      errBox.textContent = "Invalid username or password.";
    } catch (err) {
      console.error(err);
      errBox.textContent = DB.mode === "supabase"
        ? "Could not reach the database. Check your connection and try again."
        : "Failed to load local data.";
    }

    submitBtn.disabled = false;
    submitBtn.textContent = "Sign In";
    errBox.classList.remove("hidden");
  });
}
