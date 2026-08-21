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

---

# 🚀 Getting Started

## 1. Clone the Repository

Open a terminal and run:

```bash
git clone https://github.com/YOUR_USERNAME/tuition-management-system.git
```

Navigate into the project:

```bash
cd tuition-management-system
```

---

## 2. Open the Project in VS Code

```bash
code .
```

Make sure the project structure looks like:

```text
index.html
app.html
css/
js/
README.md
```

---

## 3. Run the Application

Since this is a frontend application, you can run it using **VS Code Live Server**.

### Install Live Server

1. Open VS Code
2. Go to **Extensions**
3. Search for:

```text
Live Server
```

4. Install the extension.

### Start the application

Right-click:

```text
index.html
```

and select:

```text
Open with Live Server
```

The application will open in your browser.

---

# 🔑 Login

The login system is handled by:

```text
js/auth.js
```

Session information is maintained using:

```text
localStorage
```

> Update the default credentials in `auth.js` according to your requirements before deploying the application publicly.

---

# 🗃️ Data Management

The current version uses browser `localStorage`.

The main data layer is:

```text
js/storage.js
```

Example data categories:

```javascript
students
fees
attendance
users
session
```

This makes the application easy to run without a database.

### Important

`localStorage` is **browser-specific**.

For example:

```text
Computer A
   ↓
Browser localStorage
   ↓
Student data
```

The same data will not automatically appear on:

```text
Computer B
Mobile
Another browser
```

---

# 🔄 Future Database Integration

The project can later be upgraded from:

```text
HTML
CSS
JavaScript
     ↓
localStorage
```

to:

```text
Frontend
   ↓
JavaScript
   ↓
API
   ↓
Database
```

Recommended backend/database options include:

* Supabase
* Firebase
* MongoDB
* MySQL
* PostgreSQL

For a free cloud deployment, **Supabase + Vercel** is a good option.

---

# 📚 Application Modules

## 1. Dashboard

The dashboard provides a quick overview of the tuition center.

Example statistics:

```text
Total Students
      ↓
Active Students

Fees
      ↓
Collected
Pending

Attendance
      ↓
Present
Absent
```

---

## 2. Tuition Module

The Tuition module is designed to manage regular tuition students.

Possible information:

```text
Student ID
Student Name
Class
School
Parent Name
Phone Number
Monthly Fee
Join Date
Status
```

---

## 3. Typewriting Module

The Typewriting module manages students enrolled in typewriting classes.

Possible information:

```text
Student ID
Student Name
Typewriting Level
Batch
Monthly Fee
Join Date
Status
```

---

## 4. Fees Module

The fee management system can track:

```text
Student
Month
Amount
Payment Date
Payment Status
Payment Method
```

Example:

```text
Student: Arun
Month: August 2026
Amount: ₹1,000
Status: Paid
Payment Date: 21-08-2026
```

---

## 5. Attendance Module

Attendance can be recorded using:

```text
Present
Absent
```

Example:

```text
Date: 21-08-2026

Arun       Present
Rahul      Present
Vijay      Absent
Priya      Present
```

---

# 📱 Responsive Design

The application is designed to work across different screen sizes:

* 💻 Desktop
* 💻 Laptop
* 📱 Mobile
* 📱 Tablet

The main styling is controlled by:

```text
css/style.css
```

---

# 🔒 Security Note

This project currently uses client-side authentication and `localStorage`.

This is suitable for:

* Learning
* Local use
* Prototype development
* Demonstration projects

It should **not be considered secure authentication for a production application**.

For production deployment, authentication should be moved to a secure backend/authentication provider such as Supabase Auth or Firebase Authentication.

---

# 🌐 Deployment

The application can be deployed for free using platforms such as:

* Vercel
* Netlify
* GitHub Pages

### Vercel Deployment

1. Push the project to GitHub.
2. Go to Vercel.
3. Create a new project.
4. Import your GitHub repository.
5. Select the repository.
6. Deploy.

Since this project is a static frontend application, no build command is required.

---

# 🔮 Future Improvements

Planned improvements can include:

* [ ] Supabase database integration
* [ ] Secure authentication
* [ ] Admin dashboard
* [ ] Multiple admin accounts
* [ ] Student profile pages
* [ ] Monthly fee reminders
* [ ] Automatic pending-fee calculation
* [ ] Attendance percentage calculation
* [ ] Fee receipt generation
* [ ] PDF receipt download
* [ ] Excel/CSV export
* [ ] Student import from Excel
* [ ] Advanced search and filtering
* [ ] Monthly reports
* [ ] Income reports
* [ ] Attendance reports
* [ ] Dark mode
* [ ] Mobile-friendly navigation
* [ ] Backup and restore
* [ ] Cloud database
* [ ] Parent/student portal
* [ ] WhatsApp fee reminders

---

# 🧪 Development

During development, recommended tools are:

```text
VS Code
Live Server
Google Chrome
Git
GitHub
```

To check browser storage:

```text
Chrome
→ F12
→ Application
→ Local Storage
```

You can inspect the stored application data there.

---

# 🤝 Contributing

Contributions are welcome.

### Steps

1. Fork the repository.
2. Create a new branch.

```bash
git checkout -b feature/new-feature
```

3. Make your changes.
4. Commit your changes.

```bash
git add .
git commit -m "Add new feature"
```

5. Push the branch.

```bash
git push origin feature/new-feature
```

6. Create a Pull Request.

---

# 📄 License

This project is available for educational and personal use.

You can modify and extend the project according to your requirements.

---

# 👨‍💻 Author

**Anto Kingsly**

B.Tech Artificial Intelligence & Data Science

---

## ⭐ Project Goal

The goal of this project is to create a simple and efficient tuition-center management system that reduces manual work involved in managing:

```text
Students
   ↓
Tuition / Typewriting
   ↓
Fees
   ↓
Attendance
   ↓
Reports
```

The project can eventually be expanded into a complete **cloud-based tuition management platform** with secure authentication, a real database, automated fee tracking, reports, and multi-device access.

---

## ⭐ If You Like This Project

If this project helped you, consider giving the repository a ⭐ on GitHub.
