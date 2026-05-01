import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

# OPTIMIZATION: Centralize and persist model caches to prevent redundant downloads (saves huge storage/bandwidth)
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model_cache')
os.makedirs(CACHE_DIR, exist_ok=True)
os.environ['TFHUB_CACHE_DIR'] = CACHE_DIR
os.environ['HF_HOME'] = CACHE_DIR

import warnings
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', category=DeprecationWarning)
warnings.filterwarnings('ignore', message='.*pkg_resources is deprecated.*')

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import tensorflow_hub as hub
import logging
from pymongo import MongoClient
from pymongo.errors import ConfigurationError
from bson.objectid import ObjectId
import json
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()
# CRITICAL INTERLINK: Load the Node.js backend .env to share the EXACT same JWT_SECRET and MONGODB_URI
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
from auth_middleware import require_jwt, require_admin

app = Flask(__name__)
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173').split(',')
CORS(app, origins=ALLOWED_ORIGINS, supports_credentials=True)
logging.basicConfig(level=logging.ERROR)
logging.getLogger('tensorflow').setLevel(logging.ERROR)
logging.getLogger('werkzeug').setLevel(logging.ERROR)
app.logger.setLevel(logging.ERROR)

# Security: Limit maximum payload size to prevent memory exhaustion (5 MB limit)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024

# Load pre-trained feature extractor from TensorFlow Hub (used for embeddings)
print("[STARTUP] Loading facial recognition model...")
model_url = "https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/feature_vector/5"
face_model = hub.load(model_url)

# Load face detector (using OpenCV's Haar Cascade)
prototxt = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(prototxt)

print("[STARTUP] Models loaded successfully")

# Connect to MongoDB (Unified Single Database Architecture)
MONGODB_URI = os.getenv('MONGODB_URI') or os.getenv('MONGODB_URI') or 'mongodb://localhost:27017/smart-attendance'
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
import imghdr

ALLOWED_IMAGE_TYPES = {'jpeg', 'png', 'webp', 'bmp'}

def validate_image_bytes(image_bytes):
    detected = imghdr.what(None, h=image_bytes)
    if detected not in ALLOWED_IMAGE_TYPES:
        return False, f"Unsupported image type: {detected}"
    return True, "ok"


def extract_face_encoding(image_bytes):
    """
    Extract face encoding from image bytes using TensorFlow
    Returns: numpy array of face encoding (1280-dim vector for MobileNetV2)
    """
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return None, "Failed to decode image"

        # OPTIMIZATION (Speed): Resize large images before running Haar Cascade to prevent CPU bottleneck
        max_width = 800
        h, w = img.shape[:2]
        if w > max_width:
            ratio = max_width / float(w)
            img = cv2.resize(img, (max_width, int(h * ratio)), interpolation=cv2.INTER_AREA)

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(40, 40))

        if len(faces) == 0:
            return None, "No face detected in image"

        if len(faces) > 1:
            largest_face = max(faces, key=lambda x: x[2] * x[3])
            x, y, w, h = largest_face
        else:
            x, y, w, h = faces[0]

        face_roi = img[y:y + h, x:x + w]
        face_roi_resized = cv2.resize(face_roi, (224, 224))
        face_roi_normalized = face_roi_resized.astype(np.float32) / 255.0
        face_batch = np.expand_dims(face_roi_normalized, axis=0)

        encoding = face_model(face_batch)
        encoding = encoding.numpy()[0]

        return encoding, "Success"

    except Exception:
        logging.exception("Face encoding extraction failed")
        return None, "Face processing failed. Please try again."


def calculate_face_distance(encoding1, encoding2):
    """Calculate Euclidean distance between two face encodings"""
    return np.linalg.norm(encoding1 - encoding2)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "Python face recognition service is running"}), 200


@app.route('/python-api/register-face', methods=['POST'])
@require_jwt
def register_face():
    """
    Register a student's face encoding
    Expects: image file + userId
    Note: This endpoint does not perform liveness detection. Callers must implement anti-spoofing.
    """
    try:
        if request.form.get('clientLivenessVerified') != 'true':
            return jsonify({"error": "clientLivenessVerified flag must be 'true'"}), 400

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

        encoding, message = extract_face_encoding(image_bytes)

        if encoding is None:
            return jsonify({"error": message}), 400

        try:
            result = users_collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"faceEncodingVector": encrypt_encoding(encoding.tolist())}}
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


@app.route('/python-api/verify-face', methods=['POST'])
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

        if request.form.get('clientLivenessVerified') != 'true':
            return jsonify({"error": "clientLivenessVerified flag must be 'true'"}), 400

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

        encoding, message = extract_face_encoding(image_bytes)

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


@app.route('/python-api/recognize-face', methods=['POST'])
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

        encoding, message = extract_face_encoding(image_bytes)

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


@app.route('/python-api/batch-encode', methods=['POST'])
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

                encoding, message = extract_face_encoding(image_bytes)

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


@app.route('/python-api/clear-all', methods=['POST'])
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
    port = int(os.getenv('PORT', 5001))
    try:
        from waitress import serve
        print("[STARTUP] Starting face recognition service with Waitress on port {}".format(port))
        serve(app, host='0.0.0.0', port=port, threads=8)
    except Exception as e:
        print(f"[STARTUP] Waitress unavailable ({e}); falling back to Flask server.")
        app.run(debug=False, host='0.0.0.0', port=port, threaded=True)
