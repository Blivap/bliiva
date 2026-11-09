import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsRepository } from './analytics.repository.js';
import { AnalyticsService } from './analytics.service.js';
import {
  SupportIntelligenceEvent,
  SupportIntelligenceEventSchema,
} from './schemas/intelligence-event.schema.js';
import {
  SupportLlmEvent,
  SupportLlmEventSchema,
} from './schemas/llm-event.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: SupportIntelligenceEvent.name,
        schema: SupportIntelligenceEventSchema,
      },
      {
        name: SupportLlmEvent.name,
        schema: SupportLlmEventSchema,
      },
    ]),
  ],
  providers: [AnalyticsRepository, AnalyticsService],
  exports: [AnalyticsService, AnalyticsRepository],
})
export class AnalyticsModule {}
