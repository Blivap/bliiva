import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';

export type SupportFeedbackDocument = HydratedDocument<SupportFeedback>;

@Schema({
  collection: SUPPORT_COLLECTIONS.feedback,
  timestamps: true,
})
export class SupportFeedback {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, default: null, index: true })
  ticketId: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, default: null, index: true })
  userId: Types.ObjectId | null;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: String, default: null })
  comment: string | null;

  @Prop({ type: Boolean, default: false })
  resolvedSatisfactorily: boolean;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata: Record<string, unknown>;
}

export const SupportFeedbackSchema =
  SchemaFactory.createForClass(SupportFeedback);

SupportFeedbackSchema.index({ conversationId: 1 }, { unique: true });
