import IORedis from 'ioredis';
import { config } from './index';
import logger from './logger';

let redisClient: IORedis | null = null;

export function getRedis(): IORedis {
  if (redisClient) return redisClient;

  if (config.REDIS_URL) {
  redisClient = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });
} else {
  redisClient = new IORedis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    db: config.REDIS_DB,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 10) {
        logger.error('[Redis:Reqtrol] Max retries reached');
        return null;
      }

      const delay = Math.min(times * 200, 3000);

      logger.warn(
        `[Redis:Reqtrol] Retrying in ${delay}ms (attempt ${times})`
      );

      return delay;
    },
  });
}

  redisClient.on('connect', () => logger.info('[Redis:Reqtrol] Connected'));
  redisClient.on('ready', () => logger.info('[Redis:Reqtrol] Ready'));
  redisClient.on('error', (err) => logger.error(`[Redis:Reqtrol] Error: ${err.message}`));
  redisClient.on('close', () => logger.warn('[Redis:Reqtrol] Connection closed'));

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('[Redis:Reqtrol] Disconnected');
  }
}
