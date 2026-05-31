import type { Request, Response, NextFunction } from 'express';
import { trackSchema } from '../validators';
import TrackerService from '../services/tracker.service';

export const trackController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = trackSchema.parse(req.body);
    const result = await TrackerService.track({
      analyticsId:    body.analyticsId,
      requestId:      body.requestId,
      fingerprint:    body.fingerprint,
      trackedAt:      body.trackedAt,
      userId:         body.userId,
      userName:       body.userName,
      avatarUrl:      body.avatarUrl,
      endpoint:       body.endpoint,
      action:         body.action,
      method:         body.method,
      ip:             body.ip,
      userAgent:      body.userAgent,
      allowed:        body.allowed,
      reason:         body.reason ?? null,
      limit:          body.limit,
      remaining:      body.remaining,
      resetIn:        body.resetIn,
      service:        body.service,
      source:         body.source,
      algorithm:      body.algorithm,
      limiterName:    body.limiterName,
      limiterLimit:   body.limiterLimit,
      limiterWindowMs: body.limiterWindowMs,
      responseTimeMs: body.responseTimeMs,
      statusCode:     body.statusCode,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
