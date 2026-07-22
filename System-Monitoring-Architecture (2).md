# AI-Powered Smart Classroom Monitoring Platform — Full Architecture

Hackathon problem statement: "System Monitoring" — faculty monitors all student desktops live from one system, with automatic misbehavior detection.

**Positioning for the pitch:** don't present this as a desktop monitoring tool. Present it as an intelligent invigilation and classroom analytics platform that combines real-time desktop streaming, AI-driven behavioral analysis with explainable risk scoring, automated evidence generation, and privacy-first design — built to help institutions run secure digital exams and lab sessions. Same system, framed as a product rather than a feature checklist.

---

## 1. Project Goals

1. Faculty logs into one dashboard and sees **every connected student screen live, in parallel**.
2. The system **detects unusual behavior automatically** (rule-based) and brings that student's screen to full focus with a visual alert.
3. Faculty gets **live activity insight** (typing/mouse/idle) per student, not just a static video wall.
4. Faculty can **instantly search/filter** students in a large class.
5. Everything is **auditable** after the session (logs, snapshots, reports).

---

## 2. High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Student Agent 1  │     │ Student Agent 2  │     │ Student Agent N  │
│ (Windows .exe)   │     │ (Windows .exe)   │     │ (Windows .exe)   │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │  WebSocket (screen frames + activity + events)
         └──────────────┬──────────────┘──────────────────┘
                         ▼
              ┌────────────────────────┐
              │     Backend Server      │
              │  Node.js + Socket.IO    │
              │  REST API + Rules Engine│
              └───────────┬─────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
      ┌───────────────┐        ┌────────────────┐
      │   Database      │        │  File storage   │
      │  PostgreSQL      │        │ (snapshots, logs)│
      └───────────────┘        └────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
    ┌───────────────────┐     ┌───────────────────┐
    │ Faculty Dashboard   │     │   Admin Panel       │
    │ (React web app)     │     │ (React web app)     │
    └───────────────────┘     └───────────────────┘
