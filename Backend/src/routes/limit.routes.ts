import { Router } from 'express';
import { checkLimitController } from '../controllers/limit.controller';

const limitRouter = Router();

limitRouter.post('/', checkLimitController);

export default limitRouter;
