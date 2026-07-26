import time
import uuid
import socket
import psutil
import mss
import ctypes
from io import BytesIO
from PIL import Image
import socketio
from pynput import keyboard
import string

# ─── Configuration ────────────────────────────────────────────────────────────
SERVER_URL = "http://localhost:3000"
STUDENT_ID = "STD-" + str(uuid.uuid4())[:8]

# Blacklisted process/window keywords (must match rules engine)
BLACKLISTED_KEYWORDS = [
    "discord", "whatsapp", "telegram", "chatgpt", "youtube",
    "cheatengine", "cheat engine", "game", "anydesk", "teamviewer",
    "vnc", "zoom", "parsec", "ammyy", "logmein"
]

# ─── Socket client setup ──────────────────────────────────────────────────────
sio = socketio.Client(reconnection=True, reconnection_delay=2, reconnection_attempts=99999)

try:
    sct = mss.MSS()
except Exception:
    sct = mss.mss()

# ─── Keystroke tracking ───────────────────────────────────────────────────────
keystroke_count = 0

def on_press(key):
    global keystroke_count
    keystroke_count += 1

listener = keyboard.Listener(on_press=on_press)
listener.start()

# ─── USB drive tracking ───────────────────────────────────────────────────────
_prev_usb_drives = set()

def get_usb_drives():
    """Return a set of removable drive letters currently mounted."""
    drives = set()
    try:
        bitmask = ctypes.windll.kernel32.GetLogicalDrives()
        for i, letter in enumerate(string.ascii_uppercase):
            if bitmask & (1 << i):
                drive_path = f"{letter}:\\"
                drive_type = ctypes.windll.kernel32.GetDriveTypeW(drive_path)
                # DRIVE_REMOVABLE = 2
                if drive_type == 2:
                    drives.add(drive_path)
    except Exception as e:
        print(f"[USB] Error detecting drives: {e}")
    return drives

def check_usb_event():
    """Return (usb_detected, list_of_new_drives)."""
    global _prev_usb_drives
    current = get_usb_drives()
    new_drives = current - _prev_usb_drives
    _prev_usb_drives = current
    if new_drives:
        print(f"[USB] ⚠️  New USB drive(s) detected: {new_drives}")
    return bool(new_drives), list(new_drives)

# ─── Windows API helpers ──────────────────────────────────────────────────────
class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

def get_idle_time():
    try:
        info = LASTINPUTINFO()
        info.cbSize = ctypes.sizeof(info)
        ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info))
        millis = ctypes.windll.kernel32.GetTickCount() - info.dwTime
        return millis / 1000.0
    except Exception:
        return 0.0

def get_active_window_title():
    try:
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
        buff = ctypes.create_unicode_buffer(length + 1)
        ctypes.windll.user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value or "Unknown Window"
    except Exception:
        return "Unknown Window"

def get_visible_window_count():
    try:
        count = 0
        def handler(hwnd, ctx):
            nonlocal count
            if ctypes.windll.user32.IsWindowVisible(hwnd):
                if ctypes.windll.user32.GetWindowTextLengthW(hwnd) > 0:
                    count += 1
            return True
        Proc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        ctypes.windll.user32.EnumWindows(Proc(handler), 0)
        return count
    except Exception:
        return 1

# ─── Screen capture ───────────────────────────────────────────────────────────
def capture_screen():
    try:
        mon_idx = 1 if len(sct.monitors) > 1 else 0
        sct_img = sct.grab(sct.monitors[mon_idx])
        img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
        img.thumbnail((800, 600), Image.Resampling.LANCZOS)
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=30, optimize=True)
        import base64
        return base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:
        print(f"[SCREEN] Capture warning: {e}")
        return ""

# ─── Socket events ────────────────────────────────────────────────────────────
@sio.event(namespace="/agent")
def connect():
    hostname = socket.gethostname()
    try:
        ip = socket.gethostbyname(hostname)
    except Exception:
        ip = "127.0.0.1"
    mac = ":".join(["{:02x}".format((uuid.getnode() >> ele) & 0xff) for ele in range(0, 8*6, 8)][::-1])
    sio.emit("agent:register", {
        "student_id": STUDENT_ID,
        "hostname": hostname,
        "ip": ip,
        "mac": mac
    }, namespace="/agent")
    print(f"[AGENT] ✅ Connected as Student: {STUDENT_ID}")

@sio.event(namespace="/agent")
def connect_error(data):
    print(f"[AGENT] ❌ Connection failed: {data}")

