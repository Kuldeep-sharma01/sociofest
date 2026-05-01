@echo off
setlocal enabledelayedexpansion
echo ⚡ SocioFest EASY START - All Local Services (No Docker or Stable Diffusion)
echo.

REM Ensure .env files exist
if not exist "server\.env" (
    echo Creating default server\.env from template...
    copy "server\.env.example" "server\.env" >nul
)
if not exist "client\.env" (
    echo Creating default client\.env from template...
    copy "client\.env.example" "client\.env" >nul
)
if not exist "server\python_modules\.env" (
    echo Creating default python_modules\.env from template...
    copy "server\python_modules\.env.example" "server\python_modules\.env" >nul
)

REM Smart Node Dependencies check
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

REM Kill existing ports
echo Killing active ports to ensure a clean start...
npx kill-port 5000 5173 8000 5001 7860

REM Backend (Node.js server)
start "Backend (5000)" /min cmd /k "cd server && npm run dev"

REM Frontend (React Vite)
start "Frontend (5173)" /min cmd /k "cd client && npm run dev"

REM Python AI (Voice + Face - lighter deps)
pushd server\python_modules
if not exist "venv\" (
  echo Creating Python Virtual Environment [venv]...
  call python -m venv venv
)

set "NEEDS_INSTALL=1"
if exist "venv\req.installed" (
  fc /b requirements.txt venv\req.installed >nul 2>&1
  if not errorlevel 1 set "NEEDS_INSTALL=0"
)

if "!NEEDS_INSTALL!"=="1" (
  echo Detecting new Python dependencies. Updating (this may take a while)...
  call venv\Scripts\activate.bat
  call python -m pip install --upgrade pip wheel >nul 2>&1
  call python -m pip install -r requirements.txt
  if errorlevel 1 ( call deactivate & popd & goto :eof )
  copy /Y requirements.txt venv\req.installed >nul
  call deactivate
)
popd
start "AI APIs" /min cmd /k "cd server\python_modules && call venv\Scripts\activate.bat && npx concurrently \"python -m uvicorn custom_ai_api:app --host 0.0.0.0 --port 8000\" \"python -m waitress --listen=0.0.0.0:5001 app:app\""

echo.
echo Waiting for core services to become ready...
call npx wait-on http://localhost:5173 http://localhost:5000 http://localhost:8000/docs http://localhost:5001/health --timeout 180000
if errorlevel 1 (
  echo ERROR: One or more services failed to start within 3 minutes. Check the minimized windows for errors.
  pause
  goto :eof
)

echo.
echo 🚀 EASY MODE LIVE!
echo 📱 Frontend: http://localhost:5173/ 
echo 🖥️ Backend: http://localhost:5000/
echo 🗣️ Voice AI: http://localhost:8000
echo 😎 Face AI: http://localhost:5001
echo 👥 Login/Signup first, then try AIHub!
pause
