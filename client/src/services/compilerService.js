import axios from "axios";
import axiosRetry from 'axios-retry';
import { apiClient } from './apiClient.js';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const TIMEOUT = 10000;

export const compileCode = async (languageId, code, stdin = '', rapidApiKey = '') => {
  try {
    // 1. Try LOCAL backend (JS=vm2, others=triggers public fallbacks)
    const backendResult = await runCodeOnLocalSandbox(languageId, code, stdin, rapidApiKey);
    
    if (backendResult.status === 'public-fallback') {
      // Use CORS-safe Web Worker with Wandbox
      return new Promise((resolve) => {
        const worker = new Worker('/compiler-worker.js');
        worker.onmessage = (e) => {
          console.log('Worker result:', e.data); // Debug
          worker.terminate();
          resolve(e.data);
        };
        worker.onerror = (err) => {
          worker.terminate();
          resolve({ stdout: '', stderr: 'Worker failed: ' + err.message, status: 'error' });
        };
        worker.postMessage({ language: languageId, code, stdin });
      });
    }
    
    return backendResult;
  } catch (localError) {
    console.warn('Local sandbox failed:', localError.message);
    throw new Error('Compiler unavailable. Try JavaScript or check server.');
  }
};

export const runCodeOnLocalSandbox = async (languageId, code, stdin, rapidApiKey = '') => {
  const res = await apiClient.post('/compiler/compile', {
    language: languageId,
    code,
    stdin: stdin || '',
    rapidApiKey
  }, { timeout: TIMEOUT });
  return res.data;
};

export const runCodeOnJudge0 = async (apiKey, languageId, code, stdin) => {
  const res = await axios.post(
    "https://judge0-ce.p.rapidapi.com/submissions",
    { language_id: languageId, source_code: code, stdin: stdin || "" },
    {
      params: { base64_encoded: "false", wait: "true" },
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        "X-RapidAPI-Key": apiKey,
      },
      timeout: TIMEOUT
    }
  );
  return res.data;
};

// Keep all APIs - will use in failover
export const runCodeOnPistonPylex = async (languageId, code, stdin) => {
  const res = await axios.post("https://piston.pylex.me/api/v2/execute", {
    language: languageId,
    version: "*",
    files: [{ content: code }],
    stdin: stdin || "",
  }, { timeout: TIMEOUT });
  return res.data;
};

export const runCodeOnCodex = async (language, code, stdin) => {
  const res = await axios.post("https://api.codex.jaagrav.in", {
    code,
    language,
    input: stdin || "",
  }, { timeout: TIMEOUT });
  return res.data;
};

export const runCodeOnOfficialPiston = async (languageId, version, code, stdin) => {
  const res = await axios.post("https://emkc.org/api/v2/piston/execute", {
    language: languageId,
    version,
    files: [{ content: code }],
    stdin: stdin || "",
  }, { timeout: TIMEOUT });
  return res.data;
};

export const runCodeOnPistonEmacs = async (language, code, stdin) => {
  const res = await axios.post("https://emacs.piston.rs/api/v2/execute", {
    language,
    version: "*",
    files: [{ content: code }],
    stdin: stdin || "",
  }, { timeout: TIMEOUT });
  return res.data;
};

export const runCodeOnWandbox = async (compiler, code, stdin) => {
  const res = await axios.post("https://wandbox.org/api/compile.json", {
    compiler,
    code,
    stdin: stdin || "",
  }, { timeout: TIMEOUT });
  return res.data;
};
