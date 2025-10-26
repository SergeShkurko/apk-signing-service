import type { Application } from 'express';
import fs from 'fs-extra';
import https from 'https';
import path from 'path';
import { config } from '../config';
import { logger } from './logger';
import { execCommand } from './process.utils';

/**
 * Creates self-signed certificate for development mode
 * Used when SSL is enabled but domain is not configured
 */
export async function createSelfSignedCert(): Promise<{
  key: string;
  cert: string;
}> {
  const certDir = config.ssl.certDir;
  const keyPath = path.join(certDir, 'dev-key.pem');
  const certPath = path.join(certDir, 'dev-cert.pem');

  await fs.ensureDir(certDir);

  if (await fs.pathExists(keyPath) && await fs.pathExists(certPath)) {
    logger.info('Using existing self-signed certificates', { keyPath, certPath });
    return {
      key: await fs.readFile(keyPath, 'utf-8'),
      cert: await fs.readFile(certPath, 'utf-8'),
    };
  }

  logger.info('Generating self-signed certificates for development', { certDir });

  try {
    await execCommand('openssl', ['genrsa', '-out', keyPath, '2048']);
    await execCommand('openssl', [
      'req', '-new', '-x509', '-key', keyPath, '-out', certPath, '-days', '365',
      '-subj', '/C=RU/ST=Dev/L=Dev/O=Dev/CN=localhost'
    ]);

    logger.info('Self-signed certificates created successfully');

    return {
      key: await fs.readFile(keyPath, 'utf-8'),
      cert: await fs.readFile(certPath, 'utf-8'),
    };
  } catch (error) {
    logger.error('Failed to generate self-signed certificates', { error });
    throw new Error('Failed to generate self-signed certificates');
  }
}

/**
 * Creates HTTPS server using self-signed certificates
 * Used in development mode
 */
export async function createHttpsServerDev(app: Application) {
  logger.info('Setting up HTTPS server with self-signed certificates');
  const { key, cert } = await createSelfSignedCert();
  return https.createServer({ key, cert }, app);
}

/**
 * Creates HTTPS server using Greenlock Express
 * Automatically obtains and renews Let's Encrypt certificates
 */
export async function createHttpsServerProduction(app: Application) {
  if (!config.ssl.domain || !config.ssl.email) {
    throw new Error('SSL_DOMAIN and SSL_EMAIL must be set for production SSL');
  }

  logger.info('Setting up HTTPS server with Greenlock (Let\'s Encrypt)', {
    domain: config.ssl.domain,
    staging: config.ssl.staging,
  });

  const greenlockExpress = await import('@root/greenlock-express');

  const greenlock = greenlockExpress.default.init({
    packageRoot: process.cwd(),
    configDir: config.ssl.certDir,
    maintainerEmail: config.ssl.email,
    cluster: false,
    staging: config.ssl.staging,
  });

  await greenlock.manager.defaults({
    agreeToTerms: true,
    subscriberEmail: config.ssl.email,
  });

  try {
    await greenlock.sites.add({
      subject: config.ssl.domain,
      altnames: [config.ssl.domain],
    });
    logger.info('Domain added to Greenlock', { domain: config.ssl.domain });
  } catch (error: any) {
    if (error.code !== 'E_SITE_EXISTS') {
      logger.error('Failed to add domain to Greenlock', { error });
      throw error;
    }
  }

  const glx = greenlock.serve(app);

  return {
    httpServer: glx.httpServer,
    httpsServer: glx.httpsServer,
  };
}

/**
 * HTTP to HTTPS redirect middleware
 * Redirects all HTTP requests to HTTPS
 * Exception: /.well-known/acme-challenge/ for Let's Encrypt validation
 */
export function httpsRedirectMiddleware(
  req: any,
  res: any,
  next: () => void
) {
  // Skip ACME challenge requests
  if (req.url.startsWith('/.well-known/acme-challenge/')) {
    return next();
  }

  // Check if request came via HTTP
  if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
    const httpsUrl = `https://${req.get('host')}${req.url}`;
    logger.info('Redirecting HTTP to HTTPS', {
      from: req.url,
      to: httpsUrl,
    });
    return res.redirect(301, httpsUrl);
  }

  next();
}
