import { Injectable } from '@nestjs/common';
import { normalizeText } from '../intelligence/text/text-normalizer.js';
import { ActionsRegistry } from './actions.registry.js';
import type { SupportActionDefinition } from './actions.types.js';

export interface ResolvedAction {
  action: SupportActionDefinition;
  params: Record<string, string>;
  unsupportedReason?: string;
}

const UNSUPPORTED: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(transfer|send|withdraw|payout|refund|top ?up)\b.*\b(money|wallet|funds)\b|\b(money|wallet|funds)\b.*\b(transfer|send|withdraw|payout|refund)\b/,
    reason: 'wallet_mutation_unsupported',
  },
  {
    pattern: /\bcancel (my )?(blood )?request\b/,
    reason: 'blood_request_cancel_unsupported',
  },
];

@Injectable()
export class ActionsResolver {
  constructor(private readonly registry: ActionsRegistry) {}

  resolve(input: {
    intent: string | null;
    message: string;
    params?: Record<string, string>;
  }): ResolvedAction | { unsupported: string } | null {
    const normalized = normalizeText(input.message);
    for (const rule of UNSUPPORTED) {
      if (rule.pattern.test(normalized)) {
        return { unsupported: rule.reason };
      }
    }
    if (!input.intent) return null;

    if (/\bcancel (my )?(booking|appointment|donation)\b/.test(normalized)) {
      const action = this.registry.get('cancel_booking');
      if (action?.enabled) {
        return { action, params: { ...input.params } };
      }
    }

    if (
      input.intent === 'WALLET_BALANCE' ||
      input.intent === 'WALLET_TRANSACTIONS'
    ) {
      const action = this.registry.get('get_wallet_summary');
      if (!action?.enabled) return null;
      const focus = /\b(transaction|history|recent)\b/.test(normalized)
        ? 'transactions'
        : /\b(balance|how much)\b/.test(normalized)
          ? 'balance'
          : 'all';
      return { action, params: { ...input.params, focus } };
    }

    if (
      input.intent === 'BLOOD_REQUEST_HELP' ||
      input.intent === 'BLOOD_REQUEST_STATUS'
    ) {
      if (
        /\b(how (do|to)|what is a|explain)\b/.test(normalized) &&
        !/\b(my|status|check)\b/.test(normalized)
      ) {
        return null;
      }
      const action = this.registry.get(
        input.params?.requestId ? 'get_blood_request' : 'get_blood_requests',
      );
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (
      input.intent === 'DONATION_STATUS' ||
      input.intent === 'APPOINTMENT_STATUS'
    ) {
      const action = this.registry.get(
        input.params?.donationId ? 'get_donation' : 'get_donations',
      );
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (input.intent === 'NOTIFICATION_HELP') {
      if (
        /\bturn (on|off) push\b|\benable push\b|\bdisable push\b/.test(
          normalized,
        )
      ) {
        const action = this.registry.get('update_notification_settings');
        if (!action?.enabled) return null;
        const pushEnabled = /\b(off|disable)\b/.test(normalized)
          ? 'false'
          : 'true';
        return {
          action,
          params: { ...input.params, pushEnabled },
        };
      }
      if (/\b(settings|preference)\b/.test(normalized)) {
        const action = this.registry.get('get_notification_settings');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      const action = this.registry.get('list_notifications');
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (input.intent === 'PROFILE_UPDATE') {
      if (/\b(update|change|edit)\b/.test(normalized)) return null;
      const action = this.registry.get('get_profile');
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (input.intent === 'DONOR_REGISTRATION') {
      if (
        /\b(how|register|become)\b/.test(normalized) &&
        !/\b(my|status)\b/.test(normalized)
      ) {
        return null;
      }
      const action = this.registry.get('get_donor_profile');
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (
      input.intent === 'HOSPITAL_VERIFICATION' ||
      input.intent === 'ACCOUNT_STATUS'
    ) {
      const action = this.registry.get('get_identity_verification_status');
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (input.intent === 'ACCOUNT_LOGIN') {
      if (/\b(verify|verification|activation|status)\b/.test(normalized)) {
        const action = this.registry.get('get_account_status');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      return null;
    }

    if (input.intent === 'CANCEL_BOOKING') {
      const action = this.registry.get('cancel_booking');
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    const candidates = this.registry.forIntent(input.intent);
    const preferred = candidates.find((item) => item.readOnly) ?? candidates[0];
    return preferred
      ? { action: preferred, params: { ...input.params } }
      : null;
  }
}
