import { describe, expect, it } from 'vitest';
import { IntentSensitivity } from '../../../common/enums/index.js';
import {
  blivapIntents,
  blivapKnowledge,
} from '../dataset/blivap-support.dataset.js';
import { resolveIntelligenceSettings } from '../intelligence-settings.js';
import { emptyContext } from '../context/conversation-context.js';
import { SupportDecisionKind } from '../interfaces/decision.interface.js';
import type { IntentRecognitionResult } from '../interfaces/intent-recognizer.interface.js';
import type { KnowledgeRanking } from '../interfaces/knowledge-match.interface.js';
import { inspectMessage } from '../../safety/safety-rules.js';
import { rankKnowledge } from '../retrieval/rank-knowledge.js';
import { recognizeIntents } from '../recognition/recognize-intents.js';
import { decideSupportResponse } from './decision-engine.js';

const settings = resolveIntelligenceSettings();

function decide(
  message: string,
  extras: Partial<Parameters<typeof decideSupportResponse>[0]> = {},
) {
  const recognition = recognizeIntents(message, blivapIntents, settings);
  const knowledge = rankKnowledge({
    text: message,
    entries: blivapKnowledge,
    intent: recognition.intent,
    category: recognition.category,
    settings,
  });
  return decideSupportResponse({
    settings,
    safety: inspectMessage(message),
    recognition,
    knowledge,
    context: emptyContext(),
    intents: blivapIntents,
    authenticated: true,
    humanHandling: false,
    conversationClosed: false,
    repeatCount: 0,
    followUpFailure: false,
    greeting: false,
    closing: false,
    ...extras,
  });
}

describe('decision engine', () => {
  it('answers a high-confidence safe question from published knowledge', () => {
    const decision = decide('I forgot my password');
    expect(decision.kind).toBe(SupportDecisionKind.Answer);
    expect(decision.knowledge?.knowledgeId).toBe('kb-password-reset');
    expect(decision.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('clarifies a medium-confidence or ambiguous account question', () => {
    const decision = decide('account');
    expect(decision.kind).toBe(SupportDecisionKind.Clarify);
    expect(decision.clarificationOptions.map((option) => option.label)).toEqual(
      expect.arrayContaining(['logging in', 'creating an account']),
    );
  });

  it('uses a fallback when the message is unrecognized', () => {
    const decision = decide('what is the weather today');
    expect(decision.kind).toBe(SupportDecisionKind.Fallback);
    expect(decision.knowledge).toBeNull();
  });

  it('quietly redirects illegal off-topic asks instead of escalating', () => {
    const decision = decide('how can i buy things from black market');
    expect(decision.kind).toBe(SupportDecisionKind.Fallback);
    expect(decision.reason).toBe('disallowed_topic');
    expect(decision.escalationReason).toBeNull();
  });

  it('offers escalation after repeated failed clarification', () => {
    const context = { ...emptyContext(), unsuccessfulAttempts: 2 };
    const decision = decide('what is the weather today', { context });
    expect(decision.kind).toBe(SupportDecisionKind.OfferEscalate);
    expect(decision.escalationReason).toBe('repeated_failure');
  });

  it('escalates an explicit human request even if another topic is present', () => {
    const decision = decide("I can't login, please talk to a human");
    expect(decision.kind).toBe(SupportDecisionKind.Escalate);
    expect(decision.escalationReason).toBe('human_requested');
  });

  it('offers escalation for security incidents and does not treat confidence as permission', () => {
    const decision = decide('I think my account was hacked');
    expect(decision.kind).toBe(SupportDecisionKind.OfferEscalate);
    expect(decision.escalationReason).toBe('security_incident');
    expect(decision.priority).toBe('urgent');
  });

  it('offers escalation for a personal eligibility question instead of approving the donor', () => {
    const decision = decide('Am I eligible to donate?');
    expect(decision.kind).toBe(SupportDecisionKind.OfferEscalate);
    expect(decision.escalationReason).toBe('personal_clinical_decision');
  });

  it('still explains general eligibility without turning it into a medical decision', () => {
    const decision = decide('How does donor eligibility work?');
    expect(decision.kind).toBe(SupportDecisionKind.Answer);
    expect(decision.appendDisclaimer).toBe(true);
    expect(decision.knowledge?.answer).toContain('cannot approve');
  });

  it('offers urgent specialist help for emergencies without auto-ticketing', () => {
    const decision = decide('I have chest pain and I cannot breathe');
    expect(decision.kind).toBe(SupportDecisionKind.OfferEscalate);
    expect(decision.escalationReason).toBe('medical_emergency');
    expect(decision.priority).toBe('urgent');
  });

  it('does not answer unpublished-only knowledge', () => {
    const recognition: IntentRecognitionResult = {
      intent: 'PASSWORD_RESET',
      category: 'account_authentication',
      confidence: 0.95,
      matchedKeywords: ['password'],
      matchedPhrases: ['forgot my password'],
      alternatives: [],
      requiresClarification: false,
      requiresAuthentication: false,
      requiresHumanSupport: false,
      entities: {},
      sensitivity: IntentSensitivity.Low,
      escalationPolicy: 'answer_from_knowledge',
      priority: 1,
    };
    const knowledge: KnowledgeRanking = {
      matches: [],
      best: null,
      ambiguous: false,
    };
    const decision = decideSupportResponse({
      settings,
      safety: inspectMessage('reset password'),
      recognition,
      knowledge,
      context: emptyContext(),
      intents: blivapIntents,
      authenticated: true,
      humanHandling: false,
      conversationClosed: false,
      repeatCount: 0,
      followUpFailure: false,
      greeting: false,
      closing: false,
    });
    expect(decision.kind).not.toBe(SupportDecisionKind.Answer);
  });

  it('asks a signed-out user to authenticate before wallet guidance', () => {
    const decision = decide('What is my wallet balance?', {
      authenticated: false,
    });
    expect(decision.kind).toBe(SupportDecisionKind.Authenticate);
    expect(decision.knowledge).toBeNull();
  });

  it('answers withdraw help from knowledge instead of escalating', () => {
    const decision = decide('please how can i withdraw my money');
    expect(decision.kind).toBe(SupportDecisionKind.Answer);
    expect(decision.knowledge?.knowledgeId).toBe('kb-wallet-withdraw');
    expect(decision.escalationReason).toBeNull();
  });

  it('refuses wallet mutations without escalating', () => {
    const decision = decide('Transfer money from my wallet', {
      unsupportedActionReason: 'wallet_mutation_unsupported',
    });
    expect(decision.kind).toBe(SupportDecisionKind.UnsupportedAction);
    expect(decision.escalationReason).toBeNull();
  });

  it('lets the specialist own the chat instead of greeting over them', () => {
    const decision = decide('hi', {
      greeting: true,
      humanHandling: true,
    });
    expect(decision.kind).toBe(SupportDecisionKind.HumanHandling);
  });
});
