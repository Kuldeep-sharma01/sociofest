@echo off
echo 🖥️ Starting SocioFest Node.js Backend...
cd server
if not exist "node_modules\" echo Installing dependencies... && call npm install
echo Starting Express API on Port 5000...
call npm run dev
pause