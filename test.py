import ctypes, ctypes.wintypes  
count = 0  
def enumHandler(hwnd, ctx):  
    global count  
    if ctypes.windll.user32.IsWindowVisible(hwnd):  
        length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)  
        if length > 0: count += 1  
    return True  
EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)  
ctypes.windll.user32.EnumWindows(EnumWindowsProc(enumHandler), 0)  
print(count)  
