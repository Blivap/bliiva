import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';

export type SupportAssignmentDocument = HydratedDocument<SupportAssignment>;

@Schema({
  collection: SUPPORT_COLLECTIONS.assignments,
  timestamps: true,
})
export class SupportAssignment {
  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  ticketId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  agentId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, default: null })
  assignedBy: Types.ObjectId | null;

  @Prop({ type: String, default: 'auto' })
  method: string;

  @Prop({ type: Date, default: Date.now })
  assignedAt: Date;

  @Prop({ type: Date, default: null })
  unassignedAt: Date | null;

  @Prop({ type: String, default: null })
  note: string | null;
}

export const SupportAssignmentSchema =
  SchemaFactory.createForClass(SupportAssignment);

SupportAssignmentSchema.index({ ticketId: 1, assignedAt: -1 });
SupportAssignmentSchema.index({ agentId: 1, unassignedAt: 1 });
