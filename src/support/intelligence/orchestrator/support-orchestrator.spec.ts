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
      findById: async (conversationId: string) =>
        conversations.get(String(conversationId)) ?? null,
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
    settings,
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
      execute: async (request: { name?: string; actionName?: string }) => {
        const name = request.name ?? request.actionName;
        if (name === 'resend_email_verification') {
          return {
            status: 'needs_confirmation',
            actionName: 'resend_email_verification',
            message:
              'Resend the email verification link to the address already on this account.',
            confirmationId: 'confirm-resend-1',
          };
        }
        if (name === 'get_wallet_summary') {
          return {
            status: 'success',
            actionName: 'get_wallet_summary',
            message:
              'Here is your wallet on this signed-in account.\nAvailable: NGN 12.50',
          };
        }
        return {
          status: 'success',
          actionName: name ?? 'get_wallet_summary',
          message:
            'Here is your wallet on this signed-in account.\nAvailable: NGN 12.50',
        };
      },
    } as never,
    {
      resolve: (input: {
        intent: string | null;
        message: string;
        lastBotResponse?: string | null;
        userGoAhead?: boolean;
      }) => {
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
        if (
          (input.intent === 'ACCOUNT_STATUS' ||
            input.intent === 'ACCOUNT_LOGIN') &&
          /do it|resend|go ahead/i.test(input.message)
        ) {
          return {
            action: {
              name: 'resend_email_verification',
              enabled: true,
              requiresConfirmation: true,
            },
            params: {},
          };
        }
        if (
          input.userGoAhead &&
          /balance|want me to show/i.test(String(input.lastBotResponse ?? ''))
        ) {
          return {
            action: { name: 'get_wallet_summary', enabled: true },
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
  it('greets immediately without waiting on profile lookup', async () => {
    const { orchestrator, conversation } = harness();
    const turn = await orchestrator.process(conversation, 'hi', user);
    expect(turn.content).toMatch(
      /^Hi — I’m Bliiva, Blivap’s official AI support assistant/,
    );
  });

  it('uses a cached display name on greeting when already known', async () => {
    const { orchestrator, conversation } = harness();
    conversation.context = {
      recognizedEntities: { userName: 'Ada' },
    };
    const turn = await orchestrator.process(conversation, 'hello', user);
    expect(turn.content).toBe(
      'Hi Ada — I’m Bliiva, Blivap’s official AI support assistant. How can I help?',
    );
  });

  it('answers a compound greeting without falling back', async () => {
    const { orchestrator, conversation } = harness();
    const turn = await orchestrator.process(
      conversation,
      "hello what's your name",
      user,
    );
    expect(turn.content.toLowerCase()).toMatch(/blivap.*ai support assistant/);
    expect(turn.content).not.toContain('Couldn’t match');
  });

  it('answers are-you-ai chitchat without the fallback phrase', async () => {
    const { orchestrator, conversation } = harness();
    const turn = await orchestrator.process(
      conversation,
      'hi are you and ai ?',
      user,
    );
    expect(turn.content.toLowerCase()).toMatch(/blivap.*ai support assistant/);
    expect(turn.content).not.toContain('Couldn’t match');
  });

  it('explains withdrawals instead of escalating to a specialist', async () => {
    const { orchestrator, conversation, escalations } = harness();
    const turn = await orchestrator.process(
      conversation,
      'please how can i withdraw my money',
      user,
    );
    expect(turn.content.toLowerCase()).toMatch(/withdraw|wallet/);
    expect(turn.content).not.toContain('A specialist will continue');
    expect(escalations).toHaveLength(0);
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

  it('asks before escalating a repeated unresolved question, then escalates on yes', async () => {
    const { orchestrator, conversation, escalations, conversations } =
      harness();
    await orchestrator.process(conversation, 'what is the weather today', user);
    await orchestrator.process(conversation, 'tell me a joke', user);
    const third = await orchestrator.process(
      conversation,
      'who won the match',
      user,
    );
    expect(third.responseType).toBe('CLARIFICATION_REQUIRED');
    expect(third.content.toLowerCase()).toContain('specialist');
    expect(escalations).toHaveLength(0);

    const offered = conversations.get(conversation.id) ?? conversation;
    const confirmed = await orchestrator.process(offered, 'yes', user);
    expect(confirmed.responseType).toBe('ESCALATED');
    expect(confirmed.reference).toBe('SUP-TEST-1000');
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

  it('notifies once when a specialist owns the chat, then stays silent', async () => {
    const { orchestrator, conversation, messages, conversations } = harness();
    conversation.status = ConversationStatus.Human;
    conversations.set(conversation.id, conversation);

    const first = await orchestrator.process(conversation, 'hello?', user);
    expect(first.content).toBe('A specialist is on this chat now.');
    expect(messages.filter((item) => item.senderType === 'bot')).toHaveLength(
      1,
    );

    const updated = conversations.get(conversation.id)!;
    const second = await orchestrator.process(updated, 'are you there?', user);
    expect(second.content).toBe('');
    expect(second.message.metadata).toMatchObject({ silent: true });
    expect(messages.filter((item) => item.senderType === 'bot')).toHaveLength(
      1,
    );
  });

  it('stays silent after handoff while waiting for a specialist', async () => {
    const { orchestrator, conversation, conversations } = harness();
    const handedOff = await orchestrator.process(
      conversation,
      'I want to talk to a real person',
      user,
    );
    expect(handedOff.responseType).toBe('ESCALATED');
    const waiting = conversations.get(conversation.id)!;
    expect(waiting.status).toBe(ConversationStatus.Waiting);
    expect(
      (waiting.context as { specialistNotified?: boolean }).specialistNotified,
    ).toBe(true);

    const after = await orchestrator.process(waiting, 'alright', user);
    expect(after.content).toBe('');
    expect(after.state.currentIntent).toBeNull();
  });

  it('runs a wallet lookup when the user says yes after a balance offer', async () => {
    const { orchestrator, conversation, conversations } = harness();
    conversation.context = {
      currentIntent: 'WALLET_BALANCE',
      conversationState: 'answered',
      lastBotResponse:
        'Your balance is available. Want me to show it to you?',
      pendingClarification: {
        kind: 'action_offer',
        question: 'Want me to show it to you?',
        options: [
          {
            intent: 'WALLET_BALANCE',
            label: 'yes',
            actionName: 'get_wallet_summary',
          },
          { intent: 'WALLET_BALANCE', label: 'no' },
        ],
        actionName: 'get_wallet_summary',
      },
      pendingActionName: 'get_wallet_summary',
    };
    conversations.set(conversation.id, conversation);

    const turn = await orchestrator.process(conversation, 'yes', user);
    expect(turn.responseType).toBe('ACTION_COMPLETED');
    expect(turn.content.toLowerCase()).toContain('wallet');
  });

  it('runs the offered verification action on do it instead of repeating help', async () => {
    const { orchestrator, conversation, conversations } = harness();
    conversation.context = {
      currentIntent: 'ACCOUNT_STATUS',
      conversationState: 'answered',
      pendingClarification: {
        kind: 'follow_up',
        question: 'Anything else?',
        options: [
          { intent: 'ACCOUNT_STATUS', label: 'yes' },
          { intent: 'REQUEST_HUMAN', label: 'no I need more help' },
        ],
      },
    };
    conversations.set(conversation.id, conversation);

    const turn = await orchestrator.process(conversation, 'yes do it', user);
    expect(turn.responseType).toBe('ACTION_CONFIRMATION_REQUIRED');
    expect(turn.content.toLowerCase()).toContain('verification');
    expect(turn.content.toLowerCase()).not.toContain('how can i verify');
    const updated = conversations.get(conversation.id)!;
    expect(
      (updated.context as { pendingClarification?: { kind?: string } })
        .pendingClarification?.kind,
    ).toBe('action_confirm');
  });

  it('does not reopen the prior topic on a soft ack', async () => {
    const { orchestrator, conversation, conversations } = harness();
    conversation.context = {
      currentIntent: 'ACCOUNT_STATUS',
      conversationState: 'answered',
      pendingClarification: null,
    };
    conversations.set(conversation.id, conversation);

    const turn = await orchestrator.process(conversation, 'alright', user);
    expect(turn.content.toLowerCase()).toContain('here if you need');
    expect(turn.content.toLowerCase()).not.toContain('verif');
    expect(turn.state.currentIntent).toBeNull();
  });

  it('gives emergency direction and only tickets after the user says yes', async () => {
    const { orchestrator, conversation, escalations, conversations } =
      harness();
    const turn = await orchestrator.process(
      conversation,
      'I have chest pain',
      user,
    );
    expect(turn.content).toContain('emergency services');
    expect(turn.content).toContain('Do not wait');
    expect(turn.content.toLowerCase()).toContain('specialist');
    expect(escalations).toHaveLength(0);

    const offered = conversations.get(conversation.id) ?? conversation;
    const confirmed = await orchestrator.process(offered, 'yes', user);
    expect(confirmed.responseType).toBe('ESCALATED');
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
