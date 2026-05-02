import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import warnings
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', category=DeprecationWarning)
warnings.filterwarnings('ignore', message='.*pkg_resources is deprecated.*')

# OPTIMIZATION: Centralize and persist model caches to prevent redundant downloads (saves huge storage/bandwidth)
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model_cache')
os.makedirs(CACHE_DIR, exist_ok=True)
os.environ['TFHUB_CACHE_DIR'] = CACHE_DIR
os.environ['HF_HOME'] = CACHE_DIR



# Monkeypatch for huggingface_hub compatibility (fixes 'hf_cache_home' and 'HfFolder' import errors in newer versions)
try:
    import huggingface_hub
    huggingface_hub.__version__ = "0.23.0"
except Exception:
    pass

try:
    import huggingface_hub
    import huggingface_hub.constants
    
    # Fix hf_cache_home
    if not hasattr(huggingface_hub.constants, 'hf_cache_home'):
        huggingface_hub.constants.hf_cache_home = CACHE_DIR
except Exception:
    pass

try:
    import huggingface_hub
    # Fix HfFolder (moved in newer versions)
    if not hasattr(huggingface_hub, 'HfFolder'):
        class DummyHfFolder:
            @staticmethod
            def get_token():
                return os.getenv("HF_TOKEN")
            @staticmethod
            def save_token(token):
                pass
        huggingface_hub.HfFolder = DummyHfFolder
except Exception:
    pass

try:
    import huggingface_hub
    import huggingface_hub.file_download
    # Fix cached_download (removed in huggingface_hub >= 0.23.0, breaks older diffusers/TTS)
    if not hasattr(huggingface_hub, 'cached_download'):
        huggingface_hub.cached_download = huggingface_hub.file_download.hf_hub_download
        huggingface_hub.file_download.cached_download = huggingface_hub.file_download.hf_hub_download
except Exception:
    pass

try:
    # Fix transformers version check for huggingface-hub >= 1.0.0
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

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import tensorflow_hub as hub
try:
    import torch
except ImportError:
    torch = None
import logging
from pymongo import MongoClient
from pymongo.errors import ConfigurationError
from bson.objectid import ObjectId
import json
from cryptography.fernet import Fernet
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()
# For local monorepo dev, also try loading the parent server/.env as fallback
# This is a no-op if python_modules has all vars in its own .env (required for independent deployment)
_parent_env = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(_parent_env):
    load_dotenv(_parent_env, override=False)  # override=False → own .env takes priority
from auth_middleware import require_jwt, require_admin

app = Flask(__name__)
# Global AI Hardware State — respect explicit env override (set by admin toggle)
_explicit_device = os.environ.get("AI_DEVICE")
if _explicit_device:
    AI_DEVICE = _explicit_device
else:
    AI_DEVICE = "cuda" if (torch and torch.cuda.is_available()) else "cpu"
    os.environ["AI_DEVICE"] = AI_DEVICE


logging.basicConfig(level=logging.ERROR)
logging.getLogger('tensorflow').setLevel(logging.ERROR)
logging.getLogger('werkzeug').setLevel(logging.ERROR)
app.logger.setLevel(logging.ERROR)

# ── CORS Configuration ──────────────────────────────────────────────────────
# Allow requests from the frontend and Node.js backend.
# In production these are set via env vars; in dev they default to localhost.
_frontend = os.getenv('FRONTEND_URL', 'http://localhost:5173')
_backend  = os.getenv('BACKEND_URL',  'http://localhost:5000')
_allowed_origins = [o.strip() for o in (_frontend + ',' + _backend).split(',') if o.strip()]
# Always allow localhost variants in development
if os.getenv('FLASK_ENV') != 'production':
    _allowed_origins += ['http://localhost:5173', 'http://127.0.0.1:5173',
                         'http://localhost:5000', 'http://127.0.0.1:5000']

