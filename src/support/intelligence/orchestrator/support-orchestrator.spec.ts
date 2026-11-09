import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import type { SupportActor } from '../../../common/auth/support-actor.js';
import { ConversationStatus, Priority } from '../../../common/enums/index.js';
import { AnalyticsService } from '../../analytics/analytics.service.js';
import { presentMessage } from '../../messages/present-message.js';
import { AuditRepository } from '../../audit/audit.repository.js';
import { EscalationService } from '../../escalation/escalation.service.js';
import type { EscalationRequest } from '../../escalation/escalation.types.js';
import { SafetyService } from '../../safety/safety.service.js';
import {
  blivapIntents,
  blivapKnowledge,
} from '../dataset/blivap-support.dataset.js';
import { DecisionEngineService } from '../decision/decision-engine.service.js';
import { resolveIntelligenceSettings } from '../intelligence-settings.js';
import { IntelligenceSettingsService } from '../intelligence-settings.service.js';
import { IntentCatalogService } from '../recognition/intent-catalog.service.js';
import { RuleBasedRecognizerService } from '../recognition/rule-based-recognizer.service.js';
import { KnowledgeRetrievalService } from '../retrieval/knowledge-retrieval.service.js';
import { KnowledgeCatalogService } from '../../knowledge/knowledge-catalog.service.js';
import {
  SupportOrchestratorService,
  type OrchestratorConversation,
} from './support-orchestrator.service.js';

const settings = {
  current: () => resolveIntelligenceSettings(),
} as IntelligenceSettingsService;
const user: SupportActor = {
  userId: '64b0000000000000000000aa',
  guestSessionId: null,
  roles: ['user'],
  isAuthenticated: true,
  accessToken: 'blivap-access-token',
};

function harness() {
  const messages: Array<Record<string, unknown>> = [];
  const escalations: EscalationRequest[] = [];
  const analytics: Array<{
    questionExcerpt?: string | null;
    escalated?: boolean;
  }> = [];
  const conversations = new Map<string, OrchestratorConversation>();

  const id = new Types.ObjectId().toHexString();
  const conversation: OrchestratorConversation = {
    id,
    userId: user.userId,
    status: ConversationStatus.Bot,
    category: 'general_enquiries',
    currentIntent: null,
    priority: Priority.Medium,
    context: {},
    assignedAgentId: null,
  };
  conversations.set(id, conversation);

  const orchestrator = new SupportOrchestratorService(
    {
      updateById: async (
        conversationId: string,
        patch: Record<string, unknown>,
      ) => {
        const current = conversations.get(String(conversationId));
        if (!current) return null;
        Object.assign(current, patch);
        if (patch.context)
          current.context = patch.context as Record<string, unknown>;
        return current;
      },
    } as never,
    {
      create: async (data: Record<string, unknown>) => {
        const stored = {
          ...data,
          _id: new Types.ObjectId(),
          createdAt: new Date(),
        };
        messages.push(stored);
        return stored;
      },
      findRecent: async () => messages.slice(-8),
    } as never,
    { getEnabled: async () => blivapIntents } as IntentCatalogService,
    new RuleBasedRecognizerService(
      { getEnabled: async () => blivapIntents } as IntentCatalogService,
      settings,
    ),
    new KnowledgeRetrievalService(
      { getPublished: async () => blivapKnowledge } as KnowledgeCatalogService,
      settings,
    ),
    new DecisionEngineService(settings),
    new SafetyService(),
    {
      escalate: async (request: EscalationRequest) => {
        escalations.push(request);
        return {
          ticketId: new Types.ObjectId().toHexString(),
          ticketNumber: 'SUP-TEST-1000',
          assignedAgentId: null,
          priority: request.priority,
          alreadyOpen: false,
        };
      },
    } as EscalationService,
    new AnalyticsService({
      create: async (event: {
        questionExcerpt?: string | null;
        escalated?: boolean;
      }) => {
        analytics.push(event);
      },
    } as never),
    { createAudit: async () => ({}) } as unknown as AuditRepository,
    {
      execute: async () => ({
        status: 'success',
        actionName: 'get_wallet_summary',
        message:
          'Here is your wallet on this signed-in account.\nAvailable: NGN 12.50',
      }),
    } as never,
    {
      resolve: (input: { intent: string | null; message: string }) => {
        if (
          input.intent === 'WALLET_BALANCE' ||
          /wallet balance/i.test(input.message)
        ) {
          return {
            action: {
              name: 'get_wallet_summary',
              enabled: true,
            },
            params: { focus: 'balance' },
          };
        }
        if (/transfer money/i.test(input.message)) {
          return { unsupported: 'wallet_mutation_unsupported' };
        }
        return null;
      },
    } as never,
    {
      enabled: () => false,
      runTurn: async () => {
        throw new Error('llm disabled in this test');
      },
    } as never,
    {
      enabled: () => false,
      runTurn: async () => ({ outcome: 'fallback', reason: 'llm_disabled' }),
    } as never,
    {
      getProfile: async () => ({
        id: user.userId!,
        email: 'donor@example.com',
        firstname: 'Ada',
        lastname: 'Okeke',
        emailVerified: true,
        roles: ['user'],
        identityVerified: false,
        identityProfileLocked: false,
        isSuspended: false,
        isDeleted: false,
      }),
    } as never,
  );

  return {
    orchestrator,
    conversation,
    messages,
    escalations,
    analytics,
    conversations,
  };
}