```

**Communication pattern:**
- Student agent → server: persistent WebSocket connection, pushes screen frames (throttled), activity metrics (every 1–2s), and instant events (flags) the moment a rule fires.
- Server → faculty dashboard: same WebSocket channel (different room/namespace), pushes live frames, activity scores, and flag alerts to all connected faculty clients.
- Server → database: every event, session, and snapshot is persisted asynchronously so live streaming is never blocked by writes.

---

## 3. Components

### 3.1 Student Agent (Windows client)

A lightweight background app installed on each student PC.

**Responsibilities:**
- Capture screen at low frame rate (1–2 fps is enough for monitoring, not video call quality) and send as compressed JPEG over WebSocket.
- Poll system state every 1–2 seconds:
  - Active window title + process name
  - Mouse movement delta (for activity heatmap)
  - Keystroke count (count only, never actual keys — privacy-safe) for typing speed
  - Idle time (`GetLastInputInfo`)
  - Connected displays (secondary monitor detection)
  - Running processes (for blacklist matching + remote-access tool detection)
  - USB device connect/disconnect events
  - Clipboard change size (not content, just size delta) for large-paste detection
- Evaluate simple local rules OR send raw signals to server and let the server's rules engine decide (recommended: keep agent dumb, keep logic centralized — easier to update rules without redeploying every client).
- Auto-register on first launch with student ID, hostname, IP, MAC address.
- Auto-reconnect with backoff if server connection drops.
- Runs as a Windows service / startup app so it can't be casually closed by the student (optional hardening — flag if the agent process itself stops sending heartbeats).

**Recommended tech:** C# (.NET, WinForms/WPF background service) or Python (`pywin32`, `mss` for screen capture, `pynput`/`psutil` for input & process monitoring) packaged with PyInstaller. C# is more native and lighter for a Windows-only tool if your team is comfortable; Python is faster to prototype with AI coding tools in a hackathon setting.

### 3.2 Backend Server

**Responsibilities:**
- Accept and manage WebSocket connections from all student agents (one room/namespace per class/session).
- Accept WebSocket connections from faculty dashboard clients, broadcasting live data.
- Rules engine: evaluate every incoming activity payload against configurable thresholds (blacklisted apps, idle time, secondary monitor, USB insert, large clipboard paste, remote-access tool detected, tab/window count spike).
- On rule trigger: create a "flag" event, push it instantly to all faculty clients, store it in DB, and optionally trigger a screenshot capture for evidence.
- Compute a rolling **risk score** per student (weighted sum of active flags + decay over time).
- Compute a rolling **activity score** per student from mouse/keyboard signal (for the heatmap).
- **AI explanation layer:** the rules engine still does the actual detection (deterministic, fast, reliable — don't replace this). But instead of surfacing raw flags to faculty, batch a student's active flags + recent event context and send them to the Claude API to generate a short natural-language explanation, a confidence framing, and a suggested action. This is the "AI Behavior Engine" — it's explainable-by-construction because it's built directly on your own rule outputs, not a black-box model, which is actually a stronger story for judges than a real opaque ML model would be. See §5.3.
- **Statistical anomaly detection (optional, on top of fixed rules):** maintain a rolling personal baseline per student (average typing speed, mouse activity, idle pattern over the session so far). Flag a deviation-from-self-baseline (e.g. z-score beyond a threshold) as a distinct signal alongside the fixed rules. This is genuinely non-rule-based without needing any model training — be accurate in your pitch that it's statistical baseline deviation, not a trained ML model.
- Serve REST API for dashboard/admin: student list, session history, reports, rule configuration, search/filter queries.
- AuthN/AuthZ: faculty and admin login, session/token management.
- Generate downloadable session reports (PDF/Excel) on demand.

**Recommended tech:** Node.js + Express (REST) + Socket.IO (real-time) — pairs naturally with a React frontend and is very well documented for AI coding assistants to scaffold quickly. Alternative: Python + FastAPI + `python-socketio` if your team prefers Python end-to-end.

### 3.3 Faculty Dashboard (frontend)

The main real-time monitoring surface faculty uses during a live session.

**Pages/sections:**
- **Live grid view** — tile per student, live thumbnail feed, name/roll number, current risk score badge, activity indicator.
- **Focus view** — click any tile (or auto-triggered by a flag) to expand that student's feed to full screen with their event timeline alongside.
- **Live Activity Heatmap** (new feature, detailed in §5).
- **Smart search & filter bar** (new feature, detailed in §5).
- **Alerts panel** — running feed of flags across all students, newest first, click to jump to that student.
- **Session controls** — start/end session, broadcast message to a student, lock a student's screen (stretch feature).

### 3.4 Admin Panel (frontend)

Separate, less time-critical interface for configuration and historical review.

**Pages:**
1. **Dashboard/overview** — total active sessions, total students online, flags today, quick stats.
2. **Student management** — add/edit/remove students, assign hostname/IP/agent installer key, bulk CSV import of class roster.
3. **Faculty & user management** — create faculty logins, assign classes/sections they can monitor, admin roles.
4. **Rule configuration** — enable/disable each detection rule, edit thresholds (idle timeout, blacklist app list, risk score weights), per-session or global.
5. **Session history** — list of past monitoring sessions, click into any session to replay the flag timeline and view snapshots.
6. **Reports** — generate/download session summary reports (PDF/Excel) per class or per student.
7. **Agent management** — see which student agents are online/offline/outdated, push agent version info, view heartbeat status.
8. **Audit log** — who (which faculty/admin) did what and when (locked a screen, changed a rule, exported data) — important given the privacy sensitivity of this tool.
9. **System settings** — data retention period (auto-delete snapshots after N days), storage usage, notification settings.
10. **Privacy dashboard** — visible status of all privacy safeguards (§5.7): keystroke-content policy, clipboard policy, encryption, retention, consent/session-scoping, audit trail.

### 3.5 Database

Recommended: **PostgreSQL** (relational — this data is highly structured and relationship-heavy: students → sessions → events). Redis is optional as a fast in-memory layer for "current live state" (who's online right now, current risk scores) while Postgres holds the durable history.

---

## 4. Database Schema

```
users (faculty/admin accounts)
├─ id (PK)
├─ name
├─ email
├─ password_hash
├─ role (admin | faculty)
└─ created_at

students
├─ id (PK)
├─ student_id / roll_number
├─ name
├─ hostname
├─ mac_address
├─ agent_key (unique token issued to their agent install)
└─ created_at

