import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { RagModule } from '../rag/rag.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { SupportAgentService } from './support-agent.service.js';

@Module({
  imports: [AiModule, KnowledgeModule, LlmModule, RagModule, ToolsModule],
  providers: [SupportAgentService],
  exports: [SupportAgentService, LlmModule, RagModule, ToolsModule],
})
export class AgentModule {}
