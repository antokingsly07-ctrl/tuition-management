const { handle, clean, newId } = require("./_db");

/* /api/students
   GET            -> list all students
   POST           -> create  (body: student object)
   PUT/DELETE ?id= -> update / delete by id */
module.exports = async (req, res) => {
  await handle(req, res, async (db) => {
    const col = db.collection("students");
    const id = req.query.id;

    if (req.method === "GET" && !id) {
      const students = await col.find().toArray();
      return res.status(200).json(students.map(clean));
    }

    if (req.method === "POST" && !id) {
      const doc = { ...req.body, id: req.body?.id || newId("s_") };
      await col.insertOne(doc);
      return res.status(201).json(clean(doc));
    }

    if ((req.method === "PUT" || req.method === "PATCH") && id) {
      const { id: _drop, ...patch } = req.body || {};
      await col.updateOne({ id }, { $set: patch });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE" && id) {
      await col.deleteOne({ id });
      await db.collection("payments").deleteMany({ studentId: id });
      await db.collection("attendance").updateMany({}, { $unset: { [`records.${id}`]: "" } });
      return res.status(200).json({ ok: true });
    }

    res.status(400).json({ error: "Bad request" });
  });
};
