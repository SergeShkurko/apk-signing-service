import { isDevelopment } from "../config";

/**
 * Sanitizes paths in logs
 * Hides absolute paths by replacing them with placeholders
 */
function sanitizePath(fullPath: string): string {
  const uploadDir = './uploads';
  const certDir = './certs';
  const keysDir = './keys';
  
  return fullPath
    .replace(new RegExp(uploadDir, 'g'), '<uploads>')
    .replace(new RegExp(certDir, 'g'), '<certs>')
    .replace(new RegExp(keysDir, 'g'), '<keys>')
    .replace(/\/app\/keys\/[^\s]+/, '<keystore>')
    .replace(/\/Users\/[^\/]+/, '<home>')
    .replace(/\/home\/[^\/]+/, '<home>');
}

/**
 * Recursively sanitizes data object
 * Removes or masks sensitive data
 */
function sanitizeLogData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'authorization',
    'keystore', 'keystorepassword', 'keypassword',
    'auth', 'bearer', 'credential', 'pwd', 'storepass'
  ];
  
  const sanitized: any = Array.isArray(data) ? [] : {};
  
  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    
    // Check for sensitive keys
    if (sensitiveKeys.some(sk => keyLower.includes(sk))) {
      sanitized[key] = '***REDACTED***';
    } 
    // Check for paths in values
    else if (typeof value === 'string' && (value.includes('/app/') || value.includes('/Users/') || value.includes('/home/'))) {
      sanitized[key] = sanitizePath(value);
    }
    // Recursive sanitization of nested objects
    else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    }
    // Regular values
    else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitizes error messages
 */
function sanitizeError(error: Error): any {
  return {
    message: error.message?.replace(/password|token|key|secret/gi, '***'),
    name: error.name,
    // DO NOT include stack trace in production
    ...(isDevelopment && { stack: error.stack }),
  };
}

export const logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      ...sanitizeLogData(meta || {}),
      timestamp: new Date().toISOString(),
    }));
  },
  
  warn: (message: string, meta?: any) => {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      ...sanitizeLogData(meta || {}),
      timestamp: new Date().toISOString(),
    }));
  },
  
  error: (message: string, error?: any, meta?: any) => {
    console.error(JSON.stringify({ 
      level: 'error', 
      message, 
      error: error instanceof Error ? sanitizeError(error) : error,
      ...sanitizeLogData(meta || {}),
      timestamp: new Date().toISOString() 
    }));
  },
  
  debug: (message: string, meta?: any) => {
    if (!isDevelopment) return;
    console.debug(JSON.stringify({
      level: 'debug',
      message,
      ...sanitizeLogData(meta || {}),
      timestamp: new Date().toISOString(),
    }));
},
};
