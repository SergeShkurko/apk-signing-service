import slowDown from 'express-slow-down';
import { createRateLimiter } from '../factories/limiter.factory.js';

/**
 * General limit for all API endpoints
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later',
});

/**
 * Strict limit for signing endpoint
 * 10 signatures per hour per IP
 * Protection against abuse and resource exhaustion
 */
export const signLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many signing requests from this IP',
  customResponse: { limit: 10, window: '1 hour' },
});

/**
 * Medium limit for download
 * 50 downloads per hour per IP
 */
export const downloadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: 'Too many download requests from this IP',
  customResponse: { limit: 50, window: '1 hour' },
});

/**
 * Gradual slowdown after exceeding limit
 * After 50 requests starts adding delay
 * Soft protection against burst traffic
 */
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: (hits) => hits * 100,
  maxDelayMs: 5000,
});

/**
 * Very strict limit for failed authentication attempts
 * Protection against brute force attacks on token
 * 5 failed attempts per hour
 */
export const authFailLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many failed authentication attempts',
  skipSuccessfulRequests: true,
  customResponse: { 
    message: 'Your IP has been temporarily blocked due to multiple failed login attempts' 
  },
});
