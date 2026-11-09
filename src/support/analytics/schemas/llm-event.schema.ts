import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';

export type SupportLlmEventDocument = HydratedDocument<SupportLlmEvent>;

@Schema({
  collection: SUPPORT_COLLECTIONS.llmEvents,
  timestamps: { createdAt: true, updatedAt: false },
})
export class SupportLlmEvent {
  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  outcome: string;

  @Prop({ type: String, default: null })
  modelName: string | null;

  @Prop({ type: Number, required: true })
  latencyMs: number;

  @Prop({ type: Number, default: null })
  promptTokens: number | null;

  @Prop({ type: Number, default: null })
  completionTokens: number | null;

  @Prop({ type: Number, default: 0 })
  toolCalls: number;

  @Prop({ type: Number, default: 0 })
  retrievalDurationMs: number;

  @Prop({ type: Number, default: null })
  retrievalTopScore: number | null;

  @Prop({ type: [String], default: [] })
  knowledgeDocumentIds: string[];

  @Prop({ type: Boolean, default: false, index: true })
  escalated: boolean;

  @Prop({ type: Boolean, default: false })
  unavailable: boolean;

  @Prop({ type: String, default: null })
  errorCode: string | null;
}

export const SupportLlmEventSchema =
  SchemaFactory.createForClass(SupportLlmEvent);

SupportLlmEventSchema.index({ createdAt: -1 });
SupportLlmEventSchema.index({ outcome: 1, createdAt: -1 });
