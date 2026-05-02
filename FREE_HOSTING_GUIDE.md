# 🚀 SocioFest — Complete Free Hosting Deployment Guide

> Deploy all 3 services for **$0/month** using Vercel + Render + MongoDB Atlas free tiers.

---

## 📐 Architecture — 3 Independent Services, 3 APIs

```
┌──────────────────────────────────────────────────────────────────────┐
│                        🌐 INTERNET                                   │
└────────────┬──────────────────┬──────────────────┬───────────────────┘
             │                  │                  │
             ▼                  ▼                  ▼
    ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐
    │   🖥️ CLIENT      │ │   ⚙️ SERVER       │ │   🐍 PYTHON       │
    │   (Vercel)       │ │   (Render)        │ │   (Render)        │
    │                  │ │                   │ │                   │
    │   React + Vite   │ │   Node.js Express │ │   Flask + AI      │
    │   Static SPA     │ │   REST API        │ │   Face Recognition│
    │                  │ │   Socket.io       │ │   Image Generation│
    │   Port: 443      │ │   Port: 5000      │ │   Port: 5001      │
    │   FREE ✅        │ │   FREE ✅         │ │   FREE ✅         │
    └────────┬─────────┘ └────────┬──────────┘ └────────┬──────────┘
             │                    │                     │
             │    /api/*          │                     │
             │───────────────────▶│                     │
             │                    │                     │
             │                    │    /api/ai/*        │
             │                    │────────────────────▶│
             │                    │                     │
             │                    │   SHARED DATABASE   │
             │                    ▼          ▼          │
             │               ┌──────────────────┐       │
             │               │   🍃 MongoDB      │       │
             │               │   (Atlas Free)    │◀──────┘
             │               └──────────────────┘
             │
             │   The 3 API Endpoints:
             │
             │   1️⃣  /api/*          → Server (Node.js)
             │   2️⃣  /api/face-rec/* → Server Proxy → Python (Face Rec)
             │   3️⃣  /socket.io/*    → Server (WebSocket)
             │
             └──────────────────────────────────────────
```

---

## 🆓 Free Tier Limits

| Service | Provider | Free Tier | Limit |
|---------|----------|-----------|-------|
| **Client** | Vercel | Hobby | 100 GB bandwidth/month, unlimited deploys |
| **Server** | Render | Free Web Service | 750 hrs/month, sleeps after 15 min idle |
| **Python** | Render | Free Web Service | 750 hrs/month, sleeps after 15 min idle |
| **Database** | MongoDB Atlas | M0 Shared | 512 MB storage, free forever |

> ⚠️ **Render Sleep Limit:** Free tier services sleep after 15 min. First request takes ~30s to wake.
> ⚠️ **Render Ephemeral Storage:** Render's free tier uses ephemeral disks. Uploaded media files (images/videos) will be deleted every time the server restarts. Upgrade to a paid plan with a persistent disk, or integrate cloud storage (Firebase/S3) for production use.

---

## 📋 Prerequisites

Before you begin, you need:

