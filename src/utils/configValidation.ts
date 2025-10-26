import crypto from 'crypto';

/**
 * Validates the presence of a required environment variable
 * 
 * @param name - Environment variable name
 * @param value - Environment variable value
 * @returns Cleaned variable value
 * @throws Error if variable is not set or empty
 * 
 * @example
 * ```typescript
 * const apiKey = validateRequiredEnvVar('API_KEY', process.env.API_KEY);
 * ```
 */
export function validateRequiredEnvVar(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`❌ Required environment variable ${name} is not set`);
  }
  return value.trim();
}

/**
 * Validates authentication token complexity
 * 
 * Requirements:
 * - Minimum 32 characters
 * - Minimum 16 unique characters (entropy)
 * - At least 3 character types from: uppercase, lowercase, numbers, special
 * 
 * @param token - Token to check
 * @param fieldName - Field name for error message (default 'Token')
 * @throws Error if token does not meet security requirements
 * 
 * @example
 * ```typescript
 * validateTokenStrength(process.env.STATIC_AUTH_TOKEN, 'STATIC_AUTH_TOKEN');
 * ```
 */
export function validateTokenStrength(token: string, fieldName: string = 'Token'): void {
  const minLength = 32;
  
  if (token.length < minLength) {
    throw new Error(
      `❌ ${fieldName} must be at least ${minLength} characters (current: ${token.length})\n` +
      `   Generate secure token: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"\n` +
      `   Or use: bun run scripts/generate-token.ts 64`
    );
  }
  
  // Check entropy (number of unique characters)
  const uniqueChars = new Set(token).size;
  const minUnique = 16;
  
  if (uniqueChars < minUnique) {
    throw new Error(
      `❌ ${fieldName} has insufficient entropy\n` +
      `   Unique characters: ${uniqueChars}, required: ${minUnique}\n` +
      `   Use a more complex token with mixed characters`
    );
  }
  
  // Check character diversity
  const hasUpperCase = /[A-Z]/.test(token);
  const hasLowerCase = /[a-z]/.test(token);
  const hasNumbers = /[0-9]/.test(token);
  const hasSpecial = /[^A-Za-z0-9]/.test(token);
  
  const complexity = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecial].filter(Boolean).length;
  
  if (complexity < 3) {
    throw new Error(
      `❌ ${fieldName} must contain at least 3 of:\n` +
      `   - Uppercase letters (A-Z)\n` +
      `   - Lowercase letters (a-z)\n` +
      `   - Numbers (0-9)\n` +
      `   - Special characters\n` +
      `   Current complexity: ${complexity}/4`
    );
  }
}

/**
 * Generates a cryptographically strong random token
 * 
 * @param length - Token length in bytes (result will be longer due to base64url encoding)
 * @returns Secure token in base64url format
 * 
 * @example
 * ```typescript
 * const token = generateSecureToken(32);
 * console.log(token); // VR_xfR8leNDKQfXtjCwDaj696RsbTWn3uCgpIbunyB2...
 * ```
 */
export function generateSecureToken(length: number = 32): string {
  if (length < 32) {
    throw new Error('Token length must be at least 32 bytes');
  }
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Validates and returns required environment variables for keystore
 * 
 * @param env - Object with environment variables (usually process.env)
 * @returns Object with validated keystore values
 * @throws Error if any variable is not set
 * 
 * @example
 * ```typescript
 * const keystoreConfig = validateKeystoreEnv(process.env);
 * ```
 */
export function validateKeystoreEnv(env: NodeJS.ProcessEnv) {
  return {
    path: validateRequiredEnvVar('KEYSTORE_PATH', env.KEYSTORE_PATH),
    password: validateRequiredEnvVar('KEYSTORE_PASSWORD', env.KEYSTORE_PASSWORD),
    keyAlias: validateRequiredEnvVar('KEY_ALIAS', env.KEY_ALIAS),
    keyPassword: validateRequiredEnvVar('KEY_PASSWORD', env.KEY_PASSWORD),
  };
}

/**
 * Validates and returns authentication token with complexity check
 * 
 * @param env - Object with environment variables (usually process.env)
 * @returns Validated token
 * @throws Error if token is not set or does not meet requirements
 * 
 * @example
 * ```typescript
 * const authToken = validateAuthToken(process.env);
 * ```
 */
export function validateAuthToken(env: NodeJS.ProcessEnv): string {
  const token = validateRequiredEnvVar('STATIC_AUTH_TOKEN', env.STATIC_AUTH_TOKEN);
  validateTokenStrength(token, 'STATIC_AUTH_TOKEN');
  return token;
}

/**
 * Warns about weak security settings in production
 * 
 * @param nodeEnv - Environment (development, production, etc.)
 * @param token - Token to check
 * @param minProductionLength - Minimum recommended length for production (default 64)
 */
export function warnProductionSecurity(
  nodeEnv: string, 
  token: string, 
  minProductionLength: number = 64
): void {
  if (nodeEnv === 'production') {
    if (token.length < minProductionLength) {
      console.warn(
        `⚠️  WARNING: For production, use tokens with ${minProductionLength}+ characters for better security\n` +
        `   Current token length: ${token.length}`
      );
    }
  }
}