sessions (a monitoring session, e.g. one class period)
├─ id (PK)
├─ faculty_id (FK -> users)
├─ class_name
├─ started_at
├─ ended_at
└─ status (active | ended)

student_session_links (which students were part of which session)
├─ id (PK)
├─ session_id (FK -> sessions)
├─ student_id (FK -> students)
├─ ip_address
├─ joined_at
└─ left_at

activity_snapshots (rolling, high-frequency — consider a time-series table or Redis for the live tier, Postgres for periodic rollups)
├─ id (PK)
├─ session_id (FK)
├─ student_id (FK)
├─ timestamp
├─ mouse_activity_score (0-100)
├─ typing_speed (chars/min estimate from keystroke count)
├─ idle_seconds
└─ overall_activity_score (0-100, computed)

flags (misbehavior events)
├─ id (PK)
├─ session_id (FK)
├─ student_id (FK)
├─ rule_type (blacklisted_app | idle | secondary_monitor | usb_detected | remote_access_tool | large_clipboard_paste | window_spike)
├─ detail (e.g. process name / window title that triggered it)
├─ severity (low | medium | high)
├─ risk_score_delta
├─ snapshot_path (nullable — screenshot taken at flag time)
├─ status (open | reviewed | dismissed)
└─ created_at

rules (configurable thresholds)
├─ id (PK)
├─ rule_type
├─ enabled (bool)
├─ threshold_value (json — e.g. idle timeout seconds, blacklist array)
├─ weight (contribution to risk score)
└─ scope (global | session-specific)

reports (generated exports)
├─ id (PK)
├─ session_id (FK)
├─ generated_by (FK -> users)
├─ file_path
└─ created_at

