import mongoose, { Document, Schema } from 'mongoose';
import type { AnalyticsSnapshotPayload } from '../modules/analytics/types/analytics.types';

export interface IAnalyticsSnapshot extends Document {
  key: string;
  source: string;
  payload: AnalyticsSnapshotPayload;
  createdAt: Date;
}

const AnalyticsSnapshotSchema = new Schema<IAnalyticsSnapshot>(
  {
    key: { type: String, required: true, unique: true, index: true },
    source: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false, timestamps: false },
);

AnalyticsSnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const AnalyticsSnapshot = mongoose.model<IAnalyticsSnapshot>('AnalyticsSnapshot', AnalyticsSnapshotSchema);
export default AnalyticsSnapshot;