@sio.event(namespace="/agent")
def disconnect():
    print("[AGENT] Disconnected from server. Reconnecting...")

import tkinter as tk
import threading

# ─── Screen Lock GUI Overlay ──────────────────────────────────────────────────
class ScreenLockOverlay:
    def __init__(self):
        self.root = None
        self.is_locked = False

    def show(self):
        if self.is_locked:
            return
        self.is_locked = True
        
        def _run_gui():
            try:
                self.root = tk.Tk()
                self.root.title("EXAM SAFE - WORKSTATION LOCKED")
                self.root.attributes("-fullscreen", True)
                self.root.attributes("-topmost", True)
                self.root.configure(bg="#450a0a")  # Dark Red

                # Intercept window close, Esc, Alt+F4
                self.root.protocol("WM_DELETE_WINDOW", lambda: None)
                self.root.bind("<Escape>", lambda e: "break")
                self.root.bind("<Alt-F4>", lambda e: "break")
                self.root.bind("<Control-Alt-Delete>", lambda e: "break")

                # Main container
                container = tk.Frame(self.root, bg="#450a0a")
                container.pack(expand=True)

                icon_lbl = tk.Label(container, text="🔒", font=("Segoe UI", 72), bg="#450a0a", fg="#f87171")
                icon_lbl.pack(pady=10)

                title_lbl = tk.Label(container, text="WORKSTATION LOCKED BY FACULTY", font=("Segoe UI", 28, "bold"), bg="#450a0a", fg="#ffffff")
                title_lbl.pack(pady=10)

                sub_lbl = tk.Label(
                    container,
                    text="Your examination workspace has been locked remotely by proctoring faculty due to potential integrity violations.",
                    font=("Segoe UI", 14),
                    bg="#450a0a",
                    fg="#fca5a5",
                    wraplength=700,
                    justify="center"
                )
                sub_lbl.pack(pady=10)

                info_lbl = tk.Label(
                    container,
                    text=f"Candidate ID: {STUDENT_ID}  |  Host: {socket.gethostname()}\nPlease remain seated. Your instructor will inspect your workstation to unlock it.",
                    font=("Segoe UI", 12),
                    bg="#450a0a",
                    fg="#94a3b8",
                    justify="center"
                )
                info_lbl.pack(pady=20)

                # Periodic re-focus loop to keep window top-most
                def re_force():
                    if self.is_locked and self.root:
                        try:
                            self.root.attributes("-topmost", True)
                            self.root.focus_force()
                            self.root.after(200, re_force)
                        except Exception:
                            pass
                re_force()

                self.root.mainloop()
            except Exception as e:
                print(f"[LOCK_GUI] Error displaying overlay: {e}")

        t = threading.Thread(target=_run_gui, daemon=True)
        t.start()

    def hide(self):
        self.is_locked = False
        if self.root:
            try:
                self.root.after(0, self.root.destroy)
            except Exception:
                pass
            self.root = None

lock_overlay = ScreenLockOverlay()

# ─── Warning GUI Overlay ──────────────────────────────────────────────────────
class WarningOverlay:
    def __init__(self):
        pass

    def show(self, message):
        def _run_gui():
            try:
                root = tk.Tk()
                root.title("EXAM SAFE - PROCTOR WARNING")
                root.geometry("540x280")
                root.attributes("-topmost", True)
                root.configure(bg="#111827")

                # Center window on screen
                root.eval('tk::PlaceWindow . center')

                container = tk.Frame(root, bg="#111827", padx=20, pady=20)
                container.pack(fill="both", expand=True)

                hdr = tk.Frame(container, bg="#111827")
                hdr.pack(fill="x", pady=(0, 12))

                icon_lbl = tk.Label(hdr, text="⚠️", font=("Segoe UI", 22), bg="#111827", fg="#fb923c")
                icon_lbl.pack(side="left", padx=(0, 10))

                tf = tk.Frame(hdr, bg="#111827")
                tf.pack(side="left", fill="x")

                sub = tk.Label(tf, text="MESSAGE FROM PROCTORING FACULTY", font=("Segoe UI", 8, "bold"), bg="#111827", fg="#fb923c")
                sub.pack(anchor="w")

                t_lbl = tk.Label(tf, text="Official Warning", font=("Segoe UI", 15, "bold"), bg="#111827", fg="#ffffff")
                t_lbl.pack(anchor="w")

                msg_lbl = tk.Label(
                    container,
                    text=message or "Your examination session is being monitored. Please maintain exam integrity.",
                    font=("Segoe UI", 11),
                    bg="#1f2937",
                    fg="#f3f4f6",
                    padx=14,
                    pady=12,
                    wraplength=470,
                    justify="left"
                )
                msg_lbl.pack(fill="both", expand=True, pady=(0, 15))

                btn = tk.Button(
                    container,
                    text="I Understand — Close Warning",
                    font=("Segoe UI", 10, "bold"),
                    bg="#ea580c",
                    fg="#ffffff",
                    activebackground="#c2410c",
                    activeforeground="#ffffff",
                    bd=0,
                    padx=14,
                    pady=7,
                    cursor="hand2",
                    command=root.destroy
                )
                btn.pack(fill="x")

                root.focus_force()
                root.mainloop()
            except Exception as e:
                print(f"[WARN_GUI] Error: {e}")

        t = threading.Thread(target=_run_gui, daemon=True)
        t.start()

