import fs from 'fs-extra';
import path from 'path';

export interface FileInfo {
  name: string;
  path: string;
  mtime: number;
}

/**
 * Remove file safely without throwing errors
 */
export async function safeRemove(filePath: string): Promise<void> {
  try {
    await fs.remove(filePath);
  } catch {
    // Ignore errors
  }
}

/**
 * Get files sorted by modification time (oldest first)
 */
export async function getFilesByAge(directory: string): Promise<FileInfo[]> {
  const files = await fs.readdir(directory);
  
  const fileInfos = await Promise.all(
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

  return fileInfos.sort((a, b) => a.mtime - b.mtime);
}

/**
 * Ensure multiple directories exist
 */
export async function ensureDirectories(...directories: string[]): Promise<void> {
  await Promise.all(directories.map(dir => fs.ensureDir(dir)));
}

