/**
 * After a lookup or action, add a short next-step tip.
 * Escalate to a specialist only after repeated dead ends elsewhere.
 */
export function withActionGuidance(
  actionName: string,
  message: string,
  outcome: 'success' | 'failed' | 'rejected' = 'success',
): string {
  const tip = tipFor(actionName, outcome);
  if (!tip) return message;
  return `${message.trim()}\n\n${tip}`;
}

function tipFor(
  actionName: string,
  outcome: 'success' | 'failed' | 'rejected',
): string | null {
  if (outcome === 'rejected') {
    return 'Sign in from the Blivap app and ask again so I can look that up for you.';
  }
  if (outcome === 'failed') {
    // Do not invite “say yes” here — that only works when pendingClarification
    // is escalation_confirm (dead-end path). First failure = retry.
    return 'Please try again in a moment, or ask me something else.';
  }

  switch (actionName) {
    case 'get_wallet_summary':
      return 'Need a Wallet top-up, withdrawal with OTP, or payout list? Tell me what you want next.';
    case 'list_bank_accounts':
    case 'list_banks':
      return 'Need to save a bank or start a withdrawal? Tell me the amount or which account.';
    case 'list_payouts':
    case 'get_payout':
      return 'Need to resend an OTP or start a new withdrawal? Say the word.';
    case 'start_wallet_topup':
      return 'After you pay in the browser/app, say “verify top-up” with the reference.';
    case 'start_wallet_payout':
    case 'resend_payout_otp':
      return 'Paste the 6-character OTP from your email to confirm the withdrawal.';
    case 'get_donations':
    case 'get_donation':
    case 'list_bookings':
      return 'Want help with a booking? Tell me which one, or ask to accept, decline, or cancel.';
    case 'get_blood_requests':
    case 'get_blood_request':
      return 'Need to create or check a request? Tell me what you need.';
    case 'list_notifications':
      return 'Want to mark one or all as read, or change alert settings? Ask me.';
    case 'get_notification_settings':
      return 'I can turn push on or off if you ask — or open Notifications in the app.';
    case 'list_hospitals':
    case 'list_welfare_packages':
      return 'Need that for a booking or meetup? Tell me the next step.';
    case 'get_meetup_session':
      return 'Need to verify a code, confirm, or complete this meetup? Say which step.';
    case 'get_profile':
    case 'get_account_status':
    case 'get_identity_verification_status':
      return 'Need to update profile, submit NIN, or fix verification? Tell me what’s stuck.';
    case 'get_donor_profile':
      return 'Questions about registering or meetup care? Ask me, or open Donor profile in the app.';
    case 'list_donors':
      return 'Want to book one? Open that donor in the app, or tell me a different blood type to list.';
    default:
      return 'Anything else I can check for you?';
  }
}
