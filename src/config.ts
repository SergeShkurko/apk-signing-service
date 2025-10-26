import dotenv from 'dotenv';
import type { Config } from './types/index.js';
import {
  generateSecureToken,
  validateAuthToken,
  validateKeystoreEnv,
  warnProductionSecurity
} from './utils/configValidation.js';

dotenv.config();

// credentials validation with the utilities
const authToken = validateAuthToken(process.env);
const keystoreConfig = validateKeystoreEnv(process.env);

export const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  staticAuthToken: authToken,
  ssl: {
    enabled: process.env.SSL_ENABLED === 'true',
    domain: process.env.SSL_DOMAIN || '',
    email: process.env.SSL_EMAIL || '',
    staging: process.env.SSL_STAGING === 'true',
    certDir: process.env.SSL_CERT_DIR || ('./certs'),
    httpPort: parseInt(process.env.HTTP_PORT || '80', 10),
    httpsPort: parseInt(process.env.HTTPS_PORT || '443', 10),
  },
  keystore: keystoreConfig,
  upload: {
    dir: process.env.UPLOAD_DIR || ('./uploads'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '209715200', 10), // 200MB
    retentionHours: parseInt(process.env.FILE_RETENTION_HOURS || '24', 10),
    maxFilesPerDirectory: parseInt(process.env.MAX_FILES_PER_DIRECTORY || '10', 10) - 1,
  },
};


warnProductionSecurity(config.nodeEnv, config.staticAuthToken);

export { generateSecureToken };