warning_overlay = WarningOverlay()

@sio.on("command:warn", namespace="/agent")
def on_warn(data):
    msg = data.get('message', 'Your exam is being monitored. Please focus.') if isinstance(data, dict) else str(data)
    print(f"\n[⚠️  TEACHER WARNING] {msg}\n")
    warning_overlay.show(msg)

@sio.on("command:lock_screen", namespace="/agent")
def on_lock(data=None):
    print("[AGENT] 🔒 Exam session locked by teacher/proctor.")
    lock_overlay.show()

@sio.on("command:unlock_screen", namespace="/agent")
def on_unlock(data=None):
    print("[AGENT] 🔓 Exam session unlocked by teacher/proctor.")
    lock_overlay.hide()

@sio.on("command:kick", namespace="/agent")
def on_kick(data=None):
    msg = data.get('message', 'Kicked from exam session.') if isinstance(data, dict) else 'Kicked from exam session.'
    print(f"\n[⛔ TEACHER/ADMIN REMOVAL] {msg}\n")
    try:
        sio.disconnect()
    except Exception:
        pass
    os._exit(0)

# ─── Main monitoring loop ─────────────────────────────────────────────────────
def main_loop():
    global keystroke_count
    # Initialize USB baseline on first run
    _prev_usb_drives.update(get_usb_drives())
    print(f"[AGENT] Monitoring started. Student ID: {STUDENT_ID}")
    print(f"[AGENT] Initial USB drives baseline: {_prev_usb_drives or 'None'}")

    while True:
        if not sio.connected:
            time.sleep(2)
            continue

        try:
            # ── 1. Screen capture ──────────────────────────────────────────
            jpeg_b64 = capture_screen()
            if jpeg_b64:
                sio.emit("agent:frame", {
                    "jpeg_base64": jpeg_b64,
                    "timestamp": time.time()
                }, namespace="/agent")

            # ── 2. Process list ────────────────────────────────────────────
            processes = []
            for p in psutil.process_iter(["name"]):
                try:
                    name = p.info["name"]
                    if name:
                        processes.append(name)
                except Exception:
                    pass

            # ── 3. Active window & system state ───────────────────────────
            idle_seconds = get_idle_time()
            active_window = get_active_window_title()
            window_count = get_visible_window_count()

            try:
                num_monitors = max(1, len(sct.monitors) - 1)
            except Exception:
                num_monitors = 1

            # ── 4. USB Detection ───────────────────────────────────────────
            usb_detected, new_drives = check_usb_event()

            # ── 5. Blacklisted app detection (local console logging) ───────
            proc_str = " ".join(processes).lower()
            window_lower = active_window.lower()
            detected_blacklist = [kw for kw in BLACKLISTED_KEYWORDS
                                  if kw in proc_str or kw in window_lower]
            if detected_blacklist:
                print(f"[BLACKLIST] ⚠️  Detected: {detected_blacklist} | Window: '{active_window}'")

            # ── 6. Window spike console logging ───────────────────────────
            if window_count > 3:
                print(f"[WINDOW_SPIKE] ⚠️  {window_count} visible windows open")

            # ── 7. Send full telemetry to server ──────────────────────────
            sio.emit("agent:activity", {
                "mouse_delta": 10,
                "keystroke_count": keystroke_count,
                "idle_seconds": idle_seconds,
                "processes": processes,
                "active_window": active_window,
                "secondary_monitor": num_monitors > 1,
                "monitor_count": num_monitors,
                "window_count": window_count,
                "usb_detected": usb_detected,
                "usb_events": new_drives,
            }, namespace="/agent")

            keystroke_count = 0
            time.sleep(2)

        except Exception as e:
            print(f"[AGENT] Error in monitoring loop: {e}")
            time.sleep(2)

