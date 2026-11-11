import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  BlivapBankAccount,
  BlivapBankOption,
  BlivapBloodRequestSummary,
  BlivapCallContext,
  BlivapDonationSummary,
  BlivapDonorListItem,
  BlivapHospitalSummary,
  BlivapIntegrationPort,
  BlivapMeetupSession,
  BlivapNotificationItem,
  BlivapNotificationRequest,
  BlivapNotificationSettings,
  BlivapPayoutSummary,
  BlivapTopupStart,
  BlivapUserProfile,
  BlivapWalletSummary,
  BlivapWelfarePackage,
} from './blivap.types.js';

@Injectable()
export class NoopBlivapClient implements BlivapIntegrationPort {
  private readonly logger = new Logger(NoopBlivapClient.name);

  private unavailable(operation: string): Promise<never> {
    this.logger.warn(
      `Blivap integration not configured: ${operation}. Set BLIVAP_API_BASE_URL and forward a user access token.`,
    );
    return Promise.reject(
      new ServiceUnavailableException(
        `Blivap integration unavailable for ${operation}`,
      ),
    );
  }

  getProfile(_ctx: BlivapCallContext): Promise<BlivapUserProfile> {
    return this.unavailable('getProfile');
  }

  updateProfile(_ctx: BlivapCallContext, _patch: Record<string, unknown>): Promise<BlivapUserProfile> {
    return this.unavailable('updateProfile');
  }

  changePassword(_ctx: BlivapCallContext, _input: { oldPassword: string; password: string }): Promise<{ ok: boolean }> {
    return this.unavailable('changePassword');
  }

  requestPasswordReset(_email: string): Promise<{ queued: boolean }> {
    return this.unavailable('requestPasswordReset');
  }

  submitNinVerification(_ctx: BlivapCallContext, _nin: string): Promise<Record<string, unknown>> {
    return this.unavailable('submitNinVerification');
  }

  getWalletSummary(_ctx: BlivapCallContext): Promise<BlivapWalletSummary> {
    return this.unavailable('getWalletSummary');
  }

  startWalletTopup(_ctx: BlivapCallContext, _input: { amountKobo: number; callbackUrl: string }): Promise<BlivapTopupStart> {
    return this.unavailable('startWalletTopup');
  }

  verifyWalletTopup(_ctx: BlivapCallContext, _reference: string): Promise<BlivapWalletSummary> {
    return this.unavailable('verifyWalletTopup');
  }

  listBanks(_ctx: BlivapCallContext): Promise<BlivapBankOption[]> {
    return this.unavailable('listBanks');
  }

  listBankAccounts(_ctx: BlivapCallContext): Promise<BlivapBankAccount[]> {
    return this.unavailable('listBankAccounts');
  }

  resolveBankAccount(_ctx: BlivapCallContext, _input: { accountNumber: string; bank?: string }): Promise<Record<string, unknown>> {
    return this.unavailable('resolveBankAccount');
  }

  addBankAccount(_ctx: BlivapCallContext, _input: { accountNumber: string; bank?: string }): Promise<BlivapBankAccount> {
    return this.unavailable('addBankAccount');
  }

  setPrimaryBankAccount(_ctx: BlivapCallContext, _accountId: string): Promise<BlivapBankAccount> {
    return this.unavailable('setPrimaryBankAccount');
  }

  removeBankAccount(_ctx: BlivapCallContext, _accountId: string): Promise<void> {
    return this.unavailable('removeBankAccount');
  }

  listPayouts(_ctx: BlivapCallContext): Promise<BlivapPayoutSummary[]> {
    return this.unavailable('listPayouts');
  }

  getPayout(_ctx: BlivapCallContext, _payoutId: string): Promise<BlivapPayoutSummary> {
    return this.unavailable('getPayout');
  }

  startWalletPayout(_ctx: BlivapCallContext, _input: { amountKobo: number; bankAccountId?: string }): Promise<BlivapPayoutSummary> {
    return this.unavailable('startWalletPayout');
  }

  confirmWalletPayout(_ctx: BlivapCallContext, _payoutId: string, _otp: string): Promise<BlivapPayoutSummary> {
    return this.unavailable('confirmWalletPayout');
  }

  resendPayoutOtp(_ctx: BlivapCallContext, _payoutId: string): Promise<BlivapPayoutSummary> {
    return this.unavailable('resendPayoutOtp');
  }

  getDonationHistory(_ctx: BlivapCallContext): Promise<BlivapDonationSummary[]> {
    return this.unavailable('getDonationHistory');
  }

  listBookings(_ctx: BlivapCallContext, _query?: { filter?: string; limit?: number }): Promise<BlivapDonationSummary[]> {
    return this.unavailable('listBookings');
  }

  getDonationStatus(_ctx: BlivapCallContext, _donationId: string): Promise<BlivapDonationSummary | null> {
    return this.unavailable('getDonationStatus');
  }

  requestBooking(_ctx: BlivapCallContext, _input: { donorUserId: string; hospitalId: string; scheduledAt: string; bloodRequestId?: string; donationType?: string }): Promise<BlivapDonationSummary> {
    return this.unavailable('requestBooking');
  }

