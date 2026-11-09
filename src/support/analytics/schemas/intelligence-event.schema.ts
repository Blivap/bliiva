import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';

export type SupportIntelligenceEventDocument =
  HydratedDocument<SupportIntelligenceEvent>;

@Schema({
  collection: SUPPORT_COLLECTIONS.intelligenceEvents,
  timestamps: { createdAt: true, updatedAt: false },
})
export class SupportIntelligenceEvent {
  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  outcome: string;

  @Prop({ type: String, default: null, index: true })
  category: string | null;

  @Prop({ type: String, default: null, index: true })
  intent: string | null;

  @Prop({ type: Number, default: null })
  confidence: number | null;

  @Prop({ type: Number, required: true })
  latencyMs: number;

  @Prop({ type: SchemaTypes.ObjectId, default: null })
  knowledgeId: Types.ObjectId | null;

  @Prop({ type: Boolean, default: false, index: true })
  recognized: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  unrecognized: boolean;

  @Prop({ type: Boolean, default: false })
  clarification: boolean;

  @Prop({ type: Boolean, default: false })
  resolved: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  escalated: boolean;

  @Prop({ type: Boolean, default: false })
  lowScore: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  unresolved: boolean;

  @Prop({ type: String, default: null })
  questionExcerpt: string | null;
}

export const SupportIntelligenceEventSchema = SchemaFactory.createForClass(
  SupportIntelligenceEvent,
);

SupportIntelligenceEventSchema.index({ createdAt: -1 });
SupportIntelligenceEventSchema.index({ category: 1, createdAt: -1 });
SupportIntelligenceEventSchema.index({ unresolved: 1, createdAt: -1 });
SupportIntelligenceEventSchema.index({ lowScore: 1, knowledgeId: 1 });
