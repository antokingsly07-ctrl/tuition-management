const { handle, clean } = require("./_db");

module.exports = async (req, res) => {
  await handle(req, res, async (db) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { username, password } = req.body || {};
    const user = await db.collection("users").findOne({ username, password });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const { password: _pw, ...safe } = user;
    res.status(200).json(clean(safe));
  });
};
