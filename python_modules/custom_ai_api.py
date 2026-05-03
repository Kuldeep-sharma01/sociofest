"""
🎙️ SocioFest Voice Cloning Microservice
---------------------------------------
Uses Coqui XTTSv2 to perform zero-shot voice cloning.
Run using: python -m uvicorn custom_ai_api:app --port 8000
"""

import sys
import os
import uuid
os.environ.setdefault("TORCHDYNAMO_DISABLE", "1")
os.environ["COQUI_TOS_AGREED"] = "1"

import warnings
# Suppress noisy deprecation warnings before any heavy imports happen
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning, module="jieba")
warnings.filterwarnings("ignore", message=".*pkg_resources is deprecated.*")

# Monkeypatch for huggingface_hub compatibility
try:
    import huggingface_hub
    huggingface_hub.__version__ = "0.23.0"
except Exception:
    pass

try:
    import huggingface_hub
    if not hasattr(huggingface_hub, 'HfFolder'):
        class DummyHfFolder:
            @staticmethod
            def get_token(): return os.getenv("HF_TOKEN")
            @staticmethod
            def save_token(token): pass
        huggingface_hub.HfFolder = DummyHfFolder
except Exception:
    pass

try:
    import huggingface_hub
    import huggingface_hub.file_download
    if not hasattr(huggingface_hub, 'cached_download'):
        huggingface_hub.cached_download = huggingface_hub.file_download.hf_hub_download
        huggingface_hub.file_download.cached_download = huggingface_hub.file_download.hf_hub_download
except Exception:
    pass

try:
    import importlib.metadata
    _orig_version = importlib.metadata.version
    def _patched_version(pkg):
        if pkg in ('huggingface-hub', 'huggingface_hub'):
            return '0.23.0'
        return _orig_version(pkg)
    importlib.metadata.version = _patched_version
except Exception:
    pass

try:
    import pkg_resources
    _orig_get_dist = pkg_resources.get_distribution
    def _patched_get_dist(pkg):
        if pkg in ('huggingface-hub', 'huggingface_hub'):
            class _MockDist: version = '0.23.0'
            return _MockDist()
        return _orig_get_dist(pkg)
    pkg_resources.get_distribution = _patched_get_dist
except Exception:
    pass

import torch
import torchaudio
import soundfile as sf
import numpy as np
import tempfile
import re
import subprocess
import shutil
import pathlib
from contextlib import asynccontextmanager
from TTS.api import TTS

# Check PyTorch version
torch_version = tuple(int(x) for x in torch.__version__.split('+')[0].split('.')[:3])
if torch_version < (2, 4, 0):
    raise RuntimeError(f"Coqui TTS requires torch>=2.4.0, found {torch.__version__}")

# Torchaudio Windows FFmpeg fix using soundfile backend
def _safe_sf_load(filepath, *args, **kwargs):
    data, sr = sf.read(filepath, dtype='float32')
    tensor = torch.from_numpy(data)
    if tensor.ndim == 1:
        tensor = tensor.unsqueeze(0)
    else:
        tensor = tensor.t()
    return tensor, sr

class _SafeSfInfo:
    def __init__(self, sr):
        self.sample_rate = sr
        self.num_frames = 0
        self.num_channels = 1
        self.bits_per_sample = 16
        self.encoding = 'PCM_S'

def _safe_sf_info(filepath, *args, **kwargs):
    info = sf.info(filepath)
    return _SafeSfInfo(info.samplerate)

torchaudio.load = _safe_sf_load
if hasattr(torchaudio, 'info'):
    torchaudio.info = _safe_sf_info

from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File, Form, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from deep_translator import GoogleTranslator
import jwt as pyjwt
from dotenv import load_dotenv

load_dotenv()  # Load own .env first
# Fallback to parent server/.env for local monorepo dev (no-op in independent deployment)
_parent_env = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(_parent_env):
    load_dotenv(_parent_env, override=False)

