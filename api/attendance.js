const { handle } = require("./_db");

/* /api/attendance
   POST -> upsert by {date, section, records} */
module.exports = async (req, res) => {
  await handle(req, res, async (db) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { date, section, records } = req.body || {};
    if (!date || !section) return res.status(400).json({ error: "date and section required" });
    await db.collection("attendance").updateOne(
      { date, section },
      { $set: { records: records || {} } },
      { upsert: true }
    );
    const saved = await db.collection("attendance").findOne({ date, section });
    res.status(200).json({ id: String(saved._id), date: saved.date, section: saved.section, records: saved.records });
  });
};
