import express from 'express';
import cors    from 'cors';
import helmet  from 'helmet';
import morgan  from 'morgan';
import http    from 'http';
import https   from 'https';

import { config }                      from './config';
import logger                          from './config/logger';
import { connectMongoDB, closeMongoDB } from './config/mongodb';
import { getRedis, closeRedis }        from './config/redis';
import rootRouter                      from './routes';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';

const app = express();

app.use(helmet());
app.use(cors({
  origin:           config.CORS_ORIGINS,
  credentials:      true,
  methods:          ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:   ['Content-Type', 'Authorization', 'x-correlation-id'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (msg: string) => logger.http(msg.trim()) },
  skip:   (_req, res) => res.statusCode < 400 && config.NODE_ENV === 'production',
}));

app.use('/api/v1', rootRouter);

app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'Reqtrol',
    version:   '1.0.0',
    uptime:    Math.round(process.uptime()),
    env:       config.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

async function start(): Promise<void> {
  logger.info('[Reqtrol] Starting...');

  await connectMongoDB();

  const redis = getRedis();
  await redis.connect().catch(() => {
    logger.warn('[Redis] connect() failed — will retry automatically');
  });

  app.listen(config.PORT, () => {
    // logger.info(`[Reqtrol] Listening on http://localhost:${config.PORT}`);
    logger.info(`[Reqtrol] Listening on port ${config.PORT}`);
    console.log('\n✅  Reqtrol running');
    console.log(`   API    → http://localhost:${config.PORT}/api/v1`);
    console.log(`   Health → http://localhost:${config.PORT}/health\n`);

    // ── Keep-alive self-ping (prevents Render free-tier cold start) ─────────
    // Render spins down free instances after 15 min of inactivity.
    // Ping /health every 10 minutes to keep the instance warm.
    const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    const selfPing = () => {
      try {
        const selfUrl = process.env.RENDER_EXTERNAL_URL
          ? `${process.env.RENDER_EXTERNAL_URL}/health`
          : `http://localhost:${config.PORT}/health`;
        const client = selfUrl.startsWith('https') ? https : http;
        const req = client.get(selfUrl, (res) => {
          res.resume(); // drain response body
          logger.info(`[KeepAlive] Self-ping OK → HTTP ${res.statusCode}`);
        });
        req.on('error', (err) => {
          logger.warn(`[KeepAlive] Self-ping failed: ${err.message}`);
        });
        req.setTimeout(10_000, () => {
          req.destroy();
          logger.warn('[KeepAlive] Self-ping timed out');
        });
      } catch (err) {
        logger.warn(`[KeepAlive] Self-ping error: ${(err as Error).message}`);
      }
    };
    setInterval(selfPing, PING_INTERVAL_MS);
    logger.info('[KeepAlive] Self-ping scheduled every 10 minutes');
  });
}

async function shutdown(): Promise<void> {
  logger.info('[Reqtrol] Shutting down...');
  await Promise.allSettled([closeRedis(), closeMongoDB()]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

start().catch((err: Error) => {
  logger.error(`[Reqtrol] Startup failed: ${err.message}`);
  process.exit(1);
});
