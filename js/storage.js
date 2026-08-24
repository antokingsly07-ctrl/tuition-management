/* ============================================================
   Data layer — MongoDB Atlas via Vercel serverless API (/api)
   Falls back to localStorage automatically when the backend
   isn't configured (no MONGODB_URI) or unreachable.
   Reads are served from an in-memory cache; writes update the
   cache immediately (optimistic) then sync to the server.
   ============================================================ */

const DB = (() => {
  const LOCAL_KEY = "tuition_manager_v2";
  let mem = null;
  let remote = false;

  /* UI hook: set from app.js to show error toasts */
  let onWriteError = null;
  function fail(scope, err) {
    console.error(`[DB] ${scope} failed:`, err);
    if (onWriteError) onWriteError(scope, err);
  }

  function seed() {
    return {
      users: [
        { id: "u_admin", username: "admin", password: "admin123", name: "Admin", role: "admin", section: null },
        { id: "u_tuition", username: "tuition", password: "teach123", name: "Tuition Teacher", role: "teacher", section: "tuition" },
        { id: "u_typewriting", username: "typewriting", password: "teach123", name: "Typewriting Teacher", role: "teacher", section: "typewriting" }
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
  }

  function persistLocal() {
    if (!remote) localStorage.setItem(LOCAL_KEY, JSON.stringify(mem));
  }

  async function api(path, opts) {
    const res = await fetch("/api/" + path, {
      headers: { "Content-Type": "application/json" },
      ...opts
    });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  /* ---------- init ---------- */
  async function init() {
    try {
      const d = await api("bootstrap");
      mem = {
        users: d.users || [],
        students: d.students || [],
        payments: d.payments || [],
        attendance: d.attendance || []
      };
      remote = true;
      return "mongodb";
    } catch (err) {
      console.warn("[DB] backend unavailable, using localStorage:", err.message);
      remote = false;
      const raw = localStorage.getItem(LOCAL_KEY);
      mem = raw ? JSON.parse(raw) : seed();
      persistLocal();
      return "local";
    }
  }

  /* ---------- sync read (app.js uses this everywhere) ---------- */
  function load() {
    return mem || seed();
  }

  function uid(prefix = "") {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- auth ---------- */
  async function authenticate(username, password) {
    if (remote) {
      return api("login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
    }
    // local fallback
    const user = mem.users.find(u => u.username === username && u.password === password);
    if (!user) return null;
    const { password: _pw, ...safe } = user;
    return safe;
  }

  /* ---------- granular writes ---------- */
  async function addStudent(student) {
    student.id = student.id || uid("s_");
    mem.students.push(student);
    persistLocal();
    if (remote) {
      try { Object.assign(student, await api("students", { method: "POST", body: JSON.stringify(student) })); }
      catch (err) { fail("addStudent", err); }
    }
    return student;
  }

  async function updateStudent(id, patch) {
    const s = mem.students.find(x => x.id === id);
    if (s) Object.assign(s, patch);
    persistLocal();
    if (remote) {
      try { await api("students/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(patch) }); }
      catch (err) { fail("updateStudent", err); }
    }
  }

  async function deleteStudent(id) {
    mem.students = mem.students.filter(x => x.id !== id);
    mem.payments = mem.payments.filter(p => p.studentId !== id);
    mem.attendance.forEach(a => delete a.records[id]);
    persistLocal();
    if (remote) {
      try { await api("students/" + encodeURIComponent(id), { method: "DELETE" }); }
      catch (err) { fail("deleteStudent", err); }
    }
  }

  async function addPayment(payment) {
    payment.id = payment.id || uid("p_");
    mem.payments.push(payment);
    persistLocal();
    if (remote) {
      try { Object.assign(payment, await api("payments", { method: "POST", body: JSON.stringify(payment) })); }
      catch (err) { fail("addPayment", err); }
    }
    return payment;
  }

  async function deletePayment(id) {
    mem.payments = mem.payments.filter(p => p.id !== id);
    persistLocal();
    if (remote) {
      try { await api("payments/" + encodeURIComponent(id), { method: "DELETE" }); }
      catch (err) { fail("deletePayment", err); }
    }
  }

  async function saveAttendance(date, section, records) {
    const existing = mem.attendance.find(a => a.date === date && a.section === section);
    if (existing) existing.records = records;
    else mem.attendance.push({ id: uid("a_"), date, section, records });
    persistLocal();
    if (remote) {
      try {
        const saved = await api("attendance", { method: "POST", body: JSON.stringify({ date, section, records }) });
        const row = mem.attendance.find(a => a.date === date && a.section === section);
        if (row && saved?.id) row.id = saved.id;
      } catch (err) { fail("saveAttendance", err); }
    }
  }

  return {
    get mode() { return remote ? "mongodb" : "local"; },
    init, load, authenticate,
    addStudent, updateStudent, deleteStudent,
    addPayment, deletePayment,
    saveAttendance,
    set onWriteError(fn) { onWriteError = fn; },
    uid
  };
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
