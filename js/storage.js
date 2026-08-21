/* ---------- Data layer (localStorage) ---------- */

const DB = (() => {
  const KEY = "tuition_manager_v2";

  function load() {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* corrupted -> reseed */ }
    }
    return seed();
  }

  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function uid(prefix = "") {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function seed() {
    const db = {
      users: [
        { id: uid("u_"), username: "admin", password: "admin123", name: "Admin", role: "admin" },
        { id: uid("u_"), username: "tuition", password: "teach123", name: "Tuition Teacher", role: "teacher", section: "tuition" },
        { id: uid("u_"), username: "typewriting", password: "teach123", name: "Typewriting Teacher", role: "teacher", section: "typewriting" }
      ],
      students: [
        { id: uid("s_"), name: "Aarav Kumar", phone: "9876500001", section: "tuition", batch: "Morning", joinDate: "2026-06-01", monthlyFee: 800, active: true },
        { id: uid("s_"), name: "Diya Sharma", phone: "9876500002", section: "tuition", batch: "Evening", joinDate: "2026-06-10", monthlyFee: 800, active: true },
        { id: uid("s_"), name: "Rohan Mehta", phone: "9876500003", section: "tuition", batch: "Evening", joinDate: "2026-07-01", monthlyFee: 1000, active: true },
        { id: uid("s_"), name: "Sneha Nair", phone: "9876500004", section: "typewriting", batch: "Batch A (10AM)", joinDate: "2026-05-15", monthlyFee: 500, active: true },
        { id: uid("s_"), name: "Vikram Singh", phone: "9876500005", section: "typewriting", batch: "Batch B (4PM)", joinDate: "2026-06-20", monthlyFee: 500, active: true }
      ],
      payments: [],
      attendance: []
    };
    save(db);
    return db;
  }

  return { load, save, uid };
})();

/* ---------- Shared helpers ---------- */

function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7); // "YYYY-MM"
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function formatMoney(n) {
  return "\u20B9" + Number(n || 0).toLocaleString("en-IN");
}

function monthName(key) {
  const [y, m] = key.split("-");
  return new Date(y, m - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
