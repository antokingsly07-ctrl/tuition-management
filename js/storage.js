/* ============================================================================
   DATA LAYER — Supabase (PostgreSQL)

   This file replaces the old localStorage / MongoDB backend.
   It exposes the SAME "DB" object used by app.js and auth.js, so no changes
   are needed in those files.

   How it works:
   - On startup DB.init() loads all data from Supabase into an in-memory cache.
   - DB.load() returns that cache synchronously so the UI can render instantly.
   - Every write (add/edit/delete student, payment, attendance) updates Supabase
     AND refreshes the in-memory cache.

   IMPORTANT: All Supabase connection settings live in  js/supabase.js
   ============================================================================ */

const DB = (() => {
  const LOCAL_KEY = "tuition_manager_supabase_v1";
  let mem = null;       // in-memory cache shaped like { users, students, payments, attendance }

  /* UI hook: app.js sets this to show error toasts */
  let onWriteError = null;

  function fail(scope, err) {
    console.error(`[DB] ${scope} failed:`, err);
    if (onWriteError) onWriteError(scope, err);
  }

  /* Fallback seed data — used ONLY when Supabase isn't configured yet,
     so the app still opens in demo mode. The real data source is Supabase. */
  function seed() {
    return {
      users: [
        { id: "u_admin", username: "admin", password: "admin123", name: "Admin", role: "admin", section: null },
        { id: "u_tuition", username: "tuition", password: "teach123", name: "Tuition Teacher", role: "teacher", section: "tuition" },
        { id: "u_typewriting", username: "typewriting", password: "teach123", name: "Typewriting Teacher", role: "teacher", section: "typewriting" }
      ],
      students: [
        { id: "s_1", name: "Aarav Kumar", phone: "9876500001", section: "tuition", batch: "Morning", joinDate: "2026-06-01", monthlyFee: 800, active: true },
        { id: "s_2", name: "Diya Sharma", phone: "9876500002", section: "tuition", batch: "Evening", joinDate: "2026-06-10", monthlyFee: 800, active: true },
        { id: "s_3", name: "Rohan Mehta", phone: "9876500003", section: "tuition", batch: "Evening", joinDate: "2026-07-01", monthlyFee: 1000, active: true },
        { id: "s_4", name: "Sneha Nair", phone: "9876500004", section: "typewriting", batch: "Batch A (10AM)", joinDate: "2026-05-15", monthlyFee: 500, active: true },
        { id: "s_5", name: "Vikram Singh", phone: "9876500005", section: "typewriting", batch: "Batch B (4PM)", joinDate: "2026-06-20", monthlyFee: 500, active: true }
      ],
      payments: [],
      attendance: []
    };
  }

  /* =====================================================================
     FIELD MAPPERS — convert between the app's field names and the
     Supabase column names. This keeps app.js simple and unchanged.
     ===================================================================== */

  // Supabase row  ->  app student object
  function rowToStudent(row) {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone || "",
      email: row.email || "",
      section: row.course || "tuition",          // course column = tuition/typewriting section
      batch: row.batch || "",
      joinDate: row.joining_date || "",
      monthlyFee: Number(row.fee_amount || 0),
      active: (row.status || "active") !== "inactive",
      createdAt: row.created_at
    };
  }

  // app student object  ->  Supabase row
  function studentToRow(student) {
    return {
      name: student.name,
      phone: student.phone || null,
      email: student.email || null,
      course: student.section || "tuition",
      batch: student.batch || null,
      joining_date: student.joinDate || null,
      fee_amount: Number(student.monthlyFee || 0),
      status: student.active === false ? "inactive" : "active"
    };
  }

  // attendance row  ->  key in the per-date records map (e.g. "P"/"A")
  function attStatusToCode(status) {
    return status === "Absent" ? "A" : "P";
  }

  // app code ("P"/"A")  ->  attendance.status
  function codeToAttStatus(code) {
    return code === "A" ? "Absent" : "Present";
  }

  /* =====================================================================
     INIT — load everything from Supabase into the cache
     ===================================================================== */
  async function init() {
    // Not configured => run in demo mode with local seed data
    if (!window.SUPABASE_CONFIGURED || !window.supabase) {
      console.warn("[DB] Supabase not configured — using demo (local) data.");
      const raw = localStorage.getItem(LOCAL_KEY);
      mem = raw ? JSON.parse(raw) : seed();
      persistLocal();
      return "demo";
    }

    try {
      const [usersRes, studentsRes, paymentsRes, attendanceRes] = await Promise.all([
        supabase.from("users").select("*"),
        supabase.from("students").select("*"),
        supabase.from("payments").select("*"),
        supabase.from("attendance").select("*")
      ]);
      if (usersRes.error) throw usersRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (attendanceRes.error) throw attendanceRes.error;

      const users = usersRes.data.map(u => ({ ...u }));
      const students = studentsRes.data.map(rowToStudent);
      const payments = paymentsRes.data.map(p => ({ ...p }));

      // Convert flat attendance rows -> { date: { studentId: "P"/"A" }, ... }
      const attendance = {};
      attendanceRes.data.forEach(row => {
        const d = row.attendance_date;
        if (!attendance[d]) attendance[d] = {};
        attendance[d][row.student_id] = attStatusToCode(row.status);
      });
      // Store as an array to match the old shape the app expects
      const attendanceArray = Object.keys(attendance).map(date => ({
        date,
        section: null, // section is derived from students, resolved in attendanceFor()
        records: attendance[date]
      }));

      mem = { users, students, payments, attendance: attendanceArray };
      return "supabase";
    } catch (err) {
      console.error("[DB] init failed:", err);
      // Fall back to demo data rather than breaking the UI
      const raw = localStorage.getItem(LOCAL_KEY);
      mem = raw ? JSON.parse(raw) : seed();
      persistLocal();
      return "demo";
    }
  }

  function persistLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(mem));
  }

  /* ---------- sync read (app.js uses this everywhere) ---------- */
  function load() {
    return mem || seed();
  }

  /* defensive: guarantees writes never hit a null cache */
  function ensureMem() {
    if (!mem) {
      const raw = localStorage.getItem(LOCAL_KEY);
      mem = raw ? JSON.parse(raw) : seed();
      persistLocal();
    }
  }

  /* =====================================================================
     AUTH — app's own login, checked against the Supabase users table
     ===================================================================== */
  async function authenticate(username, password) {
    ensureMem();
    if (window.SUPABASE_CONFIGURED && window.supabase) {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { password: _pw, ...safe } = data;
      return safe;
    }
    // demo mode
    const user = mem.users.find(u => u.username === username && u.password === password);
    if (!user) return null;
    const { password: _pw, ...safe } = user;
    return safe;
  }

  /* =====================================================================
     STUDENT CRUD (Supabase)
     ===================================================================== */
  async function reloadStudents() {
    if (!(window.SUPABASE_CONFIGURED && window.supabase)) return;
    const { data, error } = await supabase.from("students").select("*");
    if (error) { fail("reloadStudents", error); return; }
    const students = data.map(rowToStudent);
    mem.students = students;
    persistLocal();
  }

  async function addStudent(student) {
    ensureMem();
    if (window.SUPABASE_CONFIGURED && window.supabase) {
      const { data, error } = await supabase
        .from("students")
        .insert(studentToRow(student))
        .select()
        .single();
      if (error) throw error;
      await reloadStudents();
      return mem.students.find(s => s.id === data.id);
    }
    // demo mode
    const appStudent = { id: uid("s_"), ...student };
    mem.students.push(appStudent);
    persistLocal();
    return appStudent;
  }

  async function updateStudent(id, patch) {
    ensureMem();
    if (window.SUPABASE_CONFIGURED && window.supabase) {
      const { error } = await supabase
        .from("students")
        .update(studentToRow(patch))
        .eq("id", id);
      if (error) throw error;
      await reloadStudents();
    } else {
      const s = mem.students.find(x => x.id === id);
      if (s) Object.assign(s, patch);
      persistLocal();
    }
  }

  async function deleteStudent(id) {
    ensureMem();
    if (window.SUPABASE_CONFIGURED && window.supabase) {
      // attendance rows are removed automatically via ON DELETE CASCADE
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    } else {
      mem.students = mem.students.filter(x => x.id !== id);
      mem.payments = mem.payments.filter(p => p.studentId !== id);
      mem.attendance.forEach(a => delete a.records[id]);
      persistLocal();
    }
    await reloadStudents();
  }

  /* =====================================================================
     PAYMENTS (kept working; Supabase stores them & references the student)
     ===================================================================== */
  async function addPayment(payment) {
    ensureMem();
    let row;
    if (window.SUPABASE_CONFIGURED && window.supabase) {
      const { data, error } = await supabase
        .from("payments")
        .insert({
          student_id: payment.studentId,
          amount: Number(payment.amount),
          month: payment.month,
          date: payment.date,
          note: payment.note || null
        })
        .select()
        .single();
      if (error) throw error;
      row = data;
    } else {
      row = { id: uid("p_"), ...payment };
      mem.payments.push({ ...payment, id: row.id });
      persistLocal();
      return mem.payments[mem.payments.length - 1];
    }
    // refresh payments cache
    if (window.SUPABASE_CONFIGURED && window.supabase) {
      const { data, error } = await supabase.from("payments").select("*");
      if (error) fail("reloadPayments", error);
      else mem.payments = data.map(p => ({ ...p }));
      persistLocal();
    }
    return mem.payments.find(p => p.id === row.id);
  }

  async function deletePayment(id) {
    ensureMem();
    if (window.SUPABASE_CONFIGURED && window.supabase) {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    } else {
      mem.payments = mem.payments.filter(p => p.id !== id);
      persistLocal();
    }
    // refresh cache
    if (window.SUPABASE_CONFIGURED && window.supabase) {
      const { data, error } = await supabase.from("payments").select("*");
      if (error) fail("reloadPayments", error);
      else mem.payments = data.map(p => ({ ...p }));
      persistLocal();
    }
  }

  /* =====================================================================
     ATTENDANCE (Supabase relational rows + upsert)
     UI sends  saveAttendance(date, section, { studentId: "P"/"A" })
     We turn each entry into a row and UPSERT so we never get duplicates
     for the same (student_id, attendance_date).
     ===================================================================== */
  async function saveAttendance(date, section, records) {
    ensureMem();
    if (window.SUPABASE_CONFIGURED && window.supabase) {
      // Build rows for every marked student
      const rows = Object.keys(records).map(studentId => ({
        student_id: studentId,
        attendance_date: date,
        status: codeToAttStatus(records[studentId])
      }));
      if (rows.length) {
        const { error } = await supabase
          .from("attendance")
          .upsert(rows, { onConflict: "student_id,attendance_date" });
        if (error) throw error;
      }
    } else {
      const existing = mem.attendance.find(a => a.date === date);
      if (existing) existing.records = records;
      else mem.attendance.push({ date, section, records });
      persistLocal();
    }
    await reloadAttendance(date);
  }

  async function reloadAttendance(forDate) {
    if (!(window.SUPABASE_CONFIGURED && window.supabase)) return;
    const { data, error } = await supabase.from("attendance").select("*");
    if (error) { fail("reloadAttendance", error); return; }

    // Rebuild the date->records map from all rows
    const byDate = {};
    data.forEach(row => {
      const d = row.attendance_date;
      if (!byDate[d]) byDate[d] = {};
      byDate[d][row.student_id] = attStatusToCode(row.status);
    });

    // Merge into the current attendance array
    if (!mem.attendance) mem.attendance = [];
    Object.keys(byDate).forEach(d => {
      let entry = mem.attendance.find(a => a.date === d);
      if (!entry) {
        entry = { date: d, section: null, records: {} };
        mem.attendance.push(entry);
      }
      entry.records = byDate[d];
    });
    // For the specifically requested date, make sure it's fully synced
    if (forDate && byDate[forDate]) {
      const entry = mem.attendance.find(a => a.date === forDate);
      if (entry) entry.records = byDate[forDate];
    }
    persistLocal();
  }

  /* ---------- id generator (demo/local only) ---------- */
  function uid(prefix = "") {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return {
    get mode() { return (window.SUPABASE_CONFIGURED && window.supabase) ? "supabase" : "demo"; },
    init,
    load,
    authenticate,
    addStudent, updateStudent, deleteStudent,
    addPayment, deletePayment,
    saveAttendance,
    set onWriteError(fn) { onWriteError = fn; },
    uid
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
