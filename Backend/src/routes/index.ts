import { Router } from 'express';
import { pingController } from '../controllers/simulator.controller';
import limitRouter    from './limit.routes';
import trackRouter    from './track.routes';
import statsRouter    from './stats.routes';
import simulateRouter from './simulate.routes';
import analyticsRouter from './analytics.routes';
import sseRouter      from './sse.routes';       

const rootRouter = Router();

// Health
rootRouter.get('/ping', pingController);

// Feature routers
rootRouter.use('/check-limit', limitRouter);
rootRouter.use('/track',       trackRouter);
rootRouter.use('/stats',       statsRouter);
rootRouter.use('/simulate',    simulateRouter);
rootRouter.use('/analytics',   analyticsRouter);
rootRouter.use('/sse',         sseRouter);          

export default rootRouter;