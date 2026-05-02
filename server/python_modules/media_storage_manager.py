"""
Multi-Cloud Media Storage Management
Extends storage system for user-generated media files (images, videos, documents)
with the same admin control and fallback logic as models
"""

import os
import hashlib
from pymongo import MongoClient
from bson.objectid import ObjectId
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import logging
from storage_manager import StorageConfig, StorageBackend

logger = logging.getLogger(__name__)


class MediaStorageConfig(StorageConfig):
    """Media-specific storage configuration (inherits from StorageConfig)"""
    
    CONFIG_FILE = Path(__file__).parent / 'media_storage_config.json'
    
    DEFAULT_CONFIG = {
        'media_storage': {
            'enabled': True,
            'large_file_threshold_gb': 1,  # Media threshold (typically smaller than models)
            'supported_types': {
                'image': ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
                'video': ['mp4', 'avi', 'mov', 'mkv', 'webm'],
                'document': ['pdf', 'docx', 'txt', 'csv'],
                'audio': ['mp3', 'wav', 'ogg', 'm4a']
            },
            'max_file_size_gb': 10,
            'backends': [
                {
                    'type': 'local',
                    'name': 'Local Storage (Native)',
                    'enabled': True,
                    'priority': 1,
                    'config': {
                        'path': '../uploads/media'
                    }
                },
                {
                    'type': 'google_drive',
                    'name': 'Google Drive Media Backup',
                    'enabled': False,
                    'priority': 2,
                    'config': {
                        'credentials_file': '.env.secrets/google-drive-credentials.json',
                        'folder_id': None
                    }
                },
                {
                    'type': 'aws_s3',
                    'name': 'AWS S3 Media CDN',
                    'enabled': False,
                    'priority': 3,
                    'config': {
                        'bucket': 'sociofest-media',
                        'region': 'us-east-1',
                        'access_key': None,
                        'secret_key': None,
                        'cdn_url': None  # For public URLs
                    }
                },
                {
                    'type': 'azure_blob',
                    'name': 'Azure Blob Media',
                    'enabled': False,
                    'priority': 4,
                    'config': {
                        'account_name': None,
                        'account_key': None,
                    }
                },
                {
                    'type': 'cloudinary',
                    'name': 'Cloudinary CDN',
                    'enabled': False,
                    'priority': 5,
                    'config': {
                        'cloud_name': None,
                        'api_key': None,
                        'api_secret': None
                    }
                }
            ],
            'retention_policy': {
                'enabled': False,
                'delete_after_days': 90  # Auto-delete old media
            },
            'caching': {
                'enable_cdn': True,
                'cache_ttl_hours': 24
            }
        }
    }

    def _validate_config(self, config: dict) -> bool:
        try:
            storage = config['media_storage']
            assert isinstance(storage['large_file_threshold_gb'], (int, float))
            for b in storage['backends']:
                assert isinstance(b['priority'], int) and 1 <= b['priority'] <= 999
                assert isinstance(b['enabled'], bool)
            return True
        except (KeyError, AssertionError, TypeError) as e:
            logger.error(f"Media config validation failed: {e}")
            return False

    def _build_backends(self):
        """Build StorageBackend objects from media_storage config"""
        self.backends = []
        # CRITICAL FIX: Use 'media_storage' key instead of 'model_storage' from parent
        for backend_cfg in self.config['media_storage']['backends']:
            backend = StorageBackend(
                type=backend_cfg['type'],
                name=backend_cfg['name'],
                enabled=backend_cfg['enabled'],
                priority=backend_cfg['priority'],
                config=backend_cfg['config']
            )
            self.backends.append(backend)
        
        # Sort by priority
        self.backends.sort(key=lambda x: x.priority)


