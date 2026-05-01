"""
Media Upload/Download API Routes with Multi-Cloud Support
Handles user media uploads (images, videos) with automatic multi-cloud distribution
"""

from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from media_storage_manager import init_media_storage_manager
import logging
import re
import io
from auth_middleware import token_required

logger = logging.getLogger(__name__)

media_bp = Blueprint('media_storage', __name__, url_prefix='/python-api/media')

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB


@media_bp.route('/upload', methods=['POST'])
@token_required
def upload_media():
    """
    Upload media file (image, video, document)
    Auto-stores to all enabled cloud backends (Local, Drive, S3, Azure)
    
    Request: multipart/form-data with 'file' field
    Response: file_id that can be used to retrieve the file
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400
        
        # Secure filename
        filename = secure_filename(file.filename)
        
        file_bytes = file.read(MAX_UPLOAD_BYTES + 1)
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            return jsonify({'error': 'File exceeds maximum upload size of 5MB'}), 413
            
        file_size_gb = len(file_bytes) / (1024**3)
        mimetype = file.mimetype
        
        # Upload to storage
        manager = init_media_storage_manager()
        result = manager.upload_media(
            user_id=request.user_id,
            media_file=file_bytes,
            filename=filename,
            file_size_gb=file_size_gb,
            mimetype=mimetype
        )
        
        if result['success']:
            logger.info(f"User {request.user_id} uploaded: {filename} (stored in {result['backends_stored']})")
            
            return jsonify({
                'success': True,
                'file_id': result['file_id'],
                'filename': filename,
                'size_mb': round(file_size_gb * 1024, 2),
                'media_type': result['media_type'],
                'backends_stored': result['backends_stored'],
                'message': f'Uploaded to {len(result["backends_stored"])} storage backends'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
    
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        return jsonify({'error': str(e)}), 500


@media_bp.route('/download/<file_id>', methods=['GET'])
@token_required
def download_media(file_id):
    """
    Download media file
    Uses fallback logic: Local → GDrive → S3 → Azure
    """
    try:
        # ✅ Validate file_id format to prevent path traversal
        if not re.match(r'^[\w\-/\.]+$', file_id) or '..' in file_id:
            return jsonify({'error': 'Invalid file ID'}), 400

        manager = init_media_storage_manager()
        
        # ✅ Look up file ownership from the database, never trust the file_id prefix
        file_metadata = manager.get_file_metadata(file_id)
        if not file_metadata:
            return jsonify({'error': 'File not found'}), 404

        owner_id = file_metadata.get('owner_id')
        if owner_id != request.user_id and request.role not in ['admin', 'teacher']:
            return jsonify({'error': 'Access denied'}), 403

        # Retrieve file
        file_bytes = manager.get_media(file_id)
        
        if not file_bytes:
            return jsonify({'error': 'File not found'}), 404
        
        filename = file_id.split('/')[-1]
        
        return send_file(
            io.BytesIO(file_bytes),
            as_attachment=True,
            download_name=filename
        )
    
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return jsonify({'error': str(e)}), 500


@media_bp.route('/delete/<file_id>', methods=['DELETE'])
@token_required
def delete_media(file_id):
    """
    Delete media file from all backends
    Only user or admin can delete
    """
    try:
        manager = init_media_storage_manager()
        
        # ✅ Verify ownership from database
        file_metadata = manager.get_file_metadata(file_id)
        if not file_metadata:
            # If not in DB, it might be an old file. Fallback to string split but log warning.
            logger.warning(f"Metadata not found for file_id {file_id}. Falling back to insecure ownership check.")
            owner_id = file_id.split('/')[0]
        else:
            owner_id = file_metadata.get('owner_id')
        if owner_id != request.user_id and request.role not in ['admin', 'teacher']:
            return jsonify({'error': 'Access denied'}), 403
        
        # Delete from all backends
        results = manager.delete_media(file_id)
        
        logger.info(f"User {request.user_id} deleted: {file_id}")
        
        return jsonify({
            'success': True,
            'message': 'File deleted from all backends',
            'deletion_results': results
        }), 200
    
    except Exception as e:
        logger.error(f"Delete failed: {e}")
        return jsonify({'error': str(e)}), 500


@media_bp.route('/list', methods=['GET'])
@token_required
def list_user_media():
    """
    Get all media files for current user
    Returns list of file_ids with metadata
    """
    try:
        manager = init_media_storage_manager()
        media_list = manager.get_user_media_list(request.user_id)
        
        return jsonify({
            'success': True,
            'total_files': len(media_list),
            'media': media_list
        }), 200
    
    except Exception as e:
        logger.error(f"List failed: {e}")
        return jsonify({'error': str(e)}), 500


@media_bp.route('/stats', methods=['GET'])
@token_required
def get_media_stats():
    """
    Get media storage statistics
    Admin/HOD only
    """
    try:
        if request.role not in ['admin', 'hod']:
            return jsonify({'error': 'Admin or HOD access required'}), 403
        
        manager = init_media_storage_manager()
        stats = manager.get_storage_stats()
        
        return jsonify({
            'success': True,
            'stats': stats
        }), 200
    
    except Exception as e:
        logger.error(f"Stats failed: {e}")
        return jsonify({'error': str(e)}), 500


@media_bp.route('/config', methods=['GET'])
@token_required
def get_media_config():
    """
    Get media storage configuration
    Admin only
    """
    try:
        if request.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        manager = init_media_storage_manager()
        config = manager.config.get_json()
        
        return jsonify({
            'success': True,
            'config': config
        }), 200
    
    except Exception as e:
        logger.error(f"Get config failed: {e}")
        return jsonify({'error': str(e)}), 500


@media_bp.route('/upload-progress', methods=['GET'])
@token_required
def upload_progress():
    """
    Get upload progress (for large files)
    Returns: bytes uploaded, total size, percentage
    """
    # This would typically use a background job or websocket
    # For now, return placeholder
    return jsonify({
        'progress': 0,
        'total': 0
    }), 200
