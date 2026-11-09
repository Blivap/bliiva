import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KnowledgeStatus } from '../../common/enums/index.js';
import {
  SupportKnowledge,
  SupportKnowledgeDocument,
} from './schemas/knowledge.schema.js';

@Injectable()
export class KnowledgeRepository {
  constructor(
    @InjectModel(SupportKnowledge.name)
    private readonly model: Model<SupportKnowledgeDocument>,
  ) {}

  create(data: Partial<SupportKnowledge>) {
    return this.model.create(data);
  }

  findById(id: string) {
    return this.model.findById(id).exec();
  }

  findPublishedByIntent(intent: string, language = 'en') {
    return this.model
      .find({
        intent,
        language,
        status: KnowledgeStatus.Published,
      })
      .lean()
      .exec();
  }

  findAllPublished(language = 'en') {
    return this.model
      .find({ status: KnowledgeStatus.Published, language })
      .lean()
      .exec();
  }

  findAll() {
    return this.model.find().lean().exec();
  }

  updateById(id: string, patch: Partial<SupportKnowledge>) {
    return this.model
      .findByIdAndUpdate(id, { $set: patch }, { new: true })
      .exec();
  }

  findPaginated(filter: Record<string, unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return Promise.all([
      this.model
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
  }
}
