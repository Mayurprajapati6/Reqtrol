import { Router } from 'express';
import {
  getSummary,
  getEndpointAggregation,
  getUserAggregation,
  getRedisMetrics,
  getLimiterHits,
} from '../controllers/analytics.controller';

const router = Router();

router.get('/summary', getSummary);

router.get('/endpoints', getEndpointAggregation);

router.get('/users', getUserAggregation);

router.get('/redis', getRedisMetrics);

router.get('/limiter-hits', getLimiterHits);

export default router;
