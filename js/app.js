/* ---------- App state & router ----------
   Data is loaded on demand from Supabase (see js/storage.js) so each page
   queries only what it needs. Render functions are async and show a small
   loading state while the (fast, indexed) query runs. */

const session = Auth.require();
const isAdmin = session.role === "admin";

/* teachers are locked to their own section; admin sees both */
const allowedSections = isAdmin ? ["tuition", "typewriting"] : [session.section];
if (!allowedSections.includes(session.section) && !isAdmin) {
  Auth.logout();
}

let state = {
  section: allowedSections[0], // 'tuition' | 'typewriting'
  page: "dashboard"            // 'dashboard' | 'students' | 'fees' | 'attendance'
};

const main = document.getElementById("main-content");

/* ----- sidebar wiring ----- */
document.getElementById("user-name").textContent = session.name;
document.getElementById("user-role").textContent =
  isAdmin ? "admin" : session.section + " teacher";

const sectionSwitch = document.getElementById("section-switch");
if (!isAdmin) {
  sectionSwitch.classList.add("hidden");
} else {
  document.querySelectorAll("#section-switch .section-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.section = btn.dataset.section;
      document.querySelectorAll("#section-switch .section-btn").forEach(b => b.classList.toggle("active", b === btn));
      render();
    });
  });
}

document.getElementById("logout-btn").addEventListener("click", () => Auth.logout());

/* teachers: show their fixed section in the sidebar */
if (!isAdmin) {
  const label = document.createElement("div");
  label.style.cssText = "padding:10px 16px;font-size:12px;color:#94a3b8;border-bottom:1px solid #1e293b";
  label.innerHTML = `Section: <strong style="color:#fff;text-transform:capitalize">${esc(session.section)}</strong>`;
  sectionSwitch.after(label);
}

document.querySelectorAll("#side-nav a").forEach(a => {
  a.addEventListener("click", e => {
    e.preventDefault();
    state.page = a.dataset.page;
    document.querySelectorAll("#side-nav a").forEach(x => x.classList.toggle("active", x === a));
    render();
  });
});

/* ----- modal helpers ----- */
const overlay = document.getElementById("modal-overlay");
function openModal(title, bodyHTML) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = bodyHTML;
  overlay.classList.remove("hidden");
}
function closeModal() { overlay.classList.add("hidden"); }
document.getElementById("modal-close").addEventListener("click", closeModal);
overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });

function toast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast " + type;
  setTimeout(() => t.classList.add("hidden"), 2600);
}

/* =========================================================
   RENDER DISPATCH (async — each page loads its own data)
========================================================= */
async function render() {
  const titles = {
    tuition: { dashboard: "Tuition Dashboard", students: "Tuition Students", fees: "Tuition Fees", attendance: "Tuition Attendance" },
    typewriting: { dashboard: "Typewriting Dashboard", students: "Typewriting Students", fees: "Typewriting Fees", attendance: "Typewriting Attendance" }
  };
  const t = titles[state.section][state.page];
  const sub = {
    dashboard: "Overview of students, fees and attendance",
    students: "Manage enrolled students",
    fees: "Monthly fee collection and dues",
    attendance: "Mark and review daily attendance"
  }[state.page];

  main.innerHTML = `
    <div class="page-head">
      <div><h2>${t}</h2><p>${sub}</p></div>
      <div id="page-actions"></div>
    </div>
    <div id="page-body"><div class="empty-state">Loading…</div></div>
  `;

  const dispatcher = {
    dashboard: renderDashboard,
    students: renderStudents,
    fees: renderFees,
    attendance: renderAttendance
  }[state.page];
  await dispatcher();
}

