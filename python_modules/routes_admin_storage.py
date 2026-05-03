"""
Admin API Routes for Model Storage Management
Allows admins to:
- View storage configuration and status
- Enable/disable backends
- Adjust priority/fallback order
- Configure backend credentials
- Monitor storage usage
"""

from flask import Blueprint, request, jsonify
from storage_manager import init_storage_manager, BACKEND_TYPES
from media_storage_manager import init_media_storage_manager
import logging
from auth_middleware import admin_required

logger = logging.getLogger(__name__)

storage_bp = Blueprint('admin_storage', __name__, url_prefix='/admin/storage')

def get_manager():
    target = request.args.get('target', 'model')
    if target == 'media':
        return init_media_storage_manager()
    return init_storage_manager()

# ✅ Enforce per-backend allowlists for config updates
ALLOWED_CONFIG_KEYS = {
    'local':        {'path'},
    'google_drive': {'credentials_file', 'folder_id'},
    'aws_s3':       {'bucket', 'region', 'access_key', 'secret_key', 'cdn_url'},
    'azure_blob':   {'account_name', 'account_key', 'container'},
    'huggingface':  set(),
    'cloudinary':   {'cloud_name', 'api_key', 'api_secret'},
}

MAX_PRIORITY = 100


@storage_bp.route('/config', methods=['GET'])
@admin_required
def get_storage_config():
    """Get current storage configuration"""
    try:
        manager = get_manager()
        config = manager.storage_config.get_json()
        
        return jsonify({
            'success': True,
            'config': config,
            'backend_types': BACKEND_TYPES
        }), 200
    
    except Exception as e:
        logger.error(f"Failed to get config: {e}")
        return jsonify({'error': str(e)}), 500


@storage_bp.route('/status', methods=['GET'])
@admin_required
def get_storage_status():
    """Get real-time status of all storage backends"""
    try:
        manager = get_manager()
        status = manager.get_status()
        
        return jsonify({
            'success': True,
            'status': status
        }), 200
    
    except Exception as e:
        logger.error(f"Failed to get status: {e}")
        return jsonify({'error': str(e)}), 500


@storage_bp.route('/backend/<backend_type>/enable', methods=['POST'])
@admin_required
def enable_backend(backend_type):
    """Enable a storage backend"""
    try:
        manager = get_manager()
        updates = {'enabled': True}
        success = manager.storage_config.update_backend(backend_type, updates)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'{backend_type} backend enabled'
            }), 200
        else:
            return jsonify({'error': f'Backend {backend_type} not found'}), 404
    
    except Exception as e:
        logger.error(f"Failed to enable backend: {e}")
        return jsonify({'error': str(e)}), 500


@storage_bp.route('/backend/<backend_type>/disable', methods=['POST'])
@admin_required
def disable_backend(backend_type):
    """Disable a storage backend"""
    try:
        if backend_type == 'local':
            return jsonify({'error': 'Cannot disable local backend'}), 400
        
        manager = get_manager()
        updates = {'enabled': False}
        success = manager.storage_config.update_backend(backend_type, updates)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'{backend_type} backend disabled'
            }), 200
        else:
            return jsonify({'error': f'Backend {backend_type} not found'}), 404
    
    except Exception as e:
        logger.error(f"Failed to disable backend: {e}")
        return jsonify({'error': str(e)}), 500


@storage_bp.route('/backend/<backend_type>/priority', methods=['PUT'])
@admin_required
def update_priority(backend_type):
    """Update backend priority (1=primary, 2=secondary, etc.)"""
    try:
        data = request.json or {}
        priority = data.get('priority')
        
        if not isinstance(priority, int) or not (1 <= priority <= MAX_PRIORITY):
            return jsonify({'error': f'Priority must be integer between 1 and {MAX_PRIORITY}'}), 400
        
        manager = get_manager()
        
        # Check for priority collision
        existing = [b for b in manager.storage_config.backends
                    if b.type != backend_type and b.priority == priority]
        if existing:
            return jsonify({'error': f'Priority {priority} already assigned to {existing[0].type}'}), 409
            
        updates = {'priority': priority}
        success = manager.storage_config.update_backend(backend_type, updates)
        
        if success:
            logger.info(f"Updated {backend_type} priority to {priority}")
            return jsonify({
                'success': True,
                'message': f'{backend_type} priority updated to {priority}',
                'backends': [
                    {
                        'type': b.type,
                        'priority': b.priority,
                        'enabled': b.enabled
                    }
                    for b in sorted(manager.storage_config.backends, key=lambda x: x.priority)
                ]
            }), 200
        else:
            return jsonify({'error': f'Backend {backend_type} not found'}), 404
    
    except Exception as e:
        logger.error(f"Failed to update priority: {e}")
        return jsonify({'error': str(e)}), 500