describe('support orchestrator', () => {
  it('greets a signed-in user by their first name', async () => {
    const { orchestrator, conversation } = harness();
    const turn = await orchestrator.process(conversation, 'hi', user);
    expect(turn.content).toContain('Hi Ada');
    expect(turn.content).toContain('Blivap support');
  });

  it('answers a password question from the approved article and traces it internally', async () => {
    const { orchestrator, conversation, messages, escalations } = harness();
    const turn = await orchestrator.process(
      conversation,
      'I forgot my password',
      user,
    );
    expect(turn.content).toContain('Forgot password');
    expect(turn.content).not.toContain('kb-password-reset');
    expect(turn.reference).toBeNull();
    expect(escalations).toHaveLength(0);
    const bot = messages.at(-1);
    expect(bot?.metadata).toMatchObject({ knowledgeId: 'kb-password-reset' });
    expect(presentMessage(turn.message, user).metadata).toBeUndefined();
  });

  it('understands a short reply to the previous clarification', async () => {
    const { orchestrator, conversation } = harness();
    const first = await orchestrator.process(conversation, 'account', user);
    expect(first.content).toContain('logging in');
    expect(first.content).toContain('creating an account');
    const second = await orchestrator.process(
      conversation,
      'Logging in.',
      user,
    );
    expect(second.content).toContain('cannot see your password');
    expect(second.state.currentIntent).toBe('ACCOUNT_LOGIN');
  });

  it('switches topic when the user corrects the previous subject', async () => {
    const { orchestrator, conversation } = harness();
    await orchestrator.process(conversation, 'I forgot my password', user);
    const corrected = await orchestrator.process(
      conversation,
      'No, I meant my wallet balance',
      user,
    );
    expect(corrected.content).toContain('wallet');
  });

  it('escalates a repeated unresolved question and a human request', async () => {
    const { orchestrator, conversation, escalations } = harness();
    await orchestrator.process(conversation, 'what is the weather today', user);
    await orchestrator.process(conversation, 'tell me a joke', user);
    const third = await orchestrator.process(
      conversation,
      'who won the match',
      user,
    );
    expect(third.responseType).toBe('ESCALATED');
    expect(escalations.at(-1)?.reason).toBe('repeated_failure');

    const humanHarness = harness();
    const human = await humanHarness.orchestrator.process(
      humanHarness.conversation,
      'I want to talk to a real person',
      user,
    );
    expect(human.content.toLowerCase()).toContain('human');
    expect(human.reference).toBe('SUP-TEST-1000');
  });

  it('gives emergency direction immediately', async () => {
    const { orchestrator, conversation, escalations } = harness();
    const turn = await orchestrator.process(
      conversation,
      'I have chest pain',
      user,
    );
    expect(turn.content).toContain('emergency services');
    expect(turn.content).toContain('Do not wait');
    expect(escalations[0]?.reason).toBe('medical_emergency');
    expect(escalations[0]?.priority).toBe('urgent');
  });

  it('keeps context inside one conversation', async () => {
    const { orchestrator, conversation, conversations } = harness();
    await orchestrator.process(conversation, 'account', user);
    const other: OrchestratorConversation = {
      ...conversation,
      id: new Types.ObjectId().toHexString(),
      context: {},
      currentIntent: null,
    };
    conversations.set(other.id, { ...other });
    const turn = await orchestrator.process(other, 'Logging in.', user);
    expect(turn.content).not.toContain('cannot see your password');
  });

  it('records an unrecognized message without storing a medical excerpt', async () => {
    const { orchestrator, conversation, analytics } = harness();
    await orchestrator.process(
      conversation,
      'I have hepatitis, what should I do?',
      user,
    );
    expect(analytics[0]?.questionExcerpt).toBeNull();
  });
});
