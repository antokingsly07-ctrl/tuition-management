const { handle, clean, newId } = require("./_db");

/* /api/payments
   POST           -> create  (body: payment object)
   DELETE ?id=    -> delete by id */
module.exports = async (req, res) => {
  await handle(req, res, async (db) => {
    const col = db.collection("payments");
    const id = req.query.id;

    if (req.method === "POST" && !id) {
      const doc = { ...req.body, id: req.body?.id || newId("p_") };
      await col.insertOne(doc);
      return res.status(201).json(clean(doc));
    }

    if (req.method === "DELETE" && id) {
      await col.deleteOne({ id });
      return res.status(200).json({ ok: true });
    }

    res.status(400).json({ error: "Bad request" });
  });
};
