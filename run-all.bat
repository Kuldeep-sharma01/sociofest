@echo off
setlocal enabledelayedexpansion
REM Fix for PowerShell execution - run with cmd /c
if "%~1"=="" cmd /c ""

echo ===================================================
echo 🚀 SocioFest - Initialization Setup
echo ===================================================
echo.
echo [L] Local Development (Runs natively on your machine - fast start)
echo [P] Production Deployment (Uses Docker containers - full isolation)
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
    echo 📦 Building and starting Docker containers...
    call npm run deploy
    echo ✅ Production deployment running in background. Check Docker Desktop.
    pause
    goto :eof
  )
)

echo.
echo Starting SocioFest FULL STACK (Local Mode)...
timeout /t 2 /nobreak >nul

REM --- Prerequisite Checks ---
where node >nul 2>&1
if errorlevel 1 ( echo ERROR: Node.js not found in PATH. & pause & goto :eof )

REM A more robust check that avoids the Windows Store stub
python --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python is not installed or not found in your system's PATH.
  echo Please install Python from python.org and ensure "Add Python to PATH" is checked.
  pause & goto :eof
)

REM --- Fallback: Ensure .env files exist so app doesn't break ---
if not exist "server\.env" copy "server\.env.example" "server\.env" >nul
if not exist "client\.env" copy "client\.env.example" "client\.env" >nul
if not exist "server\python_modules\.env" copy "server\python_modules\.env.example" "server\python_modules\.env" >nul

REM --- Smart Dependencies Fallback ---
if not exist "node_modules\" (
  echo Installing root dependencies...
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

REM --- Python Virtual Environment Setup (Best Practice) ---
pushd server\python_modules
if not exist "venv\" (
  echo Creating Python Virtual Environment [venv]...
  call python -m venv venv
  if errorlevel 1 ( popd & goto :eof )
)

REM Smart Dependency Check: Only install if requirements.txt has changed
set "NEEDS_INSTALL=1"
if exist "venv\req.installed" (
  fc /b requirements.txt venv\req.installed >nul 2>&1
  if not errorlevel 1 set "NEEDS_INSTALL=0"
)

if "!NEEDS_INSTALL!"=="1" (
  echo Activating venv and installing/updating Python dependencies (this may take a while)...
  call venv\Scripts\activate.bat
  call python -m pip install --upgrade pip wheel >nul
  call python -m pip install -r requirements.txt
  if errorlevel 1 ( call deactivate & popd & goto :eof )
  copy /Y requirements.txt venv\req.installed >nul
  call deactivate
) else (
  echo Python dependencies are up-to-date. Skipping install.
)
popd

echo Killing active ports to ensure a clean start...
npx kill-port 5000 5173 8000 5001 7860 >nul 2>&1

where docker >nul 2>&1
if errorlevel 1 (
  echo WARNING: Docker not found. Skipping Docker containers.
  echo Assuming MongoDB Community Server is running locally...
) else (
  REM MongoDB (Docker - Windows compatible)
  docker compose -f docker-compose.full.yml up mongodb -d
  timeout /t 8 /nobreak >nul

  REM Nginx (Production Proxy)
  docker compose -f docker-compose.full.yml up nginx -d
)

REM Backend
start "Backend" /min cmd /k "npm run server"

REM Frontend  
start "Frontend" /min cmd /k "cd client && npm run dev"

REM Python AI APIs
start "Voice AI" /min cmd /k "cd server/python_modules && call venv\Scripts\activate.bat && python -m uvicorn custom_ai_api:app --host 0.0.0.0 --port 8000"
start "Face API" /min cmd /k "cd server/python_modules && call venv\Scripts\activate.bat && python -m waitress --listen=0.0.0.0:5001 app:app"

REM Stable Diffusion (if folder exists)
if exist "stable-diffusion-webui" (
  start "Stable Diffusion" /min cmd /k "cd stable-diffusion-webui && webui-user.bat"
  set "WAIT_SD=http://127.0.0.1:7860"
) else (
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
  pause
  goto :eof
)

echo.
echo 🚀 SocioFest FULL STACK LIVE! (Minimized terminals)
echo 📱 Frontend: http://localhost:5173
echo 🖥️ Backend: http://localhost:5000
echo ️ Voice AI: http://localhost:8000
echo 😎 Face AI (via Gateway): http://localhost:5000/api/face-rec
echo 💻 Compiler (via Gateway): http://localhost:5000/api/compiler-test
echo 🎨 Images: http://localhost:7860  
echo 🗄️ Mongo: localhost:27017
echo.
echo Production: http://localhost (Nginx proxy)
echo.
echo Use .\run-all.bat in PowerShell or double-click!
pause
