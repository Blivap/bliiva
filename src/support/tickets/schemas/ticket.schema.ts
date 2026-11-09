import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';
import { Priority, TicketStatus } from '../../../common/enums/index.js';

export type SupportTicketDocument = HydratedDocument<SupportTicket>;

@Schema({
  collection: SUPPORT_COLLECTIONS.tickets,
  timestamps: true,
})
export class SupportTicket {
  @Prop({ type: String, required: true, unique: true })
  ticketNumber: string;

  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, default: null, index: true })
  userId: Types.ObjectId | null;

  @Prop({ type: String, required: true, index: true })
  category: string;

  @Prop({ type: String, required: true })
  subject: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({
    type: String,
    enum: Object.values(Priority),
    default: Priority.Medium,
  })
  priority: Priority;

  @Prop({
    type: String,
    enum: Object.values(TicketStatus),
    default: TicketStatus.Open,
    index: true,
  })
  status: TicketStatus;

  @Prop({ type: SchemaTypes.ObjectId, default: null, index: true })
  assignedAgentId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  resolution: string | null;

  @Prop({ type: String, default: null })
  escalationReason: string | null;

  @Prop({ type: Date, default: null })
  resolvedAt: Date | null;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);

SupportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
SupportTicketSchema.index(
  { conversationId: 1, category: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          TicketStatus.Open,
          TicketStatus.Assigned,
          TicketStatus.InProgress,
          TicketStatus.WaitingForUser,
        ],
      },
    },
  },
);
