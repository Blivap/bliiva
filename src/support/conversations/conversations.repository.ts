import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SupportConversation,
  SupportConversationDocument,
} from './schemas/conversation.schema.js';

@Injectable()
export class ConversationsRepository {
  constructor(
    @InjectModel(SupportConversation.name)
    private readonly model: Model<SupportConversationDocument>,
  ) {}

  create(data: Partial<SupportConversation>) {
    return this.model.create(data);
  }

  findById(id: string | Types.ObjectId) {
    return this.model.findById(id).exec();
  }

  updateById(id: string | Types.ObjectId, patch: Partial<SupportConversation>) {
    return this.model
      .findByIdAndUpdate(id, { $set: patch }, { new: true })
      .exec();
  }

  findPaginated(filter: Record<string, unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return Promise.all([
      this.model
        .find(filter)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
  }
}
