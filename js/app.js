/* ---------- App state & router ---------- */

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

/* ----- data helpers scoped to current section ----- */
function studentsOf(section = state.section) {
  return DB.load().students.filter(s => s.section === section);
}
function studentById(id) {
  return DB.load().students.find(s => s.id === id);
}
function paidFor(studentId, month) {
  return DB.load().payments
    .filter(p => p.studentId === studentId && p.month === month)
    .reduce((sum, p) => sum + Number(p.amount), 0);
}
function attendanceFor(date, section = state.section) {
  return DB.load().attendance.find(a => a.date === date && a.section === section);
}

/* =========================================================
   RENDER DISPATCH
========================================================= */
function render() {
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
    <div id="page-body"></div>
  `;

  ({ dashboard: renderDashboard, students: renderStudents, fees: renderFees, attendance: renderAttendance })[state.page]();
}

/* =========================================================
   DASHBOARD
========================================================= */
function renderDashboard() {
  const db = DB.load();
  const month = monthKey();
  const studs = studentsOf();
  const active = studs.filter(s => s.active);

  const expected = active.reduce((sum, s) => sum + Number(s.monthlyFee), 0);
  const collected = db.payments
    .filter(p => p.month === month && studentById(p.studentId)?.section === state.section)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pending = Math.max(expected - collected, 0);

  const attToday = attendanceFor(todayStr());
  let attSub = "Not marked yet";
  let attBadge = `<span class="badge gray">—</span>`;
  if (attToday) {
    const vals = Object.values(attToday.records);
    const present = vals.filter(v => v === "P").length;
    const pct = vals.length ? Math.round(present / vals.length * 100) : 0;
    attSub = `${present}/${vals.length} present`;
    attBadge = `<span class="badge ${pct >= 75 ? "green" : "amber"}">${pct}%</span>`;
  }

  const recentPayments = db.payments
    .filter(p => studentById(p.studentId)?.section === state.section)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  document.getElementById("page-body").innerHTML = `
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
          const s = studentById(p.studentId);
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
}

/* =========================================================
   STUDENTS
========================================================= */
function renderStudents() {
  const prev = document.getElementById("search-input");
  const hadFocus = document.activeElement === prev;
  const caret = prev?.selectionStart;
  const q = (prev?.value || "").toLowerCase();
  const studs = studentsOf()
    .filter(s => s.name.toLowerCase().includes(q) || (s.phone || "").includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  const actions = isAdmin ? `<button class="btn btn-primary" onclick="openStudentForm()">+ Add Student</button>` : "";

  document.getElementById("page-actions").innerHTML = actions;
  document.getElementById("page-body").innerHTML = `
    <div class="filter-bar">
      <label>Search
        <input type="text" id="search-input" placeholder="Name or phone..." value="${esc(q)}" oninput="renderStudents()">
      </label>
    </div>
    <div class="card">
      ${studs.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Phone</th><th>Batch</th><th>Monthly Fee</th><th>Status</th>${isAdmin ? "<th>Actions</th>" : ""}</tr></thead>
        <tbody>${studs.map(s => `
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

  if (hadFocus) {
    const input = document.getElementById("search-input");
    input.focus();
    input.setSelectionRange(caret, caret);
  }
}

window.openStudentForm = function (id = null) {
  const s = id ? studentById(id) : null;
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

  document.getElementById("student-form").addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const db = DB.load();
    if (s) {
      Object.assign(db.students.find(x => x.id === s.id), {
        name: f.get("name").trim(),
        phone: f.get("phone").trim(),
        batch: f.get("batch").trim(),
        monthlyFee: Number(f.get("monthlyFee")),
        joinDate: f.get("joinDate"),
        active: f.get("active") === "true"
      });
    } else {
      db.students.push({
        id: DB.uid("s_"),
        name: f.get("name").trim(),
        phone: f.get("phone").trim(),
        batch: f.get("batch").trim(),
        monthlyFee: Number(f.get("monthlyFee")),
        joinDate: f.get("joinDate"),
        section: state.section,
        active: f.get("active") === "true"
      });
    }
    DB.save(db);
    closeModal();
    toast(s ? "Student updated" : "Student added");
    render();
  });
};

window.deleteStudent = function (id) {
  const s = studentById(id);
  if (!confirm(`Delete "${s.name}"? Their payment history will also be removed.`)) return;
  const db = DB.load();
  db.students = db.students.filter(x => x.id !== id);
  db.payments = db.payments.filter(p => p.studentId !== id);
  db.attendance.forEach(a => delete a.records[id]);
  DB.save(db);
  toast("Student deleted");
  render();
};

