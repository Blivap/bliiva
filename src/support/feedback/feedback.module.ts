import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FeedbackRepository } from './feedback.repository.js';
import {
  SupportFeedback,
  SupportFeedbackSchema,
} from './schemas/feedback.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportFeedback.name, schema: SupportFeedbackSchema },
    ]),
  ],
  providers: [FeedbackRepository],
  exports: [FeedbackRepository, MongooseModule],
})
export class FeedbackModule {}
