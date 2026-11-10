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
    return 'If this keeps failing, tell me and I can connect you to a specialist.';
  }

  switch (actionName) {
    case 'get_wallet_summary':
      return 'Need a payout or something looks wrong? Open Wallet in the app, or tell me what you want to do next.';
    case 'get_donations':
    case 'get_donation':
      return 'Want help with a booking? Tell me which one, or ask how to cancel or reschedule.';
    case 'get_blood_requests':
    case 'get_blood_request':
      return 'Need to update a request? Open Blood Requests in the app, or tell me what you need.';
    case 'list_notifications':
      return 'Want to change alerts? Ask me about your notification settings.';
    case 'get_notification_settings':
      return 'I can turn push on or off if you ask — or open Notifications in the app.';
    case 'get_profile':
    case 'get_account_status':
    case 'get_identity_verification_status':
      return 'Need to fix verification or profile details? Tell me what’s stuck, or open Profile in the app.';
    case 'get_donor_profile':
      return 'Questions about registering or eligibility rules? Ask me, or open Donor profile in the app.';
    default:
      return 'Anything else I can check for you?';
  }
}
