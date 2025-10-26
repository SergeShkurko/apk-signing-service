import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { config } from '../config';
import { authMiddleware } from '../middleware/auth';
import { downloadLimiter, signLimiter } from '../middleware/rateLimiter';
import { signingService } from '../services/signing.service';
import { upload } from '../services/upload.service';
import type { SignResponse } from '../types';
import { safeRemove } from '../utils/file.utils';
import { enforceFileLimit } from '../utils/fileLimit';
import { validateApkFile } from '../utils/fileValidation';
import { logger } from '../utils/logger';
import { safeFilePath } from '../utils/validation';

const router = express.Router();

/**
 * POST /api/sign
 * Signs the uploaded APK file
 * 
 * Protection:
 * - Rate limiting: 10 requests per hour
 * - Authentication required
 * - File validation (magic bytes, APK structure, Zip Bomb protection)
 * - File size limits
 */
router.post('/sign', signLimiter, authMiddleware, upload.single('file'), handleSign);

/**
 * GET /api/download/:fileId
 * Download signed APK file
 * 
 * Protection:
 * - Rate limiting: 50 requests per hour
 * - Authentication required
 * - Path traversal protection (UUID validation)
 */
router.get('/download/:fileId', downloadLimiter, authMiddleware, handleDownload);

export async function handleSign(req: express.Request, res: express.Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    logger.info('APK upload received', {
      originalName: req.file.originalname,
      size: req.file.size,
      ip: req.ip,
    });

    try {
      await validateApkFile(req.file.path);
    } catch (validationError: any) {
      await safeRemove(req.file.path);
      
      logger.warn('Invalid APK upload attempt', {
        error: validationError.message,
        originalName: req.file.originalname,
        size: req.file.size,
        ip: req.ip,
      });
      
      return res.status(400).json({ 
        error: 'Invalid APK file',
        details: validationError.message
      });
    }

    const dirs = ['incoming', 'signed'].map(d => path.join(config.upload.dir, d));
    await Promise.all(dirs.map(dir => 
      enforceFileLimit(dir, config.upload.maxFilesPerDirectory)
    ));

    const { fileId, filename } = await signingService.signApk(
      req.file.path, 
      req.file.originalname
    );

    const expiresAt = new Date(Date.now() + config.upload.retentionHours * 60 * 60 * 1000);

    const response: SignResponse = {
      success: true,
      downloadUrl: `/api/download/${fileId}`,
      filename,
      expiresAt: expiresAt.toISOString(),
    };

    logger.info('APK signed successfully', { 
      fileId, 
      filename,
      originalName: req.file.originalname,
    });

    res.json(response);
  } catch (error: any) {
    logger.error('Sign endpoint error', error, {
      originalName: req.file?.originalname,
      ip: req.ip,
    });
    
    if (req.file?.path) {
      await safeRemove(req.file.path);
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to sign APK'
    });
  }
};

export async function handleDownload(req: express.Request, res: express.Response) {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }
    
    const filePath = safeFilePath(
      path.join(config.upload.dir, 'signed'),
      fileId,
      'apk'
    );

    if (!(await fs.pathExists(filePath))) {
      logger.warn('File not found for download', { fileId, ip: req.ip });
      return res.status(404).json({ error: 'File not found or expired' });
    }

    logger.info('File download started', { fileId, ip: req.ip });

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="app-signed.apk"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      logger.info('File download completed', { fileId });
    });

    fileStream.on('error', (error) => {
      logger.error('File stream error', error, { fileId });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  } catch (error: any) {
    const fileId = req.params.fileId || 'unknown';
    
    logger.error('Download endpoint error', error, {
      fileId,
      ip: req.ip,
    });
    
    if (error.message.includes('Invalid file ID') || error.message.includes('Path traversal')) {
      logger.warn('Path traversal attempt detected', { fileId, ip: req.ip });
      return res.status(400).json({ error: 'Invalid file ID format' });
    }
    
    res.status(500).json({ error: error.message || 'Failed to download file' });
  }
};

export default router;
