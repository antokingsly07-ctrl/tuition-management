# 🎓 Tuition Management System

A simple, responsive **Tuition Management System** built using **HTML, CSS, and JavaScript**. The application manages students, tuition/typewriting modules, fees, **attendance**, and user login.

Student and attendance data is now stored in a **real online PostgreSQL database (Supabase)**, so records persist across browsers and devices. The app still works with demo data if Supabase is not yet configured.

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

## ☁️ Supabase Setup

Follow these steps to connect the app to a real PostgreSQL database.

### 1. Create a Supabase project
1. Go to https://supabase.com and create a free account.
2. Click **New project**, name it (e.g. `tuition-management`), set a database password, and choose a region. Wait for it to finish provisioning.

### 2. Run the database schema
1. Open the **SQL Editor** (Dashboard → SQL Editor → **New query**).
2. Copy the entire contents of **`supabase/schema.sql`**.
3. Paste it and click **RUN**.

This creates the tables, indexes, foreign key, unique constraints, the `updated_at` trigger, and Row Level Security (RLS) policies:
- `students` — student records (UUID id, name, phone, email, course/section, batch, joining date, fee_amount, status, timestamps)
- `attendance` — one row per student per day (status `Present`/`Absent`), with `ON DELETE CASCADE` from `students` and a unique constraint on `(student_id, attendance_date)`
- `users` — the app's own login accounts (admin / tuition / typewriting)
- `payments` — fee records referencing students

### 3. Get your Supabase URL and anon key
1. Dashboard → **Settings → API**.
2. Copy the **Project URL** and the **anon / public** key.
   - ⚠️ Use the **anon (public)** key only. **Never** use the `service_role` key in the frontend.

### 4. Configure the frontend
Open **`js/supabase.js`** and replace the two placeholder values:

```js
const SUPABASE_URL = "YOUR_SUPABASE_URL";                // e.g. https://abcdefgh.supabase.co
const SUPABASE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";    // anon key, NOT service_role
```

That is the **only** file you need to edit to connect Supabase.

### 5. Start the application
- **Local:** open `index.html` in a browser (or run any static server).
- **Deployed (Vercel):** push to GitHub and Vercel will redeploy automatically.

### 6. Test Student CRUD
1. Log in as `admin / admin123`.
2. Students → **+ Add Student**, fill the form, Save.
3. The student appears and remains after refresh — verify it in Supabase → **Table Editor → students**.

### 7. Test Attendance
1. Attendance → pick a date.
2. Mark students Present / Absent → **Save Attendance**.
3. Refresh the page — the marks remain. Change one and Save again (no duplicates).
4. Check the Dashboard for the current attendance statistics.

> The database (`students` + `attendance`) is now the **single source of truth**. Deleting a student in the app removes their attendance rows automatically (foreign key `ON DELETE CASCADE`).

---

## 📁 Project Structure

```text
tuition-management/
│
├── index.html          # Login page
├── app.html            # Main application (sidebar, sections, modals)
├── css/style.css       # Styling
├── js/
│   ├── supabase.js     # Supabase config (EDIT THIS) + client
│   ├── storage.js      # Data layer — Supabase adapter (same DB API)
│   ├── auth.js         # Login & session handling
│   └── app.js          # Dashboard, Students, Fees, Attendance UI
├── supabase/
│   └── schema.sql      # PostgreSQL schema — run in the Supabase SQL Editor
└── README.md
```

---

## ⚠️ Security Note

Row Level Security (RLS) is enabled on all tables, and the frontend uses only the **anon (public)** key. Because this app uses its **own** user logins (not Supabase Auth) with a `users` table, RLS grants the anon role full CRUD so the app keeps working. This is fine for a small internal tool, but for production you should migrate to **Supabase Auth** for real per-user security (out of scope for this change).

## 🧪 Local Testing Checklist

- [ ] Add student → appears in Supabase `students` table
- [ ] Student persists after page refresh
- [ ] Edit student → change appears in the database
- [ ] Delete student → gone after refresh (attendance/payments cascade-deleted)
- [ ] Attendance Present/Absent saved, survives refresh
- [ ] Change Present → Absent without duplicates
- [ ] Dashboard attendance statistics correct
