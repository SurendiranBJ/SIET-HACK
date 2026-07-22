import time
import uuid
import json
import socketio
import random
import threading
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

SERVER_URL = "http://localhost:3000/agent"

def generate_mock_screen(student_name, color, text):
    img = Image.new('RGB', (800, 600), color)
    draw = ImageDraw.Draw(img)
    
    # Draw simple text overlay
    draw.text((300, 280), f"{student_name}\n{text}", fill=(255, 255, 255))
    
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=20)
    return base64.b64encode(buf.getvalue()).decode('utf-8')

class MockStudent:
    def __init__(self, index):
        self.sio = socketio.Client()
        self.student_id = f"ROLL-{index:02d}"
        self.name = f"Mock Student {index}"
        self.hostname = f"LAB-PC-{index:02d}"
        self.ip = f"192.168.1.{100 + index}"
        
        # State
        self.color = (random.randint(50, 150), random.randint(50, 150), random.randint(50, 150))
        self.status_text = "Working normally..."
        self.typing_speed = random.randint(20, 60)
        self.processes = ["chrome.exe", "vscode.exe"]
        self.idle = 0
        self.mouse = random.randint(10, 50)
        
        self.setup_events()

    def setup_events(self):
        @self.sio.event(namespace='/agent')
        def connect():
            self.sio.emit('agent:register', {
                'student_id': self.student_id,
                'hostname': self.hostname,
                'ip': self.ip,
                'mac': '00:00:00:00:00:00'
            }, namespace='/agent')
            
    def connect(self):
        try:
            self.sio.connect("http://localhost:3000", namespaces=['/agent'])
        except:
            pass
            
    def loop(self):
        while True:
            if self.sio.connected:
                # Add some random variation
                current_typing = self.typing_speed + random.randint(-10, 10)
                
                # Send frame
                frame_data = generate_mock_screen(self.name, self.color, self.status_text)
                self.sio.emit('agent:frame', {
                    'jpeg_base64': frame_data,
                    'timestamp': time.time()
                }, namespace='/agent')
                
                # Send activity
                self.sio.emit('agent:activity', {
                    'mouse_delta': self.mouse,
                    'keystroke_count': max(0, current_typing),
                    'idle_seconds': self.idle,
                    'processes': self.processes
                }, namespace='/agent')
                
            time.sleep(2)

def main():
    import sys
    num_students = 10
    if len(sys.argv) > 1 and sys.argv[1] == '--count':
        num_students = int(sys.argv[2])

    print(f"Starting {num_students} mock students...")
    
    students = [MockStudent(i+1) for i in range(num_students)]
    
    for s in students:
        s.connect()
        threading.Thread(target=s.loop, daemon=True).start()
        time.sleep(0.2)
        
    print("Mock students running. Type commands to trigger flags:")
    print("  cheat <id> - Make a student open discord")
    print("  idle <id> - Make a student idle")
    print("  normal <id> - Return to normal")
    
    while True:
        try:
            cmd = input().strip().split()
            if len(cmd) == 2:
                action = cmd[0]
                idx = int(cmd[1]) - 1
                if 0 <= idx < num_students:
                    s = students[idx]
                    if action == 'cheat':
                        s.processes = ["chrome.exe", "discord.exe"]
                        s.status_text = "PLAYING DISCORD"
                        s.color = (200, 50, 50)
                        print(f"{s.student_id} is now cheating")
                    elif action == 'idle':
                        s.idle = 400
                        s.typing_speed = 0
                        s.mouse = 0
                        s.status_text = "IDLE / AWAY"
                        s.color = (50, 50, 200)
                        print(f"{s.student_id} is now idle")
                    elif action == 'normal':
                        s.processes = ["chrome.exe", "vscode.exe"]
                        s.idle = 0
                        s.typing_speed = random.randint(20, 60)
                        s.mouse = random.randint(10, 50)
                        s.status_text = "Working normally..."
                        s.color = (random.randint(50, 150), random.randint(50, 150), random.randint(50, 150))
                        print(f"{s.student_id} is normal")
        except:
            pass

if __name__ == '__main__':
    main()
