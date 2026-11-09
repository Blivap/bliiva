import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SupportFeedback,
  SupportFeedbackDocument,
} from './schemas/feedback.schema.js';

@Injectable()
export class FeedbackRepository {
  constructor(
    @InjectModel(SupportFeedback.name)
    private readonly model: Model<SupportFeedbackDocument>,
  ) {}

  create(data: Partial<SupportFeedback>) {
    return this.model.create(data);
  }
}
