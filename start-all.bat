@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo 🚀 SocioFest - Initialization Setup
echo ===================================================
echo.
echo [L] Local Development (Runs natively on your machine)
echo [P] Production Deployment (Uses Docker containers)
echo.
choice /C LP /N /M "Choose run mode [L/P]: "
if errorlevel 2 (
  set RUN_MODE=PROD
) else (
  set RUN_MODE=LOCAL
)

if "%RUN_MODE%"=="PROD" (
  echo ⚙️  Initializing Production Deployment...
  where docker >nul 2>&1
  if errorlevel 1 (
    echo ⚠️  ERROR: Docker not found. Required for Production mode.
    echo 🔄 FALLBACK: Automatically switching to Local Development mode...
    timeout /t 4 >nul
    set RUN_MODE=LOCAL
  ) else (
    call npm run deploy
    echo ✅ Production deployment running in background.
    pause
    goto :eof
  )
)

echo.
echo Starting SocioFest FULL STACK (Local Mode)...
echo.

REM 0. Ensure Node and Python are available
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found in PATH.
  goto error
)
REM A more robust check that avoids the Windows Store stub
python --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python is not installed or not found in your system's PATH.
  echo Please install Python from python.org and ensure "Add Python to PATH" is checked.
  goto error
)

where docker >nul 2>&1
if errorlevel 1 (
  echo WARNING: Docker is not installed or not in PATH. MongoDB container will fail to start.
  echo Please ensure MongoDB is running manually if Docker is absent.
  echo.
  set HAS_DOCKER=0
) else (
  set HAS_DOCKER=1
)

if not exist "server\.env" (
  echo 🔄 FALLBACK: Creating default server\.env from template...
  copy "server\.env.example" "server\.env" >nul
)
if not exist "client\.env" (
  echo 🔄 FALLBACK: Creating default client\.env from template...
  copy "client\.env.example" "client\.env" >nul
)
if not exist "server\python_modules\.env" (
  echo 🔄 FALLBACK: Creating default python_modules\.env from template...
  copy "server\python_modules\.env.example" "server\python_modules\.env" >nul
)

REM --- Smart Node Dependencies Fallback Check ---
if not exist "node_modules\" (
    echo Installing root npm packages...
    call npm install
)
if not exist "client\node_modules\" (
    echo Installing client dependencies...
    call npm install --prefix client
)
if not exist "server\node_modules\" (
    echo Installing server dependencies...
    call npm install --prefix server
)

cd python_modules
if not exist "venv\" (
  echo Creating Python Virtual Environment [venv]...
  call python -m venv venv
  if errorlevel 1 goto error
)

REM Smart Dependency Check: Only install if requirements.txt has changed
set "NEEDS_INSTALL=1"
if exist "venv\req.installed" (
  fc /b requirements.txt venv\req.installed >nul 2>&1
  if not errorlevel 1 set "NEEDS_INSTALL=0"
)

if "!NEEDS_INSTALL!"=="1" (
  echo Detecting new dependencies. Updating Python Virtual Environment...
  call venv\Scripts\activate.bat
  call python -m pip install --upgrade pip wheel
  call python -m pip install --use-deprecated=legacy-resolver -r requirements.txt
  if errorlevel 1 goto error
  copy /Y requirements.txt venv\req.installed >nul
  call deactivate
) else (
  echo Python dependencies are up-to-date. Skipping install.
)
cd ../..

REM 1. Start MongoDB (docker)
if "!HAS_DOCKER!"=="1" (
  echo Starting MongoDB...
  start "Databases" cmd /k "docker-compose up mongodb -d"
  timeout /t 5 >nul
) else (
  echo Docker not found, skipping Docker MongoDB startup. Relying on local MongoDB...
)

REM 2. Start Node Backend
echo Starting backend server...
start "Backend" cmd /k "cd server && npm run dev"

REM 3. Start Vite Frontend
echo Starting frontend...
start "Frontend" cmd /k "cd client && npm run dev"

REM 4. Start Voice AI (TTS/STT/XTTS)
echo Starting voice AI...
start "Voice-AI" cmd /k "cd python_modules && call venv\Scripts\activate.bat && python -m uvicorn custom_ai_api:app --host 0.0.0.0 --port 8000"

REM 5. Start Face Recognition Python (Flask)
echo Starting face recognition service...
start "Face-Rec" cmd /k "cd python_modules && call venv\Scripts\activate.bat && python -m waitress --listen=0.0.0.0:5001 app:app"

REM 6. Start Stable Diffusion
if exist "stable-diffusion-webui\" (
  echo Starting Stable Diffusion WebUI...
  start "Stable-Diffusion" cmd /k "cd stable-diffusion-webui && webui-user.bat"
  set "WAIT_SD=http://127.0.0.1:7860"
) else (
  echo Stable Diffusion folder not found. Skipping SD WebUI...
  set "WAIT_SD="
)

echo.
echo Waiting for services to become ready...

REM Wait on services to respond
call npx wait-on http://localhost:5173 http://localhost:5000 http://localhost:8000/docs http://localhost:5001/health %WAIT_SD% --timeout 300000
if errorlevel 1 (
  echo.
  echo ERROR: One or more services failed to become ready within 5 minutes.
  echo Check the individual service windows for errors.
  goto error
)

echo.
echo ========================================
echo ✅ ALL SERVICES READY
echo.
echo 📱 Frontend: http://localhost:5173
echo 🖥️  Backend API: http://localhost:5000
echo 🗣️  Voice AI: http://localhost:8000
echo 😎 Face Rec: http://localhost:5001
echo 🎨 Stable Diffusion: http://127.0.0.1:7860
echo 🗄️  MongoDB: localhost:27017
echo ========================================

pause
exit /b 0

:error
echo.
echo ========================================
echo ❌ STARTUP FAILED
echo Please review the error messages above and the terminal windows opened by this script.
echo ========================================
pause
exit /b 1
