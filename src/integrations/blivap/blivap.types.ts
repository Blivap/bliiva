export interface BlivapUserProfile {
  id: string;
  email: string;
  firstname?: string;
  lastname?: string;
  phonenumber?: string | null;
  emailVerified: boolean;
  roles: string[];
  publicId?: string | null;
  identityVerified: boolean;
  identityProfileLocked: boolean;
  isSuspended: boolean;
  isDeleted: boolean;
}

export interface BlivapWalletEntry {
  type: string;
  label: string;
  status: string;
  direction: string;
  amountKobo: number;
  bookingId?: string | null;
  reference?: string | null;
  createdAt?: string | null;
}

export interface BlivapWalletSummary {
  availableKobo: number;
  heldKobo: number;
  payoutHeldKobo: number;
  currency: string;
  entries: BlivapWalletEntry[];
}

export interface BlivapDonationSummary {
  id: string;
  status: string;
  donationType?: string;
  scheduledAt?: string | null;
  hospitalId?: string | null;
  hospitalName?: string | null;
  role?: string | null;
}

export interface BlivapBloodRequestSummary {
  id: string;
  status: string;
  neededBloodType?: string;
  urgency?: string;
  urgent?: boolean;
  city?: string | null;
  state?: string | null;
  createdAt?: string | null;
}

export interface BlivapNotificationSettings {
  pushEnabled: boolean;
  donationReminders: boolean;
  nearbyDrives: boolean;
  eligibilityAlerts: boolean;
  rewardUpdates: boolean;
  appUpdates: boolean;
}

export interface BlivapNotificationItem {
  id: string;
  title: string;
  body: string;
  type?: string;
  read?: boolean;
  createdAt?: string | null;
}

export interface BlivapNotificationRequest {
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
  channels?: Array<'in_app' | 'email' | 'push'>;
}

export interface BlivapBankAccount {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isPrimary: boolean;
}

export interface BlivapBankOption {
  bank: string;
  code: string;
}

export interface BlivapPayoutSummary {
  id: string;
  reference: string;
  amountKobo: number;
  currency: string;
  status: string;
  bankName: string;
  accountName: string;
  accountLast4: string;
  failureReason: string | null;
  receiptAvailable: boolean;
  createdAt?: string | null;
  paidAt?: string | null;
}

export interface BlivapTopupStart {
  reference: string;
  authorizationUrl: string;
  amountKobo: number;
}

export interface BlivapHospitalSummary {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
}

export interface BlivapWelfarePackage {
  id: string;
  name: string;
  amountKobo?: number;
  description?: string | null;
}

export interface BlivapDonorListItem {
  id: string;
  userId: string;
  publicId?: string | null;
  bloodType: string;
  city?: string | null;
  state?: string | null;
  isActiveDonor?: boolean;
  isInDonationCooldown?: boolean;
  averageRating?: number;
}

export interface BlivapMeetupSession {
  id: string;
  bookingId?: string;
  status: string;
  codeHint?: string | null;
}

export interface BlivapCallContext {
  /** Authenticated Blivap user id from the support request. Never taken from chat. */
  userId: string;
  /** Blivap user JWT used for ownership-enforced routes. */
  accessToken: string;
}

/**
 * Blivap-backend endpoints used by support actions (user JWT unless noted).
 */
export interface BlivapIntegrationPort {
  getProfile(ctx: BlivapCallContext): Promise<BlivapUserProfile>;
  updateProfile(
    ctx: BlivapCallContext,
    patch: Record<string, unknown>,
  ): Promise<BlivapUserProfile>;
  changePassword(
    ctx: BlivapCallContext,
    input: { oldPassword: string; password: string },
  ): Promise<{ ok: boolean }>;
  requestPasswordReset(email: string): Promise<{ queued: boolean }>;
  submitNinVerification(
    ctx: BlivapCallContext,
    nin: string,
  ): Promise<Record<string, unknown>>;

  getWalletSummary(ctx: BlivapCallContext): Promise<BlivapWalletSummary>;
  startWalletTopup(
    ctx: BlivapCallContext,
    input: { amountKobo: number; callbackUrl: string },
  ): Promise<BlivapTopupStart>;
  verifyWalletTopup(
    ctx: BlivapCallContext,
    reference: string,
  ): Promise<BlivapWalletSummary>;
  listBanks(ctx: BlivapCallContext): Promise<BlivapBankOption[]>;
  listBankAccounts(ctx: BlivapCallContext): Promise<BlivapBankAccount[]>;
  resolveBankAccount(
    ctx: BlivapCallContext,
    input: { accountNumber: string; bank?: string },
  ): Promise<Record<string, unknown>>;
  addBankAccount(
    ctx: BlivapCallContext,
    input: { accountNumber: string; bank?: string },
  ): Promise<BlivapBankAccount>;
  setPrimaryBankAccount(
    ctx: BlivapCallContext,
    accountId: string,
  ): Promise<BlivapBankAccount>;
  removeBankAccount(ctx: BlivapCallContext, accountId: string): Promise<void>;
  listPayouts(ctx: BlivapCallContext): Promise<BlivapPayoutSummary[]>;
  getPayout(
    ctx: BlivapCallContext,
    payoutId: string,
  ): Promise<BlivapPayoutSummary>;
  startWalletPayout(
    ctx: BlivapCallContext,
    input: { amountKobo: number; bankAccountId?: string },
  ): Promise<BlivapPayoutSummary>;
  confirmWalletPayout(
    ctx: BlivapCallContext,
    payoutId: string,
    otp: string,
  ): Promise<BlivapPayoutSummary>;
  resendPayoutOtp(
    ctx: BlivapCallContext,
    payoutId: string,
  ): Promise<BlivapPayoutSummary>;

