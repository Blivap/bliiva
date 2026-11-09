import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SupportIntent,
  SupportIntentDocument,
} from './schemas/intent.schema.js';

@Injectable()
export class IntentRepository {
  constructor(
    @InjectModel(SupportIntent.name)
    private readonly model: Model<SupportIntentDocument>,
  ) {}

  create(data: Partial<SupportIntent>) {
    return this.model.create(data);
  }

  findEnabled() {
    return this.model.find({ enabled: true }).lean().exec();
  }

  findByName(name: string) {
    return this.model.findOne({ name }).lean().exec();
  }

  findPaginated(filter: Record<string, unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return Promise.all([
      this.model
        .find(filter)
        .sort({ priority: -1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
  }

  updateByName(name: string, patch: Partial<SupportIntent>) {
    return this.model
      .findOneAndUpdate({ name }, { $set: patch }, { new: true })
      .lean()
      .exec();
  }
}
