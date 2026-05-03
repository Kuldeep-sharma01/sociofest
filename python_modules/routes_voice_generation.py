"""
Flask Routes for Voice Cloning, Transcription, and Translation
Integrates Coqui XTTSv2 and Whisper directly into the main Flask application.
"""

import os
import uuid
import tempfile
import shutil
import re
import subprocess
import pathlib
import logging
from flask import Blueprint, request, jsonify, send_file, after_this_request
import numpy as np

# Apply Coqui Terms of Service Agreement globally
os.environ["COQUI_TOS_AGREED"] = "1"
os.environ.setdefault("TORCHDYNAMO_DISABLE", "1")

# Apply torchaudio Windows fix using soundfile
try:
    import torch
    import torchaudio
    import soundfile as sf
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
except Exception as e:
    logging.warning(f"Failed to apply torchaudio Windows fix: {e}")


from deep_translator import GoogleTranslator
from auth_middleware import token_required

logger = logging.getLogger(__name__)

voice_bp = Blueprint('voice_generation', __name__, url_prefix='/voice-api')

# Lazy load globals
tts = None
whisper_model = None

def get_whisper():
    global whisper_model
    if whisper_model is None:
        try:
            import whisper
            device = os.getenv("AI_DEVICE", "cpu")
            logger.info(f"Loading Speech-to-Text AI (Whisper: small) on {device}...")
            # Upgrading to 'small' for better vocal understanding while maintaining speed
            whisper_model = whisper.load_model("small", device=device)
        except Exception as e:
            logger.error(f"Whisper load failed: {e}")
            raise Exception("Whisper model unavailable")
    return whisper_model

def get_tts():
    global tts
    if tts is None:
        try:
            from TTS.api import TTS
            device = os.getenv("AI_DEVICE", "cpu")
            logger.info(f"Loading Voice Cloning AI (Coqui) on {device}...")
            tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        except Exception as e:
            logger.error(f"TTS load failed: {e}")
            raise Exception("TTS model unavailable")
    return tts

def format_timestamp(seconds: float):
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hrs:02d}:{mins:02d}:{secs:06.3f}"


@voice_bp.route('/transcribe', methods=['POST'])
@token_required
def transcribe_audio():
    if 'file' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    safe_ext = pathlib.Path(file.filename).suffix.lower()
    ALLOWED_AUDIO_EXTS = {'.wav', '.mp3', '.ogg', '.m4a', '.flac', '.mp4', '.mkv', '.webm', '.avi'}
    if safe_ext not in ALLOWED_AUDIO_EXTS:
        return jsonify({"error": "Unsupported audio format"}), 400

    def isolate_vocals(input_p, output_p):
        """Uses FFmpeg to isolate vocals and reduce background noise/music."""
        try:
            # highpass (removes low rumble), lowpass (removes high hiss), afftdn (FFT-based denoiser)
            # pan (forces mono to center speech)
            cmd = [
                "ffmpeg", "-y", "-i", input_p,
                "-af", "highpass=f=100,lowpass=f=7000,afftdn=nf=-20,pan=mono|c0=c0",
                "-ar", "16000", # Whisper prefers 16kHz
                output_p
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return True
        except Exception as e:
            logger.warning(f"Vocal isolation failed: {e}. Proceeding with raw audio.")
            return False

    safe_filename = f"{uuid.uuid4().hex}{safe_ext}"
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, safe_filename)
    
    try:
        file.save(temp_path)

        # Pre-process for better vocal understanding
        isolated_path = os.path.join(temp_dir, f"isolated_{safe_filename}.wav")
        if isolate_vocals(temp_path, isolated_path):
            transcribe_source = isolated_path
        else:
            transcribe_source = temp_path

        model = get_whisper()
        result = model.transcribe(transcribe_source, fp16=False)
        
        vtt_lines = ["WEBVTT\n"]
        for i, segment in enumerate(result["segments"]):
            vtt_lines.append(f"\n{i+1}\n{format_timestamp(segment['start'])} --> {format_timestamp(segment['end'])}\n{segment['text'].strip()}")
            
        return jsonify({
            "text": result["text"], 
            "vtt": "\n".join(vtt_lines)
        }), 200
        
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return jsonify({"error": f"Transcription failed: {str(e)}"}), 500
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


SUPPORTED_LANGS = {
    'en', 'hi', 'es', 'fr', 'de', 'ar', 'ja', 'zh-cn', 'auto', 'ru', 'pt', 'it', 'ko', 'tr', 'bn', 'te', 'mr', 'ta', 'ur',
    'english', 'hindi', 'spanish', 'french', 'german', 'arabic', 'japanese', 'chinese', 'russian', 'portuguese', 'italian', 'korean', 'turkish', 'bengali', 'telugu', 'marathi', 'tamil', 'urdu'
}

def validate_lang(lang: str) -> str:
    clean = lang.strip().lower()
    if clean in SUPPORTED_LANGS:
        return clean
    # Fallback: if it's a 2-letter code, it's likely supported by GoogleTranslator anyway
    if len(clean) == 2:
        return clean
    raise ValueError(f"Unsupported language: {lang}")

