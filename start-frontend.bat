@echo off
echo 🚀 Starting SocioFest Frontend...
cd client
if not exist "node_modules\" echo Installing dependencies... && call npm install
echo Starting Vite Server...
call npm run dev
pause