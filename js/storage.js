/* ============================================================================
   DATA LAYER ΓÇö Supabase (PostgreSQL), optimized for performance

   DESIGN PRINCIPLES (why this is "best for Supabase"):
   - DEMAND-DRIVEN: we do NOT download the whole database on startup.
     Each page fetches only the rows it needs, asynchronously, so
     queries are small and fast.
   - COLUMN PROJECTION: every query requests only the columns it uses
     (e.g. attendance selects just student_id + status), cutting payload
     size and index scan work.
   - DATABASE-SIDE FILTERING: filtering by section/date/month happens in
     Postgres via .eq()/.order(), backed by composite indexes, instead of
     filtering entire tables in JavaScript.
   - Async methods are prefixed "fetch*". The old "load()" is kept only as
     a tiny in-memory cache for demo mode and small UI helpers.

   All Supabase connection settings live in  js/supabase.js
   ============================================================================ */

const DB = (() => {
  /* stale error hook for toast notifications (set by app.js) */
  let onWriteError = null;
  function fail(scope, err) {
    console.error(`[DB] ${scope} failed:`, err);
    if (onWriteError) onWriteError(scope, err);
  }

  /* is Supabase configured & loaded? */
  function isRemote() {
    return Boolean(window.SUPABASE_CONFIGURED && window.supabase);
  }

  /* tiny cache used only by demo mode + a few sync helpers */
  const cache = { users: [], students: [], payments: [], attendance: [] };

  /* ------------------------------------------------------------------
     FIELD MAPS ΓÇö convert between app field names and DB column names
     ------------------------------------------------------------------ */
  function rowToStudent(row) {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone || "",
      email: row.email || "",
      section: row.course || "tuition",
      batch: row.batch || "",
      joinDate: row.joining_date || "",
      monthlyFee: Number(row.fee_amount || 0),
      active: (row.status || "active") !== "inactive"
    };
  }
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
  function attStatusToCode(status) { return status === "Absent" ? "A" : "P"; }
  function codeToAttStatus(code) { return code === "A" ? "Absent" : "Present"; }

  /* compact column lists (projection) for each query */
  const STUDENT_COLS = "id,name,phone,email,course,batch,joining_date,fee_amount,status,created_at";

  /* =====================================================================
     AUTH ΓÇö app's own login checked against Supabase users table
     ===================================================================== */
  async function authenticate(username, password) {
    if (isRemote()) {
      const { data, error } = await supabase
        .from("users")
        .select("id,username,name,role,section")
        .eq("username", username)
        .eq("password", password)
        .maybeSingle();
      if (error) throw error;
      return data || null; // password never in projection
    }
    // demo mode
    const user = demo.users.find(u => u.username === username && u.password === password);
    if (!user) return null;
    const { password: _pw, ...safe } = user;
    return safe;
  }

  /* =====================================================================
     STUDENTS ΓÇö optimized queries
     ===================================================================== */

  // List students for a section (course), newest first, limited.
  async function fetchStudents(section) {
    if (!isRemote()) return (demo.students || []).filter(s => s.section === section);
    let q = supabase.from("students").select(STUDENT_COLS).order("created_at", { ascending: false }).limit(600);
    if (section) q = q.eq("course", section); // DB-side filtering via idx_students_course_created
    const { data, error } = await q;
    if (error) { fail("fetchStudents", error); return []; }
    return data.map(rowToStudent);
  }

  // All students (for admin dashboard across sections)
  async function fetchAllStudents() {
    return fetchStudents(null);
  }

  // One student row (used after insert/update)
  async function fetchStudent(id) {
    if (!isRemote()) return (demo.students || []).find(s => s.id === id) || null;
    const { data, error } = await supabase
      .from("students").select(STUDENT_COLS).eq("id", id).maybeSingle();
    if (error) { fail("fetchStudent", error); return null; }
    return data ? rowToStudent(data) : null;
  }

  /* ---------- student writes ---------- */
  async function addStudent(student) {
    if (isRemote()) {
      const { data, error } = await supabase
        .from("students").insert(studentToRow(student)).select(STUDENT_COLS).single();
      if (error) throw error;
      return rowToStudent(data);
    }
    const s = { id: "s_" + Date.now().toString(36), ...student };
    demo.students.push(s);
    demo.save();
    return s;
  }

  async function updateStudent(id, patch) {
    if (isRemote()) {
      const { error } = await supabase
        .from("students").update(studentToRow(patch)).eq("id", id);
      if (error) throw error;
      return;
    }
    const s = demo.students.find(x => x.id === id);
    if (s) { Object.assign(s, patch); demo.save(); }
  }

  async function deleteStudent(id) {
    if (isRemote()) {
      // attendance + payments removed automatically via ON DELETE CASCADE
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
      return;
    }
    demo.students = demo.students.filter(x => x.id !== id);
    demo.payments = demo.payments.filter(p => p.studentId !== id);
    demo.attendance.forEach(a => delete a.records[id]);
    demo.save();
  }

  /* =====================================================================
     FEES / PAYMENTS ΓÇö optimized queries
     ===================================================================== */

  // Month-wise fee summary for a section's students (used by the Fees page).
  async function fetchMonthPayments(month) {
    if (!isRemote()) return (demo.payments || []).filter(p => p.month === month);
    const { data, error } = await supabase
      .from("payments").select("id,student_id,amount,month,date,note").eq("month", month);
    if (error) { fail("fetchMonthPayments", error); return []; }
    return data.map(p => ({ id: p.id, studentId: p.student_id, amount: Number(p.amount), month: p.month, date: p.date, note: p.note }));
  }

  // Payment history for one student (kept small; indexed).
  async function fetchStudentPayments(studentId) {
    if (!isRemote()) return (demo.payments || []).filter(p => p.studentId === studentId);
    const { data, error } = await supabase
      .from("payments").select("id,amount,month,date,note")
      .eq("student_id", studentId).order("date", { ascending: false });
    if (error) { fail("fetchStudentPayments", error); return []; }
    return data.map(p => ({ id: p.id, amount: Number(p.amount), month: p.month, date: p.date, note: p.note }));
  }

  async function addPayment(payment) {
    if (isRemote()) {
      const { data, error } = await supabase
        .from("payments").insert({
          student_id: payment.studentId,
          amount: Number(payment.amount),
          month: payment.month,
          date: payment.date,
          note: payment.note || null
        }).select("id,amount,month,date,note").single();
      if (error) throw error;
      return { id: data.id, studentId: payment.studentId, amount: Number(data.amount), month: data.month, date: data.date, note: data.note };
    }
    const p = { id: "p_" + Date.now().toString(36), ...payment };
    demo.payments.push(p);
    demo.save();
    return p;
  }

  async function deletePayment(id) {
    if (isRemote()) {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
      return;
    }
    demo.payments = demo.payments.filter(p => p.id !== id);
    demo.save();
  }

  /* =====================================================================
     ATTENDANCE ΓÇö relational + upsert, optimized per-date query
     ===================================================================== */

  // Attendance for ONE date -> { studentId: "P"/"A" }
  async function fetchAttendanceForDate(date) {
    if (!isRemote()) {
      const e = (demo.attendance || []).find(a => a.date === date);
      return e ? { ...e.records } : {};
    }
    // Only 2 columns + DB-side filter on (attendance_date, student_id) index
    const { data, error } = await supabase
      .from("attendance").select("student_id,status").eq("attendance_date", date);
    if (error) { fail("fetchAttendanceForDate", error); return {}; }
    const map = {};
    data.forEach(r => { map[r.student_id] = attStatusToCode(r.status); });
    return map;
  }

  // Save attendance for a date (UPSERT per student so no duplicates)
  async function saveAttendance(date, records /* {studentId: "P"/"A"} */) {
    if (isRemote()) {
      const rows = Object.keys(records).map(studentId => ({
        student_id: studentId,
        attendance_date: date,
        status: codeToAttStatus(records[studentId])
      }));
      if (!rows.length) return;
      const { error } = await supabase
        .from("attendance").upsert(rows, { onConflict: "student_id,attendance_date" });
      if (error) throw error;
      return;
    }
    const e = (demo.attendance || []).find(a => a.date === date);
    if (e) e.records = records;
    else demo.attendance.push({ date, records });
    demo.save();
  }

  /* =====================================================================
     DASHBOARD aggregate ΓÇö single efficient call for the overview card
     (today's present vs total, passed in separately to keep it simple)
     ===================================================================== */

  /* =====================================================================
     Demo-mode helpers (only used when Supabase is not configured)
     ===================================================================== */
  const demo = (() => {
    let data = null;
    try { data = JSON.parse(localStorage.getItem("tuition_manager_demo_v1")); } catch { data = null; }
    if (!data) data = seedDemo();
    function save() { localStorage.setItem("tuition_manager_demo_v1", JSON.stringify(data)); }
    return {
      get students() { return data.students; }, set students(v) { data.students = v; save(); },
      get payments() { return data.payments; }, set payments(v) { data.payments = v; save(); },
      get attendance() { return data.attendance; }, set attendance(v) { data.attendance = v; save(); },
      users: data.users,
      save
    };
  })();

  function seedDemo() {
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

  /* keep a tiny public API surface compatible with any remaining sync callers.
     For the optimized build, prefer the async fetch* methods. */
  function load() { return { students: [], payments: [], attendance: [], users: demo.users }; }
  function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  return {
    get mode() { return isRemote() ? "supabase" : "demo"; },
    isRemote,
    uid,
    /* auth */
    authenticate,
    /* students */
    fetchStudents, fetchAllStudents, fetchStudent,
    addStudent, updateStudent, deleteStudent,
    /* payments */
    fetchMonthPayments, fetchStudentPayments, addPayment, deletePayment,
    /* attendance */
    fetchAttendanceForDate, saveAttendance,
    /* compatibility shims */
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
