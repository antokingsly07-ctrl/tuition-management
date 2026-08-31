# 🎓 Tuition Management System

A simple, responsive **Tuition Management System** built using **HTML, CSS, and JavaScript**. The application manages students, tuition/typewriting modules, fees, **attendance**, and user login.

Student and attendance data is now stored in a **real online PostgreSQL database (Supabase)**, so records **sync and persist across all devices** (phone, desktop, tablet) using the same login.

---

## ✨ Features

### 🔐 Authentication
- Login page (app's own user accounts — admin / tuition teacher / typewriting teacher)
- Session handling
- Logout functionality
- Role-based access:
  - **Admin** — sees both Tuition & Typewriting sections
  - **Tuition teacher** — Tuition only
  - **Typewriting teacher** — Typewriting only

### 📊 Dashboard
- Overview of total students
- Fee collection summary (collected / pending for the month)
- Today's attendance statistics
- Recent payments

### 👨‍🎓 Student Management
- Add students
- View / search students
- Edit student details
- Delete students (removes their attendance & payments automatically via the database)
- Separate Tuition and Typewriting sections

### 💰 Fee Management
- Record student fees (monthly)
- Track paid, pending, and outstanding fees
- View payment history (stored in the database)

### 📅 Attendance Management
- Mark students Present / Absent for any date
- Change Present → Absent (or vice versa) without duplicates
- Attendance is saved per student per day (UPSERT)
- Statistics: total, present, absent, percentage (dashboard)

---

## 🛠️ Technologies Used

| Technology    | Purpose                                    |
| ------------- | ------------------------------------------ |
| HTML5         | Application structure                      |
| CSS3          | UI design and responsive layout            |
| JavaScript    | Application logic                          |
| Supabase      | Online PostgreSQL database + RLS security  |
| Git / GitHub  | Version control and hosting                |
| Vercel        | Static hosting                             |

---

## ☁️ How Data Storage Works (Supabase)

All data — **students, attendance, fees, and the login accounts** — is stored in a hosted **PostgreSQL** database (Supabase). Because it lives in the cloud, the **same data is shared across every device** (phone, desktop, tablet) in real time.

- **Shared across devices**: add a student on your phone and it appears on your desktop.
- **Persists forever**: survives refresh, browser restart, and clearing site data.
- **No server to maintain**: Supabase hosts the database; the app is static.

The frontend talks to Supabase using the **public anon key** with Row Level Security (RLS) policies defined in the schema. The `service_role` key is never used in the browser.

---

## 🔧 Supabase Setup

> ✅ Already done for your project — the schema has been run and the credentials are wired into `js/supabase.js`. Steps below are for a fresh setup or troubleshooting.

### 1. Create a Supabase project
1. Go to https://supabase.com and create a free account.
2. Click **New project**, name it, set a database password, choose a region.

### 2. Run the database schema
1. Open the **SQL Editor** (Dashboard → SQL Editor → **New query**).
2. Copy the entire contents of **`supabase/schema.sql`**.
3. Paste it and click **RUN**.

This creates:
- `students` — student records (id, name, phone, email, course/section, batch, joining_date, fee_amount, status, timestamps)
- `attendance` — one row per student per day (`Present`/`Absent`), with `ON DELETE CASCADE` + unique `(student_id, attendance_date)`
- `users` — the app's own login accounts (admin / tuition / typewriting)
- `payments` — fee records referencing students
- plus indexes, the `updated_at` trigger, and RLS policies

### 3. Configure the frontend
The only config file is **`js/supabase.js`**:

```js
const SUPABASE_URL = "https://znxtqxhecnmpxylqiqyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_...";  // anon key, NOT service_role
```

### 4. Run the app
Open `index.html` locally or via the Vercel/GitHub Pages URL — it shows the shared data automatically.

---

## 🚀 How to Run

- **Local:** open `index.html` in a browser. (Login page → `app.html` for the main app.)
- **Deployed (Vercel):** push to GitHub and Vercel serves it as a static site.

---

## 🔑 Login Accounts

The logins live in the `users` table (seeded by `schema.sql`):

| Username    | Password   | Role        | Section       |
| ----------- | ---------- | ----------- | ------------- |
| `admin`     | `admin123` | Admin       | both          |
| `tuition`   | `teach123` | Teacher     | tuition       |
| `typewriting` | `teach123` | Teacher   | typewriting   |

## 📁 Project Structure

```text
tuition-management/
│
├── index.html          # Login page
├── app.html            # Main application (sidebar, sections, modals)
├── css/style.css       # Styling
├── js/
│   ├── supabase.js     # Supabase config (URL + anon key) + client
│   ├── storage.js      # Data layer — Supabase adapter (same DB facade)
│   ├── auth.js         # Login & session handling
│   └── app.js          # Dashboard, Students, Fees, Attendance UI
├── supabase/
│   └── schema.sql      # PostgreSQL schema — run in the Supabase SQL Editor
└── README.md
```

---

## 🧪 Testing Checklist

- [ ] Open `index.html`, log in as `admin / admin123`
- [ ] Add student → verify it appears in Supabase → Table Editor → `students`
- [ ] On a **second device**, open the same URL and log in → the student is there (shared DB)
- [ ] Edit student → change appears on both devices after refresh
- [ ] Delete student → gone everywhere (attendance/payments cascade-delete)
- [ ] Attendance Present/Absent saved, survives refresh
- [ ] Change Present → Absent without duplicates
- [ ] Dashboard attendance statistics correct
- [ ] Fees: record payment, view history, survives refresh
