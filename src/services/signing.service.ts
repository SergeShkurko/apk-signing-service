import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { safeRemove } from '../utils/file.utils';
import { logger } from '../utils/logger';
import { execCommand } from '../utils/process.utils';
import { sanitizeFilename } from '../utils/validation';

export class SigningService {
  private readonly signedDir: string;

  constructor() {
    this.signedDir = path.join(config.upload.dir, 'signed');
  }

  private async removeOldSignature(apkPath: string): Promise<void> {
    try {
      // APK is a ZIP file, remove META-INF directory to delete old signature
      // Code 0 = success, Code 12 = nothing to do (no META-INF), both are OK
      await execCommand('zip', ['-d', apkPath, 'META-INF/*'], [0, 12]);
      logger.info('Old signature removed or not present', { apkPath });
    } catch (error) {
      throw new Error(`Failed to remove old signature: ${(error as Error).message}`);
    }
  }

  async signApk(inputPath: string, originalName: string): Promise<{ fileId: string; filename: string }> {
    const fileId = uuidv4();
    const safeName = sanitizeFilename(originalName);
    const outputFilename = `${path.parse(safeName).name}-signed.apk`;
    const outputPath = path.join(this.signedDir, `${fileId}.apk`);

    if (!(await fs.pathExists(config.keystore.path))) {
      throw new Error('Keystore not found');
    }

    await fs.copy(inputPath, outputPath);

    try {
      await this.removeOldSignature(outputPath);
    } catch (error) {
      logger.warn('Failed to remove old signature, continuing anyway', { 
        error: (error as Error).message 
      });
    }

    const jarSignerArgs = [
      '-verbose',
      '-sigalg', 'SHA256withRSA',
      '-digestalg', 'SHA-256',
      '-keystore', config.keystore.path,
      '-storepass', config.keystore.password,
      '-keypass', config.keystore.keyPassword,
      outputPath,
      config.keystore.keyAlias,
    ];

    logger.info('Starting APK signing', { fileId, originalName: safeName });

    try {
      await execCommand('jarsigner', jarSignerArgs);
      logger.info('APK signing completed', { fileId, outputFilename });
      
      await safeRemove(inputPath);
      
      return { fileId, filename: outputFilename };
    } catch (error) {
      logger.error('APK signing failed', error as Error, { fileId });
      await safeRemove(outputPath);
      throw new Error(`Signing failed: ${(error as Error).message}`);
    }
  }
}

export const signingService = new SigningService();