JWT_SECRET = os.getenv('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is required")

async def verify_token(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization[7:]
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Global model refs, lazy loaded
tts = None
whisper_model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global tts, whisper_model
    # Startup: Load models
    try:
        print("Loading Voice Cloning AI...")
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
        print("[OK] TTS loaded")
    except Exception as e:
        print(f"[WARN] TTS load failed (using fallback): {e}")
        tts = None
    
    try:
        print("Loading Speech-to-Text AI (Whisper)...")
        import whisper
        global whisper_model
        whisper_model = whisper.load_model("base")
        print("[OK] Whisper loaded")
    except Exception as e:
        print(f"[WARN] Whisper load failed: {e}")
        whisper_model = None
    
    yield
    
    # Shutdown cleanup if needed

app = FastAPI(lifespan=lifespan)

# Security: Enable CORS so the React frontend can directly communicate with the voice API
ALLOWED_ORIGINS = (os.getenv('FRONTEND_URL') or os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173')).split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["POST", "GET", "HEAD"],
    allow_headers=["Authorization", "Content-Type"],
)

class TranslateVttRequest(BaseModel):
    vtt_text: str
    source_lang: str
    target_lang: str

def format_timestamp(seconds: float):
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hrs:02d}:{mins:02d}:{secs:06.3f}"

def get_whisper():
    global whisper_model
    if whisper_model is None:
        import whisper
        whisper_model = whisper.load_model("base")
    return whisper_model

def get_tts():
    global tts
    if tts is None:
        from TTS.api import TTS
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
    return tts

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), _user=Depends(verify_token)):
    safe_ext = pathlib.Path(file.filename).suffix.lower()
    ALLOWED_AUDIO_EXTS = {'.wav', '.mp3', '.ogg', '.m4a', '.flac', '.mp4', '.mkv', '.webm', '.avi'}
    if safe_ext not in ALLOWED_AUDIO_EXTS:
        raise HTTPException(status_code=400, detail="Unsupported audio format")
    safe_filename = f"{uuid.uuid4().hex}{safe_ext}"
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, safe_filename)
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        model = get_whisper()
        if model is None:
            raise HTTPException(status_code=503, detail="Whisper model unavailable.")
        
        result = model.transcribe(temp_path, fp16=False)
        
        vtt_lines = ["WEBVTT\n"]
        for i, segment in enumerate(result["segments"]):
            vtt_lines.append(f"\n{i+1}\n{format_timestamp(segment['start'])} --> {format_timestamp(segment['end'])}\n{segment['text'].strip()}")
            
        return {"text": result["text"], "vtt": "\n".join(vtt_lines)}
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

# ✅ Validate against known language codes
SUPPORTED_LANGS = {
    'en', 'hi', 'es', 'fr', 'de', 'ar', 'ja', 'zh-cn', 'auto',
    'english', 'hindi', 'spanish', 'french', 'german', 'arabic', 'japanese', 'chinese'
}

def validate_lang(lang: str) -> str:
    clean = lang.strip().lower()
    if clean not in SUPPORTED_LANGS:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {lang}")
    return clean

