import os
import jwt
from functools import wraps
from flask import request, jsonify
import logging

logger = logging.getLogger(__name__)

JWT_SECRET = os.getenv('JWT_SECRET')
if not JWT_SECRET:
    if os.getenv('FLASK_ENV') == 'production':
        raise RuntimeError("JWT_SECRET environment variable is required in production")
    JWT_SECRET = 'dev-only-secret-do-not-use-in-prod'
    logging.warning("WARNING: Using dev JWT secret. Set JWT_SECRET in production.")

def require_jwt(f):
    """Standardized JWT verification middleware for Python services"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Robust header detection (handles Bearer prefix and different case variants)
        auth_header = request.headers.get('Authorization') or request.headers.get('authorization')
        
        if auth_header:
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
            else:
                token = auth_header
                
        if not token:
            # Fallback to custom header if used by some legacy proxies
            token = request.headers.get('x-auth-token')
            
        if not token:
            logger.warning(f"Missing JWT token in request to {request.path}")
            return jsonify({"error": "Unauthorized: JWT Token is missing"}), 401
            
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            
            # Standardize context variables across all blueprints
            request.user_id = decoded.get('id') or decoded.get('user_id') or decoded.get('_id')
            request.role = str(decoded.get('role', 'student')).lower()
            
            if not request.user_id:
                logger.error(f"JWT decoded but no user identity found. Payload: {decoded}")
                return jsonify({"error": "Unauthorized: Invalid token payload"}), 401
                
            # Aliases for backward compatibility
            request.current_user_id = request.user_id
            request.current_user_role = request.role
            
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Unauthorized: Token has expired"}), 401
        except jwt.InvalidTokenError as e:
            logger.debug(f"Invalid token error: {e}")
            return jsonify({"error": "Unauthorized: Invalid token"}), 401
        except Exception as e:
            logger.exception(f"Unexpected JWT decode error: {e}")
            return jsonify({"error": "Unauthorized: Authentication failed"}), 401
            
        return f(*args, **kwargs)
    return decorated

def require_admin(f):
    """Standardized Admin/HOD verification middleware"""
    @wraps(f)
    def decorated(*args, **kwargs):
        # The require_jwt decorator (via the return line below) ensures request.role is set
        role = getattr(request, 'role', '').lower()
        if role not in ['admin', 'hod']:
            logger.warning(f"Forbidden access attempt to {request.path} by user {request.user_id} with role {role}")
            return jsonify({"error": "Forbidden: Admin or HOD access required"}), 403
        return f(*args, **kwargs)
    return require_jwt(decorated)  # Automatically run JWT checks first

# Aliases for blueprint compatibility
token_required = require_jwt
admin_required = require_admin