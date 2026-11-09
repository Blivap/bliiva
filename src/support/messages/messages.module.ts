import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagesRepository } from './messages.repository.js';
import {
  SupportMessage,
  SupportMessageSchema,
} from './schemas/message.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportMessage.name, schema: SupportMessageSchema },
    ]),
  ],
  providers: [MessagesRepository],
  exports: [MessagesRepository, MongooseModule],
})
export class MessagesModule {}
