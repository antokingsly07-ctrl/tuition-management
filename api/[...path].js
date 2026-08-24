/* REST API for the Tuition Manager frontend.
   Routes (catch-all under /api):
     POST   /api/login                {username, password} -> user (no password)
     GET    /api/bootstrap            -> {users:[], students, payments, attendance}
     GET    /api/students             -> all students
     POST   /api/students             create
     PUT    /api/students/:id         update
     DELETE /api/students/:id         delete (+ payments cascade + attendance cleanup)
     POST   /api/payments             create
     DELETE /api/payments/:id         delete
     POST   /api/attendance           upsert by {date, section, records}
*/

const { getDb, ensureSeed } = require("./_db");

function newId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const clean = doc => {
  const c = { ...doc };
  delete c._id;
  return c;
};

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const db = await getDb();
  if (!db) {
    return res.status(503).json({ error: "MONGODB_URI not configured — running without backend." });
  }

  const [resource, id] = req.query.path || [];
  const { method } = req;

  try {
    await ensureSeed(db);

    /* ---------- auth ---------- */
    if (resource === "login" && method === "POST") {
      const { username, password } = req.body || {};
      const user = await db.collection("users").findOne({ username, password });
      if (!user) return res.status(401).json({ error: "Invalid credentials" });
      const { password: _pw, ...safe } = user;
      return res.status(200).json(clean(safe));
    }

    /* ---------- initial load ---------- */
    if (resource === "bootstrap" && method === "GET") {
      const users = await db.collection("users").find({}, { projection: { password: 0 } }).toArray();
      const students = await db.collection("students").find().toArray();
      const payments = await db.collection("payments").find().toArray();
      const attendance = await db.collection("attendance").find().toArray();
      return res.status(200).json({
        users: users.map(clean),
        students: students.map(clean),
        payments: payments.map(clean),
        attendance: attendance.map(a => ({ id: String(a._id), date: a.date, section: a.section, records: a.records }))
      });
    }

    /* ---------- students ---------- */
    if (resource === "students") {
      if (method === "GET" && !id) {
        const students = await db.collection("students").find().toArray();
        return res.status(200).json(students.map(clean));
      }
      if (method === "POST" && !id) {
        const doc = { ...req.body, id: req.body?.id || newId("s_") };
        await db.collection("students").insertOne(doc);
        return res.status(201).json(clean(doc));
      }
      if ((method === "PUT" || method === "PATCH") && id) {
        const { id: _drop, ...patch } = req.body || {};
        await db.collection("students").updateOne({ id }, { $set: patch });
        return res.status(200).json({ ok: true });
      }
      if (method === "DELETE" && id) {
        await db.collection("students").deleteOne({ id });
        await db.collection("payments").deleteMany({ studentId: id });
        await db.collection("attendance").updateMany(
          {},
          { $unset: { [`records.${id}`]: "" } }
        );
        return res.status(200).json({ ok: true });
      }
    }

    /* ---------- payments ---------- */
    if (resource === "payments") {
      if (method === "POST" && !id) {
        const doc = { ...req.body, id: req.body?.id || newId("p_") };
        await db.collection("payments").insertOne(doc);
        return res.status(201).json(clean(doc));
      }
      if (method === "DELETE" && id) {
        await db.collection("payments").deleteOne({ id });
        return res.status(200).json({ ok: true });
      }
    }

    /* ---------- attendance (upsert by date+section) ---------- */
    if (resource === "attendance" && method === "POST" && !id) {
      const { date, section, records } = req.body || {};
      if (!date || !section) return res.status(400).json({ error: "date and section required" });
      await db.collection("attendance").updateOne(
        { date, section },
        { $set: { records: records || {} } },
        { upsert: true }
      );
      const saved = await db.collection("attendance").findOne({ date, section });
      return res.status(200).json({ id: String(saved._id), date: saved.date, section: saved.section, records: saved.records });
    }

    return res.status(404).json({ error: `No route: ${method} /api/${resource || ""}${id ? "/" + id : ""}` });
  } catch (err) {
    console.error("[api]", err);
    return res.status(500).json({ error: "Server error", detail: String(err.message || err) });
  }
};
