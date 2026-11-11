/**
 * Free-text params while awaiting action_resource (OTP, NIN, codes, amounts).
 * Secrets are parsed here for the allowlisted action only — never logged.
 */
export function extractPendingActionParams(
  actionName: string,
  normalized: string,
  raw: string,
): Record<string, string> | null {
  const trimmed = raw.trim();
  switch (actionName) {
    case 'confirm_wallet_payout': {
      const otp = trimmed.match(/\b([A-Za-z0-9]{6})\b/)?.[1];
      return otp ? { otp } : null;
    }
    case 'verify_wallet_topup': {
      const reference =
        trimmed.match(/\b([A-Za-z0-9_-]{8,64})\b/)?.[1] ??
        (normalized.length >= 8 ? trimmed : null);
      return reference ? { reference } : null;
    }
    case 'verify_meetup_code': {
      const code = trimmed.match(/\b(\d{6})\b/)?.[1];
      return code ? { code } : null;
    }
    case 'submit_nin_verification': {
      const nin = trimmed.match(/\b(\d{11})\b/)?.[1];
      return nin ? { nin } : null;
    }
    case 'start_wallet_topup':
    case 'start_wallet_payout': {
      const amount = trimmed.match(/\b(\d+(?:\.\d{1,2})?)\b/)?.[1];
      return amount ? { amountNaira: amount } : null;
    }
    case 'add_bank_account': {
      const accountNumber = trimmed.match(/\b(\d{10})\b/)?.[1];
      return accountNumber ? { accountNumber } : null;
    }
    case 'change_password': {
      // "old: x new: y" or two tokens — keep minimal; prefer labeled form.
      const labeled = trimmed.match(
        /old(?:Password)?\s*[:=]\s*(\S+).*(?:new|password)\s*[:=]\s*(\S+)/i,
      );
      if (labeled) {
        return { oldPassword: labeled[1]!, password: labeled[2]! };
      }
      return null;
    }
    case 'report_booking':
    case 'report_meetup':
    case 'terminate_meetup': {
      if (trimmed.length < 3) return null;
      return { reason: trimmed.slice(0, 500) };
    }
    case 'cancel_booking':
    case 'accept_booking':
    case 'decline_booking':
    case 'get_donation':
    case 'get_payout':
    case 'get_meetup_session':
    case 'mark_notification_read':
    case 'set_primary_bank_account':
    case 'remove_bank_account': {
      const id = trimmed.match(
        /\b([0-9a-f]{24}|[0-9a-f-]{36}|[A-Za-z0-9_-]{8,})\b/i,
      )?.[1];
      if (!id) return null;
      if (actionName === 'get_payout') return { payoutId: id };
      if (actionName === 'get_meetup_session') return { sessionId: id };
      if (actionName === 'mark_notification_read')
        return { notificationId: id };
      if (
        actionName === 'set_primary_bank_account' ||
        actionName === 'remove_bank_account'
      ) {
        return { bankAccountId: id };
      }
      return { bookingId: id, donationId: id };
    }
    default:
      return null;
  }
}
