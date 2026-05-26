import dotenv from 'dotenv';

type AppConfig = {
  PORT: number;
  NODE_ENV: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string;
  REDIS_DB: number;
  MONGODB_URI: string;
  CORS_ORIGINS: string[];
  QUBY_BACKEND_URL: string;
};

dotenv.config();

export const config: AppConfig = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  REDIS_DB: Number(process.env.REDIS_DB) || 1,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/flowguard',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5174,http://localhost:5173').split(','),
  QUBY_BACKEND_URL: process.env.QUBY_BACKEND_URL || 'http://localhost:3004',
};
