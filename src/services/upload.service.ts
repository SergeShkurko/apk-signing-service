import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { ensureDirectories } from '../utils/file.utils.js';

const incomingDir = path.join(config.upload.dir, 'incoming');
const signedDir = path.join(config.upload.dir, 'signed');

await ensureDirectories(incomingDir, signedDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, incomingDir);
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    cb(null, `${fileId}.apk`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype !== 'application/vnd.android.package-archive' && 
      !file.originalname.endsWith('.apk')) {
    return cb(new Error('Only APK files are allowed'));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});