@storage_bp.route('/backend/<backend_type>/config', methods=['PUT'])
@admin_required
def update_backend_config(backend_type):
    """Update backend-specific configuration"""
    try:
        data = request.json or {}
        config_updates = data.get('config', {})
        
        if not config_updates:
            return jsonify({'error': 'No config provided'}), 400
        
        # Sanitize inputs against an allowlist
        allowed = ALLOWED_CONFIG_KEYS.get(backend_type, set())
        rejected = set(config_updates.keys()) - allowed
        if rejected:
            return jsonify({'error': f'Config keys not allowed: {sorted(list(rejected))}'}), 400
        
        safe_updates = {k: v for k, v in config_updates.items() if k in allowed}
        
        manager = get_manager()
        
        # Get existing backend
        backend = manager.storage_config.get_backend_by_type(backend_type)
        if not backend:
            return jsonify({'error': f'Backend {backend_type} not found'}), 404
        
        # Update config
        backend.config.update(safe_updates)
        
        target = request.args.get('target', 'model')
        settings_key = 'media_storage' if target == 'media' else 'model_storage'
        for backend_cfg in manager.storage_config.config[settings_key]['backends']:
            if backend_cfg['type'] == backend_type:
                backend_cfg['config'].update(safe_updates)
        
        manager.storage_config.save_config()
        
        logger.info(f"Updated {backend_type} configuration")
        return jsonify({
            'success': True,
            'message': f'{backend_type} configuration updated',
            'backend': {
                'type': backend_type,
                'config': backend.config
            }
        }), 200
    
    except Exception as e:
        logger.error(f"Failed to update backend config: {e}")
        return jsonify({'error': str(e)}), 500


@storage_bp.route('/backends', methods=['GET'])
@admin_required
def list_backends():
    """List all available backends with their status"""
    try:
        manager = get_manager()
        backends_info = []
        
        for backend in manager.storage_config.backends:
            backend_impl = manager.backends.get(backend.type)
            
            backends_info.append({
                'type': backend.type,
                'name': backend.name,
                'enabled': backend.enabled,
                'priority': backend.priority,
                'healthy': backend_impl.is_healthy() if backend_impl else False,
                'available_space_gb': backend_impl.get_available_space() if backend_impl else 0,
                'config_keys': list(backend.config.keys())
            })
        
        return jsonify({
            'success': True,
            'backends': sorted(backends_info, key=lambda x: x['priority'])
        }), 200
    
    except Exception as e:
        logger.error(f"Failed to list backends: {e}")
        return jsonify({'error': str(e)}), 500


@storage_bp.route('/settings', methods=['GET'])
@admin_required
def get_settings():
    """Get storage settings (threshold, cache location, etc.)"""
    try:
        manager = get_manager()
        target = request.args.get('target', 'model')
        settings_key = 'media_storage' if target == 'media' else 'model_storage'
        settings = manager.storage_config.config[settings_key]
        
        return jsonify({
            'success': True,
            'settings': {
                'large_file_threshold_gb': settings.get('large_file_threshold_gb', 3),
                'fallback_strategy': settings.get('fallback_strategy', 'sequential'),
                'cache_location': settings.get('cache_location'),
                'enabled': settings.get('enabled', True)
            }
        }), 200
    
    except Exception as e:
        logger.error(f"Failed to get settings: {e}")
        return jsonify({'error': str(e)}), 500


@storage_bp.route('/settings', methods=['PUT'])
@admin_required
def update_settings():
    """Update storage settings"""
    try:
        data = request.json or {}
        manager = get_manager()
        target = request.args.get('target', 'model')
        settings_key = 'media_storage' if target == 'media' else 'model_storage'
        settings = manager.storage_config.config[settings_key]
        
        threshold = data.get('large_file_threshold_gb')
        if threshold is not None:
            if not isinstance(threshold, (int, float)) or threshold <= 0 or threshold > 100:
                return jsonify({'error': 'large_file_threshold_gb must be a positive number ≤ 100'}), 400
            settings['large_file_threshold_gb'] = threshold
        
        if 'fallback_strategy' in data:
            if data['fallback_strategy'] not in ['sequential', 'random']:
                return jsonify({'error': 'Invalid fallback strategy'}), 400
            settings['fallback_strategy'] = data['fallback_strategy']
        
        manager.storage_config.save_config()
        
        logger.info(f"Settings updated by {request.user_id}")
        return jsonify({
            'success': True,
            'message': 'Settings updated',
            'settings': settings
        }), 200
    
    except Exception as e:
        logger.error(f"Failed to update settings: {e}")
        return jsonify({'error': str(e)}), 500


@storage_bp.route('/backend-types', methods=['GET'])
@admin_required
def backend_types_info():
    """Get information about all available backend types"""
    return jsonify({
        'success': True,
        'backend_types': BACKEND_TYPES,
        'supported_backends': list(BACKEND_TYPES.keys())
    }), 200


@storage_bp.route('/audit-log', methods=['GET'])
@admin_required
def storage_audit_log():
    """Get storage operations audit log"""
    return jsonify({
        'success': False,
        'error': 'Audit log not yet implemented',
        'message': 'This endpoint is a stub. Connect to an activity log store to enable it.'
    }), 501
