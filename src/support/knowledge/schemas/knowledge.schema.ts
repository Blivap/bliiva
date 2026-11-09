import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';
import { KnowledgeStatus } from '../../../common/enums/index.js';

export type SupportKnowledgeDocument = HydratedDocument<SupportKnowledge>;

@Schema({
  collection: SUPPORT_COLLECTIONS.knowledge,
  timestamps: true,
})
export class SupportKnowledge {
  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true, index: true })
  category: string;

  @Prop({ type: String, required: true, index: true })
  intent: string;

  @Prop({ type: [String], default: [] })
  questions: string[];

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop({ type: [String], default: [] })
  synonyms: string[];

  @Prop({ type: [String], default: [] })
  phrases: string[];

  @Prop({ type: String, required: true })
  answer: string;

  @Prop({ type: Number, default: 0 })
  priority: number;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  @Prop({
    type: String,
    enum: Object.values(KnowledgeStatus),
    default: KnowledgeStatus.Draft,
    index: true,
  })
  status: KnowledgeStatus;

  @Prop({ type: Number, default: 1, min: 1 })
  version: number;

  @Prop({ type: Boolean, default: false })
  requiresAuthentication: boolean;

  @Prop({ type: Boolean, default: false })
  requiresHumanSupport: boolean;

  @Prop({ type: String, default: 'en' })
  language: string;

  @Prop({ type: SchemaTypes.ObjectId, default: null })
  createdBy: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, default: null })
  updatedBy: Types.ObjectId | null;
}

export const SupportKnowledgeSchema =
  SchemaFactory.createForClass(SupportKnowledge);

SupportKnowledgeSchema.index({ status: 1, category: 1 });
SupportKnowledgeSchema.index({ intent: 1, status: 1, language: 1 });
SupportKnowledgeSchema.index({ status: 1, language: 1, priority: -1 });
SupportKnowledgeSchema.index({ keywords: 1 });
