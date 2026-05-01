"""
Flask Routes for Stable Diffusion Image Generation API
"""

from flask import Blueprint, request, jsonify, send_from_directory
from image_generation import init_image_generation
import logging
import os
import time
import re
import hashlib
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from auth_middleware import token_required

logger = logging.getLogger(__name__)

image_bp = Blueprint('image_generation', __name__, url_prefix='/python-api/images')

_user_last_gen = defaultdict(float)
GEN_COOLDOWN_SECONDS = 10

# Create a strict 1-worker thread pool to act as an in-memory queue.
# This completely eliminates the need for Celery & Redis while preventing VRAM OOM!
image_queue = ThreadPoolExecutor(max_workers=1)

# Store task results in memory
task_results = {}

def background_generate(task_id, prompt, negative_prompt, num_steps, guidance_scale, width, height, model_key, return_base64, save):
    try:
        task_results[task_id] = {'state': 'PROCESSING', 'status': 'Generating image...'}
        service = init_image_generation()
        if not service.load_model(model_key):
            task_results[task_id] = {'state': 'FAILURE', 'error': f"Failed to load model {model_key}"}
            return
            
        image = service.generate_image(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_steps=num_steps,
            guidance_scale=guidance_scale,
            width=width,
            height=height
        )
        
        response = {}
        if save:
            filename = service.save_image(image)
            response['imageUrl'] = f"/python-api/images/generated/{filename}"
            
        if return_base64:
            response['image_base64'] = service.image_to_base64(image)
            response['format'] = 'png'
            
        task_results[task_id] = {'state': 'SUCCESS', 'result': response}
    except Exception as e:
        logger.error(f"Background generation error: {e}")
        task_results[task_id] = {'state': 'FAILURE', 'error': str(e)}


@image_bp.route('/health', methods=['GET'])
def health_check():
    """Check if image generation service is available"""
    return jsonify({
        'status': 'available',
        'service': 'Stable Diffusion Image Generation',
        'device': 'gpu' if 'cuda' in str(init_image_generation().device) else 'cpu'
    })


@image_bp.route('/generate', methods=['POST'])
@token_required
def generate_image():
    """
    Generate image from text prompt
    
    Request body:
    {
        "prompt": "a beautiful landscape",
        "negative_prompt": "blurry, low quality",
        "model": "sd-1-5",
        "num_steps": 30,
        "guidance_scale": 7.5,
        "save": true,
        "return_base64": true
    }
    """
    try:
        now = time.monotonic()
        if now - _user_last_gen[request.user_id] < GEN_COOLDOWN_SECONDS:
            return jsonify({'error': 'Rate limit: please wait before generating another image'}), 429
        _user_last_gen[request.user_id] = now
        
        data = request.json or {}
        prompt = data.get('prompt')
        
        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        
        # Validate prompt length
        if len(prompt) > 1000:
            return jsonify({'error': 'Prompt too long (max 1000 characters)'}), 400
        
        negative_prompt = str(data.get('negative_prompt', ''))
        if len(negative_prompt) > 500:
            return jsonify({'error': 'Negative prompt too long (max 500 characters)'}), 400

        model_key = data.get('model', 'sd-1-5')
        
        task_id = str(uuid.uuid4())
        task_results[task_id] = {'state': 'PENDING', 'status': 'Pending in queue...'}
        
        image_queue.submit(
            background_generate,
            task_id=task_id,
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_steps=min(int(data.get('num_steps', 30)), 50),
            guidance_scale=float(data.get('guidance_scale', 7.5)),
            width=int(data.get('width', 512)),
            height=int(data.get('height', 512)),
            model_key=model_key,
            return_base64=data.get('return_base64', False),
            save=data.get('save', False)
        )
        
        return jsonify({
            'success': True, 
            'task_id': task_id, 
            'status': 'Processing in background'
        }), 202
        
    except Exception as e:
        logger.error(f"Image generation error: {e}")
        return jsonify({'error': str(e)}), 500


@image_bp.route('/status/<task_id>', methods=['GET'])
@token_required
def check_task_status(task_id):
    """Check background task status"""
    task = task_results.get(task_id)
    
    if not task:
        return jsonify({'state': 'FAILURE', 'error': 'Task not found or expired'}), 404
        
    # Free up RAM by removing the task once the Node.js server reads the final result
    if task['state'] in ['SUCCESS', 'FAILURE']:
        del task_results[task_id]
        
    return jsonify(task), 200

@image_bp.route('/models', methods=['GET'])
@token_required
def list_models():
    """List available models"""
    from image_generation import MODELS_CONFIG
    
    models = [
        {
            'key': key,
            'name': config['name'],
            'source': 'google_drive' if config.get('drive_file_id') else 'huggingface'
        }
        for key, config in MODELS_CONFIG.items()
    ]
    
    return jsonify({'models': models}), 200


@image_bp.route('/status', methods=['GET'])
@token_required
def service_status():
    """Get service status and current model info"""
    service = init_image_generation()
    
    return jsonify({
        'status': 'ready',
        'current_model': service.current_model,
        'device': service.device,
        'cuda_available': service.device == 'cuda'
    }), 200


@image_bp.route('/load-model', methods=['POST'])
@token_required
def load_model():
    """Preload a specific model into memory"""
    if request.role not in ['admin', 'hod']:
        return jsonify({'error': 'Admin access required to preload models'}), 403

    try:
        data = request.json or {}
        model_key = data.get('model', 'sd-1-5')
        
        if not data.get('model'):
            return jsonify({'error': 'Model key is required'}), 400
        
        service = init_image_generation()
        if service.load_model(model_key):
            return jsonify({
                'success': True,
                'message': f'Model {model_key} loaded successfully',
                'current_model': service.current_model
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': f'Failed to load model {model_key}'
            }), 500
            
    except Exception as e:
        logger.error(f"Model loading error: {e}")
        return jsonify({'error': str(e)}), 500


@image_bp.route('/generated/<filename>', methods=['GET'])
@token_required
def serve_generated_image(filename):
    """Serve generated image securely"""
    if not re.match(r'^[\w\-]+\.(png|jpg|webp)$', filename):
        return jsonify({'error': 'Invalid filename'}), 400
    output_dir = os.path.join(os.path.dirname(__file__), 'generated_images')
    return send_from_directory(output_dir, filename)
