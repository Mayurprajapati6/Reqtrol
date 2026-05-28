import { Schema, model, Document } from 'mongoose';

export interface IAnalyticsLog extends Document {
  userId:       string;
  endpoint:     string;
  method:       string;
  allowed:      boolean;
  reason:       string | null;
  responseMs:   number;
  source:       'quby' | 'simulator';
  ip:           string;
  limiterKey:   string;    // Redis key pattern used
  remaining:    number;    // Remaining requests in window
  resetIn:      number;    // Seconds until window resets
  timestamp:    Date;
}

const AnalyticsLogSchema = new Schema<IAnalyticsLog>(
  {
    userId:    { type: String, required: true, index: true },
    endpoint:  { type: String, required: true, index: true },
    method:    { type: String, required: true },
    allowed:   { type: Boolean, required: true, index: true },
    reason:    { type: String, default: null },
    responseMs: { type: Number, default: 0 },
    source:    { type: String, enum: ['quby', 'simulator'], default: 'quby' },
    ip:        { type: String, default: '' },
    limiterKey:{ type: String, default: '' },
    remaining: { type: Number, default: 0 },
    resetIn:   { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { collection: 'analytics_logs', timestamps: false },
);

// Compound indexes for common query patterns
AnalyticsLogSchema.index({ timestamp: -1, allowed: 1 });
AnalyticsLogSchema.index({ endpoint: 1, timestamp: -1 });
AnalyticsLogSchema.index({ userId: 1, timestamp: -1 });

export const AnalyticsLog = model<IAnalyticsLog>('AnalyticsLog', AnalyticsLogSchema);