/* =========================================================
   FEES
========================================================= */
function renderFees() {
  const month = document.getElementById("fee-month")?.value || monthKey();
  const studs = studentsOf().sort((a, b) => a.name.localeCompare(b.name));

  let totalExpected = 0, totalPaid = 0;

  const rows = studs.map(s => {
    const paid = paidFor(s.id, month);
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

  document.getElementById("page-body").innerHTML = `
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
}

window.openPaymentForm = function (studentId, month) {
  const s = studentById(studentId);
  const alreadyPaid = paidFor(studentId, month);
  openModal(`Record Payment — ${s.name}`, `
    <form id="payment-form">
      <p style="margin-bottom:14px;color:var(--text-muted)">
        Month: <strong>${monthName(month)}</strong> · Already paid: <strong>${formatMoney(alreadyPaid)}</strong> ·
        Balance: <strong>${formatMoney(Math.max(s.monthlyFee - alreadyPaid, 0))}</strong>
      </p>
      <label>Amount
        <input name="amount" type="number" min="1" required value="${Math.max(s.monthlyFee - alreadyPaid, 0)}">
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

  document.getElementById("payment-form").addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const db = DB.load();
    db.payments.push({
      id: DB.uid("p_"),
      studentId,
      amount: Number(f.get("amount")),
      month,
      date: f.get("date"),
      note: f.get("note").trim()
    });
    DB.save(db);
    closeModal();
    toast("Payment recorded");
    render();
  });
};

window.openHistory = function (studentId) {
  const s = studentById(studentId);
  const pays = DB.load().payments
    .filter(p => p.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date));

  openModal(`Payment History — ${s.name}`, pays.length ? `
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
  ` : `<div class="empty-state">No payments recorded for this student.</div>`);
};

window.deletePayment = function (payId, studentId) {
  if (!confirm("Delete this payment record?")) return;
  const db = DB.load();
  db.payments = db.payments.filter(p => p.id !== payId);
  DB.save(db);
  toast("Payment deleted");
  openHistory(studentId);
  render();
};

/* =========================================================
   ATTENDANCE
========================================================= */
function renderAttendance() {
  const date = document.getElementById("att-date")?.value || todayStr();
  const existing = attendanceFor(date);
  const records = existing ? { ...existing.records } : {};
  const studs = studentsOf().filter(s => s.active).sort((a, b) => a.name.localeCompare(b.name));

  const rows = studs.map(s => {
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

  document.getElementById("page-body").innerHTML = `
    <div class="filter-bar">
      <label>Date
        <input type="date" id="att-date" value="${date}" max="${todayStr()}" onchange="renderAttendance()">
      </label>
      ${existing ? `<span class="badge blue" style="align-self:center">Saved — edit and save again to update</span>` : ""}
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
        <button class="btn btn-primary" onclick="saveAttendance('${date}')">Save Attendance</button>
      </div>` : `<div class="empty-state">No active students in this section.</div>`}
    </div>
  `;

  updateAttSummary();
  if (rows) {
    document.getElementById("att-rows").addEventListener("change", updateAttSummary);
  }
}

function collectAttendance() {
  const records = {};
  studentsOf().filter(s => s.active).forEach(s => {
    const checked = document.querySelector(`input[name="att_${s.id}"]:checked`);
    if (checked) records[s.id] = checked.value;
  });
  return records;
}

function updateAttSummary() {
  const box = document.getElementById("att-summary");
  if (!box) return;
  const recs = collectAttendance();
  const vals = Object.values(recs);
  const present = vals.filter(v => v === "P").length;
  const absent = vals.filter(v => v === "A").length;
  const unmarked = studentsOf().filter(s => s.active).length - vals.length;
  box.innerHTML = `
    <span>Present: <strong style="color:var(--green)">${present}</strong></span>
    <span>Absent: <strong style="color:var(--red)">${absent}</strong></span>
    <span>Unmarked: <strong>${unmarked}</strong></span>
  `;
}

window.markAll = function (val) {
  studentsOf().filter(s => s.active).forEach(s => {
    const radio = document.querySelector(`input[name="att_${s.id}"][value="${val}"]`);
    if (radio) radio.checked = true;
  });
  updateAttSummary();
};

window.saveAttendance = function (date) {
  const records = collectAttendance();
  const total = studentsOf().filter(s => s.active).length;
  if (Object.keys(records).length < total) {
    if (!confirm("Some students are unmarked. Save anyway?")) return;
  }
  const db = DB.load();
  const existing = db.attendance.find(a => a.date === date && a.section === state.section);
  if (existing) {
    existing.records = records;
  } else {
    db.attendance.push({ id: DB.uid("a_"), date, section: state.section, records });
  }
  DB.save(db);
  toast("Attendance saved");
  render();
};

/* ----- boot ----- */
render();
