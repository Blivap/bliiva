import type { LlmToolDefinition } from './llm.types.js';

/** Hard cap: the model may see at most this many tools on one turn. */
export const MAX_TOOLS_PER_TURN = 3;

/**
 * First matching group wins, then at most three of those tools that are
 * actually enabled. The prompt text must not list these names.
 */
const TURN_TOOL_GROUPS: Array<{ pattern: RegExp; names: string[] }> = [
  {
    pattern: /\b(top[\s-]?up|add money|fund (my )?wallet)\b/i,
    names: ['start_wallet_topup', 'verify_wallet_topup', 'get_wallet_summary'],
  },
  {
    pattern: /\bverify (?:my )?(?:top[\s-]?up|payment|paystack)\b/i,
    names: ['verify_wallet_topup', 'get_wallet_summary'],
  },
  {
    pattern: /\b(withdraw|cash out|payout|otp)\b/i,
    names: [
      'start_wallet_payout',
      'confirm_wallet_payout',
      'resend_payout_otp',
    ],
  },
  {
    pattern: /\b(bank account|account number|saved bank)\b/i,
    names: ['list_bank_accounts', 'add_bank_account', 'list_banks'],
  },
  {
    pattern: /\bbanks?\b/i,
    names: ['list_banks', 'list_bank_accounts'],
  },
  {
    pattern: /\b(balance|wallet|transactions?)\b/i,
    names: ['get_wallet_summary', 'list_payouts', 'list_bank_accounts'],
  },
  {
    pattern: /\b(booking|appointment|donation)s?\b/i,
    names: ['get_donations', 'list_bookings', 'cancel_booking'],
  },
  {
    pattern: /\b(blood )?requests?\b/i,
    names: ['get_blood_requests', 'get_blood_request', 'create_blood_request'],
  },
  {
    pattern: /\bnotifications?\b/i,
    names: [
      'list_notifications',
      'get_notification_settings',
      'mark_notification_read',
    ],
  },
  {
    pattern: /\bmeetup\b/i,
    names: ['get_meetup_session', 'verify_meetup_code', 'confirm_meetup_donor'],
  },
  {
    pattern: /\b(nin|identity verif)\b/i,
    names: [
      'get_identity_verification_status',
      'submit_nin_verification',
      'get_profile',
    ],
  },
  {
    pattern: /\b(donor|register as)\b/i,
    names: ['get_donor_profile', 'register_donor', 'list_donors'],
  },
  {
    pattern: /\b(profile|password|sign[\s-]?in|log[\s-]?in|account status)\b/i,
    names: ['get_profile', 'get_account_status', 'change_password'],
  },
  {
    pattern: /\bhospitals?\b/i,
    names: ['list_hospitals'],
  },
];

export function selectTurnTools(
  message: string,
  tools: LlmToolDefinition[],
): LlmToolDefinition[] {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  for (const group of TURN_TOOL_GROUPS) {
    if (!group.pattern.test(message)) continue;
    const picked: LlmToolDefinition[] = [];
    for (const name of group.names) {
      const tool = byName.get(name);
      if (!tool) continue;
      picked.push(tool);
      if (picked.length === MAX_TOOLS_PER_TURN) break;
    }
    if (picked.length > 0) return picked;
  }
  return [];
}
