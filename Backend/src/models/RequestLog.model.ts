import mongoose, { Document, Schema } from 'mongoose';

export interface IRequestLog extends Document {
  analyticsId:   string;
  requestId:     string;
  fingerprint:   string;
  trackedAt:     Date;
  userId:        string;
  userName:      string;
  avatarUrl:     string;
  endpoint:      string;
  action:        string;
  method:        string;
  ip:            string;
  userAgent:     string;
  allowed:       boolean;
  reason:        string | null;
  limit:         number;
  remaining:     number;
  resetIn:       number;
  service:       string;
  source:        string;
  algorithm:     string;
  limiterName:   string;
  limiterLimit:  number;
  limiterWindowMs: number;
  responseTimeMs: number;
  statusCode:    number;
  windowKey:     string;
  timestamp:     Date;
}

const RequestLogSchema = new Schema<IRequestLog>(
  {
    requestId:      { type: String, default: '' },
    analyticsId:    { type: String, required: true },
    fingerprint:    { type: String, required: true },
    trackedAt:      { type: Date, default: Date.now },
    userId:         { type: String, required: true },
    userName:       { type: String, default: '' },
    avatarUrl:      { type: String, default: '' },
    endpoint:       { type: String, required: true },
    action:         { type: String, default: 'unknown' },
    method:         { type: String, default: 'POST' },
    ip:             { type: String, default: 'unknown' },
    userAgent:      { type: String, default: 'unknown' },
    allowed:        { type: Boolean, required: true },
    reason:         { type: String, default: null },
    limit:          { type: Number, default: 0 },
    remaining:      { type: Number, default: 0 },
    resetIn:        { type: Number, default: 0 },
    service:        { type: String, default: 'quby' },
    source:         { type: String, enum: ['quby', 'simulator'], default: 'quby' },
    algorithm:      { type: String, default: 'fixed-window' },
    limiterName:    { type: String, default: '' },
    limiterLimit:   { type: Number, default: 0 },
    limiterWindowMs:{ type: Number, default: 0 },
    responseTimeMs: { type: Number, default: 0 },
    statusCode:    { type: Number, default: 200 },
    windowKey:      { type: String, default: '' },
    timestamp:      { type: Date, default: Date.now },
  },
  { versionKey: false, timestamps: false }
);

RequestLogSchema.index({ timestamp: -1 });
RequestLogSchema.index({ userId: 1, timestamp: -1 });
RequestLogSchema.index({ endpoint: 1, timestamp: -1 });
RequestLogSchema.index({ allowed: 1, timestamp: -1 });
RequestLogSchema.index({ service: 1, timestamp: -1 });
RequestLogSchema.index({ source: 1, timestamp: -1 });
RequestLogSchema.index({ limiterName: 1, timestamp: -1 });
RequestLogSchema.index({ analyticsId: 1 }, { unique: true });
RequestLogSchema.index({ fingerprint: 1 }, { unique: true });
RequestLogSchema.index(
  { requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $type: 'string', $gt: '' } } }
);

// Auto-delete after 30 days
RequestLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const RequestLog = mongoose.model<IRequestLog>('RequestLog', RequestLogSchema);
export default RequestLog;
