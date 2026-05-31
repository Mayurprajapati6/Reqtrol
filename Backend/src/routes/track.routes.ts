import { Router } from 'express';
import { trackController } from '../controllers/track.controller';

const trackRouter = Router();

trackRouter.post('/', trackController);

export default trackRouter;
