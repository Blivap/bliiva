import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';
import {
  AgentAvailability,
  SupportAgentRole,
} from '../../../common/enums/index.js';

export type SupportAgentDocument = HydratedDocument<SupportAgent>;

@Schema({
  collection: SUPPORT_COLLECTIONS.agents,
  timestamps: true,
})
export class SupportAgent {
  @Prop({ type: SchemaTypes.ObjectId, required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  displayName: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true })
  email: string;

  @Prop({
    type: String,
    enum: Object.values(SupportAgentRole),
    default: SupportAgentRole.Agent,
  })
  role: SupportAgentRole;

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({
    type: String,
    enum: Object.values(AgentAvailability),
    default: AgentAvailability.Offline,
    index: true,
  })
  availability: AgentAvailability;

  @Prop({ type: Number, default: 10, min: 1 })
  maxActiveTickets: number;

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;
}

export const SupportAgentSchema = SchemaFactory.createForClass(SupportAgent);

SupportAgentSchema.index({ availability: 1, isActive: 1 });
SupportAgentSchema.index({ skills: 1, isActive: 1 });
