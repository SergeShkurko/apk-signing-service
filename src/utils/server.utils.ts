import type { Server } from 'http';
import { logger } from './logger.js';

/**
 * Close single server with Promise
 */
export function closeServer(server: Server, name: string): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      logger.info(`${name} server closed`);
      resolve();
    });
  });
}

/**
 * Close multiple servers in parallel
 */
export async function closeServers(
  servers: Array<{ server: Server | undefined; name: string }>
): Promise<void> {
  const closePromises = servers
    .filter(s => s.server)
    .map(s => closeServer(s.server!, s.name));

  await Promise.all(closePromises);
}

