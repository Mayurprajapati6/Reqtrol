import { Router, type Request, type Response } from 'express';
import { sseEmitter } from '../services/sse.emitter';

const sseRouter = Router();

sseRouter.get('/live-feed', (req: Request, res: Response) => {

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); 
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25_000);

  const onEvent = (data: unknown) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      // client disconnected mid-write — cleanup below handles it
    }
  };
  sseEmitter.on('event', onEvent);

 
  req.on('close', () => {
    clearInterval(heartbeat);
    sseEmitter.off('event', onEvent);
  });
});

export default sseRouter;