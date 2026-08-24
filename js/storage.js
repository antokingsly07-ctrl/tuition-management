/* ============================================================
   Data layer — Supabase (remote) with localStorage fallback
   1. Create a project at https://supabase.com
   2. Run supabase-schema.sql in the SQL Editor
   3. Paste your Project URL + anon key below (Settings → API)
   Until keys are pasted, the app runs in local-only mode.
   ============================================================ */

const SUPABASE_URL = "";      // e.g. "https://abcdefgh.supabase.co"
const SUPABASE_ANON_KEY = ""; // e.g. "eyJhbGciOi..."

const DB = (() => {
  const LOCAL_KEY = "tuition_manager_v2";
  let mem = null; // in-memory cache shaped like the old DB object

  const client = (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  /* UI hook: set from app.js to show error toasts */
  let onWriteError = null;
  function fail(scope, err) {
    console.error(`[DB] ${scope} failed:`, err);
    if (onWriteError) onWriteError(scope, err);
  }

  function seed() {
    return {
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
  }

  /* ---------- init: load everything into memory ---------- */
  async function init() {
    if (!client) {
      const raw = localStorage.getItem(LOCAL_KEY);
      mem = raw ? JSON.parse(raw) : seed();
      persistLocal();
      return "local";
    }

    const [u, s, p, a] = await Promise.all([
      client.from("users").select("*"),
      client.from("students").select("*"),
      client.from("payments").select("*"),
      client.from("attendance").select("*")
    ]);
    for (const r of [u, s, p, a]) if (r.error) throw r.error;

    mem = { users: u.data, students: s.data, payments: p.data, attendance: a.data };

    // first run against an empty project → push seed data
    if (!mem.users.length && !mem.students.length) {
      const seeded = seed();
      const ins = await Promise.all([
        client.from("users").insert(seeded.users),
        client.from("students").insert(seeded.students)
      ]);
      for (const r of ins) if (r.error) throw r.error;
      mem.users = seeded.users;
      mem.students = seeded.students;
    }
    return "supabase";
  }

  /* ---------- sync reads (app.js uses these everywhere) ---------- */
  function load() {
    return mem || seed(); // safe fallback pre-init
  }

  function persistLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(mem));
  }

  function uid(prefix = "") {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- granular writes ---------- */
  async function addStudent(student) {
    student.id = student.id || uid("s_");
    mem.students.push(student);
    persistLocal();
    if (client) {
      const { error } = await client.from("students").insert(student);
      if (error) fail("addStudent", error);
    }
    return student;
  }

  async function updateStudent(id, patch) {
    const s = mem.students.find(x => x.id === id);
    if (s) Object.assign(s, patch);
    persistLocal();
    if (client) {
      const { error } = await client.from("students").update(patch).eq("id", id);
      if (error) fail("updateStudent", error);
    }
  }

  async function deleteStudent(id) {
    mem.students = mem.students.filter(x => x.id !== id);
    mem.payments = mem.payments.filter(p => p.studentId !== id);
    mem.attendance.forEach(a => delete a.records[id]);
    persistLocal();
    if (client) {
      const { error } = await client.from("students").delete().eq("id", id); // payments cascade
      if (error) return fail("deleteStudent", error);
      for (const a of mem.attendance) {
        const { error: aErr } = await client
          .from("attendance").update({ records: a.records }).eq("id", a.id);
        if (aErr) return fail("deleteStudent.attendance", aErr);
      }
    }
  }

  async function addPayment(payment) {
    payment.id = payment.id || uid("p_");
    mem.payments.push(payment);
    persistLocal();
    if (client) {
      const { error } = await client.from("payments").insert(payment);
      if (error) fail("addPayment", error);
    }
    return payment;
  }

  async function deletePayment(id) {
    mem.payments = mem.payments.filter(p => p.id !== id);
    persistLocal();
    if (client) {
      const { error } = await client.from("payments").delete().eq("id", id);
      if (error) fail("deletePayment", error);
    }
  }

  async function saveAttendance(date, section, records) {
    const existing = mem.attendance.find(a => a.date === date && a.section === section);
    if (existing) {
      existing.records = records;
      persistLocal();
      if (client) {
        const { error } = await client.from("attendance").update({ records }).eq("id", existing.id);
        if (error) fail("saveAttendance", error);
      }
    } else {
      const row = { id: uid("a_"), date, section, records };
      mem.attendance.push(row);
      persistLocal();
      if (client) {
        const { error } = await client.from("attendance").insert(row);
        if (error) fail("saveAttendance", error);
      }
    }
  }

  return {
    get mode() { return client ? "supabase" : "local"; },
    init, load,
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
