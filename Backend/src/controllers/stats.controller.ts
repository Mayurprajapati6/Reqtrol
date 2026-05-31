import type { Request, Response, NextFunction } from 'express';
import { windowQuerySchema, limitQuerySchema, usersQuerySchema, historicalRequestsQuerySchema } from '../validators';
import AnalyticsService, { BlockedAnalyticsService } from '../services/analytics.service';
import { globalQuery, windowQuery, normalizeSource } from '../utils/analytics';

export const overviewController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { const { window, source } = windowQuerySchema.parse(req.query); res.json({ success: true, data: await AnalyticsService.getOverview(windowQuery(window, source)) }); }
  catch (err) { next(err); }
};
export const timelineController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { const { window, source } = windowQuerySchema.parse(req.query); res.json({ success: true, data: await AnalyticsService.getTimeline(windowQuery(window, source)) }); }
  catch (err) { next(err); }
};
export const sourceTimelineController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const days = Number(req.query.days) || 7;
    res.json({ success: true, data: await AnalyticsService.getSourceTimeline(days, normalizeSource(req.query.source)) });
  }
  catch (err) { next(err); }
};
export const heatmapController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { res.json({ success: true, data: await AnalyticsService.getHeatmap(7, normalizeSource(req.query.source)) }); }
  catch (err) { next(err); }
};
export const endpointHeatmapController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { res.json({ success: true, data: await AnalyticsService.getEndpointHeatmap(normalizeSource(req.query.source)) }); }
  catch (err) { next(err); }
};
export const endpointsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const source = normalizeSource(req.query.source);
    const scope = req.query.scope === 'global' ? globalQuery(source) : windowQuery(windowQuerySchema.parse(req.query).window, source);
    res.json({ success: true, data: await AnalyticsService.getEndpoints(scope) });
  }
  catch (err) { next(err); }
};
export const usersController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { window, limit, source } = usersQuerySchema.parse(req.query);
    const scope = req.query.scope === 'global' ? globalQuery(source) : windowQuery(window, source);
    res.json({ success: true, data: await AnalyticsService.getUsers(scope, limit) });
  }
  catch (err) { next(err); }
};
export const limitersController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const source = normalizeSource(req.query.source);
    res.json({ success: true, data: await AnalyticsService.getLimiters(globalQuery(source)) });
  }
  catch (err) { next(err); }
};
export const userSummaryController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { window, source } = windowQuerySchema.parse(req.query);
    const scope = req.query.scope === 'global' ? globalQuery(source) : windowQuery(window, source);
    res.json({ success: true, data: await AnalyticsService.getUserSummary(scope) });
  }
  catch (err) { next(err); }
};
export const blockedController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { const { limit, source } = limitQuerySchema.parse(req.query); res.json({ success: true, data: await AnalyticsService.getRecentBlocked(limit, source) }); }
  catch (err) { next(err); }
};
export const liveFeedController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { const { limit, source } = limitQuerySchema.parse(req.query); res.json({ success: true, data: await AnalyticsService.getLiveFeed(limit, source) }); }
  catch (err) { next(err); }
};
export const historicalRequestsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { date, page, limit, source } = historicalRequestsQuerySchema.parse(req.query);
    res.json({ success: true, data: await AnalyticsService.getHistoricalRequests(date, page, limit, source) });
  }
  catch (err) { next(err); }
};
export const limitsConfigController = (_req: Request, res: Response, next: NextFunction): void => {
  try { res.json({ success: true, data: AnalyticsService.getLimitsConfig() }); }
  catch (err) { next(err); }
};
export const snapshotController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { res.json({ success: true, data: await AnalyticsService.getSnapshot(normalizeSource(req.query.source)) }); }
  catch (err) { next(err); }
};
export const redisHealthController = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { res.json({ success: true, data: await AnalyticsService.getRedisHealth() }); }
  catch (err) { next(err); }
};

export const blockedTimelineController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { const { window, source } = windowQuerySchema.parse(req.query); res.json({ success: true, data: await BlockedAnalyticsService.getBlockedTimeline(windowQuery(window, source)) }); }
  catch (err) { next(err); }
};
export const endpointAbuseHeatmapController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hours = Number(req.query.hours) || 6;
    res.json({ success: true, data: await BlockedAnalyticsService.getEndpointAbuseHeatmap(hours, normalizeSource(req.query.source)) });
  }
  catch (err) { next(err); }
};
export const blockedStatsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { const { window, source } = windowQuerySchema.parse(req.query); res.json({ success: true, data: await BlockedAnalyticsService.getBlockedStats(windowQuery(window, source)) }); }
  catch (err) { next(err); }
};
export const richBlockedController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { const { limit, source } = limitQuerySchema.parse(req.query); res.json({ success: true, data: await BlockedAnalyticsService.getRichBlocked(limit, source) }); }
  catch (err) { next(err); }
};
