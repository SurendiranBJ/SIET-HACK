import ctypes  
def get_visible_window_count():  
    try:  
        count = 0  
        def enumHandler(hwnd, ctx):  
            nonlocal count  
            if ctypes.windll.user32.IsWindowVisible(hwnd):  
                length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)  
                if length > 0:  
                    count += 1  
            return True  
        EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)  
        cb = EnumWindowsProc(enumHandler)  
        ctypes.windll.user32.EnumWindows(cb, 0)  
        return count  
    except Exception as e:  
        print('EXCEPTION:', e)  
        return 1  
print('COUNT:', get_visible_window_count())  