import os
import sys
import shutil
import hashlib
import webbrowser
import urllib.request
import urllib.error
import json
import getpass

def compute_own_sha256():
    """Compute SHA-256 hash of this exe/script."""
    try:
        exe = sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__)
        sha = hashlib.sha256()
        with open(exe, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha.update(chunk)
        return sha.hexdigest()
    except Exception:
        return "unknown"

def verify_checksum(server_url, student_id):
    """Send SHA-256 to server for tamper detection."""
    sha256 = compute_own_sha256()
    try:
        data = json.dumps({"student_id": student_id, "sha256": sha256}).encode()
        req = urllib.request.Request(
            f"{server_url}/api/agent/checksum",
            data=data, method="POST",
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read())
            if result.get("warning") == "CHECKSUM_MISMATCH":
                print("[SECURITY] ⚠️  WARNING: Agent binary checksum mismatch detected! Logged to server.")
            else:
                print("[SECURITY] ✅ Checksum verified.")
    except Exception:
        print("[SECURITY] Could not verify checksum. Continuing...")

def jwt_login(server_url, username, password, exam_id):
    """Authenticate student against server, get JWT token."""
    try:
        data = json.dumps({"username": username, "password": password, "exam_id": exam_id}).encode()
        req = urllib.request.Request(
            f"{server_url}/api/agent/verify",
            data=data, method="POST",
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            result = json.loads(resp.read())
            return result.get("token"), result.get("username")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read())
        raise ValueError(body.get("error", "Login failed"))
    except Exception as e:
        raise ValueError(f"Could not reach server: {e}")

def launch_exam_browser(server_url, username, token, session_id):
    """Auto-login to the exam portal using the SSO token."""
    # Point to Vite frontend on port 5173
    if ":3000" in server_url:
        frontend_url = server_url.replace(":3000", ":5173")
    else:
        frontend_url = "http://localhost:5173"

    exam_url = f"{frontend_url}/auto-login?token={token}&username={username}&role=student&exam_id={session_id}"
    print(f"[BROWSER] Opening secure exam portal for {username}...")
    try:
        webbrowser.open(exam_url)
    except Exception:
        print(f"[BROWSER] Could not auto-open browser. Please navigate to: {exam_url}")

def get_config():
    global STUDENT_ID
    print("=" * 51)
    print("        SIET OVERWATCH - STUDENT AGENT v2.2     ")
    print("=" * 51)

    ip = input("Enter Teacher's Server IP (blank=localhost): ").strip()
    url = f"http://{ip}:3000" if (ip and not ip.startswith("http")) else (ip or "http://localhost:3000")
    sid = input("Enter your Roll No / Username: ").strip()
    if not sid: sid = "STD-" + str(uuid.uuid4())[:8]

    return url, sid

# --- Entry point ---
if __name__ == "__main__":
    while True:
        SERVER_URL, STUDENT_ID = get_config()
        print(f"\n[AGENT] Connecting to: {SERVER_URL} as {STUDENT_ID}")

        # Step 1: SHA-256 Checksum Verification
        verify_checksum(SERVER_URL, STUDENT_ID)

        # Step 2: JWT Authentication
        password = ""
        while True:
            try:
                print(f"\n[AUTH] Authenticating student: {STUDENT_ID}")
                password = getpass.getpass("Enter your password: ")
                exam_id = input("Enter Teacher's Session ID: ").strip()
                if not exam_id:
                    print("Session ID is strictly required.")
                    continue
                token, username = jwt_login(SERVER_URL, STUDENT_ID, password, exam_id)
                print(f"[AUTH] ✅ Login successful for: {username}")
                break
            except ValueError as e:
                print(f"[AUTH] ❌ Login failed: {e}. Please try again.")

        # Step 3: Auto-launch exam browser with SSO Token
        launch_exam_browser(SERVER_URL, username, token, exam_id)

        # Step 4: Connect via Socket.io
        connected = False
        for attempt in range(3):
            try:
                sio.connect(SERVER_URL, namespaces=["/agent"], auth={"token": token, "exam_id": exam_id})
                connected = True
                break
            except Exception:
                print(f"[AGENT] Server not reachable. Retrying in 3s... (Attempt {attempt+1}/3)")
                time.sleep(3)

        if connected:
            break

    main_loop()
