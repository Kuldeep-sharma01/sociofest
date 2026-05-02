"""
Multi-Cloud Model Storage Management System
Allows dynamic configuration of model storage backends with priority/fallback logic
Supports: Local, Google Drive, AWS S3, Azure Blob, and more
"""

import os
import json
import re
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Storage backend types
BACKEND_TYPES = {
    'local': 'Local filesystem (native)',
    'google_drive': 'Google Drive',
    'aws_s3': 'AWS S3',
    'azure_blob': 'Azure Blob Storage',
    'huggingface': 'HuggingFace Hub (read-only)',
    'cloudinary': 'Cloudinary CDN',
}

MIN_REQUIRED_STORES = 1  # at least local must succeed


@dataclass
class StorageBackend:
    """Represents a storage backend configuration"""
    type: str  # 'local', 'google_drive', 'aws_s3', 'azure_blob', 'huggingface'
    name: str  # Display name
    enabled: bool
    priority: int  # 1=primary, 2=secondary, etc.
    config: Dict  # Backend-specific config
    
    def __repr__(self):
        return f"StorageBackend({self.type}, priority={self.priority}, enabled={self.enabled})"


class StorageConfig:
    """Manages multi-cloud storage configuration"""
    
    CONFIG_FILE = Path(__file__).parent / 'storage_config.json'
    
    DEFAULT_CONFIG = {
        'model_storage': {
            'enabled': True,
            'large_file_threshold_gb': 3,
            'backends': [
                {
                    'type': 'local',
                    'name': 'Local Cache (Native)',
                    'enabled': True,
                    'priority': 1,
                    'config': {
                        'path': 'stable_diffusion_models'
                    }
                },
                {
                    'type': 'google_drive',
                    'name': 'Google Drive Backup',
                    'enabled': False,
                    'priority': 2,
                    'config': {
                        'credentials_file': '.env.secrets/google-drive-credentials.json',
                        'folder_id': None
                    }
                },
                {
                    'type': 'aws_s3',
                    'name': 'AWS S3 Backup',
                    'enabled': False,
                    'priority': 3,
                    'config': {
                        'bucket': 'sociofest-models',
                        'region': 'us-east-1',
                        'access_key': None,
                        'secret_key': None
                    }
                },
                {
                    'type': 'azure_blob',
                    'name': 'Azure Blob Storage',
                    'enabled': False,
                    'priority': 4,
                    'config': {
                        'account_name': None,
                        'account_key': None,
                        'container': 'models'
                    }
                },
                {
                    'type': 'huggingface',
                    'name': 'HuggingFace Hub (Fallback)',
                    'enabled': True,
                    'priority': 99,  # Fallback
                    'config': {}
                }
            ],
            'fallback_strategy': 'sequential',  # sequential or random
            'cache_location': 'stable_diffusion_models'
        }
    }
    
    def __init__(self):
        self.config = None
        self.backends: List[StorageBackend] = []
        self.load_or_create_config()
    
    VALID_BACKEND_TYPES = {'local', 'google_drive', 'aws_s3', 'azure_blob', 'huggingface'}

    def _validate_config(self, config: dict) -> bool:
        try:
            storage = config['model_storage']
            assert isinstance(storage['large_file_threshold_gb'], (int, float))
            assert storage['fallback_strategy'] in ('sequential', 'random')
            for b in storage['backends']:
                assert b['type'] in self.VALID_BACKEND_TYPES
                assert isinstance(b['priority'], int) and 1 <= b['priority'] <= 999
                assert isinstance(b['enabled'], bool)
                # Sanitize local path — must not traverse outside the project root
                if b['type'] == 'local':
                    resolved = Path(b['config'].get('path', '')).resolve()
                    project_root = Path(__file__).parent.resolve()
                    assert str(resolved).startswith(str(project_root)), "Path traversal in local backend"
            return True
        except (KeyError, AssertionError, TypeError) as e:
            logger.error(f"Config validation failed: {e}")
            return False

    def load_or_create_config(self):
        """Load config from file or create default"""
        if self.CONFIG_FILE.exists():
            try:
                with open(self.CONFIG_FILE, 'r') as f:
                    loaded = json.load(f)
                if self._validate_config(loaded):
                    self.config = loaded
                    logger.info(f"Loaded storage config from {self.CONFIG_FILE}")
                else:
                    logger.warning("Invalid config — falling back to defaults")
                    self.config = self.DEFAULT_CONFIG.copy()
            except Exception as e:
                logger.error(f"Failed to load config: {e}, using default")
                self.config = self.DEFAULT_CONFIG.copy()
        else:
            self.config = self.DEFAULT_CONFIG.copy()
            self.save_config()
        
        self._build_backends()
    
    def _build_backends(self):
        """Build StorageBackend objects from config"""
        self.backends = []
        for backend_cfg in self.config['model_storage']['backends']:
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
    
    def save_config(self):
        """Save config to file"""
        try:
            self.CONFIG_FILE.parent.mkdir(exist_ok=True)
            with open(self.CONFIG_FILE, 'w') as f:
                json.dump(self.config, f, indent=2)
            logger.info(f"Saved storage config to {self.CONFIG_FILE}")
        except Exception as e:
            logger.error(f"Failed to save config: {e}")
    
    def get_enabled_backends(self) -> List[StorageBackend]:
        """Get list of enabled backends in priority order"""
        return [b for b in self.backends if b.enabled]
    
    def get_backend_by_type(self, backend_type: str) -> Optional[StorageBackend]:
        """Get backend by type"""
        for b in self.backends:
            if b.type == backend_type:
                return b
        return None
    
    def update_backend(self, backend_type: str, updates: Dict):
        """Update backend configuration"""
        for backend_cfg in self.config['model_storage']['backends']:
            if backend_cfg['type'] == backend_type:
                backend_cfg.update(updates)
                self._build_backends()
                self.save_config()
                logger.info(f"Updated {backend_type} backend")
                return True
        return False
    
    def get_json(self):
        """Get config as JSON for API responses"""
        return {
            'model_storage': self.config['model_storage'],
            'available_backend_types': BACKEND_TYPES
        }


