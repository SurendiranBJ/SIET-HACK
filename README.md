# Exam Safe

A session-based platform for managing student, teacher, and admin accounts with live session tracking, forced screen-share verification, and role-based access control.

---

## Overview

Exam Safe manages authenticated user sessions for students, teachers, and admins, with strict controls around session persistence, screen sharing, and account privileges. The UI has been fully redesigned around a clean login → session → lock/kickout flow.

---

## What's New in This Update

- **Complete UI overhaul** — redesigned login, dashboard, and session screens for a cleaner user flow.
- **Kickout flow fixed** — users who are kicked out are now properly logged out and required to start a fresh session (no stale-session leakage).
- **Lock screen fixed** — lock screen now correctly re-locks and re-authenticates instead of silently letting old sessions through.
- **Screen-share enforcement** — users can only log in and access their session **after** sharing their entire screen (not a window/tab). Partial or no screen share blocks login.
- **Session persistence on refresh** — previously, refreshing the page created a brand-new session (major bug). Now the session correctly persists across refreshes.
- **Kickout/lock + refresh bug fixed** — previously, a kicked-out or locked user could bypass the restriction by refreshing, which forced a new session and let them back in. This loophole is now closed — refreshing no longer resets kickout/lock state.
- **Role-based privileges added:**
  - **Admin** — full control: create/edit/delete/block any account (students, teachers), manage all sessions.
  - **Teacher** — can only create student accounts and block/unblock students they manage. No access to teacher/admin account management.
  - **Student** — standard login/session flow only.

---

## Roles & Permissions

| Action                        | Admin | Teacher | Student |
|-------------------------------|:-----:|:-------:|:-------:|
| Create student accounts       | ✅    | ✅      | ❌      |
| Block/unblock students        | ✅    | ✅      | ❌      |
| Create/manage teacher accounts| ✅    | ❌      | ❌      |
| Kick out / lock any session   | ✅    | ✅ (students only) | ❌ |
| Login and start a session     | ✅    | ✅      | ✅      |

---

## Tech Stack

- **Backend:** Node.js (`server/src/index.js`)
- **Frontend:** React (or your framework) via `npm run dev`
- **Session handling:** Persistent sessions (survive page refresh)

> Fill in specifics here — e.g. Express, database used, auth method (JWT/sessions), WebSocket library if used for live kickout/lock.

---

##  Project Structure
```
SIET-HACK
│
├── agent/
│
├── frontend/
│   ├── src/
│   └── public/
│
├── server/
│   ├── src/
│   └── index.js
│
└── README.md
```

---
---

## ⚙️ Getting Started

### 1. Start the Backend

```bash
cd server/src
node index.js
```

### 2. Start the Frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at the local dev URL shown in the terminal (typically `http://localhost:5173` or `http://localhost:3000`).

---

## Login & Session Flow

1. User navigates to the app in the browser and logs in with their credentials.
2. User is required to **share their entire screen** — login only completes once full screen sharing is confirmed.
3. On successful login, a persistent session is created.
4. **Refreshing the page no longer creates a new session** — the existing session is restored seamlessly.
5. If a user is **kicked out** or the screen is **locked** by a teacher/admin, they are required to authenticate a new session — this restriction now holds even after a page refresh.

---

## Roadmap / Planned Work

- **Auto-launch `.exe` on student login:**
  - Student logs in via browser.
  - System detects the account is a student.
  - A companion `.exe` executes automatically.
  - The `.exe` prompts for a **session key**.
  - Once the session key is entered, the student is logged in and session-linked.

---

## Known Fixed Bugs (Changelog)

| Bug | Status |
|-----|--------|
| Refreshing created a new session instead of resuming | ✅ Fixed |
| Kicked-out/locked users could bypass restriction via refresh | ✅ Fixed |
| Users could log in without sharing full screen | ✅ Fixed |
| Lock screen not properly re-locking | ✅ Fixed |
| No role separation between teacher/admin privileges | ✅ Fixed |

---
