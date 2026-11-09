import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SupportMessage,
  SupportMessageDocument,
} from './schemas/message.schema.js';

@Injectable()
export class MessagesRepository {
  constructor(
    @InjectModel(SupportMessage.name)
    private readonly model: Model<SupportMessageDocument>,
  ) {}

  create(data: Partial<SupportMessage>) {
    return this.model.create(data);
  }

  findRecent(conversationId: string | Types.ObjectId, limit: number) {
    return this.model
      .find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  findByConversation(
    conversationId: string | Types.ObjectId,
    page: number,
    limit: number,
  ) {
    const filter = { conversationId };
    const skip = (page - 1) * limit;
    return Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
  }
}
