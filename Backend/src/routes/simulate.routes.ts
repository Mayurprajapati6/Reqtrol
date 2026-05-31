import { Router } from 'express';
import { simulateController } from '../controllers/simulator.controller';

const simulateRouter = Router();

simulateRouter.post('/', simulateController);

export default simulateRouter;