  acceptBooking(_ctx: BlivapCallContext, _bookingId: string): Promise<BlivapDonationSummary> {
    return this.unavailable('acceptBooking');
  }

  declineBooking(_ctx: BlivapCallContext, _bookingId: string): Promise<BlivapDonationSummary> {
    return this.unavailable('declineBooking');
  }

  cancelBooking(_ctx: BlivapCallContext, _bookingId: string): Promise<BlivapDonationSummary> {
    return this.unavailable('cancelBooking');
  }

  reportBooking(_ctx: BlivapCallContext, _bookingId: string, _input: { reason: string; details?: string }): Promise<BlivapDonationSummary> {
    return this.unavailable('reportBooking');
  }

  getBloodRequests(_ctx: BlivapCallContext): Promise<BlivapBloodRequestSummary[]> {
    return this.unavailable('getBloodRequests');
  }

  getBloodRequestStatus(_ctx: BlivapCallContext, _requestId: string): Promise<BlivapBloodRequestSummary | null> {
    return this.unavailable('getBloodRequestStatus');
  }

  createBloodRequest(_ctx: BlivapCallContext, _input: { neededBloodType: string; location: { type: "Point"; coordinates: [number, number] }; city?: string; state?: string; urgent?: boolean; notes?: string }): Promise<BlivapBloodRequestSummary> {
    return this.unavailable('createBloodRequest');
  }

  getDonorProfile(_ctx: BlivapCallContext): Promise<Record<string, unknown> | null> {
    return this.unavailable('getDonorProfile');
  }

  listDonors(
    _ctx: BlivapCallContext,
    _query?: { bloodType?: string; search?: string; limit?: number },
  ): Promise<BlivapDonorListItem[]> {
    return this.unavailable('listDonors');
  }

  registerDonor(_ctx: BlivapCallContext, _input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.unavailable('registerDonor');
  }

  updateDonorLocation(_ctx: BlivapCallContext, _input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.unavailable('updateDonorLocation');
  }

  updateMeetupCare(_ctx: BlivapCallContext, _input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.unavailable('updateMeetupCare');
  }

  getNotificationSettings(_ctx: BlivapCallContext): Promise<BlivapNotificationSettings> {
    return this.unavailable('getNotificationSettings');
  }

  listNotifications(_ctx: BlivapCallContext, _limit?: number): Promise<BlivapNotificationItem[]> {
    return this.unavailable('listNotifications');
  }

  updateNotificationSettings(_ctx: BlivapCallContext, _patch: Partial<BlivapNotificationSettings>): Promise<BlivapNotificationSettings> {
    return this.unavailable('updateNotificationSettings');
  }

  markNotificationRead(_ctx: BlivapCallContext, _notificationId: string): Promise<void> {
    return this.unavailable('markNotificationRead');
  }

  markAllNotificationsRead(_ctx: BlivapCallContext): Promise<void> {
    return this.unavailable('markAllNotificationsRead');
  }

  listHospitals(_ctx: BlivapCallContext): Promise<BlivapHospitalSummary[]> {
    return this.unavailable('listHospitals');
  }

  listWelfarePackages(_ctx: BlivapCallContext): Promise<BlivapWelfarePackage[]> {
    return this.unavailable('listWelfarePackages');
  }

  getMeetupSession(_ctx: BlivapCallContext, _sessionId: string): Promise<BlivapMeetupSession> {
    return this.unavailable('getMeetupSession');
  }

  createMeetupSession(_ctx: BlivapCallContext, _bookingId: string): Promise<BlivapMeetupSession> {
    return this.unavailable('createMeetupSession');
  }

  verifyMeetupCode(_ctx: BlivapCallContext, _sessionId: string, _code: string): Promise<BlivapMeetupSession> {
    return this.unavailable('verifyMeetupCode');
  }

  confirmMeetupRequester(_ctx: BlivapCallContext, _sessionId: string): Promise<BlivapMeetupSession> {
    return this.unavailable('confirmMeetupRequester');
  }

  confirmMeetupDonor(_ctx: BlivapCallContext, _sessionId: string): Promise<BlivapMeetupSession> {
    return this.unavailable('confirmMeetupDonor');
  }

  completeMeetup(_ctx: BlivapCallContext, _sessionId: string): Promise<BlivapMeetupSession> {
    return this.unavailable('completeMeetup');
  }

  terminateMeetup(_ctx: BlivapCallContext, _sessionId: string, _reason?: string): Promise<BlivapMeetupSession> {
    return this.unavailable('terminateMeetup');
  }

  reportMeetup(_ctx: BlivapCallContext, _sessionId: string, _input: { reason: string; details?: string }): Promise<BlivapMeetupSession> {
    return this.unavailable('reportMeetup');
  }

  resendVerificationEmail(_email: string): Promise<{ queued: boolean }> {
    return this.unavailable('resendVerificationEmail');
  }

  notifyUser(_payload: BlivapNotificationRequest): Promise<{ accepted: boolean }> {
    return this.unavailable('notifyUser');
  }
}
