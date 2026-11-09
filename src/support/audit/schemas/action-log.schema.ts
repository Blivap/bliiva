import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';

export type SupportActionLogDocument = HydratedDocument<SupportActionLog>;

@Schema({
  collection: SUPPORT_COLLECTIONS.actionLogs,
  timestamps: { createdAt: true, updatedAt: false },
})
export class SupportActionLog {
  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, default: null, index: true })
  userId: Types.ObjectId | null;

  @Prop({ type: String, required: true, index: true })
  actionName: string;

  @Prop({ type: String, required: true })
  status: string;

  @Prop({ type: String, default: null })
  idempotencyKey: string | null;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  input: Record<string, unknown>;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  result: Record<string, unknown>;

  @Prop({ type: String, default: null })
  errorMessage: string | null;
}

export const SupportActionLogSchema =
  SchemaFactory.createForClass(SupportActionLog);

SupportActionLogSchema.index({ conversationId: 1, createdAt: -1 });
SupportActionLogSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);