class StorageManager:
    """Manages model retrieval/storage across multiple backends"""
    
    def __init__(self):
        self.storage_config = StorageConfig()
        self.backends = {}
        self._init_backends()
    
    def _init_backends(self):
        """Initialize active backend implementations"""
        for backend in self.storage_config.get_enabled_backends():
            logger.info(f"Initializing {backend.type} backend (priority {backend.priority})")
            
            if backend.type == 'local':
                self.backends['local'] = LocalBackend(backend)
            elif backend.type == 'google_drive':
                self.backends['google_drive'] = GoogleDriveBackend(backend)
            elif backend.type == 'aws_s3':
                self.backends['aws_s3'] = S3Backend(backend)
            elif backend.type == 'azure_blob':
                self.backends['azure_blob'] = AzureBlobBackend(backend)
            elif backend.type == 'huggingface':
                self.backends['huggingface'] = HuggingFaceBackend(backend)
            elif backend.type == 'cloudinary':
                self.backends['cloudinary'] = CloudinaryBackend(backend)
    
    def get_model(self, model_name: str, model_size_gb: float = None) -> Tuple[str, str]:
        """
        Get model from available backends with fallback
        Returns: (model_path, backend_used)
        """
        backends_to_try = self.storage_config.get_enabled_backends()
        
        logger.info(f"Fetching model: {model_name} from {len(backends_to_try)} backends")
        
        for backend in backends_to_try:
            try:
                if backend.type not in self.backends:
                    logger.warning(f"Backend {backend.type} not initialized")
                    continue
                
                backend_impl = self.backends[backend.type]
                path = backend_impl.get_model(model_name)
                
                if path:
                    logger.info(f"✓ Model found in {backend.type} backend")
                    return path, backend.type
                else:
                    logger.info(f"✗ Model not in {backend.type}, trying next...")
            
            except Exception as e:
                logger.warning(f"Error with {backend.type} backend: {e}")
                continue
        
        raise Exception(f"Model {model_name} not found in any available backend")
    
    def store_model(self, model_name: str, model_path: str, file_size_gb: float) -> dict:
        """
        Store model based on configuration
        Returns: {backend_type: success_status}
        """
        results = {}
        
        for backend in self.storage_config.get_enabled_backends():
            try:
                if backend.type not in self.backends:
                    continue
                
                backend_impl = self.backends[backend.type]
                success = backend_impl.store_model(model_name, model_path, file_size_gb)
                results[backend.type] = success
                
                if success:
                    logger.info(f"✓ Stored in {backend.type}")
            
            except Exception as e:
                logger.error(f"Failed to store in {backend.type}: {e}")
                results[backend.type] = False
        
        successful = [k for k, v in results.items() if v]
        if len(successful) < MIN_REQUIRED_STORES:
            raise Exception(f"Model storage failed: only {len(successful)} backends succeeded: {results}")

        return results
    
    def get_status(self) -> dict:
        """Get status of all backends"""
        status = {
            'timestamp': datetime.now().isoformat(),
            'backends': {}
        }
        
        for backend in self.storage_config.get_enabled_backends():
            if backend.type in self.backends:
                backend_impl = self.backends[backend.type]
                status['backends'][backend.type] = {
                    'name': backend.name,
                    'priority': backend.priority,
                    'healthy': backend_impl.is_healthy(),
                    'available_space_gb': backend_impl.get_available_space()
                }
        
        return status


