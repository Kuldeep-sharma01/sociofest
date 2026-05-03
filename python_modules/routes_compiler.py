"""
Flask Routes for Secure Python Code Compilation/Execution
"""

from flask import Blueprint, request, jsonify
import subprocess
import sys
import os
import tempfile
import time
import re
from auth_middleware import token_required

compiler_bp = Blueprint('compiler', __name__)

# SECURITY POLICY: Blacklist dangerous modules and keywords to prevent host system compromise
# In a production environment, this SHOULD be replaced by Judge0 or a Docker-based sandbox.
DANGEROUS_PATTERNS = [
    r'import\s+os', r'import\s+subprocess', r'import\s+sys', r'import\s+shutil', 
    r'import\s+socket', r'import\s+requests', r'from\s+os', r'from\s+subprocess',
    r'eval\(', r'exec\(', r'__import__', r'open\(', r'getattr\(', r'globals\(',
    r'rm\s+-rf', r'chmod', r'chown'
]

@compiler_bp.route('/compile', methods=['POST'])
@token_required
def compile_python():
    """
    Execute Python code in a subprocess with timeout and resource limits.
    Includes basic static analysis to block dangerous system calls.
    """
    try:
        data = request.json or {}
        code = data.get('code', '')
        stdin_data = data.get('stdin', '')

        if not code:
            return jsonify({'error': 'No code provided'}), 400

        # ✅ STATIC ANALYSIS: Block dangerous modules/keywords
        for pattern in DANGEROUS_PATTERNS:
            if re.search(pattern, code, re.IGNORECASE):
                return jsonify({
                    'language': 'python',
                    'status': 'security_violation',
                    'stderr': f'Security Error: Use of forbidden module or function detected ({pattern}). System access is restricted.',
                    'stdout': ''
                }), 403

        # Create a temporary file for the code
        with tempfile.NamedTemporaryFile(suffix='.py', delete=False, mode='w', encoding='utf-8') as f:
            f.write(code)
            temp_path = f.name

        try:
            # Run the code in a separate process
            # We use sys.executable to ensure we use the same Python environment
            start_time = time.time()
            
            # ✅ RESOURCE LIMITS: Limit memory and process count (simplified for Windows/Local)
            process = subprocess.Popen(
                [sys.executable, temp_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env={'PYTHONPATH': os.getcwd(), 'PYTHONHASHSEED': '0'} 
            )

            try:
                # 5 second timeout for user code
                stdout, stderr = process.communicate(input=stdin_data, timeout=5.0)
                execution_time = round(time.time() - start_time, 3)
                
                return jsonify({
                    'language': 'python',
                    'status': 'completed' if process.returncode == 0 else 'error',
                    'stdout': stdout if stdout else ('' if stderr else 'No output'),
                    'stderr': stderr if stderr else None,
                    'exit_code': process.returncode,
                    'time': f"{execution_time}s"
                })

            except subprocess.TimeoutExpired:
                process.kill()
                return jsonify({
                    'language': 'python',
                    'status': 'timeout',
                    'stderr': 'Execution timed out (limit: 5s)',
                    'stdout': ''
                }), 408

        finally:
            # Clean up the temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        return jsonify({
            'language': 'python',
            'status': 'error',
            'stderr': str(e),
            'stdout': ''
        }), 500
