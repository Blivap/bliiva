import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';
import { ConversationStatus, Priority } from '../../../common/enums/index.js';

export type SupportConversationDocument = HydratedDocument<SupportConversation>;

@Schema({
  collection: SUPPORT_COLLECTIONS.conversations,
  timestamps: true,
})
export class SupportConversation {
  @Prop({ type: SchemaTypes.ObjectId, default: null, index: true })
  userId: Types.ObjectId | null;

  @Prop({ type: String, default: null, index: true })
  guestSessionId: string | null;

  @Prop({
    type: String,
    enum: Object.values(ConversationStatus),
    default: ConversationStatus.Bot,
    index: true,
  })
  status: ConversationStatus;

  @Prop({ type: String, default: 'general', index: true })
  category: string;

  @Prop({ type: String, default: null })
  currentIntent: string | null;

  @Prop({ type: SchemaTypes.ObjectId, default: null, index: true })
  assignedAgentId: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: Object.values(Priority),
    default: Priority.Medium,
  })
  priority: Priority;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  context: Record<string, unknown>;

  @Prop({ type: Date, default: Date.now, index: true })
  lastMessageAt: Date;
}

export const SupportConversationSchema =
  SchemaFactory.createForClass(SupportConversation);

SupportConversationSchema.index({ status: 1, lastMessageAt: -1 });
SupportConversationSchema.index({ userId: 1, status: 1 });
SupportConversationSchema.index({ assignedAgentId: 1, status: 1 });