@app.post("/translate_vtt")
def translate_vtt_endpoint(req: TranslateVttRequest, _user=Depends(verify_token)):
    try:
        src = 'auto' if req.source_lang.lower() == 'auto-detect' else validate_lang(req.source_lang)
        tgt = validate_lang(req.target_lang)
        
        translator = GoogleTranslator(source=src, target=tgt)
        
        lines = req.vtt_text.split('\n')
        translated_lines = []
        
        for line in lines:
            if '-->' in line or line.startswith('WEBVTT') or line.strip() == '' or line.strip().isdigit():
                translated_lines.append(line)
            else:
                translated = translator.translate(line)
                translated_lines.append(translated if translated else line)
                
        return {"translated_vtt": "\n".join(translated_lines)}
    except Exception as e:
        print(f"Translation Error: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

def cleanup_file(path: str):
    if os.path.exists(path):
        os.remove(path)

@app.get("/")
def health_check():
    return {"status": "AI Server running", "tts_ready": tts is not None, "whisper_ready": whisper_model is not None}

@app.head("/")
def health_check_head():
    return {"status": "AI Server running", "tts_ready": tts is not None, "whisper_ready": whisper_model is not None}

def parse_vtt(vtt_text):
    segments = []
    vtt_text = vtt_text.replace('\r\n', '\n')
    blocks = re.split(r'\n{2,}', vtt_text.strip())
    for block in blocks:
        lines = block.strip().split('\n')
        time_line = None
        text = ""
        for i, line in enumerate(lines):
            if '-->' in line:
                time_line = line
                text = " ".join(lines[i+1:])
                break
        if not time_line:
            continue
            
        match = re.search(r'(?:(\d{2}):)?(\d{2}):(\d{2}\.\d{3})\s*-->\s*(?:(\d{2}):)?(\d{2}):(\d{2}\.\d{3})', time_line)
        if match:
            h1, m1, s1 = match.group(1) or "00", match.group(2), match.group(3)
            h2, m2, s2 = match.group(4) or "00", match.group(5), match.group(6)
            start = int(h1)*3600 + int(m1)*60 + float(s1)
            end = int(h2)*3600 + int(m2)*60 + float(s2)
            clean_text = re.sub(r'\[.*?\]', '', text).strip()
            if clean_text:
                segments.append({"start": start, "end": end, "text": clean_text})
    return segments

def time_stretch(input_path, output_path, target_duration):
    data, sr = sf.read(input_path)
    current_duration = len(data) / sr
    if current_duration == 0 or target_duration <= 0:
        sf.write(output_path, data, sr)
        return

    ratio = current_duration / target_duration
    
    filters = []
    atempo = ratio
    while atempo < 0.5:
        filters.append("atempo=0.5")
        atempo /= 0.5
    while atempo > 2.0:
        filters.append("atempo=2.0")
        atempo /= 2.0
    filters.append(f"atempo={atempo}")
    
    filter_str = ",".join(filters)
    cmd = ["ffmpeg", "-y", "-i", input_path, "-filter:a", filter_str, "-ar", "22050", "-ac", "1", output_path]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

@app.post("/clone-voice")
async def clone_voice(
    background_tasks: BackgroundTasks,
    text: str = Form(...),
    language: str = Form(...),
    speaker_wav: UploadFile = File(...),
    _user=Depends(verify_token)
):
    # ✅ Clamp parameters to safe ranges
    text = text[:2000]  # Cap text to prevent TTS memory exhaustion

    safe_ext = pathlib.Path(speaker_wav.filename).suffix.lower()
    ALLOWED_AUDIO_EXTS = {'.wav', '.mp3', '.ogg', '.m4a', '.flac', '.mp4', '.mkv', '.webm', '.avi'}
    if safe_ext not in ALLOWED_AUDIO_EXTS:
        raise HTTPException(status_code=400, detail="Unsupported audio format")
    safe_filename = f"{uuid.uuid4().hex}{safe_ext}"
    temp_dir = tempfile.mkdtemp()
    temp_wav_path = os.path.join(temp_dir, safe_filename)
    
    try:
        with open(temp_wav_path, "wb") as buffer:
            shutil.copyfileobj(speaker_wav.file, buffer)

        output_filename = f"cloned_{uuid.uuid4().hex}.wav"
        output_path = os.path.join(temp_dir, output_filename)
        is_vtt = "WEBVTT" in text or "-->" in text
        
        tts_model = get_tts()
        if tts_model is None:
            raise HTTPException(status_code=503, detail="TTS model unavailable.")
        
        if not is_vtt:
            tts_model.tts_to_file(text=text, speaker_wav=temp_wav_path, language=language, file_path=output_path)
        else:
            segments = parse_vtt(text)
            if not segments:
                tts_model.tts_to_file(text="No dialogue detected.", speaker_wav=temp_wav_path, language=language, file_path=output_path)
            else:
                temp_dir_vtt = tempfile.mkdtemp()
                try:
                    sample_rate = 22050
                    max_end = max([seg["end"] for seg in segments])
                    final_length = int((max_end + 1) * sample_rate)
                    final_audio = np.zeros(final_length, dtype=np.float32)
                    
                    for i, seg in enumerate(segments):
                        seg_audio = os.path.join(temp_dir_vtt, f"seg_{i}.wav")
                        stretched_audio = os.path.join(temp_dir_vtt, f"stretched_{i}.wav")
                        
                        tts_model.tts_to_file(text=seg["text"], speaker_wav=temp_wav_path, language=language, file_path=seg_audio)
                        
                        target_dur = seg["end"] - seg["start"]
                        time_stretch(seg_audio, stretched_audio, target_dur)
                        
                        data, sr = sf.read(stretched_audio)
                        if len(data.shape) > 1: data = data[:, 0]
                            
                        start_idx = int(seg["start"] * sample_rate)
                        end_idx = start_idx + len(data)
                        
                        if end_idx > len(final_audio):
                            final_audio = np.pad(final_audio, (0, end_idx - len(final_audio)))
                            
                        final_audio[start_idx:end_idx] += data
                        
                    max_val = np.max(np.abs(final_audio))
                    if max_val > 1.0: final_audio /= max_val
                        
                    sf.write(output_path, final_audio, sample_rate)
                finally:
                    shutil.rmtree(temp_dir_vtt, ignore_errors=True)
                    
        return FileResponse(output_path, media_type="audio/wav", filename="cloned_voice.wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
