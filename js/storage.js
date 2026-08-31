/* ============================================================================
   DATA LAYER — localStorage (no backend required)
   ============================================================================
   Data is stored entirely in the browser's localStorage so the app works on
   any device with no server. This replaces the previous MongoDB / Supabase
   backends.

   STORAGE KEY: "tuition_manager_v2"  (the same key used by the original app,
   so existing students/fees/attendance already saved on this device survive).

   NOTE: localStorage is PER-DEVICE / PER-BROWSER. Data saved on one phone or
   browser is NOT shared with other devices. Each device keeps its own copy.

   The DB facade below exposes the same async methods app.js calls, so the UI
   does not need to change.
   ============================================================================ */

const DB = (() => {
  const LOCAL_KEY = "tuition_manager_v2";

  /* UI hook: set from app.js to show error toasts */
  let onWriteError = null;
  function fail(scope, err) {
    console.error(`[DB] ${scope} failed:`, err);
    if (onWriteError) onWriteError(scope, err);
  }

  function uid(prefix = "") {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* seed data used only the FIRST time on a device with no saved data */
  function seed() {
    return {
      users: [
        { id: "u_admin", username: "admin", password: "admin123", name: "Admin", role: "admin", section: null },
        { id: "u_tuition", username: "tuition", password: "teach123", name: "Tuition Teacher", role: "teacher", section: "tuition" },
        { id: "u_typewriting", username: "typewriting", password: "teach123", name: "Typewriting Teacher", role: "teacher", section: "typewriting" }
      ],
      students: [
        { id: "s_seed1", name: "Aarav Kumar", phone: "9876500001", section: "tuition", batch: "Morning", joinDate: "2026-06-01", monthlyFee: 800, active: true },
        { id: "s_seed2", name: "Diya Sharma", phone: "9876500002", section: "tuition", batch: "Evening", joinDate: "2026-06-10", monthlyFee: 800, active: true },
        { id: "s_seed3", name: "Rohan Mehta", phone: "9876500003", section: "tuition", batch: "Evening", joinDate: "2026-07-01", monthlyFee: 1000, active: true },
        { id: "s_seed4", name: "Sneha Nair", phone: "9876500004", section: "typewriting", batch: "Batch A (10AM)", joinDate: "2026-05-15", monthlyFee: 500, active: true },
        { id: "s_seed5", name: "Vikram Singh", phone: "9876500005", section: "typewriting", batch: "Batch B (4PM)", joinDate: "2026-06-20", monthlyFee: 500, active: true }
      ],
      payments: [],
      attendance: []
    };
  }

  /* ---- read/write the whole store ---- */
  function load() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.students) return data;
      }
    } catch (err) {
      console.warn("[DB] could not parse stored data, re-seeding:", err.message);
    }
    const fresh = seed();
    save(fresh);
    return fresh;
  }

  function save(data) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("[DB] could not save to localStorage:", err);
    }
  }

  function get() { return load(); }

  /* =====================================================================
     AUTH — app's own users-table login (kept in localStorage)
     ===================================================================== */
  function authenticate(username, password) {
    const u = get().users.find(x => x.username === username && x.password === password);
    if (!u) return null;
    const { password: _pw, ...safe } = u;
    return safe;
  }

  /* =====================================================================
     STUDENTS
     ===================================================================== */
  function fetchStudents(section) {
    const d = get();
    return (d.students || []).filter(s => !section || s.section === section);
  }

  function fetchStudent(id) {
    return get().students.find(s => s.id === id) || null;
  }

  function addStudent(student) {
    const d = get();
    const s = { id: uid("s_"), ...student };
    d.students.push(s);
    save(d);
    return s;
  }

  function updateStudent(id, patch) {
    const d = get();
    const s = d.students.find(x => x.id === id);
    if (s) { Object.assign(s, patch); save(d); }
  }

  function deleteStudent(id) {
    const d = get();
    d.students = d.students.filter(x => x.id !== id);
    d.payments = (d.payments || []).filter(p => p.studentId !== id);
    (d.attendance || []).forEach(a => { if (a.records) delete a.records[id]; });
    save(d);
  }

  /* =====================================================================
     PAYMENTS (fees module)
     ===================================================================== */
  function fetchMonthPayments(month) {
    const d = get();
    return (d.payments || []).filter(p => p.month === month);
  }

  function fetchStudentPayments(studentId) {
    const d = get();
    return (d.payments || []).filter(p => p.studentId === studentId)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function addPayment(payment) {
    const d = get();
    const p = { id: uid("p_"), ...payment };
    d.payments.push(p);
    save(d);
    return p;
  }

  function deletePayment(id) {
    const d = get();
    d.payments = (d.payments || []).filter(p => p.id !== id);
    save(d);
  }

  /* =====================================================================
     ATTENDANCE — stored as {date, records} where records = {studentId:"P"/"A"}
     ===================================================================== */
  function fetchAttendanceForDate(date) {
    const d = get();
    const e = (d.attendance || []).find(a => a.date === date);
    return e ? { ...(e.records || {}) } : {};
  }

  function saveAttendance(date, records) {
    const d = get();
    if (!d.attendance) d.attendance = [];
    const existing = d.attendance.find(a => a.date === date);
    if (existing) existing.records = records;
    else d.attendance.push({ date, records });
    save(d);
  }

  /* =====================================================================
     Public API (async surface kept for app.js compatibility)
     ===================================================================== */
  return {
    get mode() { return "local"; },
    isRemote() { return false; },
    uid,
    /* auth */
    authenticate,
    /* students */
    fetchStudents, fetchStudent, addStudent, updateStudent, deleteStudent,
    /* payments */
    fetchMonthPayments, fetchStudentPayments, addPayment, deletePayment,
    /* attendance */
    fetchAttendanceForDate, saveAttendance,
    /* local-storage helpers (legacy compat) */
    load,
    set onWriteError(fn) { onWriteError = fn; }
  };
})();

/* ---------- Shared helpers (used by app.js) ---------- */
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