audit_log
├─ id (PK)
├─ user_id (FK)
├─ action
├─ target (e.g. "student:42" or "rule:idle_timeout")
├─ timestamp
```

---

## 5. New Features — Detailed

### 5.1 Live Activity Heatmap

**What it shows:** a compact visual indicator per student tile (and an aggregate class-wide heatmap view) combining:
- **Typing speed** — derived from keystroke *count* over a rolling window (never actual key content — this matters for privacy and for judges).
- **Mouse movement** — pixel-distance delta over the same rolling window, normalized.
- **Overall activity level** — a single 0–100 score blending the two (e.g. weighted average), color-coded: cold/blue = inactive, green = normal engagement, amber/red = unusually high (could mean frantic activity worth a glance, or could just be normal work — faculty interprets).

**Why it's valuable:** lets faculty scan 30+ tiles in seconds and immediately spot the two failure modes that matter — a student doing nothing (disengaged, possibly absent from the desk) and a student doing something frantic (could be legitimate work, could be worth checking).

**Implementation:**
- Agent computes raw counts every 1–2s and sends them alongside the screen frame.
- Server normalizes (e.g. against a rolling class average, or a fixed calibration) and computes the 0–100 score, stores a rollup snapshot every N seconds.
- Dashboard renders each tile with a small colored activity bar/ring, and offers an optional "heatmap view" — a grid layout where tile background color directly encodes activity level, so the whole class becomes scannable at a glance.

### 5.2 Smart Search & Filtering

A persistent search/filter bar on the faculty dashboard (and admin student management page) supporting:
- **Student ID** / **Roll number** — text search, partial match.
- **Hostname** — text search.
- **IP address** — text/CIDR-aware search.
- **Risk level** — filter chips (low / medium / high / flagged now).
- **Current status** — filter chips (online / offline / idle / actively flagged).

**Implementation:**
- Frontend: a single search input with debounced client-side filtering against the already-loaded live student list (fast, no round trip needed since the list is already in memory via WebSocket state) — filter chips for risk/status use simple predicate functions.
- For historical/admin search across sessions (larger datasets), add a REST endpoint with query params and DB-side filtering (`WHERE` clauses / indexed columns on `student_id`, `hostname`, `ip_address`, computed `risk_level`).
- Add DB indexes on `students.student_id`, `students.hostname`, `student_session_links.ip_address` for fast lookups at scale.

### 5.3 AI Behavior Engine (explainable suspicion scoring)

Instead of showing faculty a raw flag ("USB detected"), show an AI-generated explanation built on top of your deterministic rule outputs.

**How it works (important: the rules engine still does the actual detection — the AI layer only explains and summarizes what already fired):**
1. Rules engine evaluates signals as before and produces a list of active flags for a student (e.g. `unauthorized_app`, `usb_connected`, `large_clipboard_paste`, `window_switch_spike`) plus the numeric risk score.
2. Server calls the Claude API (`claude-sonnet-4-6`, one short call per flagged student, only when their flag set changes — not on every polling tick) with a compact prompt: the student's active flags, the numeric risk score, and recent event timestamps.
3. The model returns: a one-line plain-English explanation, a confidence framing ("high confidence — 3 independent signals" vs "low confidence — single weak signal"), and a suggested faculty action (observe / screenshot / lock screen / call invigilator).
4. Dashboard renders this as a card:
   ```
   Suspicion score: 87%          Confidence: high

   Reasons
   ✓ Unauthorized application opened
   ✓ USB device connected
   ✓ Large clipboard paste detected
   ✓ Window switching spike

   Suggested action: inspect this student immediately
   ```

**Why this is safe to build in 20 hours:** you are not training or hosting a model — you're making one short API call per flag event with a tightly constrained prompt and structured JSON output. Detection stays deterministic and reliable (the part that must never fail live); the AI only adds the explanation layer on top, so a slow/failed API call degrades gracefully to showing the raw flags instead of blocking the core monitoring flow.

### 5.4 Incident Timeline Replay

A per-student event timeline, rendered like a CCTV playback log, built entirely from the `flags` and `activity_snapshots` tables you already have:
```
9:01  Login
9:05  Opened VS Code
9:18  USB inserted
9:19  Chrome opened
9:22  Window switch spike
9:25  Snapshot captured
9:31  Clipboard paste spike
9:40  Idle
```
No new capture logic needed — this is a formatted query over existing event data, surfaced as its own page/panel per student. High demo impact for very low build cost.

### 5.5 AI Session Summary

At session end, send the aggregate session data (student count, flag counts by type, average activity, top-risk students) to the Claude API and render the response as a summary card:
```
Session summary
42 students monitored · 5 flagged as suspicious
Most common violation: unauthorized browser use
Average activity: 82%
Top risk: roll no. 23
Recommendation: increase monitoring near row B
```
This is one API call at session end (not live/continuous), so it's low-risk to add and a strong closing beat for the demo.

### 5.6 Smart Classroom Map

An optional alternate view to the tile grid: render students in a seating-grid layout (rows/columns matching the physical lab, configured once by faculty) instead of a plain list, with each seat colored by current risk level (green/amber/red). Lets faculty locate a flagged student physically, not just by name. Reuses the same live risk-score data already powering the tile grid — this is a layout/rendering variant, not new backend logic.

### 5.7 Privacy Dashboard

A dedicated admin page that makes your privacy safeguards visible rather than just documented in this architecture doc:
```
Privacy dashboard
✓ Keystroke content never captured — cadence only
✓ Clipboard content never captured — paste size only
✓ Data encrypted in transit (WSS/HTTPS)
✓ Auto-delete after configurable retention period
✓ Session-scoped monitoring, not always-on
✓ Full audit trail of faculty/admin actions
```
This directly answers the "isn't this just spyware" question before a judge asks it, and it's just a status page over settings/flags you're already implementing — near-zero extra build cost for real credibility.

### 5.8 AI Natural-Language Search (stretch)

Extend the smart search bar (§5.2) to also accept a free-text query like "show all idle students" or "who pasted large text today", sent to the Claude API to translate into the same structured filter object your existing search already supports (risk level, status, etc.), rather than building custom NLP. Only attempt this after the structured filter UI (§5.2) is solid — it's a thin AI layer on top of filters you already have, not a replacement for them.

### 5.9 AI Chat Assistant (stretch, only if time remains)

A simple chat panel where faculty can ask "who is the most suspicious student right now?" or "why was roll 18 flagged?". Implementation: pass the current session's live student/flag state as context to a Claude API call alongside the question, return a short natural-language answer. Cut this first if hours run short — it reuses the same data and prompting pattern as §5.3 and §5.5, so it's genuinely optional rather than new infrastructure.

### 5.10 Deliberately out of scope (park as future vision, don't build for this hackathon)

Be upfront about these in the pitch as roadmap items rather than attempting them — each carries real infrastructure risk that isn't worth it for a 20-hour build:
- **3D digital twin classroom** — real 3D rendering/avatar work, far more effort than the payoff justifies here.
- **Predictive network-failure detection** — needs real network telemetry and a validated model; a fake "likely offline in 30s" readout would be dishonest to demo.
- **Full device health telemetry** (CPU/RAM/battery/temperature) — turns this into a lab-management tool, a scope change judges didn't ask for; skip unless core is done with hours to spare.
- **Zero-install QR-code onboarding** — needs a hosted installer + auto-provisioning flow; nice polish but not worth the risk of onboarding failing live. A simple shared installer link is a safe middle ground if you want part of this idea.
- **True ML-based anomaly detection / cheat-trend forecasting** — don't claim a trained model. The statistical baseline-deviation approach (§3.2) and a simple linear trend line on the risk score get you 90% of the visual effect honestly, without the risk or the overclaiming.

---

## 6. Full Feature List

**Core (must-have, satisfies the base problem statement):**
- Live parallel screen streaming from all connected student agents to one faculty view.
- Real-time misbehavior detection (rule-based) with automatic full-screen focus + red highlight on the offending student's tile.
- Student agent auto-registration and reconnect handling.

**Bonus (explicitly rewarded by the problem statement):**
- Unusual-behavior detection and auto-focus (covered above).

**Differentiators (added to stand out):**
- Live activity timeline / event log per student.
- Session risk score (aggregate, live-updating).
- Auto-snapshot on flag (evidence capture).
- Faculty → student broadcast message / remote screen lock.
- Auto-generated session summary report (PDF/Excel export).
- Configurable rule dashboard (admin can tune thresholds without redeploying).
- Smart-sorted grid (highest risk students float to top).
- **Live Activity Heatmap** (typing speed, mouse movement, overall activity).
- **Smart Search & Filtering** (student ID, roll number, hostname, IP, risk level, status).
- **AI Behavior Engine** — explainable suspicion score with reasons and suggested action (§5.3).
- **Incident Timeline Replay** — CCTV-style per-student event log (§5.4).
- **AI Session Summary** — auto-generated end-of-session report (§5.5).
- **Smart Classroom Map** — seating-grid view colored by risk level (§5.6).
- **Privacy Dashboard** — visible, working privacy safeguards (§5.7).
- **Statistical anomaly detection** — deviation from a student's own rolling baseline, not just fixed rules.

**Stretch (only if time remains):**
- Trend graph of flags over the session timeline (per student / class-wide) — simple linear trend, not a forecasting model.
- Multi-session comparison in admin (e.g. same student across multiple classes).
- **AI natural-language search** (§5.8).
- **AI chat assistant** (§5.9).
- Remote screen lock / broadcast message to a student.

---

## 7. API Design

### REST endpoints

```
POST   /api/auth/login                     faculty/admin login, returns JWT
POST   /api/auth/logout