  getDonationHistory(ctx: BlivapCallContext): Promise<BlivapDonationSummary[]>;
  listBookings(
    ctx: BlivapCallContext,
    query?: { filter?: string; limit?: number },
  ): Promise<BlivapDonationSummary[]>;
  getDonationStatus(
    ctx: BlivapCallContext,
    donationId: string,
  ): Promise<BlivapDonationSummary | null>;
  requestBooking(
    ctx: BlivapCallContext,
    input: {
      donorUserId: string;
      hospitalId: string;
      scheduledAt: string;
      bloodRequestId?: string;
      donationType?: string;
    },
  ): Promise<BlivapDonationSummary>;
  acceptBooking(
    ctx: BlivapCallContext,
    bookingId: string,
  ): Promise<BlivapDonationSummary>;
  declineBooking(
    ctx: BlivapCallContext,
    bookingId: string,
  ): Promise<BlivapDonationSummary>;
  cancelBooking(
    ctx: BlivapCallContext,
    bookingId: string,
  ): Promise<BlivapDonationSummary>;
  reportBooking(
    ctx: BlivapCallContext,
    bookingId: string,
    input: { reason: string; details?: string },
  ): Promise<BlivapDonationSummary>;

  getBloodRequests(
    ctx: BlivapCallContext,
  ): Promise<BlivapBloodRequestSummary[]>;
  getBloodRequestStatus(
    ctx: BlivapCallContext,
    requestId: string,
  ): Promise<BlivapBloodRequestSummary | null>;
  createBloodRequest(
    ctx: BlivapCallContext,
    input: {
      neededBloodType: string;
      location: { type: 'Point'; coordinates: [number, number] };
      city?: string;
      state?: string;
      urgent?: boolean;
      notes?: string;
    },
  ): Promise<BlivapBloodRequestSummary>;

  getDonorProfile(
    ctx: BlivapCallContext,
  ): Promise<Record<string, unknown> | null>;
  listDonors(
    ctx: BlivapCallContext,
    query?: { bloodType?: string; search?: string; limit?: number },
  ): Promise<BlivapDonorListItem[]>;
  registerDonor(
    ctx: BlivapCallContext,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  updateDonorLocation(
    ctx: BlivapCallContext,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  updateMeetupCare(
    ctx: BlivapCallContext,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;

  getNotificationSettings(
    ctx: BlivapCallContext,
  ): Promise<BlivapNotificationSettings>;
  listNotifications(
    ctx: BlivapCallContext,
    limit?: number,
  ): Promise<BlivapNotificationItem[]>;
  updateNotificationSettings(
    ctx: BlivapCallContext,
    patch: Partial<BlivapNotificationSettings>,
  ): Promise<BlivapNotificationSettings>;
  markNotificationRead(
    ctx: BlivapCallContext,
    notificationId: string,
  ): Promise<void>;
  markAllNotificationsRead(ctx: BlivapCallContext): Promise<void>;

  listHospitals(ctx: BlivapCallContext): Promise<BlivapHospitalSummary[]>;
  listWelfarePackages(
    ctx: BlivapCallContext,
  ): Promise<BlivapWelfarePackage[]>;
  getMeetupSession(
    ctx: BlivapCallContext,
    sessionId: string,
  ): Promise<BlivapMeetupSession>;
  createMeetupSession(
    ctx: BlivapCallContext,
    bookingId: string,
  ): Promise<BlivapMeetupSession>;
  verifyMeetupCode(
    ctx: BlivapCallContext,
    sessionId: string,
    code: string,
  ): Promise<BlivapMeetupSession>;
  confirmMeetupRequester(
    ctx: BlivapCallContext,
    sessionId: string,
  ): Promise<BlivapMeetupSession>;
  confirmMeetupDonor(
    ctx: BlivapCallContext,
    sessionId: string,
  ): Promise<BlivapMeetupSession>;
  completeMeetup(
    ctx: BlivapCallContext,
    sessionId: string,
  ): Promise<BlivapMeetupSession>;
  terminateMeetup(
    ctx: BlivapCallContext,
    sessionId: string,
    reason?: string,
  ): Promise<BlivapMeetupSession>;
  reportMeetup(
    ctx: BlivapCallContext,
    sessionId: string,
    input: { reason: string; details?: string },
  ): Promise<BlivapMeetupSession>;

  resendVerificationEmail(email: string): Promise<{ queued: boolean }>;
  notifyUser(
    payload: BlivapNotificationRequest,
  ): Promise<{ accepted: boolean }>;
}
