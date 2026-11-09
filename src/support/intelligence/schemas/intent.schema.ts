import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';
import { IntentSensitivity } from '../../../common/enums/index.js';

export type SupportIntentDocument = HydratedDocument<SupportIntent>;

@Schema({
  collection: SUPPORT_COLLECTIONS.intents,
  timestamps: true,
})
export class SupportIntent {
  @Prop({ type: String, required: true, unique: true })
  name: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: String, required: true, index: true })
  category: string;

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop({ type: [String], default: [] })
  phrases: string[];

  @Prop({ type: [String], default: [] })
  synonyms: string[];

  @Prop({ type: [String], default: [] })
  examples: string[];

  @Prop({ type: [String], default: [] })
  negativeKeywords: string[];

  @Prop({ type: Number, default: 0 })
  priority: number;

  @Prop({ type: Number, default: null, min: 0, max: 1 })
  confidenceThreshold: number | null;

  @Prop({ type: String, default: '' })
  clarificationLabel: string;

  @Prop({ type: Boolean, default: true, index: true })
  enabled: boolean;

  @Prop({
    type: String,
    enum: Object.values(IntentSensitivity),
    default: IntentSensitivity.Low,
  })
  sensitivity: IntentSensitivity;

  @Prop({ type: Boolean, default: false })
  requiresAuthentication: boolean;

  @Prop({ type: String, default: 'clarify_then_escalate' })
  escalationPolicy: string;
}

export const SupportIntentSchema = SchemaFactory.createForClass(SupportIntent);

SupportIntentSchema.index({ enabled: 1, category: 1 });
SupportIntentSchema.index({ keywords: 1 });
