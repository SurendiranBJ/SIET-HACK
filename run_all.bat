@echo off
title Launch SIET-HACK Services
echo ==============================================
echo        Starting SIET-HACK Application
echo ==============================================
echo.

:: Add local nodejs and python paths if available
set "PATH=D:\software\nodejs;D:\software\python;%PATH%"

cd /d "%~dp0"

echo [1/3] Starting Backend Server (Port 3000)...
start "SIET-HACK Server" cmd /k "cd /d "%~dp0server" && node src/index.js"

ping -n 3 127.0.0.1 >nul

echo [2/3] Starting Frontend Dashboard (Vite)...
start "SIET-HACK Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

ping -n 3 127.0.0.1 >nul

echo [3/3] Starting Student Agent...
start "SIET-HACK Agent" cmd /k "cd /d "%~dp0agent" && python student_agent.py"

echo.
echo ==============================================
echo  All 3 services have been launched!
echo  - Backend:  http://localhost:3000
echo  - Frontend: http://localhost:5173
echo ==============================================
echo.
pause
