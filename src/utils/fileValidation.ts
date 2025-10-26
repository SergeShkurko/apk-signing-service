import AdmZip from 'adm-zip';
import { fileTypeFromFile } from 'file-type';
import fs from 'fs-extra';
import { logger } from './logger';

/**
 * Validates APK file
 * Checks magic bytes, ZIP structure, presence of AndroidManifest.xml
 * Protection against Zip Bomb attacks
 * 
 * @param filePath - Path to file for validation
 * @throws Error on invalid file or Zip Bomb detection
 */
export async function validateApkFile(filePath: string): Promise<void> {
  // 1. Check file existence
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    throw new Error('File not found');
  }

  // 2. Check file size
  const stats = await fs.stat(filePath);
  const maxSize = 200 * 1024 * 1024; // 200MB
  
  if (stats.size === 0) {
    throw new Error('File is empty');
  }
  
  if (stats.size > maxSize) {
    throw new Error(`File too large: ${Math.round(stats.size / 1024 / 1024)}MB (max: 200MB)`);
  }

  // 3. Check magic bytes (ZIP signature)
  // APK files are ZIP archives, must start with PK (0x50 0x4B)
  
  // First try with file-type library
  const fileType = await fileTypeFromFile(filePath);
  
  logger.debug('File type detection', {
    fileType: fileType ? `${fileType.mime} (${fileType.ext})` : 'undefined',
    filePath
  });
  
  // Manually check magic bytes - read only first 4 bytes
  const readFirstBytes = async (path: string, bytes: number): Promise<Buffer> => {
    return new Promise<Buffer>((resolve, reject) => {
      const buffer = Buffer.alloc(bytes);
      const stream = fs.createReadStream(path, { start: 0, end: bytes - 1 });
      let position = 0;
      
      stream.on('data', (chunk) => {
        const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunkBuffer.copy(buffer, position);
        position += chunkBuffer.length;
      });
      
      stream.on('end', () => resolve(buffer));
      stream.on('error', (err) => reject(err));
    });
  };
  
  const buffer = await readFirstBytes(filePath, 4);
  
  // ZIP files start with PK signature (0x50 0x4B 0x03 0x04 or other variants)
  const isZip = buffer.length >= 4 && 
          buffer[0] === 0x50 && 
          buffer[1] === 0x4B && 
          (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
          (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08);
  
  logger.debug('ZIP signature check', {
    isZip,
    bytes: buffer.length >= 4 
      ? `0x${buffer[0]!.toString(16)} 0x${buffer[1]!.toString(16)} 0x${buffer[2]!.toString(16)} 0x${buffer[3]!.toString(16)}`
      : 'N/A'
  });
  
  if (!isZip && (!fileType || fileType.mime !== 'application/zip')) {
    throw new Error('Invalid APK file: not a ZIP archive');
  }

  // 4. Check ZIP structure and Zip Bomb protection
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    
    if (entries.length === 0) {
      throw new Error('APK is empty (no files inside)');
    }
    
    // Check for AndroidManifest.xml (required file for APK)
    const hasManifest = entries.some(entry => 
      entry.entryName === 'AndroidManifest.xml'
    );
    
    if (!hasManifest) {
      throw new Error('Invalid APK: missing AndroidManifest.xml');
    }
    
    // Zip Bomb protection: check compression
    let totalUncompressedSize = 0;
    const maxUncompressedSize = 500 * 1024 * 1024; // 500MB
    const maxCompressionRatio = 100; // Maximum 100:1
    
    for (const entry of entries) {
      totalUncompressedSize += entry.header.size;
      
      // Check total size after decompression
      if (totalUncompressedSize > maxUncompressedSize) {
        throw new Error('Potential Zip Bomb detected: uncompressed size too large');
      }
      
      // Check compression ratio for each file
      if (entry.header.compressedSize > 0) {
        const ratio = entry.header.size / entry.header.compressedSize;
        if (ratio > maxCompressionRatio) {
          logger.warn('High compression ratio detected', {
            file: entry.entryName,
            ratio: ratio.toFixed(2),
          });
          throw new Error('Potential Zip Bomb detected: compression ratio too high');
        }
      }
    }
    
    logger.info('APK validation passed', {
      compressedSize: `${Math.round(stats.size / 1024 / 1024)}MB`,
      uncompressedSize: `${Math.round(totalUncompressedSize / 1024 / 1024)}MB`,
      ratio: (totalUncompressedSize / stats.size).toFixed(2),
      files: entries.length,
    });
    
  } catch (error: any) {
    // If this is already our error (Zip Bomb, Invalid APK), rethrow it
    if (error.message.includes('Zip Bomb') || 
        error.message.includes('Invalid APK') || 
        error.message.includes('APK is empty')) {
      throw error;
    }
    // Otherwise - parsing error
    throw new Error(`Failed to parse APK: ${error.message}`);
  }
}

/**
 * Validates file extension
 * 
 * @param filename - File name
 * @param allowedExtensions - Array of allowed extensions
 * @throws Error if extension is not allowed
 */
export function validateFileExtension(filename: string, allowedExtensions: string[]): void {
  const ext = filename.toLowerCase().split('.').pop();
  if (!ext || !allowedExtensions.includes(ext)) {
    throw new Error(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`);
  }
}

/**
 * Checks that file is not a symbolic link
 * Protection against symlink attacks
 * 
 * @param filePath - Path to file
 * @throws Error if file is a symlink
 */
export async function validateNotSymlink(filePath: string): Promise<void> {
  const stats = await fs.lstat(filePath);
  if (stats.isSymbolicLink()) {
    throw new Error('Symbolic links are not allowed');
  }
}
