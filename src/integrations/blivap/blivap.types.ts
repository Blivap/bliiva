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

export interface BlivapCallContext {
  /** Authenticated Blivap user id from the support request. Never taken from chat. */
  userId: string;
  /** Blivap user JWT used for ownership-enforced routes. */
  accessToken: string;
}

/**
 * Required Blivap-backend endpoints used by Phase 3:
 *
 * - GET  /authentication/me
 * - POST /authentication/resend-email-verification-link?email=
 * - GET  /donors/me
 * - GET  /bookings/mine
 * - GET  /blood-requests/mine
 * - GET  /wallet
 * - GET  /notifications
 * - GET  /notifications/settings
 * - PATCH /notifications/settings
 * - PATCH /bookings/:id/cancel
 */
export interface BlivapIntegrationPort {
  getProfile(ctx: BlivapCallContext): Promise<BlivapUserProfile>;
  getWalletSummary(ctx: BlivapCallContext): Promise<BlivapWalletSummary>;
  getDonationHistory(ctx: BlivapCallContext): Promise<BlivapDonationSummary[]>;
  getDonationStatus(
    ctx: BlivapCallContext,
    donationId: string,
  ): Promise<BlivapDonationSummary | null>;
  getBloodRequests(
    ctx: BlivapCallContext,
  ): Promise<BlivapBloodRequestSummary[]>;
  getBloodRequestStatus(
    ctx: BlivapCallContext,
    requestId: string,
  ): Promise<BlivapBloodRequestSummary | null>;
  getDonorProfile(
    ctx: BlivapCallContext,
  ): Promise<Record<string, unknown> | null>;
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
  cancelBooking(
    ctx: BlivapCallContext,
    bookingId: string,
  ): Promise<BlivapDonationSummary>;
  resendVerificationEmail(email: string): Promise<{ queued: boolean }>;
  notifyUser(
    payload: BlivapNotificationRequest,
  ): Promise<{ accepted: boolean }>;
}
