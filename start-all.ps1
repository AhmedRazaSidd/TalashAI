Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "          TALASH AI LEGAL PLATFORM - SYSTEM INITIALIZER" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Preparing to boot up all systems concurrently..." -ForegroundColor Yellow
Write-Host ""

# 1. Launch Python AI FastAPI Server
Write-Host "[+] Launching Python AI Agent (FastAPI Port 8000)..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList '/c cd talashAgent && (if exist .venv\Scripts\activate.bat (call .venv\Scripts\activate.bat) else if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat)) && python -m uvicorn api:app --port 8000' -NoNewWindow:$false

# 2. Launch NestJS Backend Server
Write-Host "[+] Launching NestJS Backend Server (Port 3000)..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList '/c cd server && npm run start:dev' -NoNewWindow:$false

# 3. Launch Expo Frontend Mobile App
Write-Host "[+] Launching Expo Metro Bundler (Port 8081)..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList '/c cd app && npx expo start' -NoNewWindow:$false

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " SUCCESS: All three systems are launching in individual windows!" -ForegroundColor Green
Write-Host " " -ForegroundColor Green
Write-Host " 1. Python AI API:  http://localhost:8000" -ForegroundColor Yellow
Write-Host " 2. NestJS Backend: http://localhost:3000" -ForegroundColor Yellow
Write-Host " 3. Expo Mobile:    Port 8081 (Metro Bundler)" -ForegroundColor Yellow
Write-Host ""
Write-Host " Keep those windows open while developing." -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
