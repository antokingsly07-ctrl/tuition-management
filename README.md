# 🎓 Tuition Management System

A simple, responsive **Tuition Management System** built using **HTML, CSS, and JavaScript**. The application helps manage students, tuition/typewriting modules, fees, attendance, and user login/session data.

The project uses **localStorage** as a lightweight client-side database, making it easy to run locally without requiring a backend server.

---

## ✨ Features

### 🔐 Authentication

* Login page
* Session handling using `localStorage`
* Logout functionality
* Basic authentication protection for the main application

### 📊 Dashboard

* Overview of total students
* Fee collection summary
* Pending fees
* Attendance statistics
* Quick access to major modules

### 👨‍🎓 Student Management

* Add students
* View student details
* Search students
* Filter students
* Manage students based on module
* Support for:

  * Tuition
  * Typewriting

### 💰 Fee Management

* Record student fees
* Track paid fees
* Track pending fees
* View fee history
* Calculate total collected amount
* Calculate outstanding fees

### 📅 Attendance Management

* Mark students as:

  * Present
  * Absent
* View attendance records
* Track attendance statistics
* Manage attendance by date

### 💾 Local Data Storage

The application currently uses the browser's `localStorage` to store:

* User/session information
* Student records
* Fee records
* Attendance records
* Application settings/data

Seed data is included to make the application usable immediately after setup.

---

## 🛠️ Technologies Used

| Technology   | Purpose                         |
| ------------ | ------------------------------- |
| HTML5        | Application structure           |
| CSS3         | UI design and responsive layout |
| JavaScript   | Application logic               |
| LocalStorage | Client-side data storage        |
| Git          | Version control                 |
| GitHub       | Source code hosting             |

---

## 📁 Project Structure

```text
tuition-management-system/
│
├── index.html
│   └── Login page
│
├── app.html
│   └── Main application
│       ├── Sidebar navigation
│       ├── Dashboard
│       ├── Students
│       ├── Fees
│       └── Attendance
│
├── css/
│   └── style.css
│       └── Application styling
│
├── js/
│   ├── storage.js
│   │   ├── localStorage data layer
│   │   └── Seed/demo data
│   │
│   ├── auth.js
│   │   └── Login and session handling
│   │
│   └── app.js
│       ├── Dashboard
│       ├── Student management
│       ├── Fee management
│       └── Attendance management
│
└── README.md
    └── Project documentation
```
