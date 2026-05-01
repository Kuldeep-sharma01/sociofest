import os
import jwt
from functools import wraps
from flask import request, jsonify
import logging

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
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            
        if not token:
            return jsonify({"error": "Unauthorized: JWT Token is missing"}), 401
            
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            # Standardize context variables across all blueprints
            request.user_id = decoded.get('id') or decoded.get('user_id')
            request.role = decoded.get('role', 'student').lower()
            
            # Aliases for backward compatibility
            request.current_user_id = request.user_id
            request.current_user_role = request.role
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Unauthorized: Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Unauthorized: Invalid token"}), 401
        except Exception:
            logging.exception("Unexpected JWT decode error")
            return jsonify({"error": "Unauthorized"}), 401
            
        return f(*args, **kwargs)
    return decorated

def require_admin(f):
    """Standardized Admin/HOD verification middleware"""
    @wraps(f)
    def decorated(*args, **kwargs):
        role = getattr(request, 'role', '').lower()
        if role not in ['admin', 'hod']:
            return jsonify({"error": "Forbidden: Admin or HOD access required"}), 403
        return f(*args, **kwargs)
    return require_jwt(decorated)  # Automatically run JWT checks first

# Aliases for blueprint compatibility
token_required = require_jwt
admin_required = require_admin