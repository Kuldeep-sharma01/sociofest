import vm from 'node:vm';
import rateLimit from 'express-rate-limit';
import { readSystemSettings } from '../utils/systemSettings.js';

const compilerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per IP
  message: 'Too many compile requests, slow down!'
});

export const compileCode = [
  compilerLimiter,
  async (req, res) => {
    try {
      const systemSettings = await readSystemSettings();
      if (systemSettings.serviceControls?.compilerEnabled === false) {
        return res.status(403).json({ error: 'Code compiler is currently disabled by admin.' });
      }

      const { language, code, stdin } = req.body;

      if (!code || !language) {
        return res.status(400).json({ error: 'Code and language required' });
      }

      if (code.length > 10000) {
        return res.status(400).json({ error: 'Code too large (max 10KB)' });
      }

      // Python Integration: Proxy to our local Python module for Python code
      if (language === 'python') {
        try {
          const PYTHON_SERVICE_URL = process.env.PYTHON_INTERNAL_URL || process.env.PYTHON_URL || 'http://localhost:5001';
          const axios = (await import('axios')).default;
          
          const response = await axios.post(`${PYTHON_SERVICE_URL}/compile`, {
            code,
            stdin
          }, {
            headers: {
              'Authorization': req.headers.authorization // Forward the JWT
            },
            timeout: 10000,
            validateStatus: (status) => true // Handle all status codes manually
          });
          
          if (response.status >= 400) {
             return res.status(response.status).json(response.data);
          }
          
          return res.json(response.data);
        } catch (error) {
          console.error('Python compiler proxy failed:', error.message);
          // Only fallback to public if it's a network/timeout error, not a logic error from python
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
             // fall through to public fallback
          } else {
             return res.status(500).json({ error: 'Compiler gateway error' });
          }
        }
      }

      // Non-JS / Fallback: Signal frontend Web Worker (Wandbox CORS-safe)
      if (language !== 'javascript' && language !== 'js') {
        return res.json({
          language,
          status: 'public-fallback',
          stdout: '',
          stderr: null,
          time: 'Worker Wandbox'
        });
      }

      let stdout = '';
      let stderr = '';

      const consoleLog = (...args) => { stdout += args.join(' ') + '\n'; };
      const consoleError = (...args) => { stderr += args.join(' ') + '\n'; };

      // SECURITY FIX: Use Node.js built-in vm module instead of deprecated vm2
      // vm.createContext creates a sandboxed context with only the explicitly provided globals
      const sandbox = {
        console: { log: consoleLog, error: consoleError, warn: consoleError, info: consoleLog },
        process: { stdin: { read: () => stdin || '' } },
        setTimeout: (cb, delay) => delay > 4500 ? null : setTimeout(cb, Math.min(delay, 4500)),
        setInterval: () => null,
        // Block all require/import access
        require: () => { throw new Error('require is not allowed in sandbox'); },
        // Provide safe globals
        JSON,
        Math,
        Date,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Map,
        Set,
        RegExp,
        Error,
        TypeError,
        RangeError,
        SyntaxError,
        Promise,
      };

      const context = vm.createContext(sandbox);

      const script = new vm.Script(code, {
        filename: 'user-code.js',
        timeout: 5000, // 5 second execution limit
      });

      script.runInContext(context, {
        timeout: 5000,
        breakOnSigint: true,
      });

      const result = {
        language,
        status: 'completed',
        stdout: stdout || 'No output',
        stderr: stderr || null,
        time: '< 5s (sandbox)'
      };

      res.json(result);
    } catch (error) {
      res.json({
        language: req.body.language || 'unknown',
        status: 'error',
        stderr: error.message || 'Execution failed',
        stdout: ''
      });
    }
  }
];
