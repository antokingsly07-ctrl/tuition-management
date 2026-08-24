const { handle, clean } = require("./_db");

module.exports = async (req, res) => {
  await handle(req, res, async (db) => {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const [users, students, payments, attendance] = await Promise.all([
      db.collection("users").find({}, { projection: { password: 0 } }).toArray(),
      db.collection("students").find().toArray(),
      db.collection("payments").find().toArray(),
      db.collection("attendance").find().toArray()
    ]);
    res.status(200).json({
      users: users.map(clean),
      students: students.map(clean),
      payments: payments.map(clean),
      attendance: attendance.map(a => ({ id: String(a._id), date: a.date, section: a.section, records: a.records }))
    });
  });
};
