import { Request, Response, NextFunction } from 'express';
import AnalyticsService from '../services/analytics.service';
import logger from '../config/logger';
import { globalQuery, normalizeSource } from '../utils/analytics';

export async function getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const windowDays = Number(req.query.days ?? 7);
    const data = await AnalyticsService.getOverview(globalQuery(normalizeSource(req.query.source)));
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getEndpointAggregation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const windowDays = Number(req.query.days ?? 7);
    void windowDays;
    const data = await AnalyticsService.getEndpoints(globalQuery(normalizeSource(req.query.source)));
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getUserAggregation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const windowDays = Number(req.query.days ?? 7);
    const limit      = Number(req.query.limit ?? 50);
    void windowDays;
    const data = await AnalyticsService.getUsers(globalQuery(normalizeSource(req.query.source)), limit);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getRedisMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await AnalyticsService.getRedisHealth();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getLimiterHits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const windowDays = Number(req.query.days ?? 7);
    void windowDays;
    const data = await AnalyticsService.getEndpoints(globalQuery(normalizeSource(req.query.source)));
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
