import { describe, expect, it } from 'vitest';
import { inspectMessage } from './safety-rules.js';

describe('safety rules', () => {
  it('flags urgent medical language', () => {
    expect(inspectMessage('This is a medical emergency').emergency).toBe(true);
    expect(inspectMessage('How does donation work?').emergency).toBe(false);
  });

  it('flags security and unauthorized transactions separately from balance questions', () => {
    expect(inspectMessage('my account was hacked').securityIncident).toBe(true);
    expect(
      inspectMessage('there is an unauthorized transaction')
        .unauthorizedTransaction,
    ).toBe(true);
    expect(
      inspectMessage('what is my wallet balance').unauthorizedTransaction,
    ).toBe(false);
  });

  it('flags personal clinical decisions and explicit human requests', () => {
    const clinical = inspectMessage('Am I eligible to donate blood?');
    expect(clinical.personalClinicalDecision).toBe(true);
    expect(inspectMessage('I want to talk to a human').humanRequested).toBe(
      true,
    );
  });

  it('flags illegal off-platform requests without treating normal help as disallowed', () => {
    expect(
      inspectMessage('how can i buy things from black market').disallowedTopic,
    ).toBe(true);
    expect(inspectMessage('how do I withdraw from my wallet').disallowedTopic).toBe(
      false,
    );
  });
});
