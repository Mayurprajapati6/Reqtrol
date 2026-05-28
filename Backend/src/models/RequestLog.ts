import mongoose, { Document, Schema } from 'mongoose';

export interface IRequestLog extends Document {
  userId: string;
  endpoint: string;
  action: string;
  method: string;
  ip: string;
  allowed: boolean;
  reason: string | null;
  limit: number;
  remaining: number;
  resetIn: number;
  service: string;
  algorithm: string;
  responseTimeMs: number;
  timestamp: Date;
  windowKey: string;
}

const RequestLogSchema = new Schema<IRequestLog>(
  {
    userId: { type: String, required: true, index: true },
    endpoint: { type: String, required: true, index: true },
    action: { type: String, required: true },
    method: { type: String, default: 'POST' },
    ip: { type: String, default: 'unknown' },
    allowed: { type: Boolean, required: true, index: true },
    reason: { type: String, default: null },
    limit: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 },
    resetIn: { type: Number, default: 0 },
    service: { type: String, default: 'quby', index: true },
    algorithm: { type: String, default: 'fixed-window' },
    responseTimeMs: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now, index: true },
    windowKey: { type: String, default: '' },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

// Compound indexes for analytics queries
RequestLogSchema.index({ timestamp: -1, allowed: 1 });
RequestLogSchema.index({ userId: 1, timestamp: -1 });
RequestLogSchema.index({ endpoint: 1, timestamp: -1 });
RequestLogSchema.index({ timestamp: -1, service: 1 });

// TTL: auto-delete logs older than 30 days
RequestLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const RequestLog = mongoose.model<IRequestLog>('RequestLog', RequestLogSchema);
export default RequestLog;
