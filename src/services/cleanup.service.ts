import cron from 'node-cron';
import path from 'path';
import { config } from '../config';
import { getFilesByAge, safeRemove } from '../utils/file.utils';
import { logger } from '../utils/logger';

export class CleanupService {
  private readonly directories: string[];

  constructor() {
    this.directories = ['signed', 'incoming'].map(d => 
      path.join(config.upload.dir, d)
    );
  }

  start() {
    cron.schedule('0 * * * *', () => this.cleanup());
    logger.info('Cleanup service started', { 
      schedule: 'Every hour',
      retentionHours: config.upload.retentionHours 
    });
  }

  private async cleanup() {
    logger.info('Starting cleanup process');

    const now = Date.now();
    const maxAge = config.upload.retentionHours * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const dir of this.directories) {
      try {
        const files = await getFilesByAge(dir);

        for (const file of files) {
          if (now - file.mtime > maxAge) {
            await safeRemove(file.path);
            deletedCount++;
            logger.info('File deleted', { 
              file: file.name, 
              age: Math.floor((now - file.mtime) / 1000 / 60) + 'min' 
            });
          }
        }
      } catch (error) {
        logger.error('Cleanup error in directory', error, { dir });
      }
    }

    logger.info('Cleanup process completed', { deletedCount });
  }
}

export const cleanupService = new CleanupService();
