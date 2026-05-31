import { z } from 'zod';

export const checkLimitSchema = z.object({
  requestId: z.string().optional(),
  userId:    z.string().min(1, 'userId is required'),
  userName:  z.string().optional().default(''),
  avatarUrl: z.string().optional().default(''),
  endpoint:  z.string().min(1, 'endpoint is required'),
  action:    z.string().optional().default('unknown'),
  method:    z.string().optional().default('GET'),
  ip:        z.string().optional().default('unknown'),
  userAgent: z.string().optional().default('unknown'),
  timestamp: z.number().optional(),
  service:   z.string().optional().default('quby'),
  source:    z.string().optional().default('quby'),
});

export type CheckLimitBody = z.infer<typeof checkLimitSchema>;

export const trackSchema = z.object({
  requestId:      z.string().optional(),
  analyticsId:    z.string().optional(),
  fingerprint:    z.string().optional(),
  trackedAt:      z.string().optional(),
  userId:         z.string().min(1, 'userId is required'),
  userName:       z.string().optional().default(''),
  avatarUrl:      z.string().optional().default(''),
  endpoint:       z.string().min(1, 'endpoint is required'),
  action:         z.string().optional().default('unknown'),
  method:         z.string().optional().default('GET'),
  ip:             z.string().optional().default('unknown'),
  userAgent:      z.string().optional().default('unknown'),
  allowed:        z.boolean(),
  reason:         z.string().nullable().optional().default(null),
  limit:          z.number().optional().default(0),
  remaining:      z.number().optional().default(0),
  resetIn:        z.number().optional().default(0),
  service:        z.string().optional().default('quby'),
  source:         z.string().optional().default('quby'),
  algorithm:      z.string().optional().default('fixed-window'),
  limiterName:    z.string().optional().default(''),
  limiterLimit:   z.number().optional(),
  limiterWindowMs:z.number().optional(),
  responseTimeMs: z.number().optional().default(0),
  statusCode:     z.number().int().optional().default(200),
  timestamp:      z.number().optional(),
});

export type TrackBody = z.infer<typeof trackSchema>;

export const simulateSchema = z.object({
  userId:   z.string().min(1).default('sim-user'),
  endpoint: z.string().min(1).default('/payment/order'),
  count:    z.number().int().min(1).max(100).default(20),
  delayMs:  z.number().int().min(0).max(5000).default(50),
});

export type SimulateBody = z.infer<typeof simulateSchema>;

export const windowQuerySchema = z.object({
  window: z.coerce.number().int().min(1).max(10080).default(30),
  source: z.enum(['all', 'quby', 'simulator']).default('all'),
});

export const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(2000).default(50),
  source: z.enum(['all', 'quby', 'simulator']).default('all'),
});

export const historicalRequestsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  source: z.enum(['all', 'quby', 'simulator']).default('all'),
});

export const usersQuerySchema = z.object({
  window: z.coerce.number().int().min(1).max(10080).default(30),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  source: z.enum(['all', 'quby', 'simulator']).default('all'),
});
