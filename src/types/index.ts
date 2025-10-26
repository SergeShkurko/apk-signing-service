export interface Config {
  port: number;
  nodeEnv: string;
  staticAuthToken: string;
  ssl: {
    enabled: boolean;
    domain: string;
    email: string;
    staging: boolean;
    certDir: string;
    httpPort: number;
    httpsPort: number;
  };
  keystore: {
    path: string;
    password: string;
    keyAlias: string;
    keyPassword: string;
  };
  upload: {
    dir: string;
    maxFileSize: number;
    retentionHours: number;
    maxFilesPerDirectory: number;
  };
}

export interface SignResponse {
  success: boolean;
  downloadUrl: string;
  filename: string;
  expiresAt: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  uptime: number;
  timestamp: string;
}
