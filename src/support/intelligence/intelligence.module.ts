import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActionsModule } from '../actions/actions.module.js';
import { AgentModule } from '../agent/agent.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { EscalationModule } from '../escalation/escalation.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { SafetyModule } from '../safety/safety.module.js';
import { DecisionEngineService } from './decision/decision-engine.service.js';
import { IntentsService } from './intents.service.js';
import { IntentRepository } from './intent.repository.js';
import { INTENT_RECOGNIZER } from './interfaces/intent-recognizer.interface.js';
import { IntelligenceSettingsService } from './intelligence-settings.service.js';
import { SupportOrchestratorService } from './orchestrator/support-orchestrator.service.js';
import { IntentCatalogService } from './recognition/intent-catalog.service.js';
import { RuleBasedRecognizerService } from './recognition/rule-based-recognizer.service.js';
import { KnowledgeRetrievalService } from './retrieval/knowledge-retrieval.service.js';
import { SupportIntent, SupportIntentSchema } from './schemas/intent.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportIntent.name, schema: SupportIntentSchema },
    ]),
    KnowledgeModule,
    ConversationsModule,
    MessagesModule,
    SafetyModule,
    EscalationModule,
    AnalyticsModule,
    AuditModule,
    ActionsModule,
    AgentModule,
    LlmModule,
  ],
  providers: [
    IntentRepository,
    IntelligenceSettingsService,
    IntentCatalogService,
    RuleBasedRecognizerService,
    {
      provide: INTENT_RECOGNIZER,
      useExisting: RuleBasedRecognizerService,
    },
    KnowledgeRetrievalService,
    DecisionEngineService,
    IntentsService,
    SupportOrchestratorService,
  ],
  exports: [
    IntentRepository,
    IntelligenceSettingsService,
    IntentCatalogService,
    RuleBasedRecognizerService,
    INTENT_RECOGNIZER,
    KnowledgeRetrievalService,
    DecisionEngineService,
    IntentsService,
    SupportOrchestratorService,
    MongooseModule,
  ],
})
export class IntelligenceModule {}
