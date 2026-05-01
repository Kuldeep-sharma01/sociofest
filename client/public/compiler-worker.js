// Reliable Web Worker Compiler (CORS-safe)
self.onmessage = async (e) => {
  const { language, code, stdin } = e.data;
  
  try {
    // Wandbox API (CORS-friendly, 100+ languages)
    const compilerMap = {
      'python': 'cpython-3.12.7',
      'java': 'openjdk-jdk-22+36',
      'cpp': 'gcc-13.2.0',
      'c': 'gcc-13.2.0-c'
    };
    
    const compiler = compilerMap[language] || 'cpython-3.12.7';
    
    const response = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        compiler: compiler,
        code: code,
        stdin: stdin || ''
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const result = await response.json();
    
    console.log('Wandbox result:', result); // Debug Java
    self.postMessage({
      stdout: result.program_output || '',
      stderr: result.program_stderr || result.compiler_output || '',
      status: 'completed'
    });
  } catch (err) {
    self.postMessage({
      stdout: '',
      stderr: 'Worker compiler failed: ' + err.message,
      status: 'error'
    });
  }
};

