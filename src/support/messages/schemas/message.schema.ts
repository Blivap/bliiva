import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';
import { MessageSenderType, MessageType } from '../../../common/enums/index.js';

export type SupportMessageDocument = HydratedDocument<SupportMessage>;

@Schema({
  collection: SUPPORT_COLLECTIONS.messages,
  timestamps: { createdAt: true, updatedAt: false },
})
export class SupportMessage {
  @Prop({
    type: SchemaTypes.ObjectId,
    required: true,
    index: true,
  })
  conversationId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(MessageSenderType),
    required: true,
  })
  senderType: MessageSenderType;

  @Prop({ type: SchemaTypes.ObjectId, default: null })
  senderId: Types.ObjectId | null;

  @Prop({ type: String, required: true })
  content: string;

  @Prop({
    type: String,
    enum: Object.values(MessageType),
    default: MessageType.Text,
  })
  messageType: MessageType;

  @Prop({ type: String, default: null })
  intent: string | null;

  @Prop({ type: Number, default: null, min: 0, max: 1 })
  confidence: number | null;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata: Record<string, unknown>;
}

export const SupportMessageSchema =
  SchemaFactory.createForClass(SupportMessage);

SupportMessageSchema.index({ conversationId: 1, createdAt: -1 });
