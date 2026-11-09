import { Module } from '@nestjs/common';
import { ActionsModule } from './actions/actions.module.js';
import { AgentModule } from './agent/agent.module.js';
import { AgentsModule } from './agents/agents.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuditModule } from './audit/audit.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { EscalationModule } from './escalation/escalation.module.js';
import { FeedbackModule } from './feedback/feedback.module.js';
import { SupportGatewayModule } from './gateway/support-gateway.module.js';
import { IntelligenceModule } from './intelligence/intelligence.module.js';
import { KnowledgeModule } from './knowledge/knowledge.module.js';
import { LlmModule } from './llm/llm.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { RagModule } from './rag/rag.module.js';
import { SafetyModule } from './safety/safety.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { ToolsModule } from './tools/tools.module.js';

@Module({
  imports: [
    ConversationsModule,
    MessagesModule,
    KnowledgeModule,
    IntelligenceModule,
    ActionsModule,
    AgentModule,
    LlmModule,
    RagModule,
    ToolsModule,
    EscalationModule,
    TicketsModule,
    AgentsModule,
    NotificationsModule,
    SafetyModule,
    AnalyticsModule,
    FeedbackModule,
    AuditModule,
    SupportGatewayModule,
  ],
  exports: [
    ConversationsModule,
    MessagesModule,
    KnowledgeModule,
    IntelligenceModule,
    TicketsModule,
    AgentsModule,
    FeedbackModule,
    AuditModule,
    LlmModule,
    RagModule,
  ],
})
export class SupportModule {}
