import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationsRepository } from './conversations.repository.js';
import {
  SupportConversation,
  SupportConversationSchema,
} from './schemas/conversation.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportConversation.name, schema: SupportConversationSchema },
    ]),
  ],
  providers: [ConversationsRepository],
  exports: [ConversationsRepository, MongooseModule],
})
export class ConversationsModule {}