GET    /api/students                       list all students (supports ?search=&risk=&status=)
POST   /api/students                       add student (admin)
PUT    /api/students/:id                   edit student (admin)
DELETE /api/students/:id                   remove student (admin)
POST   /api/students/import                bulk CSV import (admin)

POST   /api/sessions                       start a new monitoring session
PUT    /api/sessions/:id/end                end a session
GET    /api/sessions                       list sessions (history)
GET    /api/sessions/:id                   session detail (students, flags, timeline)

GET    /api/sessions/:id/flags             list flags for a session (filterable by student/severity)
PUT    /api/flags/:id                      update flag status (reviewed/dismissed)

GET    /api/rules                          list configured rules
PUT    /api/rules/:id                      update a rule's threshold/enabled state (admin)

GET    /api/sessions/:id/report             generate/download report (PDF or Excel)

GET    /api/agents/status                   list agent online/offline/heartbeat status (admin)

GET    /api/audit-log                       list audit log entries (admin)

GET    /api/students/:id/ai-explanation      AI-generated suspicion explanation for a student's active flags
GET    /api/sessions/:id/ai-summary           AI-generated end-of-session summary
POST   /api/search/nl                          natural-language query -> structured filter (stretch)
POST   /api/assistant/ask                       AI chat assistant question -> answer (stretch)
```

### WebSocket events

```
Student agent -> server
  agent:register        { student_id, hostname, ip, mac }
  agent:frame            { student_id, jpeg_base64, timestamp }
  agent:activity          { student_id, mouse_delta, keystroke_count, idle_seconds }
  agent:signal            { student_id, type: 'process_list' | 'usb_event' | 'display_count', payload }
  agent:heartbeat

