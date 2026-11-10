import { describe, expect, it } from 'vitest';
import {
  OrchestratorResponseType,
  Priority,
} from '../../../common/enums/index.js';
import {
  SupportDecisionKind,
  type SupportDecision,
} from '../interfaces/decision.interface.js';
import { composeResponse } from './response-composer.js';

function greetDecision(): SupportDecision {
  return {
    kind: SupportDecisionKind.Greet,
    responseType: OrchestratorResponseType.Answered,
    reason: 'greeting',
    intent: null,
    category: null,
    confidence: 1,
    knowledge: null,
    clarificationOptions: [],
    escalationReason: null,
    priority: Priority.Low,
    countsAsUnresolved: false,
    appendDisclaimer: false,
    empathetic: false,
    repeatedQuestion: false,
    actionName: null,
    unsupportedActionReason: null,
  };
}

describe('composeResponse greeting', () => {
  it('includes the user name when provided', () => {
    const result = composeResponse(greetDecision(), { userName: 'Ada' });
    expect(result.content).toBe(
      'Hi Ada — I’m Blivap’s official AI support assistant. How can I help?',
    );
  });

  it('falls back when no name is available', () => {
    const result = composeResponse(greetDecision());
    expect(result.content).toBe(
      'Hi — I’m Blivap’s official AI support assistant. How can I help?',
    );
  });
});

describe('composeResponse out-of-scope fallback', () => {
  it('asks for an app or problem question without offering a specialist', () => {
    const decision: SupportDecision = {
      ...greetDecision(),
      kind: SupportDecisionKind.Fallback,
      responseType: OrchestratorResponseType.Unsupported,
      reason: 'disallowed_topic',
      confidence: 0,
    };
    const result = composeResponse(decision);
    expect(result.content).toContain(
      'Please ask a question about the Blivap app',
    );
    expect(result.content.toLowerCase()).not.toContain('authorities');
    expect(result.content.toLowerCase()).not.toContain('specialist');
    expect(result.content.toLowerCase()).not.toContain('report');
  });
});
