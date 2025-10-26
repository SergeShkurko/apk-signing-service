import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger';

interface FileInfo {
  name: string;
  path: string;
  mtime: number;
}


export async function enforceFileLimit(directory: string, maxFiles: number): Promise<void> {
  try {
    // Read all files in directory
    const files = await fs.readdir(directory);
    
    if (files.length <= maxFiles) {
      return; // Under limit, nothing to do
    }

    // Get file stats for all files
    const fileInfos: FileInfo[] = await Promise.all(
      files.map(async (fileName) => {
        const filePath = path.join(directory, fileName);
        const stats = await fs.stat(filePath);
        return {
          name: fileName,
          path: filePath,
          mtime: stats.mtimeMs,
        };
      })
    );

    // Sort by modification time (oldest first)
    fileInfos.sort((a, b) => a.mtime - b.mtime);

    // Calculate how many files to delete
    const filesToDelete = fileInfos.length - maxFiles;

    // Delete oldest files
    for (let i = 0; i < filesToDelete; i++) {
      const file = fileInfos[i];
      if (!file) return;
      await fs.remove(file.path);
      logger.info('File deleted due to limit', {
        file: file.name,
        directory,
        reason: 'max_files_limit',
        maxFiles,
      });
    }

    logger.info('File limit enforced', {
      directory,
      deletedCount: filesToDelete,
      remainingCount: maxFiles,
    });
  } catch (error) {
    logger.error('Failed to enforce file limit', error, { directory });
    // Don't throw - this is not critical, upload should continue
  }
}
