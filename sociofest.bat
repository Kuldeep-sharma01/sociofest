@echo off
echo ======================================
echo SocioFest - DEPRECATED Docker Setup
echo ======================================
echo.
echo WARNING: This script uses a specific Docker configuration that may be outdated.
echo For a full local or production deployment, please use run-all.bat instead.
echo.

echo 1. Starting Nginx Reverse Proxy Container...
docker run -d --name sociofest-proxy -p 80:80 -v "%cd%\nginx.conf:/etc/nginx/nginx.conf:ro" nginx:alpine

echo 2. Building and starting microservice containers...
docker-compose up --build -d backend python-service voice-ai
echo.
echo Containers are spinning up! View status with 'docker ps' or Docker Desktop.
echo.
echo ==============================================
echo 🌐 GATEWAY: http://localhost (via Nginx)
echo ==============================================
echo Node.js Backend:       Proxied from http://localhost:5000
echo Python Face Service:   Proxied from http://localhost:5001 (python-service)
echo Voice AI Service:      Proxied from http://localhost:8000 (voice-ai)
echo.
echo Note: Ensure Docker Desktop is running before executing this script.
echo To view live app logs, run: docker-compose logs -f
pause