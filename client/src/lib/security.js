/**
 * Security utilities for attendance verification
 */

// Check if face recognition confidence is acceptable
export function isConfidenceAcceptable(confidence, threshold = 0.85) {
  return confidence >= threshold;
}

// Check if user is attempting attendance too frequently
export function isFrequentAttempt(lastAttendanceTime, minIntervalMinutes = 5) {
  if (!lastAttendanceTime || !(lastAttendanceTime instanceof Date)) return false;
  const timeDiffMinutes = (Date.now() - lastAttendanceTime.getTime()) / 60000;
  return timeDiffMinutes < minIntervalMinutes;
}

export function validateFacialRecognition(
  confidence,
  distance,
  wifiVerified,
  confidenceThreshold = 0.85,
  distanceThreshold = 0.6
) {
  const reasons = [];

  if (confidence < confidenceThreshold) {
    reasons.push(`Face confidence (${(confidence * 100).toFixed(1)}%) below threshold`);
  }

  if (distance > distanceThreshold) {
    reasons.push(`Face distance (${distance.toFixed(2)}) exceeds threshold`);
  }

  if (!wifiVerified) {
    reasons.push('Not connected to school WiFi network');
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

// Generate secure token
export function generateSecureToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Hash data for secure storage
export async function hashData(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Validate input to prevent XSS
export function sanitizeInput(input) {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

// Rate limiting utility
export class RateLimiter {
  maxAttempts;
  windowMs;

  constructor(maxAttempts = 5, windowMs = 60000) {
    // 5 attempts per minute by default
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isLimited(identifier) {
    const key = `rl_${identifier}`;
    const stored = JSON.parse(sessionStorage.getItem(key) || '[]');
    const now = Date.now();
    const recent = stored.filter(t => now - t < this.windowMs);
    if (recent.length >= this.maxAttempts) return true;
    recent.push(now);
    sessionStorage.setItem(key, JSON.stringify(recent));
    return false;
  }

  getRemainingAttempts(identifier) {
    const key = `rl_${identifier}`;
    const stored = JSON.parse(sessionStorage.getItem(key) || '[]');
    const now = Date.now();
    const recentAttempts = stored.filter((time) => now - time < this.windowMs);
    return Math.max(0, this.maxAttempts - recentAttempts.length);
  }

  reset(identifier) {
    const key = `rl_${identifier}`;
    sessionStorage.removeItem(key);
  }
}

// Verify CORS origin
export function isValidOrigin(origin, allowedOrigins) {
  return allowedOrigins.includes(origin);
}

// Encrypt sensitive data for transmission
export async function encryptData(data, publicKey) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  return await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    dataBuffer
  );
}

// Log security events
export async function logSecurityEvent(eventType, userId, details, severity = 'info') {
  try {
    await fetch('/api/audit/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, userId, details, severity,
                             timestamp: new Date().toISOString() }),
      keepalive: true,  // survives page unload
    });
  } catch { /* fail silently — never block the main flow */ }
}
