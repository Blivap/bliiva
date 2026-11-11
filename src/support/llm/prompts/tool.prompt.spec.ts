import { describe, expect, it } from 'vitest';
import { ActionsRegistry } from '../../actions/actions.registry.js';
import { buildToolPrompt } from './tool.prompt.js';

describe('buildToolPrompt', () => {
  it('lists every allowlisted Blivap action for reasoning', () => {
    const actions = new ActionsRegistry().list();
    const prompt = buildToolPrompt(actions);
    expect(prompt).toContain('allowlisted action registry');
    for (const name of [
      'get_profile',
      'get_account_status',
      'get_identity_verification_status',
      'resend_email_verification',
      'get_donor_profile',
      'get_donations',
      'get_donation',
      'cancel_booking',
      'get_blood_requests',
      'get_blood_request',
      'get_wallet_summary',
      'get_notification_settings',
      'list_notifications',
      'update_notification_settings',
    ]) {
      expect(prompt).toContain(name);
    }
  });
});
