import { normalizeText } from '../text/text-normalizer.js';
import type { UtteranceSignals } from '../text/utterances.js';

/**
 * Detects when the bot offered to perform a lookup/action, and maps that
 * offer + a user go-ahead onto a concrete action name.
 *
 * This is the durable guard against “Want me to show it?” → “yes” →
 * “What else?” loops: go-ahead must resolve to the offered action.
 */

const OFFER_CUE =
  /\b(?:(?:do you |would you )?(?:want(?: me)? to|shall i|should i|can i|could i|may i)|let me|i can|i will|i'll)\b.{0,40}\b(show|check|get|fetch|look(?:\s+up)?|pull|open|resend|send|help|do (?:it|that)|verify)\b|\blet'?s check your\b|\byour (?:balance|wallet|bookings?|donations?|requests?|notifications?|profile).{0,40}\b(available|ready|shown below)\b|\b(?:is|are) shown below\b|\bwant me to show\b/i;

/** Read-only lookups that must run immediately for a clear ask (no “Want me to…?”). */
const IMMEDIATE_LIVE_DATA_ACTIONS = new Set([
  'get_wallet_summary',
  'get_donations',
  'get_donation',
  'get_blood_requests',
  'get_blood_request',
  'list_notifications',
  'get_notification_settings',
  'get_profile',
  'get_donor_profile',
  'get_account_status',
  'get_identity_verification_status',
  'list_bank_accounts',
  'list_banks',
  'list_payouts',
  'list_hospitals',
  'list_welfare_packages',
  'list_bookings',
  'list_donors',
]);

const TOPIC_TO_ACTION: Array<{
  pattern: RegExp;
  action: string;
  params?: Record<string, string>;
}> = [
  {
    pattern: /\b(balance|wallet|money|funds|transactions?)\b/,
    action: 'get_wallet_summary',
    params: { focus: 'balance' },
  },
  {
    pattern: /\b(payout|withdrawal)s?\b/,
    action: 'list_payouts',
  },
  {
    pattern: /\bbank accounts?\b/,
    action: 'list_bank_accounts',
  },
  {
    pattern: /\b(?:supported )?banks\b/,
    action: 'list_banks',
  },
  {
    pattern: /\bhospitals?\b/,
    action: 'list_hospitals',
  },
  {
    pattern: /\bwelfare packages?\b/,
    action: 'list_welfare_packages',
  },
  {
    pattern: /\bcancel (?:my )?(?:booking|appointment|donation)\b/,
    action: 'cancel_booking',
  },
  {
    pattern: /\b(booking|appointment|donation)s?\b/,
    action: 'get_donations',
  },
  {
    pattern: /\b(blood )?requests?\b/,
    action: 'get_blood_requests',
  },
  {
    pattern: /\b(notification settings|alert (?:prefs|preferences)|push (?:on|off))\b/,
    action: 'get_notification_settings',
  },
  {
    pattern: /\bnotifications?\b/,
    action: 'list_notifications',
  },
  {
    pattern: /\b(list|show|find|browse|available)\b.{0,30}\bdonors?\b|\bdonors?\b.{0,20}\b(list|near me|available)\b|\b[abo]b?\s*[+-]\s*donors?\b/,
    action: 'list_donors',
  },
  {
    pattern: /\b(donor profile|donor registration|am i a donor)\b/,
    action: 'get_donor_profile',
  },
  {
    pattern: /\b(profile|my (?:name|phone|email))\b/,
    action: 'get_profile',
  },
  {
    pattern:
      /\b(resend|verification(?:\s+\w+){0,2}|verify(?:ing)?(?:\s+\w+){0,2}\s+(?:email|account))\b/,
    action: 'resend_email_verification',
  },
  {
    pattern: /\b(nin|identity verif|identity check|verification status)\b/,
    action: 'get_identity_verification_status',
  },
  {
    pattern: /\b(account status|activation|is my account)\b/,
    action: 'get_account_status',
  },
];

/** Stricter patterns: user clearly wants the live lookup now. */
const IMMEDIATE_ASK: Array<{
  pattern: RegExp;
  action: string;
  params?: Record<string, string>;
}> = [
  {
    pattern:
      /\b(?:(?:i )?(?:want(?: to)?|need(?: to)?|wanna) (?:to )?(?:know|see|check|get)|(?:please )?(?:show|check|see|get|tell)(?: me)?(?: my)?|what(?:'?s| is)|how much(?: (?:do i have|is|in my wallet))?)\b.{0,40}\b(?:balance|wallet|funds|transactions?)\b|\b(?:my|the) (?:wallet )?balance\b|\b(?:my|the) wallet\b|\bwallet balance\b|\brecent transactions?\b/,
    action: 'get_wallet_summary',
    params: { focus: 'balance' },
  },
  {
    pattern:
      /\b(?:(?:i )?(?:want(?: to)?|need(?: to)?|wanna) (?:to )?(?:know|see|check|get)|(?:please )?(?:show|check|see|get|tell)(?: me)?(?: my)?|what(?:'?s| are)|my)\b.{0,40}\b(?:bookings?|appointments?|donations?)\b/,
    action: 'get_donations',
  },
  {
    pattern:
      /\b(?:(?:i )?(?:want(?: to)?|need(?: to)?|wanna) (?:to )?(?:know|see|check|get)|(?:please )?(?:show|check|see|get|tell)(?: me)?(?: my)?|what(?:'?s| are)|my)\b.{0,40}\b(?:blood )?requests?\b/,
    action: 'get_blood_requests',
  },
  {
    pattern:
      /\b(?:(?:i )?(?:want(?: to)?|need(?: to)?|wanna) (?:to )?(?:know|see|check|get)|(?:please )?(?:show|check|see|get|tell)(?: me)?(?: my)?|what(?:'?s| are)|(?:do i |did i )?have(?: any)?|any|my)\b.{0,48}\b(?:unread )?notifications?\b|\bunread notifications?\b|\bany notifications?\b/,
    action: 'list_notifications',
  },
  {
    pattern:
      /\b(?:(?:i )?(?:want(?: to)?|need(?: to)?|wanna) (?:to )?(?:know|see|check|get)|(?:please )?(?:show|check|see|get|tell)(?: me)?(?: my)?|what(?:'?s| is)|my)\b.{0,40}\b(?:profile|account status)\b|\bam i (?:a )?donor\b|\bdonor (?:profile|status|registration)\b|\bverification status\b|\bidentity (?:verif|check)/,
    action: 'get_profile',
  },
  {
    pattern:
      /\b(?:(?:please )?(?:show|list|check|see|get|tell)(?: me)?(?: my)?|my|what(?:'?s| are))\b.{0,40}\b(?:bank accounts?|saved banks?)\b/,
    action: 'list_bank_accounts',
  },
  {
    pattern:
      /\b(?:(?:please )?(?:show|list|check|see|get|tell)(?: me)?(?: my)?|my|what(?:'?s| are))\b.{0,40}\b(?:payouts?|withdrawals?)\b/,
    action: 'list_payouts',
  },
  {
    pattern:
      /\b(?:(?:please )?(?:show|list|check|see|get|tell)(?: me)?|what(?:'?s| are)|which)\b.{0,40}\bhospitals?\b/,
    action: 'list_hospitals',
  },
  {
    pattern:
      /\b(?:(?:please )?(?:show|list|check|see|get|tell)(?: me)?|what(?:'?s| are))\b.{0,40}\bwelfare packages?\b/,
    action: 'list_welfare_packages',
  },
  {
    pattern:
      /\b(?:(?:please )?(?:show|list|find|browse|get|give)(?: me)?(?: a)?(?: list of)?|my)\b.{0,40}\b(?:[abo]b?\s*[+-]\s*)?donors?\b|\b[abo]b?\s*[+-]\s*donors?\b/,
    action: 'list_donors',
  },
];

const INTENT_TO_ACTION: Record<
  string,
  { action: string; params?: Record<string, string> }
> = {
  WALLET_BALANCE: { action: 'get_wallet_summary', params: { focus: 'balance' } },
  WALLET_TRANSACTIONS: {
    action: 'get_wallet_summary',
    params: { focus: 'transactions' },
  },
  DONATION_STATUS: { action: 'get_donations' },
  APPOINTMENT_STATUS: { action: 'get_donations' },
  CANCEL_BOOKING: { action: 'cancel_booking' },
  BLOOD_REQUEST_STATUS: { action: 'get_blood_requests' },
  BLOOD_REQUEST_HELP: { action: 'get_blood_requests' },
  NOTIFICATION_HELP: { action: 'list_notifications' },
  PROFILE_UPDATE: { action: 'get_profile' },
  DONOR_REGISTRATION: { action: 'get_donor_profile' },
  ACCOUNT_STATUS: { action: 'get_account_status' },
  ACCOUNT_LOGIN: { action: 'get_account_status' },
  HOSPITAL_VERIFICATION: { action: 'get_identity_verification_status' },
  IDENTITY_VERIFICATION: { action: 'get_identity_verification_status' },
};

export function botOfferedAction(lastBotResponse: string | null | undefined): boolean {
  if (!lastBotResponse) return false;
  return OFFER_CUE.test(normalizeText(lastBotResponse));
}

export function inferOfferedAction(input: {
  lastBotResponse?: string | null;
  lastUserMessage?: string | null;
  currentIntent?: string | null;
  pendingActionName?: string | null;
}): { actionName: string; params: Record<string, string> } | null {
  if (input.pendingActionName) {
    return { actionName: input.pendingActionName, params: {} };
  }

  const haystacks = [
    input.lastBotResponse ? normalizeText(input.lastBotResponse) : '',
    input.lastUserMessage ? normalizeText(input.lastUserMessage) : '',
  ].filter(Boolean);

  for (const text of haystacks) {
    for (const rule of TOPIC_TO_ACTION) {
      if (rule.pattern.test(text)) {
        return { actionName: rule.action, params: { ...(rule.params ?? {}) } };
      }
    }
  }

  if (input.currentIntent && INTENT_TO_ACTION[input.currentIntent]) {
    const mapped = INTENT_TO_ACTION[input.currentIntent];
    return { actionName: mapped.action, params: { ...(mapped.params ?? {}) } };
  }

  return null;
}

/** Prior user ask was clearly a live-data request (balance, bookings, …). */
export function priorUserAskedForLiveData(
  lastUserMessage: string | null | undefined,
): boolean {
  if (!lastUserMessage) return false;
  const text = normalizeText(lastUserMessage);
  return TOPIC_TO_ACTION.some((rule) => rule.pattern.test(text));
}

/**
 * Clear signed-in lookups that should run now — no permission ask.
 * Skips high-risk actions that still need an explicit confirm.
 */
export function inferImmediateLiveDataAction(
  userMessage: string | null | undefined,
): { actionName: string; params: Record<string, string> } | null {
  if (!userMessage) return null;
  const text = normalizeText(userMessage);
  if (!text) return null;
  // Money mutations are confirm-gated — never auto-run as a balance read.
  if (
    /\b(withdraw|cash out|payout|top ?up|add money|fund (?:my )?wallet|transfer|refund)\b/.test(
      text,
    )
  ) {
    return null;
  }
  // Vague / how-to questions stay conversational.
  if (
    /\b(how (?:can|do|to)|where (?:can|do|to)|what is a|explain|help me (?:with|understand))\b/.test(
      text,
    ) &&
    !/\b(my|check|show|status|balance|wallet)\b/.test(text)
  ) {
    return null;
  }
  for (const rule of IMMEDIATE_ASK) {
    if (!rule.pattern.test(text)) continue;
    if (!IMMEDIATE_LIVE_DATA_ACTIONS.has(rule.action)) continue;
    // Profile catch-all: route donor / verification / account to the right tool.
    if (rule.action === 'get_profile') {
      if (/\b(donor|am i a donor)\b/.test(text)) {
        return { actionName: 'get_donor_profile', params: {} };
      }
      if (/\b(verification|identity|nin)\b/.test(text)) {
        return {
          actionName: 'get_identity_verification_status',
          params: {},
        };
      }
      if (/\baccount status\b/.test(text)) {
        return { actionName: 'get_account_status', params: {} };
      }
    }
    const focus =
      rule.action === 'get_wallet_summary' &&
      /\b(transaction|history|recent)\b/.test(text)
        ? 'transactions'
        : rule.params?.focus;
    const bloodType =
      rule.action === 'list_donors' ? extractBloodType(text) : null;
    return {
      actionName: rule.action,
      params: {
        ...(rule.params ?? {}),
        ...(focus ? { focus } : {}),
        ...(bloodType ? { bloodType } : {}),
      },
    };
  }
  return null;
}

function extractBloodType(text: string): string | null {
  // No trailing \b after +/- — "+" is non-word so \b never matches before a space.
  const match = text.match(
    /\b(ab|a|b|o)\s*([+-]|plus|minus|positive|negative)(?=\s|$|[^a-z0-9])/i,
  );
  if (!match) return null;
  const sign = match[2]!.toLowerCase();
  const compact =
    sign === '+' || sign === 'plus' || sign === 'positive'
      ? '+'
      : sign === '-' || sign === 'minus' || sign === 'negative'
        ? '-'
        : sign;
  return `${match[1]!.toUpperCase()}${compact}`;
}

/** User is accepting an offered task (yes / do it / show me / go ahead). */
export function isGoAhead(utterance: UtteranceSignals, normalized: string): boolean {
  if (utterance.affirmation || utterance.actionGoAhead) return true;
  // Soft ack alone is not enough (“alright” after “Anything else?” means done).
  // Explicit show/check language is a go-ahead even without “yes”.
  if (
    /^(?:please[, ]+)?(?:show(?: me)?(?: it)?|check(?: it)?|get it|look(?: it)? up|pull it up)(?: please)?$/.test(
      normalized,
    )
  ) {
    return true;
  }
  // “nothing more just the balance is fine” / “just the balance”
  if (
    /\bjust (?:the |my )?(balance|wallet|bookings?|donations?|requests?|notifications?|profile)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  return false;
}

export function pendingFromBotOffer(input: {
  botContent: string;
  currentIntent?: string | null;
}): {
  kind: 'action_offer';
  question: string;
  options: Array<{ intent: string; label: string; actionName?: string }>;
  actionName: string;
} | null {
  if (!botOfferedAction(input.botContent)) return null;
  const inferred = inferOfferedAction({
    lastBotResponse: input.botContent,
    currentIntent: input.currentIntent,
  });
  if (!inferred) return null;
  return {
    kind: 'action_offer',
    question: input.botContent.slice(0, 240),
    options: [
      {
        intent: input.currentIntent ?? 'GENERAL_ENQUIRY',
        label: 'yes',
        actionName: inferred.actionName,
      },
      {
        intent: input.currentIntent ?? 'GENERAL_ENQUIRY',
        label: 'no',
      },
    ],
    actionName: inferred.actionName,
  };
}
