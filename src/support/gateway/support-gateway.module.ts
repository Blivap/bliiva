import { Module } from '@nestjs/common';
import { ActionsAdminController } from '../actions/actions.admin.controller.js';
import { ActionsModule } from '../actions/actions.module.js';
import { AgentsModule } from '../agents/agents.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { IntelligenceAdminController } from '../analytics/intelligence.admin.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { CategoriesController } from '../categories/categories.controller.js';
import { ConversationsController } from '../conversations/conversations.controller.js';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { ConversationsService } from '../conversations/conversations.service.js';
import { TicketsAdminController } from '../escalation/tickets.admin.controller.js';
import { IntelligenceModule } from '../intelligence/intelligence.module.js';
import { IntentsAdminController } from '../intelligence/intents.admin.controller.js';
import { KnowledgeAdminController } from '../knowledge/knowledge.admin.controller.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { RagAdminController } from '../rag/rag.admin.controller.js';
import { RagModule } from '../rag/rag.module.js';
import { TicketsModule } from '../tickets/tickets.module.js';

@Module({
  imports: [
    ConversationsModule,
    MessagesModule,
    KnowledgeModule,
    IntelligenceModule,
    AnalyticsModule,
    TicketsModule,
    AgentsModule,
    ActionsModule,
    AuditModule,
    LlmModule,
    RagModule,
  ],
  controllers: [
    CategoriesController,
    ConversationsController,
    IntentsAdminController,
    KnowledgeAdminController,
    IntelligenceAdminController,
    TicketsAdminController,
    ActionsAdminController,
    RagAdminController,
  ],
  providers: [ConversationsService],
})
export class SupportGatewayModule {}
