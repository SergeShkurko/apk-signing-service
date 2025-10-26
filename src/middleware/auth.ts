import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid authorization header', { ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.substring(7);

  if (token !== config.staticAuthToken) {
    logger.warn('Invalid token provided', { ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  next();
};
