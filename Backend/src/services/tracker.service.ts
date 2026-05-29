import { RequestLogRepository } from '../repositories/requestLog.repository';
import { sseEmitter }           from './sse.emitter';
import logger from '../config/logger';
import { getLimiterMetadata } from '../modules/analytics/config/limiterRegistry';
import { normalizeAction, normalizeEndpoint, normalizeSourceValue } from '../modules/analytics/utils/normalizeEndpoint';

export type TrackInput = {
  requestId?:     string;
  analyticsId?:   string;
  fingerprint?:   string;
  trackedAt?:     string;
  userId:         string;
  userName?:      string;
  avatarUrl?:     string;
  endpoint:       string;
  action:         string;
  method:         string;
  ip:             string;
  userAgent?:     string;
  allowed:        boolean;
  reason:         string | null;
  limit:          number;
  remaining:      number;
  resetIn:        number;
  service:        string;
  source?:        string;
  algorithm:      string;
  limiterName?:   string;
  limiterLimit?:  number;
  limiterWindowMs?: number;
  responseTimeMs: number;
  statusCode?:    number;
};

export type TrackOutput = { tracked: boolean };

const TrackerService = {
  async track(input: TrackInput): Promise<TrackOutput> {
    const endpoint = normalizeEndpoint(input.endpoint);
    const source = normalizeSourceValue(input.source, input.service);
    const metadata = getLimiterMetadata(endpoint);
    const limiterName = input.limiterName?.trim() || metadata.limiterName;
    const action = normalizeAction(endpoint, input.action);
    const trackedAt = input.trackedAt ? new Date(input.trackedAt) : new Date();

    const doc = await RequestLogRepository.create({
      analyticsId:    input.analyticsId,
      requestId:      input.requestId     ?? '',
      fingerprint:    input.fingerprint,
      trackedAt,
      userId:         input.userId,
      userName:       input.userName      ?? '',
      avatarUrl:      input.avatarUrl     ?? '',
      endpoint,
      action,
      method:         input.method,
      ip:             input.ip,
      userAgent:      input.userAgent     ?? 'unknown',
      allowed:        input.allowed,
      reason:         input.reason,
      limit:          input.limit,
      remaining:      input.remaining,
      resetIn:        input.resetIn,
      service:        input.service,
      source,
      algorithm:      input.algorithm,
      limiterName,
      limiterLimit:   input.limiterLimit ?? metadata.limit,
      limiterWindowMs: input.limiterWindowMs ?? metadata.windowMs,
      responseTimeMs: input.responseTimeMs,
      statusCode:     input.statusCode,
      windowKey:      '',
      timestamp:      trackedAt,
    });

    logger.info(
      `[TrackerService] tracked userId=${input.userId} endpoint=${input.endpoint} ` +
      `allowed=${input.allowed} limiter=${input.limiterName ?? '—'} service=${input.service}`,
    );

    // Push to SSE clients immediately after DB write —
    // shape matches LiveEvent in the frontend API client
    sseEmitter.emit('event', {
      _id:           doc.id,
      userId:        input.userId,
      userName:      input.userName      ?? '',
      avatarUrl:     input.avatarUrl     ?? '',
      endpoint,
      method:        input.method,
      allowed:       input.allowed,
      reason:        input.reason,
      ip:            input.ip,
      responseTimeMs: input.responseTimeMs,
      source,
      limiterName,
      limit:         input.limit,
      remaining:     input.remaining,
      timestamp:     trackedAt.toISOString(),
    });

    return { tracked: true };
  },
};

export default TrackerService;