Server -> faculty dashboard
  session:student_joined   { student }
  session:student_left     { student_id }
  frame:update              { student_id, jpeg_base64 }
  activity:update            { student_id, activity_score, typing_speed, mouse_score }
  flag:new                    { flag object } -> triggers auto-focus + red highlight client-side
  risk:update                  { student_id, risk_score }

Server -> student agent (for remote control features)
  agent:lock_screen
  agent:broadcast_message      { text }
```

---

## 8. Tech Stack Summary

| Layer | Choice | Why |
|---|---|---|
| Student agent | Python (`mss`, `psutil`, `pynput`, `websockets`) packaged with PyInstaller, or C# WPF | Fast to prototype with AI tools; native OS API access for process/idle/USB detection |
| Backend | Node.js + Express + Socket.IO | Real-time-first, huge ecosystem, easy for AI coding assistants to scaffold quickly |
| Database | PostgreSQL | Relational integrity for students/sessions/flags; strong indexing/search support |
| Live-state cache (optional) | Redis | Fast in-memory store for "who's online right now" and live activity scores |
| Faculty dashboard & admin panel | React + Tailwind | Fast to build with AI tools, component-based, good for a tile-grid live UI |
| Auth | JWT-based sessions | Simple, stateless, fast to implement |
| File/snapshot storage | Local disk (hackathon) or S3-compatible bucket (production) | Screenshots/reports |
| Report generation | `pdfkit` / `exceljs` (Node) or `openpyxl` (Python) | Session summary export |
| Real-time transport | WebSocket (Socket.IO) | Bi-directional, low-latency, supports rooms per session |
| AI explanation / summary / assistant | Anthropic API (Claude Sonnet 4.6), structured JSON output | Explainable suspicion scoring, session summaries, NL search, chat assistant — all built on your own deterministic rule outputs, not a trained model |

---

## 9. Security & Privacy Considerations

- Screen streaming and keystroke *counting* (never actual keystrokes) should be disclosed to students — this is institutional monitoring and should be scoped to lab/exam sessions, not always-on surveillance.
- Encrypt WebSocket traffic (WSS) and REST calls (HTTPS) even in the demo if feasible — judges notice this.
- Role-based access: only authorized faculty can view a session; admin-only for rule configuration and student management.
- Audit log every sensitive action (screen lock, data export, rule change).
- Data retention policy — auto-purge snapshots/screen data after a configurable period.
- Agent should only run during declared sessions, not persist indefinitely without faculty initiating monitoring — reduces privacy exposure and strengthens your pitch.

---

## 10. Build Plan for 20 Hours

| Hours | Focus |
|---|---|
| 0–2 | Repo scaffold (backend + 2 React frontends), DB schema migration, basic auth |
| 2–6 | Student agent: screen capture + WebSocket send, activity polling (mouse/keyboard/idle), agent registration |
| 6–9 | Backend: WebSocket ingest, live state broadcast to dashboard, basic rules engine (2–3 rules first: blacklist app, idle, secondary monitor) |
| **9** | **Checkpoint: deploy agent + backend to 2+ real machines and confirm a live connection end-to-end** (see §12.3) — do this before building more UI on top of an unproven pipe |
| 9–13 | Faculty dashboard: live tile grid, focus view, flag alert + auto-focus/red highlight, activity heatmap indicators |
| 13–15 | Smart search & filter bar on dashboard |
| 15–17 | Admin panel: student management, rule configuration page, session history |
| 17–18 | Report generation (PDF/Excel export) |
| 18–19 | Snapshot-on-flag, risk score computation, polish/styling pass |
| 19–20 | End-to-end test across 2–3 real machines, prep demo script |

**Priority order if you run short on time:** core streaming + rule-based flagging + auto-focus (non-negotiable) → activity heatmap → smart search → admin rule config → report export → remote lock/broadcast (cut first if needed).

---

## 11. Demo Script Suggestion

1. Show 3 student machines with the agent running, faculty dashboard shows all 3 live in a grid.
2. On one student machine, open a blacklisted app (e.g. a game or unauthorized site) — dashboard instantly flags it, auto-focuses that tile full-screen with a red border, logs the event.
3. Show the AI explanation card that appears alongside the flag — suspicion score, plain-English reasons, confidence, suggested action. This is the moment that makes it feel like a product, not a rules demo.
4. Point at the activity heatmap — show one student idle (cold color) and one typing fast (warm color) to demonstrate the at-a-glance insight.
5. Use the smart search bar to filter by risk level "high" — show it narrows instantly to the flagged student.
6. Open that student's incident timeline replay — walk through their session like a CCTV log.
7. Open the privacy dashboard for a few seconds — pre-empt the "isn't this spyware" question before anyone asks it.
8. End the session, generate the AI session summary and the downloadable report side by side.
9. (If built) Faculty locks that student's screen or sends a broadcast message live.

This sequence hits every scored dimension of the problem statement, tells a "smart, not just rule-based" story, and closes on the privacy safeguard in under 4 minutes.

---

## 12. Key Execution Principles

These three points aren't extra features — they're how the whole build should be run. Treat them as constraints on every other section above, not a checklist to add at the end.

### 12.1 Keystroke privacy by design

The agent must **count** keystrokes, never **log** them.

- Only capture a rolling counter (keystrokes per N-second window) to derive typing speed. Never capture, buffer, or transmit which keys were pressed.
- Implement this as a hard architectural boundary: the local hook that listens for key events should increment an integer and discard the event immediately — it should never have access to a string buffer, clipboard content beyond size, or any persisted key log.
- Apply the same principle everywhere adjacent: clipboard monitoring uses **paste size only**, never paste content; screen frames are for faculty viewing, not OCR'd or stored as searchable text.
- State this explicitly in your pitch and in the admin panel's privacy/settings section (§3.4.9) — a visible, working privacy safeguard is a differentiator judges remember, and it directly pre-empts the "isn't this just spyware" question.
- Add a one-line note to the system settings page: "Keystroke content is never captured or stored — only typing cadence."

### 12.2 Priority order over feature count

Build in this strict order and be willing to stop anywhere on the line and still have a demo-able product:

1. **Non-negotiable core** — live parallel screen streaming + rule-based flagging + auto-focus/red highlight on the offending student. Nothing else matters if this doesn't work.
2. **Activity Heatmap** — reuses data you're already capturing (§5.1); cheap to add once core streaming works.
3. **Smart Search & Filtering** — pure frontend filtering over data already in memory; low effort, high demo value.
4. **AI Behavior Engine explanation cards** (§5.3) — one API call per flag change on top of rules that already work; this is your single biggest differentiator relative to effort.
5. **Incident Timeline Replay + Privacy Dashboard** (§5.4, §5.7) — both are thin UI layers over data/config you already have.
6. **Admin panel** (student management, rule configuration) — needed for credibility but not for the live demo itself.
7. **AI Session Summary + Report generation / snapshot-on-flag** (§5.5) — polish that helps the pitch's "after the session" story.
8. **Smart Classroom Map** (§5.6) — nice visual variant, build only once everything above is solid.
9. **Remote lock / broadcast, AI natural-language search, AI chat assistant** — most differentiating, but also most optional; cut first if hours run short.

Do not let admin-panel polish or report styling eat time before step 1 is rock solid on real machines. A judge remembers a working live flag more than a pretty settings page.

### 12.3 Prove the network path before building on it

Multi-machine screen streaming is the single biggest risk to your 20-hour budget — not the UI, not the rules engine.

- As soon as the backend can accept a WebSocket connection (around hour 6–9), stop and deploy the agent to at least **two separate physical machines (or VMs on separate hosts)** and confirm a frame makes it from student agent → server → any client, even a raw console log. Do this before writing a single line of dashboard UI.
- Common failure points to check early: Windows Firewall blocking inbound/outbound on your chosen port, both machines needing to be on the same network/subnet (or a public relay if not), and antivirus flagging the agent executable.
- Keep a fallback plan: if live cross-machine networking fails close to demo time, be ready to run agent + server + dashboard on a single machine with multiple agent processes bound to different ports — it still proves the architecture even if it's not literally three physical laptops.
- Re-test the full path (agent → flag → dashboard auto-focus) on real machines again with time to spare before the demo slot — not for the first time at hour 18.
