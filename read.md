# Exam Safe - System Blueprint & Technical Specification

Exam Safe is a real-time, low-overhead, AI-supported exam proctoring and integrity monitoring platform. It comprises a local Win32 Python agent (`student_agent.py`), an asynchronous Node.js Express server (`server`), and a modern Vite/React single-page dashboard (`frontend`).

---

## 1. System Architecture & Topology

The application uses a hub-and-spoke model using WebSockets for bi-directional live communication:

```
[Student's Windows Machine]                     [Teacher / Proctor Laptop]
    ├── Python Desktop Agent (Win32 APIs)           └── Vite + React Dashboard UI
    └── Secure Browser (Vite Exam Portal)                  ▲
             │                    │                        │
             │ (WS: /agent)       │ (WS: /agent)           │ (WS: /dashboard)
             ▼                    ▼                        ▼
      ┌────────────────────────────────────────────────────────┐
      │             Node.js / Express Backend Server           │
      │   ┌───────────────┐ ┌───────────────┐ ┌────────────┐   │
      │   │  RulesEngine  │ │  RiskEngine   │ │  AIEngine  │   │
      │   └───────────────┘ └───────────────┘ └────────────┘   │
      │            SQLite-Like In-Memory MockDB (JSON)         │
      └────────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### A. Windows Desktop Agent (`student_agent.py`)
* **Role**: Runs locally on student computers to gather native system telemetry.
* **Win32 Integration**: Uses Python `ctypes` to link to `kernel32.dll` and `user32.dll` to bypass shell limits and access system metrics directly.
* **Key OS API Hooks**:
  * `GetForegroundWindow` / `GetWindowTextW`: Extracts active application headers.
  * `GetLastInputInfo`: Measures system-wide physical input inactivity.
  * `GetLogicalDrives` / `GetDriveTypeW`: Detects hardware changes (e.g., removable USB mounts).
  * `EnumWindows` / `IsWindowVisible`: Counts open graphical windows.
* **Optimization**: Captures screen frames via `mss`, downsamples them to `800x600` via `Pillow`, compresses them to JPEG (30% quality), and encodes them as Base64. Average transmission payload is ~30KB per frame.

### B. Node.js Backend Server (`server`)
* **Role**: Coordinates sockets, authenticates accounts, runs rule models, logs telemetry, and computes risk profiles.
* **Database**: Runs a custom database driver (`MockDB`) in `db.js`. It supports SQLite syntax internally, handles tables in-memory, and serializes updates to a single JSON file (`database.json`) using a **500ms debounce save timer** to prevent disk blocking.

### C. Teacher Dashboard (`frontend`)
* **Role**: Admin and proctor UI.
* **Features**: Live Grid monitor, seating layout map (`SmartClassroomMap`), focus view, and user/rules management.

---

## 3. Communication & Socket.io Protocol

The application runs two Socket.io namespaces: `/agent` and `/dashboard`.

### `/agent` Namespace (Agent ⟷ Server)
* **`agent:register` (Client ➜ Server)**:
  ```json
  { "student_id": "STD-108", "hostname": "LAB-PC-01", "ip": "10.19.185.210", "mac": "00:50:56:C0:00:08" }
  ```
* **`agent:frame` (Client ➜ Server)**: Sends Base64 compressed JPEG frames + time logs.
* **`agent:activity` (Client ➜ Server)**: Periodic telemetry update.
  ```json
  {
    "mouse_delta": 45.2, "keystroke_count": 12, "idle_seconds": 0.2,
    "processes": ["chrome.exe", "vscode.exe"], "active_window": "Exam Portal - Safe Browser",
    "secondary_monitor": false, "monitor_count": 1, "window_count": 2, "usb_detected": false
  }
  ```
* **`command:warn` (Server ➜ Client)**: Triggers a warnings modal inside the student portal.
* **`command:lock_screen` / `command:unlock_screen` (Server ➜ Client)**: Restricts or allows browser interaction.
* **`command:kick` (Server ➜ Client)**: Forces the Python agent process to terminate via `os._exit(0)`.

### `/dashboard` Namespace (Server ⟷ Dashboard)
* **`session:student_joined` (Server ➜ Dashboard)**: Broadcasts when a student connects.
* **`frame:update` (Server ➜ Dashboard)**: Sends the Base64 frame of the student.
* **`activity:update` (Server ➜ Dashboard)**: Emits live telemetry metrics for Sparklines.
* **`flag:new` (Server ➜ Dashboard)**: Emits incident details when a rule is triggered.
* **`risk:update` (Server ➜ Dashboard)**: Broadcasts updated risk score (0-100%).

---

## 4. Detection Engines & Logic

The project has three custom evaluation engines in `server/src/engine`:

### A. Rules Engine (`rulesEngine.js`)
Processes telemetry data using dynamic parameters:
1. **Application Blacklist**: Cross-references process lists and focused window titles against custom keywords configured by the admin (e.g., Discord, WhatsApp, ChatGPT, YouTube).
2. **Behavioral Statistical Anomaly Detection**:
   * Tracks a rolling cache (last 30 telemetry ticks) of typing speed and mouse movements per student.
   * Computes the mean ($\mu$) and standard deviation ($\sigma$) of this baseline.
   * If a student's activity deviates by more than **$1.8\sigma$** from their baseline, it flags an anomaly (indicative of sudden bulk code copy-pastes).
   * **Z-Score Formula**: $Z = \frac{|x - \mu|}{\sigma}$

### B. Frozen Frame Detection (`frozenFrameEngine.js`)
Detects if a student feeds pre-recorded loops or static frames:
* **Signature Matching**: Generates a fast perceptual signature by hashing the string length + base64 prefix + base64 suffix of the frame.
* **Correlation**: If the signature remains identical for **> 30 seconds** AND physical input (mouse/keyboard) remains idle for **> 15 seconds**, it flags a `Frozen Frame Detected` incident.

### C. Risk Engine (`riskEngine.js`)
* Calculates risk scores (0 to 100) using a **linear decay over 15 minutes**:
  $$\text{Decay Factor} = \max\left(0, \frac{15 - \text{minutesAgo}}{15}\right)$$
* This ensures that single accidental window switches don't permanently penalize the student's final integrity report.

---

## 5. Security & Anti-Cheat Measures

* **Binary Integrity Checksum**: The agent computes its own SHA-256 hash. If modified (e.g., bypassing monitoring hooks), the server logs a mismatch warning.
* **JWT & SSO Lock**: The student must enter credentials and Session IDs in the desktop agent console. The backend yields a signed JWT token that autologins the student browser.
* **Hardware Intercepts**: Removable USB devices and multiple screens are tracked using Windows DLL interfaces to prevent cheats on external drives.

---

## 6. Project Directory Map

```
SIET Hack - Copy/
├── agent/
│   ├── student_agent.py           # Core Win32 Python Agent Script
│   ├── student_agent.spec         # PyInstaller compilation specification
│   └── mock_students_simulator.py # Batch Simulator for spawning multiple bots
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js              # Mock SQLite JSON controller
│   │   │   └── database.json      # Flat database store
│   │   ├── engine/
│   │   │   ├── rulesEngine.js     # Pattern & Z-Score anomaly processing
│   │   │   ├── riskEngine.js      # Linear decay risk calculator
│   │   │   ├── frozenFrameEngine.js# Screenshot loop detector
│   │   │   └── aiEngine.js        # Dynamic natural language NLP explanations
│   │   ├── routes/
│   │   │   └── api.js             # Authentication, session and rule APIs
│   │   ├── sockets/
│   │   │   └── socketHandler.js   # Real-time WebSocket router
│   │   └── index.js               # Application entry point
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LiveGrid.jsx       # Grid rendering of screens
│   │   │   ├── SmartClassroomMap.jsx# Classroom layout visualizer
│   │   │   └── AdminPanel.jsx     # Rule editor & weight manager
│   │   ├── pages/
│   │   │   ├── StudentPortal.jsx  # Student safe exam space
│   │   │   └── TeacherDashboard.jsx# Core Invigilator workspace
```
