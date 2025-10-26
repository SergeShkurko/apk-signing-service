import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

interface RateLimiterConfig {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  customResponse?: Record<string, any>;
}

/**
 * Create rate limiter with common configuration
 */
export function createRateLimiter(config: RateLimiterConfig) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
    
    // Use default keyGenerator to properly handle IPv6 addresses
    // This automatically uses express-rate-limit's built-in ipKeyGenerator
    
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: config.message,
        retryAfter: Math.ceil(config.windowMs / 1000),
        ...config.customResponse,
      });
    },
  });
}