- [x] A **GitHub account** (to push your code)
- [x] A **Vercel account** (https://vercel.com — sign up with GitHub)
- [x] A **Render account** (https://render.com — sign up with GitHub)
- [x] A **MongoDB Atlas account** (https://cloud.mongodb.com — sign up free)
- [x] Your repo pushed to GitHub

---

## STEP 1: Create MongoDB Atlas Free Database

This is done first because **both Server and Python need the same database URL**.

### 1.1 — Create Atlas Cluster

1. Go to https://cloud.mongodb.com
2. Click **"Build a Database"**
3. Select **M0 FREE** (Shared) tier
4. Choose your region (pick closest to your users)
5. Cluster name: `sociofest-cluster` (or anything)
6. Click **"Create Cluster"**

### 1.2 — Create Database User

1. Go to **Database Access** → **Add New Database User**
2. Authentication: Password
3. Username: `sociofest_user`
4. Password: Generate a secure password → **COPY IT NOW**
5. Role: `Atlas Admin` (or `readWriteAnyDatabase`)
6. Click **"Add User"**

### 1.3 — Allow Network Access

1. Go to **Network Access** → **Add IP Address**
2. Click **"Allow Access from Anywhere"** (sets `0.0.0.0/0`)
3. Click **"Confirm"**

> ⚠️ This allows any IP to connect. For production, whitelist only your Render service IPs.

### 1.4 — Get Connection String

1. Go to **Database** → Click **"Connect"** on your cluster
2. Choose **"Connect your application"**
3. Driver: Node.js, Version: 6.0+
4. Copy the connection string. It looks like:
```
mongodb+srv://sociofest_user:<password>@sociofest-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```
5. Replace `<password>` with the password from step 1.2
6. Add database name before the `?`:
```
mongodb+srv://sociofest_user:YOUR_PASSWORD@sociofest-cluster.xxxxx.mongodb.net/sociofest?retryWrites=true&w=majority
```

**Save this connection string — you'll need it for both Server and Python.**

---

## STEP 2: Generate Shared Secrets

Both Server and Python need the **same JWT_SECRET**. Generate one now:

### Option A: Using Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Option B: Using Python
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

**Save this JWT_SECRET — you'll use it in Steps 3 and 4.**

---

## STEP 3: Deploy SERVER (Node.js) on Render

### 3.1 — Create Web Service

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your **GitHub repo**
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `sociofest-backend` |
| **Region** | Same as your Atlas cluster |
| **Branch** | `main` (or your default branch) |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm ci --omit=dev` |
| **Start Command** | `node server.js` |
| **Instance Type** | **Free** |

### 3.2 — Set Environment Variables

Go to the **Environment** tab and add these variables **one by one**:

```env
NODE_ENV=production
PORT=5000

# Database (from Step 1)
MONGODB_URI=mongodb+srv://sociofest_user:YOUR_PASSWORD@cluster.xxxxx.mongodb.net/sociofest?retryWrites=true&w=majority

# Shared secret (from Step 2)
JWT_SECRET=your_64_char_hex_secret_here
JWT_EXPIRES_IN=7d

# URLs — UPDATE after deploying client and python
FRONTEND_URL=https://sociofest.vercel.app
PYTHON_INTERNAL_URL=https://sociofest-python.onrender.com

# Email (Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=no-reply@sociofest.com
SMTP_SECURE=false

# Push Notifications (generate at https://web-push-codelab.glitch.me/)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your_email@gmail.com

# Admin defaults
DEFAULT_ADMIN_MAIL=admin@sociofest.edu
DEFAULT_ADMIN_PASSWORD=YourSecureAdminPassword123!

# Encryption
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### 3.3 — Set Health Check

In the service settings:
- **Health Check Path**: `/health`

### 3.4 — Deploy

Click **"Create Web Service"**. Render will:
1. Clone your repo
2. Run `npm ci --omit=dev` in the `server/` directory
3. Start `node server.js`
4. Your server URL will be: `https://sociofest-backend.onrender.com`

### 3.5 — Verify

Visit `https://sociofest-backend.onrender.com/health` — you should see:
```json
{"status": "ok", "db": "connected", "uptime": 12.345}
```

---

## STEP 4: Deploy PYTHON (Flask AI) on Render

### 4.1 — Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect the **same GitHub repo**
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `sociofest-python` |
| **Region** | Same as your Atlas cluster |
| **Branch** | `main` |
| **Root Directory** | `server/python_modules` |
| **Runtime** | `Docker` |
| **Dockerfile Path** | `./Dockerfile` |
| **Instance Type** | **Free** |

> 💡 We use Docker runtime because Python needs system dependencies (OpenCV, TensorFlow, etc.)

### 4.2 — Set Environment Variables

```env
# Database (SAME as Server — Step 1)
MONGODB_URI=mongodb+srv://sociofest_user:YOUR_PASSWORD@cluster.xxxxx.mongodb.net/sociofest?retryWrites=true&w=majority

# Shared secret (SAME as Server — Step 2)
JWT_SECRET=your_64_char_hex_secret_here

# URLs
# Port (Render sets this automatically, but good to have as default)
PORT=5001
```

> ⚠️ **CRITICAL**: `JWT_SECRET` and `MONGODB_URI` **MUST be identical** to the Server. If they don't match, authentication between services will fail silently.

### 4.3 — Set Health Check

- **Health Check Path**: `/health`

### 4.4 — Deploy

Click **"Create Web Service"**. Render will:
1. Build the Docker image from `server/python_modules/Dockerfile`
2. Download TensorFlow model (~100 MB on first start)
3. Your Python URL will be: `https://sociofest-python.onrender.com`

> ⏳ First deploy takes **5-10 minutes** (downloading ML models). Subsequent deploys are faster.

### 4.5 — Verify

Visit `https://sociofest-python.onrender.com/health` — you should see:
```json
{"status": "Python face recognition service is running"}
```

---

## STEP 5: Deploy CLIENT (React) on Vercel

### 5.1 — Import Project

1. Go to https://vercel.com/new
2. Click **"Import Git Repository"**
3. Select your GitHub repo
4. Configure:

| Setting | Value |
|---------|-------|
| **Framework Preset** | `Vite` |
| **Root Directory** | `client` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

### 5.2 — Set Environment Variables

Click **"Environment Variables"** and add:

```env
# Point to your Node.js Gateway
VITE_BACKEND_URL=https://sociofest-backend.onrender.com

# Firebase (for push notifications)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 5.3 — Deploy

Click **"Deploy"**. Vercel will:
1. Run `npm run build` in the `client/` directory
2. Serve the static SPA with CDN
3. Your client URL will be: `https://sociofest.vercel.app` (or your custom domain)

### 5.4 — How Client Finds the APIs

The `vercel.json` has fallback rewrites, but the client primarily uses environment variables:

```
Browser loads React SPA from Vercel
    │
    ├── /api/* & /api/ai/* ───────▶ https://sociofest-backend.onrender.com/api/*
    │   (VITE_BACKEND_URL)           (Node.js Express Gateway)
    │
    │                                       │
    │                                       └──▶ https://sociofest-python.onrender.com/*
    │                                            (Flask Python via Proxy)
    │
    └── /socket.io/* ─────────────▶ https://sociofest-backend.onrender.com/socket.io/*
        (VITE_BACKEND_URL)           (Socket.io WebSocket)
```

### 5.5 — Verify

Visit your Vercel URL — the SPA should load. Open browser DevTools → Network tab:
- Login request should go to `https://sociofest-backend.onrender.com/api/auth/login`
- Face verification should go to `https://sociofest-python.onrender.com/python-api/verify-face`

---

## STEP 6: Update Server FRONTEND_URL (Cross-Reference)

Now that you know all 3 URLs, go back and make sure they're consistent:

### Server (Render Dashboard → sociofest-backend → Environment)
```env
FRONTEND_URL=https://your-app.vercel.app
PYTHON_URL=https://sociofest-python.onrender.com
```

### Python (Render Dashboard → sociofest-python → Environment)
```env
FRONTEND_URL=https://your-app.vercel.app
```

> 💡 `FRONTEND_URL` is used for **CORS**. If it doesn't match the actual client URL, all API requests from the browser will be blocked with CORS errors.

---

## STEP 7: Seed Admin Account

After all 3 services are running, seed the admin account:

### Option A: Auto-seeded on first start
The server auto-creates an admin account using `DEFAULT_ADMIN_MAIL` and `DEFAULT_ADMIN_PASSWORD` from the env vars.

### Option B: Manual seed via Render Shell
1. Go to Render Dashboard → `sociofest-backend` → **Shell**
2. Run:
```bash
node seeder.js
```

---

## ✅ Final Verification Checklist

| Test | URL | Expected Result |
|------|-----|-----------------|
| Server health | `https://sociofest-backend.onrender.com/health` | `{"status":"ok","db":"connected"}` |
| Python health | `https://sociofest-python.onrender.com/health` | `{"status":"...running"}` |
| Client loads | `https://your-app.vercel.app` | React SPA renders |
| Login works | Click login on client | Redirects to dashboard |
| Face AI works | Try face registration | Camera + AI responds |

---

## 🔧 Troubleshooting

### "CORS error" in browser console
```
FRONTEND_URL on the Server and Python services must EXACTLY match your Vercel URL.
- Wrong: FRONTEND_URL=https://sociofest.vercel.app/  (trailing slash)
- Wrong: FRONTEND_URL=http://sociofest.vercel.app    (http instead of https)
- Right: FRONTEND_URL=https://sociofest.vercel.app
```

### "Network Error" / API calls timing out
```
Render free services sleep after 15 minutes of inactivity.
First request after sleep takes ~30 seconds.
Solution: Be patient, or use a free uptime monitor (UptimeRobot) to ping every 14 min.
```

### "JWT token invalid" on Python face API
```
JWT_SECRET MUST be the exact same string on both Server and Python.
Copy-paste it — don't retype it. Even one character difference breaks everything.
```

### "MongoDB connection failed"
```
1. Check MONGODB_URI has the correct password (no angle brackets)
2. Check Atlas Network Access allows 0.0.0.0/0
3. Check the database name is in the URI: .../sociofest?retryWrites=...
```

### Client shows blank page
```
1. Check Vercel build logs for errors
2. Verify BACKEND_URL is set in Vercel environment variables
3. Ensure Root Directory is set to "client" in Vercel project settings
```

### Python service keeps crashing / restarting
```
Render free tier has 512 MB RAM. TensorFlow model loading may exceed this.
Solution: The Dockerfile uses tensorflow-cpu which is lighter. If still crashing,
check Render logs for OOM (Out of Memory) errors.
```

---

## 🔗 Quick Reference — All Environment Variables

### Server (.env on Render)
| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | ✅ | Must be `production` |
| `PORT` | ✅ | `5000` |
| `MONGODB_URI` | ✅ | Atlas connection string |
| `JWT_SECRET` | ✅ | **Must match Python** |
| `FRONTEND_URL` | ✅ | Your Vercel URL (for CORS) |
| `BACKEND_URL` | ✅ | This service's own URL |
| `PYTHON_URL` | ✅ | Python service URL |
| `SMTP_USER` | ⚠️ | Gmail for sending emails |
| `SMTP_PASS` | ⚠️ | Gmail app password |
| `VAPID_*` | ⚠️ | For push notifications |

### Python (.env on Render)
| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | **Same as Server** |
| `JWT_SECRET` | ✅ | **Same as Server** |
| `FRONTEND_URL` | ✅ | Your Vercel URL (for CORS) |
| `PORT` | ✅ | `5001` (Render may override) |

### Client (.env on Vercel)
| Variable | Required | Description |
|----------|----------|-------------|
| `BACKEND_URL` | ✅ | Server Render URL |
| `PYTHON_URL` | ✅ | Python Render URL |
| `VITE_FIREBASE_*` | ⚠️ | Firebase config (6 vars) |

---

## 📊 How the 3 APIs Work Together

```
                    ┌─────────────────────────────────┐
                    │         USER'S BROWSER           │
                    │     (React SPA from Vercel)      │
                    └──────┬──────────┬────────────────┘
                           │          │
              ┌────────────┘          └───────────────┐
              │                                       │
              ▼                                       ▼
   ┌──────────────────┐                   ┌───────────────────┐
   │  API 1: /api/*    │                   │ API 2: /python-api│
   │  (Node.js Server) │                   │ (Python Flask)    │
   │                   │                   │                   │
   │  • Authentication │                   │  • Face Register  │
   │  • CRUD (Posts,   │                   │  • Face Verify    │
   │    Users, Events) │                   │  • Face Recognize │
   │  • Chat / Messages│                   │  • Image Generate │
   │  • Assignments    │                   │  • Storage Mgmt   │
   │  • Certificates   │                   │                   │
   │  • AI Chat        │                   │                   │
   │  • Governance     │                   │                   │
   │  • Admin Panel    │                   │                   │
   └────────┬──────────┘                   └─────────┬─────────┘
            │                                        │
            │     API 3: /socket.io/*                │
            │     (Real-time WebSocket)              │
            │     • Online status                    │
            │     • Typing indicators                │
            │     • Live notifications               │
            │     • Chat messages                    │
            │                                        │
            └────────────────┬───────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   MongoDB Atlas  │
                    │   (Shared DB)    │
                    │                  │
                    │  • users         │
                    │  • posts         │
                    │  • conversations │
                    │  • assignments   │
                    │  • events        │
                    │  • ...           │
                    └─────────────────┘
```

---

## 🎉 You're Done!

Your SocioFest app is now deployed with:
- **$0/month** hosting cost
- **3 independent services** that can be updated separately
- **Auto-deploy** on every git push
- **SSL certificates** included (HTTPS)
- **CDN** for the client (Vercel Edge Network)

### Keeping Services Awake (Optional)

Render free services sleep after 15 min. To prevent this:

1. Sign up at https://uptimerobot.com (free)
2. Add 2 HTTP monitors:
   - `https://sociofest-backend.onrender.com/health` (every 14 min)
   - `https://sociofest-python.onrender.com/health` (every 14 min)

This pings your services every 14 minutes, preventing sleep.

---

*Last updated: May 2026*