# Backend Implementations
class LocalBackend:
    """Local filesystem backend"""
    
    def __init__(self, backend: StorageBackend):
        self.backend = backend
        self.path = Path(backend.config.get('path', 'stable_diffusion_models'))
        self.path.mkdir(exist_ok=True)
    
    def get_model(self, model_name: str) -> Optional[str]:
        model_path = self.path / model_name
        if model_path.exists():
            return str(model_path)
        return None
    
    def store_model(self, model_name: str, model_path: str, file_size_gb: float) -> bool:
        try:
            import shutil
            dest = self.path / model_name
            shutil.copy2(model_path, dest)
            return True
        except Exception as e:
            logger.error(f"Local store failed: {e}")
            return False
    
    def is_healthy(self) -> bool:
        return self.path.exists() and os.access(self.path, os.W_OK)
    
    def get_available_space(self) -> float:
        try:
            import shutil
            stat = shutil.disk_usage(self.path)
            return stat.free / (1024**3)
        except:
            return 0.0


def _safe_model_name(name: str) -> str:
    if not re.match(r'^[\w\-\.]+$', name):
        raise ValueError(f"Invalid model name: {name}")
    return name


class GoogleDriveBackend:
    """Google Drive backend"""
    
    def __init__(self, backend: StorageBackend):
        self.backend = backend
        self.service = None
        self._init_service()
    
    def _init_service(self):
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
            
            credentials_file = self.backend.config.get('credentials_file')
            if not credentials_file or not os.path.exists(credentials_file):
                logger.warning(f"Google Drive credentials not found: {credentials_file}")
                return
            
            credentials = service_account.Credentials.from_service_account_file(
                credentials_file,
                scopes=['https://www.googleapis.com/auth/drive.file']
            )
            self.service = build('drive', 'v3', credentials=credentials)
            logger.info("Google Drive backend initialized")
        except Exception as e:
            logger.error(f"Failed to init Google Drive: {e}")
    
    def get_model(self, model_name: str) -> Optional[str]:
        if not self.service:
            return None
        try:
            safe_name = _safe_model_name(model_name)
            results = self.service.files().list(
                q=f"name='{safe_name}' and trashed=false",
                spaces='drive',
                fields='files(id,name,size)',
                pageSize=1
            ).execute()
            files = results.get('files', [])
            return files[0].get('id') if files else None
        except (ValueError, Exception) as e:
            logger.error(f"Drive get_model failed: {e}")
            return None
    
    def store_model(self, model_name: str, model_path: str, file_size_gb: float) -> bool:
        if not self.service:
            return False
        try:
            from googleapiclient.http import MediaFileUpload
            media = MediaFileUpload(model_path, chunksize=1024*1024)
            self.service.files().create(
                body={'name': model_name},
                media_body=media
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Google Drive store failed: {e}")
            return False
    
    def is_healthy(self) -> bool:
        return self.service is not None
    
    def get_available_space(self) -> float:
        if not self.service:
            return 0
        try:
            about = self.service.about().get(fields='storageQuota').execute()
            quota = about['storageQuota']
            free = (quota['limit'] - quota['usage']) / (1024**3)
            return free
        except:
            return 0.0


class S3Backend:
    """AWS S3 backend"""
    
    def __init__(self, backend: StorageBackend):
        self.backend = backend
        self.s3_client = None
        self._init_client()
    
    def _init_client(self):
        try:
            import boto3
            config = self.backend.config
            if not config.get('access_key') or not config.get('secret_key'):
                logger.info("S3 credentials not configured — skipping S3 backend init")
                return
            self.s3_client = boto3.client(
                's3',
                region_name=config.get('region'),
                aws_access_key_id=config.get('access_key'),
                aws_secret_access_key=config.get('secret_key')
            )
        except Exception as e:
            logger.error(f"Failed to init S3: {e}")
    
    def get_model(self, model_name: str) -> Optional[str]:
        if not self.s3_client:
            return None
        try:
            bucket = self.backend.config.get('bucket')
            self.s3_client.head_object(Bucket=bucket, Key=model_name)
            return f"s3://{bucket}/{model_name}"
        except:
            return None
    
    def store_model(self, model_name: str, model_path: str, file_size_gb: float) -> bool:
        if not self.s3_client:
            return False
        try:
            bucket = self.backend.config.get('bucket')
            self.s3_client.upload_file(model_path, bucket, model_name)
            return True
        except Exception as e:
            logger.error(f"S3 store failed: {e}")
            return False
    
    def is_healthy(self) -> bool:
        if not self.s3_client:
            return False
        try:
            bucket = self.backend.config.get('bucket')
            self.s3_client.head_bucket(Bucket=bucket)
            return True
        except:
            return False
    
    def get_available_space(self) -> float:
        return float('inf')  # S3 typically unlimited


class AzureBlobBackend:
    """Azure Blob Storage backend"""
    
    def __init__(self, backend: StorageBackend):
        self.backend = backend
        self.client = None
        self._init_client()
    
    def _init_client(self):
        try:
            from azure.storage.blob import BlobServiceClient
            config = self.backend.config
            if not config.get('account_name') or not config.get('account_key'):
                logger.info("Azure credentials not configured — skipping Azure backend init")
                return
            connection_string = (
                f"DefaultEndpointsProtocol=https;"
                f"AccountName={config.get('account_name')};"
                f"AccountKey={config.get('account_key')};"
                f"EndpointSuffix=core.windows.net"
            )
            self.client = BlobServiceClient.from_connection_string(connection_string)
        except Exception as e:
            logger.error(f"Failed to init Azure: {e}")
    
    def get_model(self, model_name: str) -> Optional[str]:
        if not self.client:
            return None
        try:
            container = self.backend.config.get('container')
            blob_client = self.client.get_blob_client(
                container=container,
                blob=model_name
            )
            blob_client.get_blob_properties()
            return blob_client.url
        except:
            return None
    
    def store_model(self, model_name: str, model_path: str, file_size_gb: float) -> bool:
        if not self.client:
            return False
        try:
            container = self.backend.config.get('container')
            with open(model_path, 'rb') as data:
                self.client.get_blob_client(
                    container=container,
                    blob=model_name
                ).upload_blob(data, overwrite=True)
            return True
        except Exception as e:
            logger.error(f"Azure store failed: {e}")
            return False
    
    def is_healthy(self) -> bool:
        if not self.client:
            return False
        try:
            self.client.list_containers()
            return True
        except:
            return False
    
    def get_available_space(self) -> float:
        return float('inf')  # Azure typically unlimited


_hf_health_cache = {'result': None, 'at': 0.0}
HF_HEALTH_TTL = 60  # seconds

class HuggingFaceBackend:
    """HuggingFace Hub backend (read-only)"""
    
    def __init__(self, backend: StorageBackend):
        self.backend = backend
    
    def get_model(self, model_name: str) -> Optional[str]:
        # HuggingFace is handled by diffusers library directly
        return model_name  # Return model ID for diffusers
    
    def store_model(self, model_name: str, model_path: str, file_size_gb: float) -> bool:
        return False  # Read-only
    
    def is_healthy(self) -> bool:
        now = time.monotonic()
        if now - _hf_health_cache['at'] < HF_HEALTH_TTL:
            return _hf_health_cache['result']
        try:
            import requests
            ok = requests.get('https://huggingface.co', timeout=5).status_code == 200
        except Exception:
            ok = False
        _hf_health_cache.update({'result': ok, 'at': now})
        return ok
    
    def get_available_space(self) -> float:
        return float('inf')


class CloudinaryBackend:
    """Cloudinary backend primarily for media storage"""
    
    def __init__(self, backend: StorageBackend):
        self.backend = backend
        self.configured = False
        self._init_client()
    
    def _init_client(self):
        try:
            import cloudinary
            config = self.backend.config
            if not config.get('cloud_name') or not config.get('api_key') or not config.get('api_secret'):
                logger.info("Cloudinary credentials not configured — skipping Cloudinary backend init")
                return
            cloudinary.config(
                cloud_name=config.get('cloud_name'),
                api_key=config.get('api_key'),
                api_secret=config.get('api_secret')
            )
            self.configured = True
        except Exception as e:
            logger.error(f"Failed to init Cloudinary: {e}")

    def get_model(self, model_name: str) -> Optional[str]:
        # Cloudinary isn't typically used for large .safetensors models
        return None
        
    def store_model(self, model_name: str, model_path: str, file_size_gb: float) -> bool:
        return False
        
    def is_healthy(self) -> bool:
        return self.configured
        
    def get_available_space(self) -> float:
        return float('inf')


# Global storage manager instance
_storage_manager = None

def init_storage_manager():
    global _storage_manager
    if _storage_manager is None:
        _storage_manager = StorageManager()
    return _storage_manager
