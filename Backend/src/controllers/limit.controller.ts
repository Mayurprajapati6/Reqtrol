import type { Request, Response, NextFunction } from 'express';
import { checkLimitSchema } from '../validators';
import LimiterService from '../services/limiter.service';
import { flushAllKeys } from '../engine/rateLimiter.engine';

export const checkLimitController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    
    const body = checkLimitSchema.parse(req.body);

    const result = await LimiterService.checkLimit({
      userId:    body.userId,
      userName:  body.userName,
      avatarUrl: body.avatarUrl,
      endpoint:  body.endpoint,
      action:    body.action,
      method:    body.method,
      ip:        body.ip,
      service:   body.service,
    });

    res.status(result.allowed ? 200 : 429).json({
      success:        true,
      allowed:        result.allowed,
      reason:         result.reason,
      limit:          result.limit,
      remaining:      result.remaining,
      resetIn:        result.resetIn,
      algorithm:      result.algorithm,
      limiterName:    result.limiterName,
      responseTimeMs: result.responseTimeMs,
    });
  } catch (err) {
    next(err);
  }
};

export const flushKeysController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const count = await flushAllKeys();
    res.json({ success: true, message: `Flushed ${count} Redis keys`, keysDeleted: count });
  } catch (err) {
    next(err);
  }
};