CORS(app,
     origins=list(set(_allowed_origins)),
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

# Security: Limit maximum payload size to support high-res images and audio (50 MB limit)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024


import threading

face_model = None
def load_face_model_async():
    global face_model
    print("[BACKGROUND] Loading facial recognition model...")
    model_url = "https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/feature_vector/5"
    try:
        face_model = hub.load(model_url)
        print("[BACKGROUND] Facial recognition model loaded successfully")
    except Exception as e:
        print(f"[WARNING] Primary model load failed: {e}")
        if "Access is denied" in str(e):
            print("[BACKGROUND] Detected Windows file lock. Retrying in 2 seconds...")
            import time
            time.sleep(2)
            try:
                face_model = hub.load(model_url)
                print("[BACKGROUND] Facial recognition model loaded successfully")
            except Exception:
                print("[CRITICAL] Could not load facial recognition model. Face ID features will be disabled.")
                face_model = None
        else:
            face_model = None

threading.Thread(target=load_face_model_async, daemon=True).start()

# Load face detector (using OpenCV's Haar Cascade)
prototxt = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(prototxt)

# Connect to MongoDB (Unified Single Database Architecture)
MONGODB_URI = os.getenv('MONGODB_URI') or 'mongodb://localhost:27017/sociofestdb'
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME') or os.getenv('MONGODB_DB_NAME') or 'smart-attendance'

JWT_SECRET = os.getenv('JWT_SECRET')
if not JWT_SECRET:
    if os.getenv('FLASK_ENV') == 'production':
        raise RuntimeError("JWT_SECRET environment variable is required in production")
    JWT_SECRET = 'dev-only-secret-do-not-use-in-prod'
    logging.warning("WARNING: Using dev JWT secret. Set JWT_SECRET in production.")
client = MongoClient(MONGODB_URI)
try:
    default_db = client.get_default_database()
except ConfigurationError:
    default_db = None
db = default_db if default_db is not None else client[MONGO_DB_NAME]
app.db = db
# Auto-purge AI tasks after 24 hours to prevent DB bloat
db['ai_tasks'].create_index("created_at", expireAfterSeconds=86400)
users_collection = db['users']



# ✅ Encrypt the encoding vector before storage
FACE_ENCRYPTION_KEY = os.getenv('FACE_ENCRYPTION_KEY')
if not FACE_ENCRYPTION_KEY:
    if os.getenv('FLASK_ENV') == 'production':
        raise RuntimeError("FACE_ENCRYPTION_KEY environment variable is required in production")
    FACE_ENCRYPTION_KEY = Fernet.generate_key().decode()
    logging.warning("WARNING: Using random dev FACE_ENCRYPTION_KEY. Set FACE_ENCRYPTION_KEY to persist faces across restarts.")
fernet = Fernet(FACE_ENCRYPTION_KEY)

def encrypt_encoding(vector: list) -> str:
    return fernet.encrypt(json.dumps(vector).encode()).decode()

def decrypt_encoding(encrypted) -> list:
    if isinstance(encrypted, list):
        return encrypted
    return json.loads(fernet.decrypt(str(encrypted).encode()))

# ✅ Validate file signature before processing

ALLOWED_IMAGE_TYPES = {'jpeg', 'png', 'webp', 'bmp'}

def validate_image_bytes(image_bytes):
    header = image_bytes[:12]
    if header.startswith(b'\xff\xd8\xff'): detected = 'jpeg'
    elif header.startswith(b'\x89PNG\r\n\x1a\n'): detected = 'png'
    elif header.startswith(b'RIFF') and header[8:12] == b'WEBP': detected = 'webp'
    elif header.startswith(b'BM'): detected = 'bmp'
    else: detected = None

    if detected not in ALLOWED_IMAGE_TYPES:
        return False, f"Unsupported image type: {detected}"
    return True, "ok"


def assess_face_quality(img, x, y, w, h):
    """
    Assess face quality for registration:
    - Centering
    - Size
    - Pose (estimate from bounding box and eyes)
    """
    img_h, img_w = img.shape[:2]
    
    # 1. Size check
    face_area = w * h
    frame_area = img_w * img_h
    size_ratio = face_area / frame_area
    
    # 2. Centering check
    face_center_x = x + w / 2
    face_center_y = y + h / 2
    dist_from_center_x = abs(face_center_x - img_w / 2) / img_w
    dist_from_center_y = abs(face_center_y - img_h / 2) / img_h
    
    # 3. Simple Pose Estimation (based on box symmetry in frame)
    # Ideally use dlib or mediapipe for landmarks, but let's stick to OpenCV for minimal deps
    is_centered = dist_from_center_x < 0.15 and dist_from_center_y < 0.2
    is_good_size = size_ratio > 0.05 # Face should take at least 5% of frame
    
    # Check for "Looking Straight" (Heuristic: face box should be roughly square and centered)
    aspect_ratio = w / h
    is_looking_straight = 0.8 < aspect_ratio < 1.2
    
    # Sharpness check (Laplacian variance)
    gray_roi = cv2.cvtColor(img[y:y+h, x:x+w], cv2.COLOR_BGR2GRAY)
    sharpness = cv2.Laplacian(gray_roi, cv2.CV_64F).var()
    is_sharp = sharpness > 100
    
    quality_score = 0
    if is_centered: quality_score += 30
    if is_good_size: quality_score += 20
    if is_looking_straight: quality_score += 30
    if is_sharp: quality_score += 20
    
    return {
        "score": quality_score,
        "is_centered": is_centered,
        "is_good_size": is_good_size,
        "is_looking_straight": is_looking_straight,
        "is_sharp": is_sharp,
        "sharpness": float(sharpness),
        "aspect_ratio": float(aspect_ratio),
        "size_ratio": float(size_ratio)
    }

def extract_face_encoding(image_bytes, include_assessment=False):
    """
    Extract face encoding from image bytes using TensorFlow
    Returns: (encoding, message, assessment)
    """
    if face_model is None:
        return None, "Face recognition model is still loading. Please wait a moment and try again.", None

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return None, "Failed to decode image", None

        # OPTIMIZATION (Speed): Resize large images
        max_width = 800
        h_orig, w_orig = img.shape[:2]
        if w_orig > max_width:
            ratio = max_width / float(w_orig)
            img = cv2.resize(img, (max_width, int(h_orig * ratio)), interpolation=cv2.INTER_AREA)

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # IMPROVEMENT: Histogram equalization to handle poor lighting
        gray = cv2.equalizeHist(gray)
        
        # OPTIMIZATION: More accurate scaleFactor and lower minSize for better detection
        faces = face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1, 
            minNeighbors=5, 
            minSize=(30, 30),
            flags=cv2.CASCADE_SCALE_IMAGE
        )

        if len(faces) == 0:
            return None, "No face detected in image", None

        # Pick the largest face (closest to camera)
        largest_face = max(faces, key=lambda x: x[2] * x[3])
        x, y, w, h = largest_face

        assessment = None
        if include_assessment:
            assessment = assess_face_quality(img, x, y, w, h)

        face_roi = img[y:y + h, x:x + w]
        face_roi_resized = cv2.resize(face_roi, (224, 224))
        face_roi_normalized = face_roi_resized.astype(np.float32) / 255.0
        face_batch = np.expand_dims(face_roi_normalized, axis=0)

        encoding = face_model(face_batch)
        encoding = encoding.numpy()[0]

        return encoding, "Success", assessment

    except Exception:
        logging.exception("Face encoding extraction failed")
        return None, "Face processing failed. Please try again.", None


