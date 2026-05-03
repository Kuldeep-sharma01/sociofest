import os
from celery import Celery
from image_generation import init_image_generation
import logging

logger = logging.getLogger(__name__)

# Initialize Celery with Redis as the broker and backend
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
celery_app = Celery('sd_tasks', broker=redis_url, backend=redis_url)

# Initialize the service once globally per worker process to keep the model in VRAM
service = None

@celery_app.task(bind=True, name='generate_image_task')
def generate_image_task(self, prompt, negative_prompt, num_steps, guidance_scale, width, height, model_key, return_base64, save):
    global service
    if service is None:
        service = init_image_generation()
        
    if not service.load_model(model_key):
        raise Exception(f"Failed to load model {model_key}")
        
    logger.info(f"Task {self.request.id}: Generating image for prompt: {prompt[:30]}...")
    
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
        
    return response