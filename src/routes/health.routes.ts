import type { Request, Response } from 'express';
import express from 'express';
import type { HealthResponse } from '../types/index.js';

const router = express.Router();

router.get('/health', (req: Request, res: Response) => {
  const response: HealthResponse = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

export default router;
