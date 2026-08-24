/* Shared MongoDB connection + request handler (cached across invocations) */

const { MongoClient } = require("mongodb");

let cachedClient = null;

async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
  }
  // use the db name from the URI path if present, otherwise "tuition"
  const match = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([a-zA-Z0-9_-]+)(?:\?|$)/);
  return cachedClient.db(match ? match[1] : "tuition");
}

function seedData() {
  return {
    users: [
      { id: "u_admin", username: "admin", password: "admin123", name: "Admin", role: "admin", section: null },
      { id: "u_tuition", username: "tuition", password: "teach123", name: "Tuition Teacher", role: "teacher", section: "tuition" },
      { id: "u_typewriting", username: "typewriting", password: "teach123", name: "Typewriting Teacher", role: "teacher", section: "typewriting" }
    ],
    students: [
      { id: "s_aarav", name: "Aarav Kumar", phone: "9876500001", section: "tuition", batch: "Morning", joinDate: "2026-06-01", monthlyFee: 800, active: true },
      { id: "s_diya", name: "Diya Sharma", phone: "9876500002", section: "tuition", batch: "Evening", joinDate: "2026-06-10", monthlyFee: 800, active: true },
      { id: "s_rohan", name: "Rohan Mehta", phone: "9876500003", section: "tuition", batch: "Evening", joinDate: "2026-07-01", monthlyFee: 1000, active: true },
      { id: "s_sneha", name: "Sneha Nair", phone: "9876500004", section: "typewriting", batch: "Batch A (10AM)", joinDate: "2026-05-15", monthlyFee: 500, active: true },
      { id: "s_vikram", name: "Vikram Singh", phone: "9876500005", section: "typewriting", batch: "Batch B (4PM)", joinDate: "2026-06-20", monthlyFee: 500, active: true }
    ]
  };
}

async function ensureSeed(db) {
  const users = db.collection("users");
  if ((await users.estimatedDocumentCount()) === 0) {
    const seed = seedData();
    await users.insertMany(seed.users);
    await db.collection("students").insertMany(seed.students);
  }
}

const clean = doc => {
  const c = { ...doc };
  delete c._id;
  return c;
};

function newId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* wraps each endpoint with db access, seeding and error handling */
async function handle(req, res, fn) {
  res.setHeader("Cache-Control", "no-store");
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "MONGODB_URI not configured — running without backend." });
  try {
    await ensureSeed(db);
    await fn(db, req, res);
  } catch (err) {
    console.error("[api]", err);
    res.status(500).json({ error: "Server error", detail: String(err.message || err) });
  }
}

module.exports = { getDb, ensureSeed, handle, clean, newId };