def calculate_face_distance(encoding1, encoding2):
    """Calculate Euclidean distance between two face encodings"""
    return np.linalg.norm(encoding1 - encoding2)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "online",
        "device": os.environ.get("AI_DEVICE", "cpu"),
        "cuda_available": torch.cuda.is_available() if torch else False
    }), 200


@app.route('/toggle-hardware', methods=['POST'])
@require_jwt
@require_admin
def toggle_hardware():
    """Toggle between CPU and GPU for AI tasks"""
    try:
        data = request.get_json()
        target = data.get('device', 'cpu').lower()
        
        if target == 'cuda' and (not torch or not torch.cuda.is_available()):
            return jsonify({"error": "CUDA (GPU) is not available on this system"}), 400
            
        os.environ["AI_DEVICE"] = target
        return jsonify({
            "success": True,
            "device": target,
            "message": f"AI hardware switched to {target.upper()}"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500




@app.route('/register-face', methods=['POST'])
@require_jwt
def register_face():
    """
    Register a student's face encoding
    Expects: image file + userId
    Note: This endpoint does not perform liveness detection. Callers must implement anti-spoofing.
    """
    try:
        # ✅ SECURITY: Log assessment metadata but don't trust raw client flags for critical state
        liveness_verified = request.form.get('clientLivenessVerified') == 'true'
        if not liveness_verified:
            logging.warning(f"Face registration for user {request.form.get('userId')} requested without client-side liveness signal.")

        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400

        if 'userId' not in request.form:
            return jsonify({"error": "No userId provided"}), 400

        user_id = request.form.get('userId')

        if str(user_id) != str(request.current_user_id):
            return jsonify({"error": "Unauthorized: Cannot register face for another user"}), 403

        image_file = request.files['image']
        image_bytes = image_file.read()

        valid, msg = validate_image_bytes(image_bytes)
        if not valid:
            return jsonify({"error": msg}), 400

        encoding, message, assessment = extract_face_encoding(image_bytes, include_assessment=True)

        if encoding is None:
            return jsonify({"error": message}), 400
            
        if assessment and assessment['score'] < 60:
            return jsonify({
                "error": "Low quality image. Please look straight at the camera in a well-lit area.",
                "assessment": assessment
            }), 422

        try:
            result = users_collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "faceEncodingVector": encrypt_encoding(encoding.tolist()),
                    "isFaceRegistered": True,
                    "lastFaceAssessment": {
                        "quality": assessment.get('score'),
                        "liveness_signal": liveness_verified,
                        "timestamp": datetime.utcnow()
                    }
                }}
            )
        except Exception:
            return jsonify({"error": "Invalid user ID format"}), 400

        if result.matched_count == 0:
            return jsonify({"error": "User not found in database"}), 404

        return jsonify({
            "success": True,
            "message": "Face registered successfully",
            "userId": user_id,
            "encodingDimensions": len(encoding)
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/verify-face', methods=['POST'])
@require_jwt
def verify_face():
    """
    Verify if a face belongs to a specific user
    Expects: image file + userId
    Returns: verification result + confidence score
    Note: This endpoint does not perform liveness detection. Callers must implement anti-spoofing.
    """
    try:
        # Ping check for network polling (no payload provided)
        if not request.files and not request.form:
            return jsonify({"success": True, "message": "Service online"}), 200

        # ✅ SECURITY: Hierarchy check - log assessment metadata
        liveness_verified = request.form.get('clientLivenessVerified') == 'true'

        if 'image' not in request.files or 'userId' not in request.form:
            return jsonify({"error": "Image and userId required"}), 400

        user_id = request.form.get('userId')

        if str(user_id) != str(request.current_user_id):
            return jsonify({"error": "Unauthorized: Identity mismatch"}), 403

        image_file = request.files['image']
        image_bytes = image_file.read()

        valid, msg = validate_image_bytes(image_bytes)
        if not valid:
            return jsonify({"error": msg}), 400

        try:
            user = users_collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return jsonify({"error": "Invalid user ID format"}), 400

        if not user or "faceEncodingVector" not in user or not user["faceEncodingVector"]:
            return jsonify({
                "verified": False,
                "message": "User face not registered in database"
            }), 400

        encoding, message, assessment = extract_face_encoding(image_bytes, include_assessment=True)

        if encoding is None:
            return jsonify({
                "verified": False,
                "message": message
            }), 400

        stored_encoding = np.array(decrypt_encoding(user["faceEncodingVector"]))

        distance = calculate_face_distance(encoding, stored_encoding)
        confidence = max(0, 1 - (distance / 2.0))

        verified = distance < 0.6

        return jsonify({
            "verified": verified,
            "distance": float(distance),
            "confidence": float(confidence),
            "userId": user_id,
            "message": "Face verified" if verified else "Face does not match"
        }), 200

    except Exception as e:
        return jsonify({"verified": False, "error": str(e)}), 500


@app.route('/assess-face', methods=['POST'])
@require_jwt
def assess_face():
    """
    Rapid runtime assessment of face quality without database updates.
    Used for UI feedback during enrollment.
    """
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
            
        image_bytes = request.files['image'].read()
        _, _, assessment = extract_face_encoding(image_bytes, include_assessment=True)
        
        if not assessment:
            return jsonify({"error": "No face detected"}), 400
            
        return jsonify({
            "success": True,
            "assessment": assessment
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/recognize-face', methods=['POST'])
@require_jwt
def recognize_face():
    """
    Recognize student from image
    Expects: image file
    Returns: matched user_id + confidence score
    Note: This endpoint does not perform liveness detection. Callers must implement anti-spoofing.
    """
    try:
        if request.form.get('clientLivenessVerified') != 'true':
            return jsonify({"error": "clientLivenessVerified flag must be 'true'"}), 400

        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400

        image_file = request.files['image']
        image_bytes = image_file.read()

        valid, msg = validate_image_bytes(image_bytes)
        if not valid:
            return jsonify({"error": msg}), 400

        encoding, message, assessment = extract_face_encoding(image_bytes)

        if encoding is None:
            return jsonify({"error": message, "matches": []}), 400

        matches = []
        distance_threshold = 0.6

        # Restrict to users within the same department context to prevent OOM
        current_user = users_collection.find_one({"_id": ObjectId(request.current_user_id)})
        dept_id = current_user.get("department") if current_user else None
        
        query = {"faceEncodingVector": {"$exists": True, "$ne": []}}
        if dept_id:
            query["department"] = dept_id
            
        users_with_faces = users_collection.find(query).limit(500)

        for user in users_with_faces:
            stored_encoding = np.array(decrypt_encoding(user["faceEncodingVector"]))
            distance = calculate_face_distance(encoding, stored_encoding)
            confidence = max(0, 1 - (distance / 2.0))

            if distance < distance_threshold:
                matches.append({
                    "userId": str(user["_id"]),
                    "confidence": float(confidence),
                    "distance": float(distance)
                })

        matches.sort(key=lambda x: x["confidence"], reverse=True)

        return jsonify({
            "success": True,
            "matches": matches,
            "topMatch": matches[0] if matches else None,
            "matchFound": len(matches) > 0
        }), 200

    except Exception as e:
        return jsonify({"error": str(e), "matches": []}), 500


@app.route('/batch-encode', methods=['POST'])
@require_jwt
def batch_encode():
    """
    Encode multiple images at once (for bulk registration)
    Expects: JSON with list of {userId, imageBase64}
    Note: This endpoint does not perform liveness detection. Callers must implement anti-spoofing.
    """
    try:
        data = request.get_json()

        # ✅ Enforce batch size and per-image size limits
        MAX_BATCH_SIZE = 50
        MAX_IMAGE_B64_BYTES = 5 * 1024 * 1024 * 1.37  # ~5MB image → ~6.85MB base64

        if not isinstance(data, list):
            return jsonify({"error": "Expected list of images"}), 400
        if len(data) > MAX_BATCH_SIZE:
            return jsonify({"error": f"Batch size exceeds maximum of {MAX_BATCH_SIZE}"}), 400
        for item in data:
            b64 = item.get('imageBase64', '')
            if len(b64) > MAX_IMAGE_B64_BYTES:
                return jsonify({"error": f"Image for userId {item.get('userId')} exceeds size limit"}), 400

        results = {
            "successful": 0,
            "failed": 0,
            "details": []
        }

        role = getattr(request, 'role', '').lower()
        for item in data:
            try:
                user_id = item.get('userId')
                image_base64 = item.get('imageBase64')

                if not user_id or not image_base64:
                    results["failed"] += 1
                    continue

                if role not in ['admin', 'hod'] and str(user_id) != str(request.current_user_id):
                    results["failed"] += 1
                    results["details"].append({"userId": user_id, "status": "failed",
                                               "error": "Not authorized to encode another user's face"})
                    continue

                if item.get('clientLivenessVerified') is not True and str(item.get('clientLivenessVerified')).lower() != 'true':
                    results["failed"] += 1
                    results["details"].append({"userId": user_id, "status": "failed",
                                               "error": "clientLivenessVerified flag must be true"})
                    continue

                import base64
                image_bytes = base64.b64decode(image_base64)

                valid, msg = validate_image_bytes(image_bytes)
                if not valid:
                    results["failed"] += 1
                    results["details"].append({
                        "userId": user_id,
                        "status": "failed",
                        "error": msg
                    })
                    continue

                encoding, message, _ = extract_face_encoding(image_bytes)

                if encoding is not None:
                    users_collection.update_one(
                        {"_id": ObjectId(user_id)},
                        {"$set": {"faceEncodingVector": encrypt_encoding(encoding.tolist())}}
                    )
                    results["successful"] += 1
                    results["details"].append({
                        "userId": user_id,
                        "status": "success"
                    })
                else:
                    results["failed"] += 1
                    results["details"].append({
                        "userId": user_id,
                        "status": "failed",
                        "error": message
                    })

            except Exception as e:
                results["failed"] += 1
                results["details"].append({
                    "userId": item.get('userId'),
                    "status": "failed",
                    "error": str(e)
                })

        return jsonify(results), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/clear-all', methods=['POST'])
@require_jwt
@require_admin
def clear_all():
    """
    Clear all registered faces (admin only)
    """
    users_collection.update_many({}, {"$unset": {"faceEncodingVector": ""}})
    return jsonify({"message": "All face encodings cleared from database"}), 200


# Register Image Generation Service
try:
    from routes_image_generation import image_bp
    app.register_blueprint(image_bp)
    print("[STARTUP] Image generation service initialized")
except ImportError as e:
    print(f"[WARNING] Image generation service not available: {e}")

# Register Voice Generation Service (Migrated from custom_ai_api.py)
try:
    from routes_voice_generation import voice_bp
    from routes_compiler import compiler_bp

    app.register_blueprint(voice_bp)
    app.register_blueprint(compiler_bp)
    print("[STARTUP] Voice generation & transcription service initialized")
except ImportError as e:
    print(f"[WARNING] Voice generation service not available: {e}")

# Register Admin Storage Management Service
try:
    from routes_admin_storage import storage_bp
    app.register_blueprint(storage_bp)
    print("[STARTUP] Admin storage management service initialized")
except ImportError as e:
    print(f"[WARNING] Storage management service not available: {e}")

# Register Media Storage Service (Multi-Cloud)
try:
    from routes_media_storage import media_bp
    app.register_blueprint(media_bp)
    print("[STARTUP] Media storage service initialized")
except ImportError as e:
    print(f"[WARNING] Media storage service not available: {e}")


if __name__ == '__main__':
    from waitress import serve
    import socket

    port = 5001
    # Check if port is already in use to prevent 'dumb' crashes
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(('localhost', port)) == 0:
            print(f"❌ ERROR: Port {port} is already in use!")
            print(f"👉 Run this to fix: Stop-Process -Id (Get-NetTCPConnection -LocalPort {port}).OwningProcess -Force")
            os._exit(1)

    print(f"[STARTUP] Starting Monolithic AI Gateway on port {port}")
    if torch:
        print(f"[STARTUP] Mode: {'GPU (CUDA)' if torch.cuda.is_available() else 'CPU (Slow Mode)'}")
    else:
        print("[STARTUP] Mode: CPU (Torch not installed)")
    try:
        serve(app, host='0.0.0.0', port=port, threads=8)
    except Exception as e:
        print(f"[STARTUP] Waitress unavailable ({e}); falling back to Flask server.")
        app.run(debug=False, host='0.0.0.0', port=port, threaded=True)
