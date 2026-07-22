import time
import uuid
import socket
import json
import psutil
import mss
import ctypes
from io import BytesIO
from PIL import Image
import socketio
from pynput import keyboard

# Configuration
SERVER_URL = "http://localhost:3000/agent"
STUDENT_ID = "STD-" + str(uuid.uuid4())[:8]

sio = socketio.Client()
sct = mss.mss()

# Keystroke cadence tracking
keystroke_count = 0
def on_press(key):
    global keystroke_count
    keystroke_count += 1

listener = keyboard.Listener(on_press=on_press)
listener.start()

class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

def get_idle_time():
    try:
        lastInputInfo = LASTINPUTINFO()
        lastInputInfo.cbSize = ctypes.sizeof(lastInputInfo)
        ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lastInputInfo))
        millis = ctypes.windll.kernel32.GetTickCount() - lastInputInfo.dwTime
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

def capture_screen():
    # Capture the primary monitor
    monitor = sct.monitors[1]
    sct_img = sct.grab(monitor)
    img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
    
    # Throttle/Compress frames: Resize and low JPEG quality to save bandwidth
    img.thumbnail((800, 600), Image.Resampling.LANCZOS)
    
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=30, optimize=True)
    import base64
    return base64.b64encode(buf.getvalue()).decode('utf-8')

@sio.event(namespace='/agent')
def connect():
    print("Connected to server")
    hostname = socket.gethostname()
    try:
        ip = socket.gethostbyname(hostname)
    except Exception:
        ip = "127.0.0.1"
    mac = ':'.join(['{:02x}'.format((uuid.getnode() >> ele) & 0xff) for ele in range(0,8*6,8)][::-1])
    sio.emit('agent:register', {
        'student_id': STUDENT_ID,
        'hostname': hostname,
        'ip': ip,
        'mac': mac
    }, namespace='/agent')

@sio.event(namespace='/agent')
def connect_error(data):
    print("Connection failed:", data)

@sio.event(namespace='/agent')
def disconnect():
    print("Disconnected from server")

def main_loop():
    global keystroke_count
    while True:
        if not sio.connected:
            time.sleep(2)
            continue
            
        try:
            # 1. Capture & send screen
            jpeg_base64 = capture_screen()
            sio.emit('agent:frame', {
                'jpeg_base64': jpeg_base64,
                'timestamp': time.time()
            }, namespace='/agent')
            
            # 2. Gather native OS telemetry
            processes = []
            for p in psutil.process_iter(['name']):
                try:
                    if p.info['name']: processes.append(p.info['name'])
                except Exception:
                    pass

            idle_seconds = get_idle_time()
            active_window = get_active_window_title()
            num_monitors = len(sct.monitors) - 1 # mss index 0 is all monitors combined
            
            sio.emit('agent:activity', {
                'mouse_delta': 10,
                'keystroke_count': keystroke_count,
                'idle_seconds': idle_seconds,
                'processes': processes,
                'active_window': active_window,
                'secondary_monitor': num_monitors > 1,
                'monitor_count': num_monitors
            }, namespace='/agent')
            
            # Reset cadence counter per window
            keystroke_count = 0
            
            time.sleep(2)
        except Exception as e:
            print(f"Error in main loop: {e}")
            time.sleep(2)

if __name__ == '__main__':
    while True:
        try:
            sio.connect("http://localhost:3000", namespaces=['/agent'])
            break
        except Exception:
            print(f"Waiting for server at {SERVER_URL}...")
            time.sleep(3)
    main_loop()
