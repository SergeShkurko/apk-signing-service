import path from 'path';

/**
 * Validates file ID in UUID format
 * Blocks path traversal attacks
 * 
 * @throws Error if fileId does not match UUID format
 */
export function sanitizeFileId(fileId: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(fileId)) {
    throw new Error('Invalid file ID format');
  }
  
  return fileId;
}

/**
 * Creates a safe file path
 * Verifies that resulting path is inside baseDir
 * Protection against path traversal attacks (../../../etc/passwd)
 * 
 * @param baseDir - Base directory
 * @param fileId - File ID (must be UUID)
 * @param extension - File extension
 * @returns Safe absolute path to file
 * @throws Error on path traversal attempt
 */
export function safeFilePath(baseDir: string, fileId: string, extension: string): string {
  // Validate UUID
  const sanitized = sanitizeFileId(fileId);
  
  // Create filename
  const filename = `${sanitized}.${extension}`;
  
  // Resolve paths
  const resolved = path.resolve(baseDir, filename);
  const baseResolved = path.resolve(baseDir);
  
  // Check that path is still inside baseDir
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    throw new Error('Path traversal attempt detected');
  }
  
  return resolved;
}

/**
 * Sanitizes filename
 * Removes potentially dangerous characters to protect against command injection
 * 
 * @param filename - Original filename
 * @returns Safe filename
 */
export function sanitizeFilename(filename: string): string {
  // Only letters, numbers, hyphen, underscore, dot
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Limit length
  const maxLength = 100;
  if (sanitized.length > maxLength) {
    return sanitized.substring(0, maxLength);
  }
  
  // Don't allow files starting with dot (hidden files)
  if (sanitized.startsWith('.')) {
    return '_' + sanitized.substring(1);
  }
  
  return sanitized;
}

/**
 * Validates string length
 * 
 * @param value - Value to check
 * @param maxLength - Maximum length
 * @param fieldName - Field name for error message
 * @throws Error if length exceeds maximum
 */
export function validateLength(value: string, maxLength: number, fieldName: string): void {
  if (value.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength}`);
  }
}

/**
 * Validates that string contains only safe characters
 * 
 * @param value - Value to check
 * @param fieldName - Field name for error message
 * @throws Error if unsafe characters are found
 */
export function validateSafeString(value: string, fieldName: string): void {
  // Forbid null bytes and control characters
  if (/[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(`${fieldName} contains invalid characters`);
  }
}
