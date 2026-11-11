import { Injectable } from '@nestjs/common';
import {
  botOfferedAction,
  inferImmediateLiveDataAction,
  inferOfferedAction,
} from '../intelligence/context/offered-action.js';
import { normalizeText } from '../intelligence/text/text-normalizer.js';
import { ActionsRegistry } from './actions.registry.js';
import type { SupportActionDefinition } from './actions.types.js';

export interface ResolvedAction {
  action: SupportActionDefinition;
  params: Record<string, string>;
  unsupportedReason?: string;
}

/** Peer transfers/refunds are unsupported; top-up/withdraw-to-own-bank are allowlisted. */
const WALLET_TRANSFER_UNSUPPORTED =
  /\b(make a transfer|transfer|send)\b.*\b(money|wallet|funds|balance)\b|\b(money|wallet|funds|balance)\b.*\b(transfer|send)\b|\b(transfer|send) (?:to|from)\b|\bsend (?:money|funds|cash)\b|\brefund\b|\brecipient(?:'?s)? (?:bank|account)\b/;
const WALLET_MUTATION_HOWTO =
  /\b(how (can|do|to)|where (can|do|to)|can i|is it possible to)\b/;
const GO_AHEAD_MESSAGE =
  /^(?:(?:yes|yeah|yep|yup|ok|okay|sure|please)[, ]+)*(?:please[, ]+)?(?:do it|do that|do so|go ahead|go for it|please do|help me with that|help me do that|can you do it|could you do it|would you do it|show(?: me)?(?: it)?|check(?: it)?|resend(?: it)?|send(?: it)?(?: now)?|resend the (?:email|link|verification)|send the (?:email|link|verification))(?: please)?$|\bresend (?:my )?(?:email )?verification\b|\bjust (?:the |my )?(balance|wallet|bookings?|donations?)\b/;

const UNSUPPORTED: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: WALLET_TRANSFER_UNSUPPORTED,
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
    /** Prior bot reply — used to honor go-ahead after an offered lookup. */
    lastBotResponse?: string | null;
    userGoAhead?: boolean;
  }): ResolvedAction | { unsupported: string } | null {
    const normalized = normalizeText(input.message);
    for (const rule of UNSUPPORTED) {
      if (!rule.pattern.test(normalized)) continue;
      if (
        rule.reason === 'wallet_mutation_unsupported' &&
        WALLET_MUTATION_HOWTO.test(normalized)
      ) {
        return null;
      }
      return { unsupported: rule.reason };
    }

    // User accepted a prior offer (“yes” / “do it” / “show me”) — run that action.
    if (
      (input.userGoAhead || GO_AHEAD_MESSAGE.test(normalized)) &&
      botOfferedAction(input.lastBotResponse)
    ) {
      const offered = inferOfferedAction({
        lastBotResponse: input.lastBotResponse,
        currentIntent: input.intent,
      });
      if (offered) {
        const action = this.registry.get(offered.actionName);
        if (action?.enabled) {
          return {
            action,
            params: { ...input.params, ...offered.params },
          };
        }
      }
    }

    // Money mutations (confirm-gated) before balance reads so “withdraw from wallet”
    // is not swallowed by the live-data wallet summary pattern.
    if (!WALLET_MUTATION_HOWTO.test(normalized)) {
      if (
        /\b(withdraw|cash out|payout)\b/.test(normalized) &&
        !/\b(status|history|list)\b/.test(normalized)
      ) {
        const action = this.registry.get('start_wallet_payout');
        if (action?.enabled) {
          const amount = normalized.match(/\b(\d+(?:\.\d{1,2})?)\b/)?.[1];
          return {
            action,
            params: {
              ...input.params,
              ...(amount ? { amountNaira: amount } : {}),
            },
          };
        }
      }
      if (
        /\b(top ?up|add money|fund (my )?wallet)\b/.test(normalized) &&
        !/\bverify\b/.test(normalized)
      ) {
        const action = this.registry.get('start_wallet_topup');
        if (action?.enabled) {
          const amount = normalized.match(/\b(\d+(?:\.\d{1,2})?)\b/)?.[1];
          return {
            action,
            params: {
              ...input.params,
              ...(amount ? { amountNaira: amount } : {}),
            },
          };
        }
      }
      if (/\bverify (?:my )?(?:top ?up|payment|paystack)\b/.test(normalized)) {
        const action = this.registry.get('verify_wallet_topup');
        if (action?.enabled) {
          const reference =
            input.message.match(/\b([A-Za-z0-9_-]{8,64})\b/)?.[1];
          return {
            action,
            params: {
              ...input.params,
              ...(reference ? { reference } : {}),
            },
          };
        }
      }
      if (/\bresend (?:payout |withdraw )?(?:otp|code)\b/.test(normalized)) {
        const action = this.registry.get('resend_payout_otp');
        if (action?.enabled) {
          return { action, params: { ...input.params } };
        }
      }
    }

    // Browse / list donors (optional blood type) — not the signed-in user's own profile.
    if (
      /\b(list|show|find|browse|get|give)\b.{0,40}\bdonors?\b|\bdonors?\b.{0,20}\b(list|near me|available)\b|\b(?:ab|a|b|o)\s*[+-]\s*donors?\b/.test(
        normalized,
      )
    ) {
      const action = this.registry.get('list_donors');
      if (action?.enabled) {
        const bloodMatch = normalized.match(
          /\b(ab|a|b|o)\s*([+-]|plus|minus|positive|negative)(?=\s|$|[^a-z0-9])/i,
        );
        const fromMatch = bloodMatch
          ? `${bloodMatch[1]!.toUpperCase()}${
              /plus|positive|\+/.test(bloodMatch[2]!.toLowerCase())
                ? '+'
                : '-'
            }`
          : undefined;
        const bloodType = input.params?.bloodType || fromMatch;
        return {
          action,
          params: {
            ...input.params,
            ...(bloodType ? { bloodType } : {}),
          },
        };
      }
    }

    if (
      /\bmark (?:all )?(?:my )?notifications? (?:as )?read\b/.test(normalized)
    ) {
      const all = /\ball\b/.test(normalized);
      const action = this.registry.get(
        all ? 'mark_all_notifications_read' : 'mark_notification_read',
      );
      if (action?.enabled) {
        return { action, params: { ...input.params } };
      }
    }

    // Clear live-data asks (“my balance”, “show my bookings”) run now —
    // never wait for an LLM “Want me to show it?” permission loop.
    const immediate = inferImmediateLiveDataAction(normalized);
    if (immediate) {
      const action = this.registry.get(immediate.actionName);
      if (action?.enabled && !action.requiresConfirmation) {
        return {
          action,
          params: { ...input.params, ...immediate.params },
        };
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
      if (/\b(payout|withdrawal)s?\b/.test(normalized)) {
        const action = this.registry.get(
          input.params?.payoutId ? 'get_payout' : 'list_payouts',
        );
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      if (/\bbank accounts?\b/.test(normalized)) {
        const action = this.registry.get('list_bank_accounts');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      const action = this.registry.get('get_wallet_summary');
      if (!action?.enabled) return null;
      const focus = /\b(transaction|history|recent)\b/.test(normalized)
        ? 'transactions'
        : /\b(balance|how much)\b/.test(normalized)
          ? 'balance'
          : 'all';
      return { action, params: { ...input.params, focus } };
    }

    if (input.intent === 'WALLET_TOPUP_HELP') {
      if (WALLET_MUTATION_HOWTO.test(normalized)) return null;
      const action = this.registry.get(
        /\bverify\b/.test(normalized)
          ? 'verify_wallet_topup'
          : 'start_wallet_topup',
      );
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (input.intent === 'WALLET_WITHDRAW_HELP') {
      if (WALLET_MUTATION_HOWTO.test(normalized)) return null;
      if (/\b(status|history|list)\b/.test(normalized)) {
        const action = this.registry.get('list_payouts');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      const action = this.registry.get('start_wallet_payout');
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (input.intent === 'BANK_ACCOUNT_HELP') {
      if (
        WALLET_MUTATION_HOWTO.test(normalized) ||
        /\b(how|where)\b/.test(normalized)
      ) {
        if (!/\b(my|list|show|saved)\b/.test(normalized)) return null;
      }
      if (/\b(add|save|link)\b/.test(normalized)) {
        const action = this.registry.get('add_bank_account');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      if (/\b(supported )?banks?\b/.test(normalized) && !/\baccount\b/.test(normalized)) {
        const action = this.registry.get('list_banks');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      const action = this.registry.get('list_bank_accounts');
      return action?.enabled ? { action, params: { ...input.params } } : null;
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
      if (/\b(create|new|make)\b/.test(normalized) && !WALLET_MUTATION_HOWTO.test(normalized)) {
        const action = this.registry.get('create_blood_request');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      const action = this.registry.get(
        input.params?.requestId ? 'get_blood_request' : 'get_blood_requests',
      );
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (
      input.intent === 'DONATION_STATUS' ||
      input.intent === 'APPOINTMENT_STATUS' ||
      input.intent === 'BOOKING_HELP'
    ) {
      if (input.intent === 'BOOKING_HELP' && WALLET_MUTATION_HOWTO.test(normalized)) {
        return null;
      }
      if (/\baccept\b/.test(normalized)) {
        const action = this.registry.get('accept_booking');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      if (/\bdecline\b/.test(normalized)) {
        const action = this.registry.get('decline_booking');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      if (/\b(list|filter|pending|upcoming)\b/.test(normalized)) {
        const action = this.registry.get('list_bookings');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      const action = this.registry.get(
        input.params?.donationId ? 'get_donation' : 'get_donations',
      );
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (input.intent === 'MEETUP_HELP') {
      if (WALLET_MUTATION_HOWTO.test(normalized) && !/\b(my|status|session)\b/.test(normalized)) {
        return null;
      }
      if (/\bwelfare packages?\b/.test(normalized)) {
        const action = this.registry.get('list_welfare_packages');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      if (input.params?.sessionId || /\bmeetup session\b/.test(normalized)) {
        const action = this.registry.get('get_meetup_session');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      return null;
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
      if (/\bmark all\b/.test(normalized)) {
        const action = this.registry.get('mark_all_notifications_read');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      if (/\b(settings|preference)\b/.test(normalized)) {
        const action = this.registry.get('get_notification_settings');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      const action = this.registry.get('list_notifications');
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (input.intent === 'PROFILE_UPDATE') {
      if (/\b(update|change|edit)\b/.test(normalized)) {
        const action = this.registry.get('update_profile');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      const action = this.registry.get('get_profile');
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (input.intent === 'DONOR_REGISTRATION') {
      if (
        /\b(how|register|become)\b/.test(normalized) &&
        !/\b(my|status)\b/.test(normalized)
      ) {
        if (/\bregister me\b|\bbecome a donor now\b/.test(normalized)) {
          const action = this.registry.get('register_donor');
          return action?.enabled
            ? { action, params: { ...input.params } }
            : null;
        }
        return null;
      }
      const action = this.registry.get('get_donor_profile');
      return action?.enabled ? { action, params: { ...input.params } } : null;
    }

    if (
      input.intent === 'HOSPITAL_VERIFICATION' ||
      input.intent === 'ACCOUNT_STATUS' ||
      input.intent === 'ACCOUNT_LOGIN' ||
      input.intent === 'IDENTITY_VERIFICATION'
    ) {
      if (/\bhospitals?\b/.test(normalized) && !/\bverif\b/.test(normalized)) {
        const action = this.registry.get('list_hospitals');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      if (
        input.intent === 'IDENTITY_VERIFICATION' &&
        /\b(submit|verify).{0,12}\bnin\b|\bnin\b/.test(normalized) &&
        !WALLET_MUTATION_HOWTO.test(normalized)
      ) {
        const action = this.registry.get('submit_nin_verification');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      // User said "do it" / "resend" while on a verification intent.
      if (GO_AHEAD_MESSAGE.test(normalized) || /\bresend\b/.test(normalized)) {
        const resend = this.registry.get('resend_email_verification');
        return resend?.enabled
          ? { action: resend, params: { ...input.params } }
          : null;
      }
      if (input.intent === 'ACCOUNT_LOGIN') {
        if (/\b(verify|verification|activation|status)\b/.test(normalized)) {
          const action = this.registry.get('get_account_status');
          return action?.enabled
            ? { action, params: { ...input.params } }
            : null;
        }
        return null;
      }
      if (input.intent === 'ACCOUNT_STATUS') {
        if (
          /\b(how (do|can|to)|what (do|can) i|where (do|can) i)\b/.test(
            normalized,
          ) &&
          !/\b(status|check|resend|send)\b/.test(normalized)
        ) {
          return null;
        }
        const action = this.registry.get('get_account_status');
        return action?.enabled
          ? { action, params: { ...input.params } }
          : null;
      }
      const identity = this.registry.get('get_identity_verification_status');
      return identity?.enabled
        ? { action: identity, params: { ...input.params } }
        : null;
    }

    if (input.intent === 'PASSWORD_RESET') {
      if (WALLET_MUTATION_HOWTO.test(normalized)) return null;
      if (/\bchange password\b/.test(normalized)) {
        const action = this.registry.get('change_password');
        return action?.enabled ? { action, params: { ...input.params } } : null;
      }
      const action = this.registry.get('request_password_reset_email');
      return action?.enabled ? { action, params: { ...input.params } } : null;
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
