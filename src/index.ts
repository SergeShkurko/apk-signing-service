import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import type { Server } from 'http';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, speedLimiter } from './middleware/rateLimiter';
import healthRoutes from './routes/health.routes';
import signRoutes from './routes/sign.routes';
import { cleanupService } from './services/cleanup.service';
import { enforceFileLimit } from './utils/fileLimit';
import { logger } from './utils/logger';
import { closeServers } from './utils/server.utils';
import {
  createHttpsServerDev,
  createHttpsServerProduction
} from './utils/ssl';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use('/api', apiLimiter);
app.use('/api', speedLimiter);
app.use('/', healthRoutes);
app.use('/api', signRoutes);
app.use(errorHandler);

cleanupService.start();

const initializeFileLimits = async () => {
  const dirs = ['incoming', 'signed'].map(d => path.join(config.upload.dir, d));
  
  logger.info('Enforcing file limits on startup', {
    maxFiles: config.upload.maxFilesPerDirectory,
    directories: dirs,
  });
  
  await Promise.all(dirs.map(dir => 
    enforceFileLimit(dir, config.upload.maxFilesPerDirectory)
  ));
  
  logger.info('File limits enforced on startup');
};

let httpServer: Server | undefined;
let httpsServer: Server | undefined;

const startHttpServer = () => {
  httpServer = app.listen(config.port, async () => {
    logger.info('HTTP server started', { port: config.port, nodeEnv: config.nodeEnv });
    await initializeFileLimits();
  });
};

const startHttpsDevServer = async () => {
  httpsServer = await createHttpsServerDev(app);
  httpsServer.listen(config.ssl.httpsPort, async () => {
    logger.info('HTTPS server started with self-signed certificates', {
      port: config.ssl.httpsPort,
      nodeEnv: config.nodeEnv,
    });
    await initializeFileLimits();
  });
};

const startHttpsProductionServer = async () => {
  const servers = await createHttpsServerProduction(app);
  httpServer = servers.httpServer;
  httpsServer = servers.httpsServer;

  httpServer!.listen(config.ssl.httpPort, () => {
    logger.info('HTTP server started (for ACME challenges)', { port: config.ssl.httpPort });
  });

  httpsServer!.listen(config.ssl.httpsPort, async () => {
    logger.info('HTTPS server started with Greenlock', {
      port: config.ssl.httpsPort,
      domain: config.ssl.domain,
      staging: config.ssl.staging,
    });
    await initializeFileLimits();
  });
};

const startServers = async () => {
  if (!config.ssl.enabled) {
    startHttpServer();
    return;
  }

  logger.info('SSL is enabled', { domain: config.ssl.domain, staging: config.ssl.staging });

  try {
    if (config.ssl.domain) {
      await startHttpsProductionServer();
    } else {
      await startHttpsDevServer();
    }
  } catch (error) {
    logger.error('Failed to start servers', { error });
    process.exit(1);
  }
};

startServers();

const shutdown = async () => {
  logger.info('Shutdown signal received, closing servers gracefully');

  try {
    await closeServers([
      { server: httpServer, name: 'HTTP' },
      { server: httpsServer, name: 'HTTPS' },
    ]);
    logger.info('All servers closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
