import type { Request, Response, NextFunction } from 'express';
import { simulateSchema } from '../validators';
import SimulatorService from '../services/simulator.service';

export const simulateController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    
    const body = simulateSchema.parse(req.body);

    const data = await SimulatorService.run({
      userId:   body.userId,
      endpoint: body.endpoint,
      count:    body.count,
      delayMs:  body.delayMs,
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const pingController = (
  _req: Request,
  res: Response
): void => {
  res.status(200).json({
    success:   true,
    service:   'Reqtrol',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
  });
};
