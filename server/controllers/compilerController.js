import { VM } from 'vm2';
import { promisify } from 'util';
import rateLimit from 'express-rate-limit';

const compilerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per IP
  message: 'Too many compile requests, slow down!'
});

export const compileCode = [
  compilerLimiter,
  async (req, res) => {
    try {
      const { language, code, stdin } = req.body;

      if (!code || !language) {
        return res.status(400).json({ error: 'Code and language required' });
      }

      if (code.length > 10000) {
        return res.status(400).json({ error: 'Code too large (max 10KB)' });
      }

// Non-JS: Signal frontend Web Worker (Wandbox CORS-safe)
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

      const safeSandbox = {
        console: { log: consoleLog, error: consoleError },
        process: { stdin: { read: () => stdin || '' } },
        setTimeout: (cb, delay) => delay > 4500 ? null : setTimeout(cb, Math.min(delay, 4500)),
        setInterval: () => null,
        require: () => ({})
      };

      const sandbox = new VM({
        timeout: 5000,
        sandbox: safeSandbox,
        eval: false,
        wasm: false,
        require: {
          external: false,
          builtin: [],
          root: './'
        }
      });

      sandbox.run(code);

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
