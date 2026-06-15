import { Router } from 'express';
import { checkLimitController, flushKeysController } from '../controllers/limit.controller';

const limitRouter = Router();

limitRouter.post('/', checkLimitController);
limitRouter.post('/flush', flushKeysController);

export default limitRouter;
