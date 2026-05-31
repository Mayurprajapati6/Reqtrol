import { Router } from 'express';
import {
  overviewController, timelineController, heatmapController, endpointHeatmapController,
  sourceTimelineController,
  endpointsController, usersController, userSummaryController,
  blockedController, liveFeedController, limitsConfigController, limitersController,
  redisHealthController,
  snapshotController,
  blockedTimelineController, endpointAbuseHeatmapController,
  blockedStatsController, richBlockedController,
  historicalRequestsController,
} from '../controllers/stats.controller';

const statsRouter = Router();
statsRouter.get('/overview',               overviewController);
statsRouter.get('/timeline',               timelineController);
statsRouter.get('/sources',                sourceTimelineController);
statsRouter.get('/heatmap',                heatmapController);
statsRouter.get('/endpoints/heatmap',      endpointHeatmapController);
statsRouter.get('/endpoints',              endpointsController);
statsRouter.get('/users',                  usersController);
statsRouter.get('/limiters',               limitersController);
statsRouter.get('/users/summary',          userSummaryController);
statsRouter.get('/blocked',                blockedController);
statsRouter.get('/blocked/rich',           richBlockedController);
statsRouter.get('/blocked/timeline',       blockedTimelineController);
statsRouter.get('/blocked/stats',          blockedStatsController);
statsRouter.get('/blocked/endpoint-heatmap', endpointAbuseHeatmapController);
statsRouter.get('/live',                   liveFeedController);
statsRouter.get('/requests',               historicalRequestsController);
statsRouter.get('/limits-config',          limitsConfigController);
statsRouter.get('/snapshot',               snapshotController);
statsRouter.get('/redis-health',           redisHealthController);
export default statsRouter;
