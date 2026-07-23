@echo off
title SIET Overwatch - Server
color 0A
echo ============================================================
echo   SIET OVERWATCH - SERVER
echo   Starting on http://localhost:3000
echo   Keep this window open during the exam!
echo ============================================================
echo.
cd /d "%~dp0server"
node src/index.js
echo.
echo [SERVER STOPPED]
pause
