import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
};
