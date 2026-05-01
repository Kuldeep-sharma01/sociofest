# 🚀 SocioFest Complete Deployment Guide
## From Scratch Setup (Local/Cloud - Docker or Native)

### 📋 Prerequisites
```
Node.js 20+ (https://nodejs.org)
Python 3.10+ (https://python.org - "Add to PATH" checked)
MongoDB (Local or Atlas)
Git
FFmpeg (optional for media)
```
*Cloud*: VPS (Ubuntu 22.04+), domain name, SSL certs

---

## 1. Clone & Initial Setup
```bash
git clone <repo>
cd sociofest
npm install
npm --prefix client install
npm --prefix server install
```

## 2. Environment Files (.env Creation)
Copy templates & edit:

**server/.env**
```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sociofest # or Atlas
JWT_SECRET=your-super-secret-jwt-key-64chars-min
PYTHON_API_URL=http://localhost:5001
VOICE_AI_URL=http://localhost:8000
VITE_CLIENT_URL=http://localhost:5173,http://yourdomain.com
UPLOAD_LIMIT_MB=50
```

**client/.env**
```
VITE_CLIENT_URL=http://localhost:5000/api
PYTHON_API_URL=http://localhost:5001
VITE_VOICE_API_URL=http://localhost:8000
```

**server/python_modules/.env**
```
MONGODB_URI=your-mongo-uri
OPENAI_API_KEY=sk-...
HUGGINGFACE_TOKEN=hf_...
```

---

## 3. Deployment Modes

### A. Native Local (No Docker - Windows/Mac/Linux)
```bash
# Python AI setup
cd server/python_modules
python -m venv venv
venv\Scripts\activate # Windows
source venv/bin/activate # Mac/Linux
pip install -r requirements.txt

# Run services
npm --prefix server run dev  # Backend :5000
npm --prefix client run dev  # Frontend :5173
# Python (separate terminals)
python -m waitress 0.0.0.0:5001 app:app  # Face AI
uvicorn custom_ai_api:app --host 0.0.0.0 --port 8000  # Voice AI

# Quick start
smart-deploy.bat  # Interactive selector!
```

**Ports Used:** 5173 (FE), 5000 (BE), 5001 (Face), 8000 (Voice)

### B. Docker Local (Recommended Dev)
```bash
docker compose -f docker-compose.yml up -d  # Basic
docker compose -f docker-compose.full.yml up -d  # Full + Nginx
```

### C. Cloud Production (Railway/Render/DO)
1. **Push to Git** (Railway auto-deploy)
2. **Add .env vars** in platform dashboard
3. **docker-compose.cloud.yml** for external MongoDB Atlas + Redis:
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/sociofest
REDIS_URL=redis://default:pass@redis-host:6379
VITE_CLIENT_URL=https://yourdomain.com
```
4. **SSL**: Upload certs to `./ssl/` + nginx.conf
5. `docker compose -f docker-compose.cloud.yml up -d`

**Railway:** `railway up --dockerfile Dockerfile.prod`
**Render:** Service → Docker → docker-compose.full.yml

### D. VPS Manual (Ubuntu)
```bash
apt update && apt install -y nginx docker docker-compose nodejs npm python3 python3-venv ffmpeg
git clone repo && cd sociofest
npm install && npm --prefix client/server install
docker compose -f docker-compose.full.yml up -d

# Nginx reverse proxy (nginx.conf)
sudo nginx -t && sudo systemctl reload nginx
```

**SSL (Certbot):**
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

---

## 4. Service Health Check
```
http://localhost:5173  # Frontend
http://localhost:5000/health  # Backend ✓
http://localhost:5001/health  # Python ✓
http://localhost:8000/docs  # Voice AI ✓
```

**Wait Tool:** `npx wait-on http://localhost:5000/health http://localhost:5001/health`

## 5. Domain Setup
1. A record → server IP
2. Update VITE_CLIENT_URL=yourdomain.com
3. Nginx SSL volume mount
4. Restart: `docker compose restart`

## 6. Troubleshooting
- **Port conflict**: `npx kill-port 5000`
- **Python deps**: Delete `server/python_modules/venv` → recreate
- **Mongo connection**: Test `mongosh mongodb://localhost:27017`
- **Build fail**: `npm run build --prefix client` + check logs

## 7. Quick Commands
```bash
# Logs
docker logs -f sociofest-backend

# Restart
docker compose restart

# Scale
docker compose up --scale python-service=2 -d

# Backup
docker exec sociofest-mongo mongodump --out=/dump
```

**Production Ready!** Questions? 🚀
