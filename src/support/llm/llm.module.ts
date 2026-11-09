import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { AiSettingsService } from '../ai/ai-settings.service.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { RagModule } from '../rag/rag.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { LlmMetricsService } from './analytics/llm-metrics.service.js';
import { LlmAdminController } from './llm.admin.controller.js';
import { createLlmProvider } from './llm.factory.js';
import { LLM_PROVIDER } from './llm.interface.js';
import { LlmService } from './llm.service.js';

@Module({
  imports: [AiModule, RagModule, ToolsModule, AnalyticsModule],
  controllers: [LlmAdminController],
  providers: [
    LlmMetricsService,
    LlmService,
    {
      provide: LLM_PROVIDER,
      useFactory: createLlmProvider,
      inject: [AiSettingsService],
    },
  ],
  exports: [LlmService, LlmMetricsService, LLM_PROVIDER, AiModule],
})
export class LlmModule {}
