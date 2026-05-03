#!/bin/bash
echo "==================================================="
echo "🚀 SocioFest - Initialization Setup"
echo "==================================================="
echo
echo "[L] Local Development (Runs natively on your machine)"
echo "[P] Production Deployment (Uses Docker containers)"
echo ""
read -p "Choose run mode [L/P]: " mode

if [[ "$mode" == "P" || "$mode" == "p" ]]; then
  echo "⚙️  Initializing Production Deployment..."
  if ! command -v docker &> /dev/null; then
    echo "⚠️  ERROR: Docker not found. Required for Production mode."
    echo "🔄 FALLBACK: Automatically switching to Local Development mode..."
    sleep 4
    mode="L"
  else
    npm run deploy
    echo "✅ Production deployment running in background."
    exit 0
  fi
fi

echo "🚀 Starting SocioFest FULL STACK (Local Mode - Linux/Mac)..."
echo

# --- Fallback logic: Ensure environment variables exist ---
[ ! -f "server/.env" ] && cp server/.env.example server/.env && echo "Created server/.env"
[ ! -f "client/.env" ] && cp client/.env.example client/.env && echo "Created client/.env"
[ ! -f "python_modules/.env" ] && cp python_modules/.env.example python_modules/.env && echo "Created python/.env"

# --- Smart Dependency Check Fallback ---
[ ! -d "node_modules" ] && npm install
[ ! -d "client/node_modules" ] && npm install --prefix client
[ ! -d "server/node_modules" ] && npm install --prefix server

# Terminal 1: MongoDB
docker compose up mongodb -d &
sleep 5

# Terminal 2: Backend  
npm run server &

# Terminal 3: Frontend
(cd client && npm run dev) &

# Terminal 4: Voice AI
(cd python_modules && pip install --upgrade pip wheel && pip install --use-deprecated=legacy-resolver -r requirements.txt && uvicorn custom_ai_api:app --host 0.0.0.0 --port 8000 --reload) &

# Terminal 5: Face Rec
(cd python_modules && python app.py) &

# Terminal 6: Stable Diffusion
if [ -d "stable-diffusion-webui" ]; then
  (cd stable-diffusion-webui && ./webui.sh --listen --api) &
fi

echo "
================================================
📱 Frontend: http://localhost:5173
🖥️ Backend: http://localhost:5000  
🗣️ Voice AI: http://localhost:8000
😎 Face Rec: http://localhost:5001
🎨 SD WebUI: http://localhost:7860
================================================
Press Ctrl+C to stop all"
wait
