# 🎓 Tuition Management System

A simple, responsive **Tuition Management System** built using **HTML, CSS, and JavaScript**. The application manages students, tuition/typewriting modules, fees, **attendance**, and user login.

Student, attendance, and fee data is stored in the **browser's localStorage** — no server or database is required. The app works directly on any device by opening the HTML files (or a static host).

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
| Browser       | localStorage data storage (no backend)     |
| Git / GitHub  | Version control and hosting                |
| Vercel        | Static hosting                             |

---

## 💾 How Data Storage Works

All data (students, attendance, fees, and login users) is stored in the browser's **localStorage** under the key `tuition_manager_v2`.

- **No server, no database, no API keys** — the app is fully self-contained.
- Data **persists across page refreshes** and browser restarts.
- The app **works offline** on any device.

> ⚠️ **Important:** localStorage is **per-device / per-browser**. Data saved on one phone or browser is **not shared** with other devices — each device keeps its own copy. If you need the same data on multiple devices, you would need a real backend; localStorage cannot sync between devices.

---

## ▶️ How to Run

- **Local:** open `index.html` in a browser. (Login page → `app.html` for the main app.)
- **Deployed (Vercel):** push to GitHub and Vercel serves it as a static site.

---

## 🔑 Login Accounts

On first load on a device (no saved data yet), the app seeds these accounts:

| Username    | Password   | Role        | Section       |
| ----------- | ---------- | ----------- | ------------- |
| `admin`     | `admin123` | Admin       | both          |
| `tuition`   | `teach123` | Teacher     | tuition       |
| `typewriting` | `teach123` | Teacher   | typewriting   |

Existing saved data (from the original app) is preserved automatically because it uses the same storage key.

## 📁 Project Structure

```text
tuition-management/
│
├── index.html          # Login page
├── app.html            # Main application (sidebar, sections, modals)
├── css/style.css       # Styling
├── js/
│   ├── storage.js      # Data layer — localStorage (students, fees, attendance, users)
│   ├── auth.js         # Login & session handling
│   └── app.js          # Dashboard, Students, Fees, Attendance UI
└── README.md
```

---

## 🧪 Local Testing Checklist

- [ ] Open `index.html`, log in (first run seeds demo login accounts)
- [ ] Add student → appears and persists after refresh
- [ ] Edit student → change persists after refresh
- [ ] Delete student → gone after refresh
- [ ] Attendance Present/Absent saved, survives refresh
- [ ] Change Present → Absent without duplicates
- [ ] Dashboard attendance statistics correct
- [ ] Fees: record payment, view history, survives refresh
