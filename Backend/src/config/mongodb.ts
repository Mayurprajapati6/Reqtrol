import mongoose from 'mongoose';
import { config } from './index';
import logger from './logger';

export async function connectMongoDB(): Promise<void> {
  try {
    mongoose.set('strictQuery', false);

    await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('[MongoDB] Connected to Atlas');

    mongoose.connection.on('error', (err) => {
      logger.error(`[MongoDB] Connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('[MongoDB] Disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('[MongoDB] Reconnected');
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[MongoDB] Failed to connect: ${message}`);
    throw err;
  }
}

export async function closeMongoDB(): Promise<void> {
  await mongoose.connection.close();
  logger.info('[MongoDB] Connection closed');
}
