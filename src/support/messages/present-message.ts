import { toIdString } from '../../common/auth/to-id-string.js';
import { MessageSenderType, MessageType } from '../../common/enums/index.js';
import { isStaff, type SupportActor } from '../../common/auth/support-actor.js';

export interface StoredMessage {
  _id?: unknown;
  id?: unknown;
  senderType: MessageSenderType;
  content: string;
  messageType?: MessageType;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface PublicMessage {
  id: string;
  senderType: MessageSenderType;
  content: string;
  messageType: MessageType;
  createdAt: Date | null;
  metadata?: Record<string, unknown>;
}

export function presentMessage(
  message: StoredMessage,
  actor: SupportActor,
): PublicMessage {
  const id = message._id ?? message.id;
  const presented: PublicMessage = {
    id: toIdString(id),
    senderType: message.senderType,
    content: message.content,
    messageType: message.messageType ?? MessageType.Text,
    createdAt: message.createdAt ?? null,
  };
  if (isStaff(actor) && message.metadata) {
    presented.metadata = message.metadata;
  }
  return presented;
}
