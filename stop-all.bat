@echo off
echo Stopping ALL SocioFest services...

REM Prerequisite Check
where node >nul 2>&1
if errorlevel 1 ( echo ERROR: Node.js (and npx) not found in PATH. Cannot kill ports. & pause & goto :eof )

REM Kill common ports
npx kill-port 5000 5173 8000 5001 7860 27017 80 443

REM Kill Docker containers
where docker >nul 2>&1
if not errorlevel 1 (
docker compose -f docker-compose.full.yml down || docker-compose -f docker-compose.full.yml down
)

REM Kill Python/Node processes
echo.
echo WARNING: Forcefully terminating all node.exe and python.exe processes on the system.
taskkill /f /im node.exe /t >nul 2>&1
taskkill /f /im python.exe /t >nul 2>&1
taskkill /f /im uvicorn.exe /t >nul 2>&1

REM Cleanup
node server/scripts/cleanup.js || echo Cleanup skipped...

echo All services stopped! ✅
pause
