"""
Stable Diffusion Image Generation Service with Google Drive Model Management
Integrates with Flask app for on-demand image generation
"""

import os
import json
import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
from PIL import Image
import io
import base64
from pathlib import Path
import requests
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import logging

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent / 'stable_diffusion_models'
MODELS_DIR.mkdir(exist_ok=True)

# Model configurations stored in Google Drive
MODELS_CONFIG = {
    'sd-2-1': {
        'id': 'runwayml/stable-diffusion-v1-5',  # HuggingFace model ID
        'drive_file_id': None,  # Optional: pre-downloaded model on Drive
        'name': 'Stable Diffusion 2.1',
    },
    'sd-1-5': {
        'id': 'runwayml/stable-diffusion-v1-5',
        'drive_file_id': None,
        'name': 'Stable Diffusion 1.5',
    },
}

class GoogleDriveModelManager:
    """Manage model downloads from Google Drive"""
    
    def __init__(self, credentials_file=None):
        self.credentials_file = credentials_file or os.getenv('GOOGLE_DRIVE_CREDENTIALS')
        self.service = None
        self.authenticated = False
        
    def authenticate(self):
        """Authenticate with Google Drive API"""
        try:
            if not self.credentials_file or not os.path.exists(self.credentials_file):
                logger.warning("Google Drive credentials not found. Models will be downloaded from HuggingFace.")
                return False
                
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_file,
                scopes=['https://www.googleapis.com/auth/drive.readonly']
            )
            self.service = build('drive', 'v3', credentials=credentials)
            self.authenticated = True
            logger.info("Google Drive authenticated successfully")
            return True
        except Exception as e:
            logger.warning(f"Google Drive authentication failed: {e}")
            return False
    
    def download_model(self, file_id, destination):
        """Download model from Google Drive"""
        if not self.authenticated:
            return False
            
        try:
            file_metadata = self.service.files().get(fileId=file_id).execute()
            file_name = file_metadata.get('name')
            
            request = self.service.files().get_media(fileId=file_id)
            with open(destination, 'wb') as fh:
                downloader = MediaIoBaseDownload(fh, request, chunksize=-1)
                done = False
                while not done:
                    status, done = downloader.next_chunk()
                    if status:
                        logger.info(f"Downloaded {int(status.progress() * 100)}% of {file_name}")
            
            logger.info(f"Model downloaded: {file_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to download model from Google Drive: {e}")
            return False


class StableDiffusionService:
    """Main image generation service"""
    
    def __init__(self):
        self.pipeline = None
        self.current_model = None
        self.device = "cpu"
        self.drive_manager = GoogleDriveModelManager()
        self.drive_manager.authenticate()
        
        # Use GPU if available
        if torch.cuda.is_available():
            self.device = "cuda"
            logger.info("Using GPU for image generation")
        else:
            logger.info("Using CPU for image generation")
    
    def load_model(self, model_key='sd-1-5'):
        """Load model into memory"""
        if self.current_model == model_key:
            return True
            
        try:
            config = MODELS_CONFIG.get(model_key, MODELS_CONFIG['sd-1-5'])
            
            logger.info(f"Loading model: {config['name']}")
            
            # Try to load from Google Drive first
            if config.get('drive_file_id') and self.drive_manager.authenticated:
                model_path = MODELS_DIR / f"{model_key}.safetensors"
                if not model_path.exists():
                    self.drive_manager.download_model(config['drive_file_id'], model_path)
                
                # Load from local path
                self.pipeline = StableDiffusionPipeline.from_pretrained(
                self.pipeline = StableDiffusionPipeline.from_single_file(
                    str(model_path),
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32
                )
            else:
                # Load from HuggingFace
                self.pipeline = StableDiffusionPipeline.from_pretrained(
                    config['id'],
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32
                )
            
            # Optional: Use faster scheduler
            self.pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
                self.pipeline.scheduler.config,
                algorithm_type="dpmsolver",
                use_karras_sigmas=True
            )
            
            self.pipeline = self.pipeline.to(self.device)
            self.current_model = model_key
            
            logger.info(f"Model loaded successfully: {config['name']}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False
    
    def generate_image(self, prompt, negative_prompt="", num_steps=30, guidance_scale=7.5, width=1024, height=1024):
        """Generate image from prompt"""
        # Clamp parameters to safe ranges
        num_steps = max(1, min(int(num_steps), 50))
        guidance_scale = max(1.0, min(float(guidance_scale), 20.0))
        width = min(int(width), 1536)
        height = min(int(height), 1536)

        if not self.pipeline:
            raise ValueError("Model not loaded. Call load_model() first.")

        try:
            # Enable memory optimization for better performance
            if self.device == "cuda":
                torch.cuda.empty_cache()

            with torch.no_grad():
                image = self.pipeline(
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    num_inference_steps=num_steps,
                    guidance_scale=guidance_scale,
                    height=height,
                    width=width,
                ).images[0]

            return image

        except Exception as e:
            logger.error(f"Image generation failed: {e}")
            raise
    
    def image_to_base64(self, image):
        """Convert PIL Image to base64 for JSON response"""
        img_io = io.BytesIO()
        image.save(img_io, 'PNG', quality=95, optimize=False)
        image.save(img_io, format='PNG')
        img_io.seek(0)
        return base64.b64encode(img_io.getvalue()).decode('utf-8')
    
    def save_image(self, image, filename=None):
        """Save image to disk"""
        if not filename:
            import time
            filename = f"generated_{int(time.time())}.png"
        
        output_dir = Path(__file__).parent / 'generated_images'
        output_dir.mkdir(exist_ok=True)
        
        filepath = output_dir / filename
        image.save(filepath)
        logger.info(f"Image saved: {filepath}")
        # ✅ Return only the filename, not the full path
        return filename


# Global service instance
image_service = None

def init_image_generation():
    """Initialize image generation service"""
    global image_service
    if image_service is None:
        image_service = StableDiffusionService()
    return image_service
