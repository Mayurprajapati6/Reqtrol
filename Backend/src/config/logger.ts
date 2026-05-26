import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { AsyncLocalStorage } from 'async_hooks';

type Store = { correlationId: string };
export const asyncLocalStorage = new AsyncLocalStorage<Store>();
export const getCorrelationId = () => asyncLocalStorage.getStore()?.correlationId ?? 'unknown';

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({ format: 'MM-DD-YYYY HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, ...data }) =>
      JSON.stringify({ level, message, timestamp, correlationId: getCorrelationId(), data })
    )
  ),
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: 'logs/%DATE%-flowguard.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

export default logger;
