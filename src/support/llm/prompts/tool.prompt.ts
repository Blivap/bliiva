import type { SupportActionDefinition } from '../../actions/actions.types.js';

/** Human-facing use cases for each allowlisted Blivap action (reasoning aid). */
const ACTION_USE_CASES: Record<string, string> = {
  get_profile: 'profile details (name, phone, account info) via GET /authentication/me',
  get_account_status:
    'whether the account is active, verified, or ready via GET /authentication/me',
  get_identity_verification_status:
    'email / NIN / identity verification progress via GET /authentication/me',
  resend_email_verification:
    'resend verification email via POST /authentication/resend-email-verification-link (needs chat confirmation)',
  update_profile: 'update profile fields via PUT /authentication/me (confirm first)',
  change_password:
    'change password via PUT /authentication/change-password (confirm first; never log secrets)',
  request_password_reset_email:
    'email reset link via forgot-password for the signed-in account (confirm first)',
  submit_nin_verification:
    'submit 11-digit NIN via POST /nin-verification (confirm first)',
  get_donor_profile: 'signed-in user’s own donor profile via GET /donors/me',
  list_donors:
    'browse donors (optional bloodType like O+) via GET /donors — not the user’s own profile',
  register_donor: 'register as donor (confirm first)',
  update_donor_location: 'update donor location (confirm first)',
  update_meetup_care: 'set meetup care self/requested (confirm first)',
  get_donations:
    'donation history, bookings, upcoming appointments via GET /bookings/mine',
  get_donation:
    'one specific donation/booking by id via GET /bookings/mine (filter by id)',
  list_bookings: 'filtered bookings via GET /bookings',
  cancel_booking:
    'cancel a booking via PATCH /bookings/:id/cancel (needs confirmation, high risk)',
  request_booking: 'request a booking via POST /bookings/request (confirm first)',
  accept_booking: 'accept a booking (confirm first)',
  decline_booking: 'decline a booking (confirm first)',
  report_booking: 'report a booking issue (confirm first)',
  get_blood_requests: 'user blood request list via GET /blood-requests/mine',
  get_blood_request:
    'one specific blood request by id via GET /blood-requests/mine (filter by id)',
  create_blood_request: 'create blood request via POST /blood-requests (confirm first)',
  get_wallet_summary: 'wallet balance and recent transactions via GET /wallet',
  list_banks: 'supported banks via GET /wallet/banks',
  list_bank_accounts: 'saved bank accounts via GET /wallet/bank-accounts',
  add_bank_account: 'save a bank account (confirm first)',
  set_primary_bank_account: 'set primary bank account (confirm first)',
  remove_bank_account: 'remove a bank account (confirm first)',
  list_payouts: 'withdrawal history via GET /wallet/payouts',
  get_payout: 'one payout via GET /wallet/payouts/:id',
  start_wallet_topup:
    'start top-up via POST /wallet/topups — returns Paystack URL (confirm amount first)',
  verify_wallet_topup:
    'verify top-up via POST /wallet/topups/:reference/verify after user pays',
  start_wallet_payout:
    'start withdrawal via POST /wallet/payouts (confirm amount; OTP emailed)',
  confirm_wallet_payout:
    'confirm withdrawal with OTP via POST /wallet/payouts/:id/confirm (redact OTP)',
  resend_payout_otp: 'resend payout OTP (confirm first)',
  get_notification_settings:
    'notification preferences via GET /notifications/settings',
  list_notifications: 'recent / unread notifications via GET /notifications',
  update_notification_settings:
    'change notification prefs via PATCH /notifications/settings (needs confirmation)',
  mark_notification_read: 'mark one notification read',
  mark_all_notifications_read: 'mark all notifications read (confirm first)',
  list_hospitals: 'list hospitals via GET /hospitals',
  list_welfare_packages: 'list welfare packages via GET /welfare-packages',
  get_meetup_session: 'meetup session via GET /meetups/:sessionId',
  create_meetup_session: 'create meetup for a booking (confirm first)',
  verify_meetup_code: 'verify meetup code/QR (confirm first)',
  confirm_meetup_requester: 'requester meetup confirm (confirm first)',
  confirm_meetup_donor: 'donor meetup confirm (confirm first)',
  complete_meetup: 'complete meetup (confirm first)',
  terminate_meetup: 'terminate meetup (confirm first)',
  report_meetup: 'report meetup (confirm first)',
};

export function buildToolPrompt(
  actions: SupportActionDefinition[] = [],
): string {
  const enabled = actions.filter((action) => action.enabled);
  const catalog =
    enabled.length > 0
      ? enabled
          .map((action) => {
            const useCase =
              ACTION_USE_CASES[action.name] ?? action.description;
            const confirm = action.requiresConfirmation
              ? ' [confirm in chat first]'
              : '';
            return `- ${action.name}: ${useCase}${confirm}`;
          })
          .join('\n')
      : Object.entries(ACTION_USE_CASES)
          .map(([name, useCase]) => `- ${name}: ${useCase}`)
          .join('\n');

  return [
    'Bliiva only assists via this allowlisted action registry that calls Blivap for the signed-in user. Never pass a user id. Never invent endpoints or data.',
    'During reasoning: match what the user wants to exactly one action below, call it, then answer from the tool result.',
    'If they ask for live account data (balance, bookings, banks, payouts, hospitals, notifications, etc.), call the tool in this turn and answer from the result — never ask permission or say “Want me to show it?” / “shown below” first.',
    'Money and high-risk writes need chat confirmation first (except OTP/reference paste for confirm_wallet_payout / verify_wallet_topup).',
    'OTP/password are only for the user’s own confirmed wallet/security actions. Never ask for OTP unsolicited. Never echo secrets in replies.',
    'If they confirm an offer (yes / do it / show me / go ahead), call that action now.',
    'Do not call tools for idle acks (ok, alright, thanks, sure, nothing) or off-topic chat.',
    'Allowlisted actions:',
    catalog,
    'After the tool returns, reply in 2–4 short sentences: what you found, then one clear next step in the app. Never include reasoning or tool-choice notes in that reply.',
    'Never invent tool results. On one failure, say so and suggest retry. If it keeps failing, ask whether they want a human specialist — wait for yes before treating it as escalated.',
    'Prefer tools for live account ops; approved knowledge for how-to. Never invent policy.',
  ].join('\n');
}
