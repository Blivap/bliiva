import { describe, expect, it } from 'vitest';
import { buildTurnLog } from './turn-log.js';

describe('buildTurnLog', () => {
  it('keeps the question, reply, and error cause without secrets', () => {
    const log = buildTurnLog({
      conversationId: '64b0000000000000000000bb',
      userText: 'reset password for me@example.com otp: 123456',
      reply: 'Our AI support assistant is temporarily unavailable.',
      responseType: 'TEMPORARY_ERROR',
      reason: 'llm_providers_failed',
      errorCode: 'timeout',
      errorMessage: 'The model request timed out.',
      model: 'qwen3:1.7b',
      source: 'llm',
      latencyMs: 15000,
    });
    expect(log.event).toBe('support.turn');
    expect(log.user).not.toContain('me@example.com');
    expect(log.user).not.toContain('123456');
    expect(log.user).toContain('reset password');
    expect(log.reason).toBe('llm_providers_failed');
    expect(log.errorCode).toBe('timeout');
    expect(log.errorMessage).toContain('timed out');
    expect(log.model).toBe('qwen3:1.7b');
  });
});