/* =========================================================
   DASHBOARD
========================================================= */
async function renderDashboard() {
  const month = monthKey();
  const body = document.getElementById("page-body");
  body.innerHTML = `<div class="empty-state">Loading…</div>`;

  try {
    // Fetch the pieces needed for the dashboard cards in parallel.
    const [studs, monthPayments] = await Promise.all([
      DB.fetchStudents(state.section),
      DB.fetchMonthPayments(month)
    ]);

    const active = studs.filter(s => s.active);
    const expected = active.reduce((sum, s) => sum + Number(s.monthlyFee), 0);
    const collected = monthPayments
      .filter(p => studs.some(s => s.id === p.studentId))
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const pending = Math.max(expected - collected, 0);
    const studById = new Map(studs.map(s => [s.id, s]));

    let attSub = "Not marked yet";
    let attBadge = `<span class="badge gray">—</span>`;
    const attToday = await DB.fetchAttendanceForDate(todayStr());
    const presentKeys = Object.keys(attToday).filter(k => attToday[k] === "P" && studById.has(k));
    const totalMarked = Object.keys(attToday).length;
    if (totalMarked) {
      const pct = Math.round(presentKeys.length / totalMarked * 100);
      attSub = `${presentKeys.length}/${totalMarked} present`;
      attBadge = `<span class="badge ${pct >= 75 ? "green" : "amber"}">${pct}%</span>`;
    }

    const recentPayments = monthPayments
      .filter(p => studById.has(p.studentId))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 5);

    body.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card accent-blue">
          <div class="stat-label">Total Students</div>
          <div class="stat-value">${studs.length}</div>
          <div class="stat-sub">${active.length} active</div>
        </div>
        <div class="stat-card accent-green">
          <div class="stat-label">Collected (${monthName(month)})</div>
          <div class="stat-value">${formatMoney(collected)}</div>
          <div class="stat-sub">of ${formatMoney(expected)} expected</div>
        </div>
        <div class="stat-card accent-red">
          <div class="stat-label">Pending Dues</div>
          <div class="stat-value">${formatMoney(pending)}</div>
          <div class="stat-sub">${monthName(month)}</div>
        </div>
        <div class="stat-card accent-amber">
          <div class="stat-label">Today's Attendance</div>
          <div class="stat-value">${attBadge}</div>
          <div class="stat-sub">${attSub}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Recent Payments</h3></div>
        ${recentPayments.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Student</th><th>Month</th><th>Amount</th><th>Note</th></tr></thead>
          <tbody>${recentPayments.map(p => {
            const s = studById.get(p.studentId);
            return `<tr>
              <td>${esc(p.date)}</td>
              <td>${esc(s ? s.name : "Deleted student")}</td>
              <td>${esc(monthName(p.month))}</td>
              <td><strong>${formatMoney(p.amount)}</strong></td>
              <td>${esc(p.note || "—")}</td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>` : `<div class="empty-state">No payments recorded yet.</div>`}
      </div>
    `;
  } catch (err) {
    console.error(err);
    body.innerHTML = `<div class="empty-state">Could not load dashboard.</div>`;
  }
}

/* =========================================================
   STUDENTS
========================================================= */
let studentSearchToken = 0; // avoid stale search races

function renderStudentsTable(studs, q) {
  const filtered = studs
    .filter(s => s.name.toLowerCase().includes(q) || (s.phone || "").includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const actions = isAdmin ? `<button class="btn btn-primary" onclick="openStudentForm()">+ Add Student</button>` : "";
  document.getElementById("page-actions").innerHTML = actions;
  document.getElementById("page-body").innerHTML = `
    <div class="filter-bar">
      <label>Search
        <input type="text" id="search-input" placeholder="Name or phone..." value="${esc(q)}" oninput="onStudentSearch()">
      </label>
    </div>
    <div class="card">
      ${filtered.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Phone</th><th>Batch</th><th>Monthly Fee</th><th>Status</th>${isAdmin ? "<th>Actions</th>" : ""}</tr></thead>
        <tbody>${filtered.map(s => `
          <tr>
            <td><strong>${esc(s.name)}</strong></td>
            <td>${esc(s.phone || "—")}</td>
            <td>${esc(s.batch || "—")}</td>
            <td>${formatMoney(s.monthlyFee)}</td>
            <td><span class="badge ${s.active ? "green" : "gray"}">${s.active ? "Active" : "Inactive"}</span></td>
            ${isAdmin ? `
            <td class="actions-cell">
              <button class="btn btn-outline btn-sm" onclick='openStudentForm(${JSON.stringify(s.id)})'>Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteStudent('${s.id}')">Delete</button>
            </td>` : ""}
          </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty-state">No students found.</div>`}
    </div>
  `;
}

let cachedStudents = [];

async function renderStudents() {
  const body = document.getElementById("page-body");
  body.innerHTML = `<div class="empty-state">Loading students…</div>`;
  try {
    // search happens client-side over one cached, section-scoped query
    cachedStudents = await DB.fetchStudents(state.section);
    renderStudentsTable(cachedStudents, "");
  } catch (err) {
    console.error(err);
    body.innerHTML = `<div class="empty-state">Could not load students.</div>`;
  }
}

window.onStudentSearch = function () {
  const input = document.getElementById("search-input");
  const q = (input?.value || "").toLowerCase();
  renderStudentsTable(cachedStudents, q);
  input && input.focus(); // keep focus while typing (no re-query needed)
};

window.openStudentForm = function (id = null) {
  const s = id ? cachedStudents.find(x => x.id === id) : null;
  openModal(s ? "Edit Student" : "Add Student", `
    <form id="student-form">
      <label>Full Name
        <input name="name" required value="${esc(s?.name || "")}">
      </label>
      <label>Phone
        <input name="phone" value="${esc(s?.phone || "")}">
      </label>
      <label>Batch / Timing
        <input name="batch" placeholder="e.g. Morning / Batch A (10AM)" value="${esc(s?.batch || "")}">
      </label>
      <label>Monthly Fee
        <input name="monthlyFee" type="number" min="0" required value="${s?.monthlyFee ?? ""}">
      </label>
      <label>Join Date
        <input name="joinDate" type="date" value="${esc(s?.joinDate || todayStr())}">
      </label>
      <label>Status
        <select name="active">
          <option value="true" ${!s || s.active ? "selected" : ""}>Active</option>
          <option value="false" ${s && !s.active ? "selected" : ""}>Inactive</option>
        </select>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${s ? "Save Changes" : "Add Student"}</button>
      </div>
    </form>
  `);

  document.getElementById("student-form").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Saving…";
    const f = new FormData(e.target);
    const patch = {
      name: f.get("name").trim(),
      phone: f.get("phone").trim(),
      batch: f.get("batch").trim(),
      monthlyFee: Number(f.get("monthlyFee")),
      joinDate: f.get("joinDate"),
      active: f.get("active") === "true"
    };
    if (!patch.name) { toast("Name is required", "error"); btn.disabled = false; btn.textContent = s ? "Save Changes" : "Add Student"; return; }
    try {
      if (s) { await DB.updateStudent(s.id, patch); toast("Student updated"); }
      else { await DB.addStudent({ ...patch, section: state.section }); toast("Student added to database"); }
      closeModal();
    } catch (err) {
      console.error(err);
      toast("Could not save: " + (err.message || err), "error");
      btn.disabled = false; btn.textContent = s ? "Save Changes" : "Add Student";
      return;
    }
    await renderStudents(); // refresh the list from Supabase
  });
};

window.deleteStudent = async function (id) {
  const s = cachedStudents.find(x => x.id === id);
  if (!confirm(`Delete "${s?.name || ""}"? Their attendance and payment history will also be removed.`)) return;
  try {
    await DB.deleteStudent(id);
    toast("Student deleted");
  } catch (err) {
    console.error(err);
    toast("Could not delete: " + (err.message || err), "error");
    return;
  }
  await renderStudents();
};

/* =========================================================
   FEES
========================================================= */
let feeMonthCache = "";
let feePaymentsCache = [];

async function renderFees() {
  const month = document.getElementById("fee-month")?.value || monthKey();
  const body = document.getElementById("page-body");
  body.innerHTML = `<div class="empty-state">Loading fees…</div>`;

  try {
    // students + month payments in parallel (both indexed)
    const [studs, pays] = await Promise.all([
      DB.fetchStudents(state.section),
      DB.fetchMonthPayments(month)
    ]);
    feeMonthCache = month;
    feePaymentsCache = pays;
    const paidMap = new Map();
    pays.forEach(p => { paidMap.set(p.studentId, (paidMap.get(p.studentId) || 0) + Number(p.amount)); });

    const sorted = [...studs].sort((a, b) => a.name.localeCompare(b.name));
    let totalExpected = 0, totalPaid = 0;
    const rows = sorted.map(s => {
      const paid = paidMap.get(s.id) || 0;
      const due = Math.max(Number(s.monthlyFee) - paid, 0);
      totalExpected += Number(s.monthlyFee);
      totalPaid += Math.min(paid, Number(s.monthlyFee));
      const status = paid >= s.monthlyFee ? ["green", "Paid"] : paid > 0 ? ["amber", "Partial"] : ["red", "Unpaid"];
      return `
        <tr>
          <td><strong>${esc(s.name)}</strong></td>
          <td>${formatMoney(s.monthlyFee)}</td>
          <td>${formatMoney(paid)}</td>
          <td>${due > 0 ? `<strong style="color:var(--red)">${formatMoney(due)}</strong>` : "—"}</td>
          <td><span class="badge ${status[0]}">${status[1]}</span></td>
          <td class="actions-cell">
            ${isAdmin && s.active ? `<button class="btn btn-primary btn-sm" onclick="openPaymentForm('${s.id}','${month}')">Record Payment</button>` : ""}
            <button class="btn btn-outline btn-sm" onclick="openHistory('${s.id}')">History</button>
          </td>
        </tr>`;
    }).join("");

    body.innerHTML = `
      <div class="filter-bar">
        <label>Month
          <input type="month" id="fee-month" value="${month}" onchange="renderFees()">
        </label>
      </div>
      <div class="stats-grid">
        <div class="stat-card accent-blue"><div class="stat-label">Expected</div><div class="stat-value">${formatMoney(totalExpected)}</div></div>
        <div class="stat-card accent-green"><div class="stat-label">Collected</div><div class="stat-value">${formatMoney(totalPaid)}</div></div>
        <div class="stat-card accent-red"><div class="stat-label">Outstanding</div><div class="stat-value">${formatMoney(Math.max(totalExpected - totalPaid, 0))}</div></div>
      </div>
      <div class="card">
        ${rows ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Student</th><th>Monthly Fee</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>` : `<div class="empty-state">No students in this section yet.</div>`}
      </div>
    `;
  } catch (err) {
    console.error(err);
    body.innerHTML = `<div class="empty-state">Could not load fees.</div>`;
  }
}

window.openPaymentForm = function (studentId, month) {
  const s = cachedStudents.find(x => x.id === studentId);
  const alreadyPaid = (feePaymentsCache && feeMonthCache === month ? feePaymentsCache : [])
    .filter(p => p.studentId === studentId)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  openModal(`Record Payment — ${s?.name || ""}`, `
    <form id="payment-form">
      <p style="margin-bottom:14px;color:var(--text-muted)">
        Month: <strong>${monthName(month)}</strong> · Already paid: <strong>${formatMoney(alreadyPaid)}</strong> ·
        Balance: <strong>${formatMoney(Math.max((s?.monthlyFee || 0) - alreadyPaid, 0))}</strong>
      </p>
      <label>Amount
        <input name="amount" type="number" min="1" required value="${Math.max((s?.monthlyFee || 0) - alreadyPaid, 0)}">
      </label>
      <label>Date
        <input name="date" type="date" required value="${todayStr()}">
      </label>
      <label>Note (optional)
        <input name="note" placeholder="e.g. cash, UPI...">
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Payment</button>
      </div>
    </form>
  `);

  document.getElementById("payment-form").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Saving…";
    const f = new FormData(e.target);
    try {
      await DB.addPayment({
        studentId,
        amount: Number(f.get("amount")),
        month,
        date: f.get("date"),
        note: f.get("note").trim()
      });
      closeModal();
      toast("Payment recorded");
    } catch (err) {
      console.error(err);
      toast("Could not save payment: " + (err.message || err), "error");
      btn.disabled = false; btn.textContent = "Save Payment";
      return;
    }
    await renderFees();
  });
};

window.openHistory = async function (studentId) {
  const s = cachedStudents.find(x => x.id === studentId);
  openModal(`Payment History — ${s?.name || ""}`, `<div class="empty-state">Loading…</div>`);
  try {
    const pays = await DB.fetchStudentPayments(studentId);
    document.getElementById("modal-body").innerHTML = pays.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Month</th><th>Amount</th><th>Note</th>${isAdmin ? "<th></th>" : ""}</tr></thead>
        <tbody>${pays.map(p => `
          <tr>
            <td>${esc(p.date)}</td>
            <td>${esc(monthName(p.month))}</td>
            <td><strong>${formatMoney(p.amount)}</strong></td>
            <td>${esc(p.note || "—")}</td>
            ${isAdmin ? `<td><button class="btn btn-danger btn-sm" onclick="deletePayment('${p.id}','${studentId}')">Delete</button></td>` : ""}
          </tr>`).join("")}</tbody>
      </table></div>
    ` : `<div class="empty-state">No payments recorded for this student.</div>`;
  } catch (err) {
    console.error(err);
    document.getElementById("modal-body").innerHTML = `<div class="empty-state">Could not load history.</div>`;
  }
};

window.deletePayment = async function (payId, studentId) {
  if (!confirm("Delete this payment record?")) return;
  try {
    await DB.deletePayment(payId);
    toast("Payment deleted");
  } catch (err) {
    console.error(err);
    toast("Could not delete: " + (err.message || err), "error");
    return;
  }
  await openHistory(studentId);
  await renderFees();
};

/* =========================================================
   ATTENDANCE
========================================================= */
let attendanceDateCache = "";
let attendanceRecordsCache = {};
let attendanceStudentsCache = [];

function renderAttendanceTable(date, studs, records) {
  const sorted = [...studs].filter(s => s.active).sort((a, b) => a.name.localeCompare(b.name));
  const rows = sorted.map(s => {
    const val = records[s.id] || "";
    return `
      <tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td>${esc(s.batch || "—")}</td>
        <td>
          <div class="att-radio-group">
            <label><input type="radio" name="att_${s.id}" value="P" ${val === "P" ? "checked" : ""}> Present</label>
            <label><input type="radio" name="att_${s.id}" value="A" ${val === "A" ? "checked" : ""}> Absent</label>
          </div>
        </td>
      </tr>`;
  }).join("");

  const hasData = Object.keys(records).length > 0;

  document.getElementById("page-body").innerHTML = `
    <div class="filter-bar">
      <label>Date
        <input type="date" id="att-date" value="${date}" max="${todayStr()}" onchange="onAttDateChange()">
      </label>
      ${hasData ? `<span class="badge blue" style="align-self:center">Saved — edit and save again to update</span>` : ""}
    </div>
    <div class="card">
      ${rows ? `
      <div class="summary-strip" id="att-summary"></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Student</th><th>Batch</th><th>Status</th></tr></thead>
        <tbody id="att-rows">${rows}</tbody>
      </table></div>
      <div class="card-body" style="display:flex;justify-content:flex-end;gap:10px">
        <button class="btn btn-outline" onclick="markAll('P')">Mark All Present</button>
        <button class="btn btn-primary" onclick="saveAttendance()">Save Attendance</button>
      </div>` : `<div class="empty-state">No active students in this section.</div>`}
    </div>
  `;
  updateAttSummary(studs);
  if (rows) {
    document.getElementById("att-rows").addEventListener("change", () => updateAttSummary(studs));
  }
}

async function renderAttendance() {
  const date = document.getElementById("att-date")?.value || todayStr();
  const body = document.getElementById("page-body");
  body.innerHTML = `<div class="empty-state">Loading attendance…</div>`;
  try {
    // students for the section + attendance for just this date, in parallel
    const [studs, records] = await Promise.all([
      DB.fetchStudents(state.section),
      DB.fetchAttendanceForDate(date)
    ]);
    attendanceDateCache = date;
    attendanceRecordsCache = records || {};
    attendanceStudentsCache = studs;
    renderAttendanceTable(date, studs, attendanceRecordsCache);
  } catch (err) {
    console.error(err);
    body.innerHTML = `<div class="empty-state">Could not load attendance.</div>`;
  }
}

window.onAttDateChange = function () {
  const date = document.getElementById("att-date")?.value || todayStr();
  // fresh query for the newly selected date
  DB.fetchAttendanceForDate(date).then(records => {
    attendanceDateCache = date;
    attendanceRecordsCache = records || {};
    renderAttendanceTable(date, attendanceStudentsCache, attendanceRecordsCache);
  }).catch(err => { console.error(err); toast("Could not load that date", "error"); });
};

function currentAttendance() {
  const records = {};
  attendanceStudentsCache.filter(s => s.active).forEach(s => {
    const checked = document.querySelector(`input[name="att_${s.id}"]:checked`);
    if (checked) records[s.id] = checked.value;
  });
  return records;
}

function updateAttSummary(studs) {
  const box = document.getElementById("att-summary");
  if (!box) return;
  const recs = currentAttendance();
  const vals = Object.values(recs);
  const present = vals.filter(v => v === "P").length;
  const absent = vals.filter(v => v === "A").length;
  const unmarked = studs.filter(s => s.active).length - vals.length;
  box.innerHTML = `
    <span>Present: <strong style="color:var(--green)">${present}</strong></span>
    <span>Absent: <strong style="color:var(--red)">${absent}</strong></span>
    <span>Unmarked: <strong>${unmarked}</strong></span>
  `;
}

window.markAll = function (val) {
  attendanceStudentsCache.filter(s => s.active).forEach(s => {
    const radio = document.querySelector(`input[name="att_${s.id}"][value="${val}"]`);
    if (radio) radio.checked = true;
  });
  updateAttSummary(attendanceStudentsCache);
};

window.saveAttendance = async function () {
  const records = currentAttendance();
  const total = attendanceStudentsCache.filter(s => s.active).length;
  if (Object.keys(records).length < total) {
    if (!confirm("Some students are unmarked. Save anyway?")) return;
  }
  const btn = document.querySelector('button[onclick="saveAttendance()"]');
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
  try {
    await DB.saveAttendance(attendanceDateCache, records);
    toast("Attendance saved");
  } catch (err) {
    console.error(err);
    toast("Could not save attendance: " + (err.message || err), "error");
    if (btn) { btn.disabled = false; btn.textContent = "Save Attendance"; }
    return;
  }
  await renderAttendance();
};

/* ----- boot: just wire the error hook, then render the first page ----- */
(async function boot() {
  DB.onWriteError = (scope, err) => toast("Save failed — check connection", "error");
  const modeEl = document.getElementById("data-mode");
  if (modeEl) {
    const remote = DB.isRemote ? DB.isRemote() : false;
    modeEl.textContent = remote ? "● Connected to Supabase" : "● Demo / local only";
    modeEl.classList.toggle("online", remote);
  }
  await render();
})();
