@echo off
title Talash AI Legal Platform — Starter
color 0B
echo =====================================================================
echo           TALASH AI LEGAL PLATFORM - SYSTEM INITIALIZER
echo =====================================================================
echo.
echo Preparing to boot up all systems concurrently...
echo.

:: 1. Launch Python AI FastAPI Server
echo [+] Launching Python AI Agent (FastAPI Port 8000)...
start "Talash AI FastAPI Server" cmd /c "cd talashAgent && (if exist .venv\Scripts\activate.bat (call .venv\Scripts\activate.bat) else if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat)) && python -m uvicorn api:app --host 0.0.0.0 --port 8000"

:: 2. Launch NestJS Backend Server
echo [+] Launching NestJS Backend Server (Port 3000)...
start "Talash NestJS Backend" cmd /c "cd server && npm run start:dev"

:: 3. Launch Expo Frontend Mobile App
echo [+] Launching Expo Metro Bundler (Port 8081)...
start "Talash Expo Mobile App" cmd /c "cd app && npx expo start"

echo.
echo =====================================================================
echo  SUCCESS: All three systems are launching in individual windows!
echo  
echo  1. Python AI API:  http://localhost:8000
echo  2. NestJS Backend: http://localhost:3000
echo  3. Expo Mobile:    Port 8081 (Metro Bundler)
echo.
echo  Keep those windows open while developing. Press any key to exit this starter.
echo =====================================================================
pause > nul
