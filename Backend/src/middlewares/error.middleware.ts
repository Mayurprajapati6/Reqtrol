/**
 * Error Middleware
 *
 * Catches all errors thrown in controllers/services.
 * Must be registered LAST in Express (after all routes).
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../config/logger';

export const errorMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Validation error from Zod
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors:  err.errors.map((e) => ({
        field:   e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Generic application error
  const error   = err instanceof Error ? err : new Error(String(err));
  const isKnown = error.message.length < 200;

  logger.error(`[ErrorMiddleware] ${error.message}`);

  res.status(500).json({
    success: false,
    message: isKnown ? error.message : 'Internal server error',
  });
};

export const notFoundMiddleware = (_req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
};