class MediaStorageManager:
    """Manages media file storage across multiple backends"""
    
    def __init__(self):
        self.storage_config = MediaStorageConfig()
        self.backends = {}
        self._init_backends()
        local_backend = next((b for b in self.storage_config.config['media_storage']['backends'] if b['type'] == 'local'), None)
        if local_backend and 'config' in local_backend and 'path' in local_backend['config']:
            # Base path for local storage (e.g., ../uploads/media)
            self.local_path = Path(local_backend['config']['path'])
        else:
            self.local_path = Path('media_uploads')
        self.local_path.mkdir(exist_ok=True, parents=True)
        
        # ✅ Add DB connection for metadata
        try:
            self.mongo_client = MongoClient(os.getenv('MONGODB_URI'))
            try:
                self.db = self.mongo_client.get_default_database()
            except Exception:
                db_name = os.getenv('MONGO_DB_NAME') or os.getenv('MONGODB_DB_NAME') or 'sociofestdb'
                self.db = self.mongo_client[db_name]
            self.media_collection = self.db['media']
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB for MediaStorageManager: {e}")
            self.media_collection = None
    
    def _init_backends(self):
        """Initialize active backend implementations"""
        from storage_manager import (
            LocalBackend, GoogleDriveBackend, S3Backend, AzureBlobBackend
        )
        
        for backend in self.storage_config.get_enabled_backends():
            if backend.type == 'local':
                self.backends['local'] = LocalBackend(backend)
            elif backend.type == 'google_drive':
                self.backends['google_drive'] = GoogleDriveBackend(backend)
            elif backend.type == 'aws_s3':
                self.backends['aws_s3'] = S3Backend(backend)
            elif backend.type == 'azure_blob':
                self.backends['azure_blob'] = AzureBlobBackend(backend)
            elif backend.type == 'cloudinary':
                from storage_manager import CloudinaryBackend
                self.backends['cloudinary'] = CloudinaryBackend(backend)
    
    def validate_file(self, filename: str, file_size_gb: float) -> Tuple[bool, str]:
        """Validate file type and size"""
        config = self.storage_config.config['media_storage']
        
        # Check file size
        max_size = config['max_file_size_gb']
        if file_size_gb > max_size:
            return False, f"File too large (max {max_size}GB)"
        
        # Check file type
        ext = filename.split('.')[-1].lower()
        allowed_types = []
        for type_list in config['supported_types'].values():
            allowed_types.extend(type_list)
        
        if ext not in allowed_types:
            return False, f"File type .{ext} not allowed"
        
        return True, "Valid"
    
    def get_media_type(self, filename: str) -> str:
        """Determine media type from filename"""
        ext = filename.split('.')[-1].lower()
        for media_type, exts in self.storage_config.config['media_storage']['supported_types'].items():
            if ext in exts:
                return media_type
        return 'unknown'
    
    def upload_media(self, user_id: str, media_file: bytes, filename: str, 
                     file_size_gb: float, mimetype: str) -> Dict:
        """
        Upload media file to storage backends
        
        Returns: {
            'success': bool,
            'file_id': str,
            'backends_stored': [backend_type, ...],
            'local_path': str
        }
        """
        filename = os.path.basename(filename)  # Sanitize filename to prevent directory traversal
        
        # Validate
        valid, msg = self.validate_file(filename, file_size_gb)
        if not valid:
            return {'success': False, 'error': msg}
        
        # ✅ Deduplicate files by hashing content
        file_hash = hashlib.sha256(media_file).hexdigest()
        if self.media_collection is not None:
            existing_media = self.media_collection.find_one({'hash': file_hash})
            if existing_media:
                logger.info(f"Duplicate media uploaded by {user_id}. Reusing existing file.")
                return {
                    'success': True,
                    'file_id': existing_media['path'],
                    'backends_stored': ['local'], # Assume it's at least local
                    'media_type': self.get_media_type(filename),
                    'size_gb': file_size_gb,
                    'uploaded_at': existing_media.get('createdAt', datetime.now()).isoformat()
                }

        # Create organized path: media_uploads/user_id/media_type/YYYY-MM/filename
        media_type = self.get_media_type(filename)
        now = datetime.now()
        date_folder = now.strftime('%Y-%m')
        
        # Physical path relative to this script
        relative_storage_path = Path(user_id) / media_type / date_folder / filename
        file_path = self.local_path / relative_storage_path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write to local storage first
        try:
            with open(file_path, 'wb') as f:
                f.write(media_file)
            logger.info(f"Media file saved locally: {file_path}")
        except Exception as e:
            logger.error(f"Failed to save locally: {e}")
            return {'success': False, 'error': 'Local storage failed'}
        
        # GLOBAL PATH FIX: Prepend 'media/' so Node.js (serving from 'uploads/') finds it correctly
        # This string is stored in MongoDB 'path' field.
        file_id = f"media/{user_id}/{media_type}/{date_folder}/{filename}"
        
        # Store in cloud backends
        backends_stored = []
        for backend in self.storage_config.get_enabled_backends():
            if backend.type == 'local':
                backends_stored.append('local')
                continue
            
            try:
                if backend.type in self.backends:
                    backend_impl = self.backends[backend.type]
                    # We pass the full file_id as the cloud key
                    backend_impl.store_media(str(file_path), file_id)
                    backends_stored.append(backend.type)
                    logger.info(f"✓ Stored in {backend.type}")
            except Exception as e:
                logger.warning(f"Failed to store in {backend.type}: {e}")
        
        # ✅ Store metadata in database
        if self.media_collection is not None:
            try:
                self.media_collection.insert_one({
                    'hash': file_hash,
                    'path': file_id,
                    'uploader': ObjectId(user_id),
                    'originalName': filename,
                    'mimetype': mimetype,
                    'size': len(media_file),
                    'createdAt': now,
                    'updatedAt': now
                })
            except Exception as e:
                logger.error(f"Failed to save media metadata to DB: {e}")
                return {'success': False, 'error': 'Database metadata storage failed'}

        return {
            'success': True,
            'file_id': file_id,
            'backends_stored': backends_stored,
            'local_path': str(file_path),
            'media_type': media_type,
            'size_gb': file_size_gb,
            'uploaded_at': now.isoformat()
        }
    
    def get_file_metadata(self, file_id: str) -> Optional[Dict]:
        """Get file metadata from database"""
        if not self.media_collection:
            return None
        try:
            metadata = self.media_collection.find_one({'path': file_id})
            if metadata and 'uploader' in metadata:
                metadata['owner_id'] = str(metadata['uploader'])
            return metadata
        except Exception as e:
            logger.error(f"Failed to get media metadata: {e}")
            return None

    def get_media(self, file_id: str) -> Optional[bytes]:
        """Retrieve media file with fallback logic"""
        backends_to_try = self.storage_config.get_enabled_backends()
        
        logger.info(f"Fetching media: {file_id} from {len(backends_to_try)} backends")
        
        for backend in backends_to_try:
            try:
                if backend.type not in self.backends:
                    continue
                
                backend_impl = self.backends[backend.type]
                file_bytes = backend_impl.get_media(file_id)
                
                if file_bytes:
                    logger.info(f"✓ Media found in {backend.type}")
                    return file_bytes
            except Exception as e:
                logger.warning(f"Error with {backend.type}: {e}")
                continue
        
        logger.warning(f"Media {file_id} not found in any backend")
        return None
    
    def delete_media(self, file_id: str) -> Dict:
        """Delete media from all backends"""
        results = {}
        
        # ✅ Delete from database
        if self.media_collection:
            delete_result = self.media_collection.delete_one({'path': file_id})
            results['database'] = 'success' if delete_result.deleted_count > 0 else 'not_found'

        for backend in self.storage_config.get_enabled_backends():
            try:
                if backend.type in self.backends:
                    backend_impl = self.backends[backend.type]
                    deleted = backend_impl.delete_media(file_id)
                    results[backend.type] = 'success' if deleted else 'not_found'
            except Exception as e:
                logger.error(f"Failed to delete from {backend.type}: {e}")
                results[backend.type] = 'error'
        
        return results
    
    def get_user_media_list(self, user_id: str) -> List[Dict]:
        """Get all media files for a user"""
        if not self.media_collection:
            return []
        try:
            media_docs = self.media_collection.find({'uploader': ObjectId(user_id)}).sort('createdAt', -1)
            media_list = []
            for doc in media_docs:
                media_list.append({
                    'file_id': doc.get('path'),
                    'filename': doc.get('originalName'),
                    'media_type': self.get_media_type(doc.get('originalName', '')),
                    'size_gb': doc.get('size', 0) / (1024**3),
                    'uploaded_at': doc.get('createdAt').isoformat()
                })
            return media_list
        except Exception as e:
            logger.error(f"Failed to get user media list from DB: {e}")
            return []
    
    def get_storage_stats(self) -> Dict:
        """Get media storage statistics"""
        total_size_gb = 0
        file_count = 0
        
        for root, dirs, files in os.walk(self.local_path):
            for file in files:
                file_path = Path(root) / file
                total_size_gb += file_path.stat().st_size / (1024**3)
                file_count += 1
        
        return {
            'total_files': file_count,
            'total_size_gb': round(total_size_gb, 2),
            'timestamp': datetime.now().isoformat()
        }


