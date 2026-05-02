# 🚀 SocioFest Deployment Guide
## Unified Multi-Cloud Microservices (Client + Server + Monolithic Python AI)

SocioFest is now powered by a **Monolithic Python AI Gateway**. Face Recognition, Image Generation, Voice Cloning, and Transcription are all unified into a single service running on Port 5001.

---

## 🏗️ Architecture Overview

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────────────┐
│   Client     │────▶│  Server (Node)   │────▶│  Python AI Gateway    │
│  Vite/React  │     │  Express API     │     │  (Port 5001)          │
│  Port 5173   │     │  Port 5000       │     │  ───────────────────  │
│  (Vercel)    │     │  (Render)        │     │  • Face Recognition   │
└─────────────┘     └──────────────────┘     │  • Stable Diffusion   │
                             │               │  • Voice Cloning      │
                      ┌──────┴──────┐        │  • Transcription      │
                      │  MongoDB    │        └───────────────────────┘
                      │  (Atlas)    │                   ▲
                      └─────────────┘                   │
                             │                          │
                             └──────────────────────────┘
```

### 🧠 Generative AI Modality Breakdown

| AI Type | Engine | Service | Backend Handler |
|---------|--------|---------|-----------------|
| **Text** | Google Gemini | Node.js (5000) | `aiController.js` |
| **Image** | Stable Diffusion | Python (5001) | `routes_image_generation.py` |
| **Voice** | Coqui XTTSv2 | Python (5001) | `routes_voice_generation.py` |
| **STT** | OpenAI Whisper | Python (5001) | `routes_voice_generation.py` |
| **Face** | TensorFlow | Python (5001) | `app.py` |
| **Compiler** | Subprocess | Python (5001) | `routes_compiler.py` |

---

## 🛠️ 1. Environment Configuration

### Shared Secrets (MUST Match)
| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Used by Node & Python to verify user identity. |
| `MONGODB_URI` | Both services must connect to the same DB. |
| `FRONTEND_URL` | Essential for CORS whitelist (e.g., `https://sociofest.vercel.app`). |

### AI-Specific Keys
| Variable | Service | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | Node | Powers the AI Tutor and Chatbot. |
| `FACE_ENCRYPTION_KEY` | Python | Encrypts facial biometric data in the DB. |
| `SD_MODEL_PATH` | Python | (Optional) Path to local Stable Diffusion checkpoints. |

---

## 🧬 2. AI Model Management (Linking & Uploading)

The Python service manages its models via the `server/python_modules/model_cache` directory.

### 🖼️ Image Generation (Stable Diffusion)
- **Automatic:** On the first request, the server will download `runwayml/stable-diffusion-v1-5` from HuggingFace to the `model_cache`.
- **Manual (WebUI Style):** You can place custom `.safetensors` or `.ckpt` files in `server/python_modules/stable_diffusion_models/` and update `image_config.json` to link them.
- **Optimization:** The gateway uses a **1-worker ThreadPool**. This prevents GPU VRAM crashes by processing image requests one at a time.
- **⚠️ CRITICAL (Production):** AI models (XTTS, SD, Whisper) are huge (1GB - 4GB). If deploying to Render/Railway, you **MUST** attach a **Persistent Volume** to `/server/python_modules/model_cache`. Without this, your server will re-download models on every restart, causing a 5-10 minute "Cold Start" delay.

### 🎙️ Voice AI (TTS & STT)
- **Models:** Uses `xtts_v2` for voice cloning and `whisper-base` for transcription.
- **Linking:** Models are stored in `~/.cache/tts` and `~/.cache/whisper` by default. 
- **Voice Cloning:** Requires a 5-10 second sample `.wav` file of the target voice.
- **FFmpeg:** Ensure FFmpeg is installed on your server path for audio stretching and VTT processing.

### 🔍 Face Recognition
- Uses `MobileNetV2` feature vectors. Biometric encodings are encrypted with `Fernet` (AES-128) before being saved to MongoDB.
- **Security Policy:** All requests (`register-face`, `verify-face`) **MUST** include the `clientLivenessVerified: true` flag. The backend will reject any request without it to prevent static image injection.

### 💻 Python Compiler
- **Sandbox:** Python code is executed in a temporary subprocess with a **5.0s timeout**.
- **Isolation:** Files are written to a temporary directory and deleted immediately after execution.

---

## 🚀 3. Deployment Steps

### Step A: Deploy Python AI (Render/Railway/VPS)
**Root Directory:** `server/python_modules`  
**Port:** 5001
1. Install dependencies: `pip install -r requirements.txt`
2. Start Command: `python app.py`
3. Set `PYTHON_BACKEND_PORT=5001` in environment variables.

### Step B: Deploy Node Backend (Render/Railway)
**Root Directory:** `server`  
**Port:** 5000
1. Set `PYTHON_URL` to your Python service URL (e.g., `https://sociofest-ai.onrender.com`).
2. Set `GEMINI_API_KEY` for text generation.

### Step C: Deploy Frontend (Vercel)
**Root Directory:** `client`
1. Set `VITE_BACKEND_URL` (Node) and `VITE_PYTHON_URL` (Python).
2. Note: The frontend uses proxy rewrites (`/python-api` -> `5001`) automatically.

---

## 🖥️ 4. Local Development

```bash
# Start the unified AI Gateway
cd server/python_modules
python app.py

# Start Node Backend
cd server
npm run dev

# Start Frontend
cd client
npm run dev
```

---

## ❓ 5. Troubleshooting AI Modules

- **AI Timeout:** If using a free-tier hosting (like Render Free), the first AI request might time out while the model is "waking up". Always check the logs to see if the model is still loading.
- **CORS Errors:** If the AI says "Access Denied", ensure `FRONTEND_URL` in the Python `.env` exactly matches your Vercel URL.
- **404 Errors:** If Voice/Image routes return 404, ensure you are hitting `/voice-api/...` or `/sd-api/...` and that the blueprints are registered in `app.py`.
- **Memory Issues:** Voice and Image AI require ~4GB RAM minimum. If your server crashes, upgrade your RAM or use Swap space.

## 🛡️ 6. Attendance & Security Linking
- **Self-Marking:** Students can mark attendance via `/api/attendance/self-mark-face`.
- **Verification Chain:** Frontend (Image) → Node Proxy → Python `verify-face` → MongoDB Match → Node Response.
- **Spoof Protection:** The server performs identity verification against the JWT. Students cannot mark attendance for other user IDs, even if they have their photo.

---

**Everything is now Integrated!** 🚀
*One API to rule them all.*