@voice_bp.route('/translate_vtt', methods=['POST'])
@token_required
def translate_vtt_endpoint():
    data = request.json or {}
    vtt_text = data.get('vtt_text', '')
    source_lang = data.get('source_lang', 'auto')
    target_lang = data.get('target_lang', 'en')

    if not vtt_text:
        return jsonify({"translated_vtt": ""}), 200

    try:
        src = 'auto' if source_lang.lower() in ['auto', 'auto-detect'] else validate_lang(source_lang)
        tgt = validate_lang(target_lang)
        
        translator = GoogleTranslator(source=src, target=tgt)
        
        lines = vtt_text.split('\n')
        translated_lines = [None] * len(lines)
        
        # Identify non-structural lines (text lines)
        to_translate = []
        for i, line in enumerate(lines):
            is_structural = '-->' in line or line.startswith('WEBVTT') or line.strip() == '' or line.strip().isdigit()
            if is_structural:
                translated_lines[i] = line
            else:
                to_translate.append(i)

        if not to_translate:
            return jsonify({"translated_vtt": vtt_text}), 200

        # Process in chunks of 50 lines to avoid Google Translate limits and maintain alignment
        CHUNK_SIZE = 50
        for i in range(0, len(to_translate), CHUNK_SIZE):
            chunk_indices = to_translate[i:i+CHUNK_SIZE]
            chunk_text_list = [lines[idx] for idx in chunk_indices]
            
            try:
                # We join with a unique separator that Google Translate usually preserves
                separator = " ___ "
                batch_text = separator.join(chunk_text_list)
                
                translated_batch = translator.translate(batch_text)
                
                if translated_batch:
                    translated_parts = [p.strip() for p in translated_batch.split(separator)]
                    
                    # If line count matches, use translated parts
                    if len(translated_parts) == len(chunk_indices):
                        for j, part in enumerate(translated_parts):
                            translated_lines[chunk_indices[j]] = part
                    else:
                        # Fallback: Translate individually for this chunk if counts don't match
                        for idx in chunk_indices:
                            try:
                                translated_lines[idx] = translator.translate(lines[idx])
                            except:
                                translated_lines[idx] = lines[idx] # Keep original on failure
                else:
                    # Fallback to original text if translate returns None
                    for idx in chunk_indices:
                        translated_lines[idx] = lines[idx]
            except Exception as chunk_err:
                logger.warning(f"Batch translation failed for chunk {i}: {chunk_err}")
                # Fallback to original for this chunk
                for idx in chunk_indices:
                    translated_lines[idx] = lines[idx]

        # Fill any remaining None values just in case
        final_lines = [l if l is not None else "" for l in translated_lines]
                
        return jsonify({"translated_vtt": "\n".join(final_lines)}), 200
    except Exception as e:
        logger.error(f"Translation Error: {e}")
        return jsonify({"error": f"Translation failed: {str(e)}"}), 500


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


COQUI_LANG_MAP = {
    'en': 'en', 'hi': 'hi', 'es': 'es', 'fr': 'fr', 'de': 'de', 'ar': 'ar', 'ja': 'ja', 'zh-cn': 'zh-cn', 'ru': 'ru', 'pt': 'pt', 'it': 'it', 'ko': 'ko', 'tr': 'tr',
    'english': 'en', 'hindi': 'hi', 'spanish': 'es', 'french': 'fr', 'german': 'de',
    'arabic': 'ar', 'japanese': 'ja', 'chinese': 'zh-cn', 'russian': 'ru',
    'portuguese': 'pt', 'italian': 'it', 'korean': 'ko', 'turkish': 'tr',
    'whisper ai': 'en', 'ai script': 'en', 'scripture': 'en', 'ai': 'en'
}

@voice_bp.route('/clone-voice', methods=['POST'])
@token_required
def clone_voice():
    text = request.form.get('text', '')
    raw_lang = request.form.get('language', 'en').strip().lower()
    language = COQUI_LANG_MAP.get(raw_lang, raw_lang)
    
    # Final safety check: if it's still not a 2-letter code, default to 'en'
    if len(language) > 5:
        language = 'en'
    
    if 'speaker_wav' not in request.files:
        return jsonify({"error": "No speaker_wav file provided"}), 400
        
    speaker_wav = request.files['speaker_wav']
    
    # Clamp parameters to safe ranges
    text = text[:2000]

    safe_ext = pathlib.Path(speaker_wav.filename).suffix.lower()
    ALLOWED_AUDIO_EXTS = {'.wav', '.mp3', '.ogg', '.m4a', '.flac', '.mp4', '.mkv', '.webm', '.avi'}
    if safe_ext not in ALLOWED_AUDIO_EXTS:
        return jsonify({"error": "Unsupported audio format"}), 400
        
    safe_filename = f"{uuid.uuid4().hex}{safe_ext}"
    temp_dir = tempfile.mkdtemp()
    temp_wav_path = os.path.join(temp_dir, safe_filename)
    
    try:
        speaker_wav.save(temp_wav_path)

        output_filename = f"cloned_{uuid.uuid4().hex}.wav"
        output_path = os.path.join(temp_dir, output_filename)
        is_vtt = "WEBVTT" in text or "-->" in text
        
        tts_model = get_tts()
        
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
                    
        return send_file(output_path, mimetype="audio/wav", as_attachment=True, download_name="cloned_voice.wav")
        
    except Exception as e:
        logger.error(f"AI generation failed: {e}")
        return jsonify({"error": f"AI generation failed: {str(e)}"}), 500
    finally:
        # Note: temp_dir cleanup handles output_path since it's now inside temp_dir
        shutil.rmtree(temp_dir, ignore_errors=True)