# Backend extensions for media operations
def extend_backends_for_media():
    """Extend existing backends with media-specific methods"""
    from storage_manager import LocalBackend, GoogleDriveBackend, S3Backend, AzureBlobBackend
    
    # Add methods to LocalBackend
    def local_store_media(self, file_path: str, file_id: str) -> bool:
        return True  # Already stored
    
    def local_get_media(self, file_id: str) -> Optional[bytes]:
        # Handle the 'media/' prefix by stripping it if the base path already includes it
        lookup_path = file_id
        if file_id.startswith('media/') and self.path.name == 'media':
             lookup_path = file_id[6:] # Strip 'media/'
             
        full_path = self.path / lookup_path
        logger.info(f"LocalBackend: Trying to open {full_path}")
        try:
            with open(full_path, 'rb') as f:
                return f.read()
        except Exception as e:
            logger.debug(f"LocalBackend: File not found at {full_path}: {e}")
            return None
    
    def local_delete_media(self, file_id: str) -> bool:
        try:
            lookup_path = file_id
            if file_id.startswith('media/') and self.path.name == 'media':
                lookup_path = file_id[6:]
            (self.path / lookup_path).unlink()
            return True
        except:
            return False
    
    LocalBackend.store_media = local_store_media
    LocalBackend.get_media = local_get_media
    LocalBackend.delete_media = local_delete_media
    
    # Add methods to S3Backend
    def s3_store_media(self, file_path: str, file_id: str) -> bool:
        try:
            if hasattr(self, 's3') and hasattr(self, 'bucket'):
                self.s3.upload_file(file_path, self.bucket, f"media/{file_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"S3 store_media failed: {e}")
            return False
            
    def s3_get_media(self, file_id: str) -> Optional[bytes]:
        try:
            if hasattr(self, 's3') and hasattr(self, 'bucket'):
                response = self.s3.get_object(Bucket=self.bucket, Key=f"media/{file_id}")
                return response['Body'].read()
            return None
        except Exception as e:
            logger.error(f"S3 get_media failed: {e}")
            return None
            
    def s3_delete_media(self, file_id: str) -> bool:
        try:
            if hasattr(self, 's3') and hasattr(self, 'bucket'):
                self.s3.delete_object(Bucket=self.bucket, Key=f"media/{file_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"S3 delete_media failed: {e}")
            return False
            
    S3Backend.store_media = s3_store_media
    S3Backend.get_media = s3_get_media
    S3Backend.delete_media = s3_delete_media
    
    # Cloudinary extensions
    from storage_manager import CloudinaryBackend
    def cloudinary_store_media(self, file_path: str, file_id: str) -> bool:
        try:
            if self.configured:
                import cloudinary.uploader
                # Using file_id as public_id
                cloudinary.uploader.upload(file_path, public_id=file_id, resource_type="auto")
                return True
            return False
        except Exception as e:
            logger.error(f"Cloudinary store_media failed: {e}")
            return False

    def cloudinary_get_media(self, file_id: str) -> Optional[bytes]:
        try:
            if self.configured:
                import cloudinary.api
                import requests
                resource = cloudinary.api.resource(file_id)
                url = resource.get('secure_url')
                if url:
                    resp = requests.get(url)
                    if resp.status_code == 200:
                        return resp.content
            return None
        except Exception as e:
            logger.error(f"Cloudinary get_media failed: {e}")
            return None

    def cloudinary_delete_media(self, file_id: str) -> bool:
        try:
            if self.configured:
                import cloudinary.uploader
                cloudinary.uploader.destroy(file_id)
                return True
            return False
        except Exception as e:
            logger.error(f"Cloudinary delete_media failed: {e}")
            return False

    CloudinaryBackend.store_media = cloudinary_store_media
    CloudinaryBackend.get_media = cloudinary_get_media
    CloudinaryBackend.delete_media = cloudinary_delete_media

    # TODO: Similar extensions for GoogleDriveBackend and AzureBlobBackend
    # should be implemented matching their specific SDKs used in storage_manager.py


# Global manager instance
_media_manager = None

def init_media_storage_manager():
    global _media_manager
    if _media_manager is None:
        extend_backends_for_media()
        _media_manager = MediaStorageManager()
    return _media_manager
