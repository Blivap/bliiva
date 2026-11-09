import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  BlivapBloodRequestSummary,
  BlivapCallContext,
  BlivapDonationSummary,
  BlivapIntegrationPort,
  BlivapNotificationItem,
  BlivapNotificationRequest,
  BlivapNotificationSettings,
  BlivapUserProfile,
  BlivapWalletSummary,
} from './blivap.types.js';

/**
 * Fails closed when no HTTP Blivap client is configured.
 * Controllers/actions catch this and escalate or ask the user to retry.
 */
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

  getWalletSummary(_ctx: BlivapCallContext): Promise<BlivapWalletSummary> {
    return this.unavailable('getWalletSummary');
  }

  getDonationHistory(
    _ctx: BlivapCallContext,
  ): Promise<BlivapDonationSummary[]> {
    return this.unavailable('getDonationHistory');
  }

  getDonationStatus(
    _ctx: BlivapCallContext,
    _donationId: string,
  ): Promise<BlivapDonationSummary | null> {
    return this.unavailable('getDonationStatus');
  }

  getBloodRequests(
    _ctx: BlivapCallContext,
  ): Promise<BlivapBloodRequestSummary[]> {
    return this.unavailable('getBloodRequests');
  }

  getBloodRequestStatus(
    _ctx: BlivapCallContext,
    _requestId: string,
  ): Promise<BlivapBloodRequestSummary | null> {
    return this.unavailable('getBloodRequestStatus');
  }

  getDonorProfile(
    _ctx: BlivapCallContext,
  ): Promise<Record<string, unknown> | null> {
    return this.unavailable('getDonorProfile');
  }

  getNotificationSettings(
    _ctx: BlivapCallContext,
  ): Promise<BlivapNotificationSettings> {
    return this.unavailable('getNotificationSettings');
  }

  listNotifications(
    _ctx: BlivapCallContext,
    _limit?: number,
  ): Promise<BlivapNotificationItem[]> {
    return this.unavailable('listNotifications');
  }

  updateNotificationSettings(
    _ctx: BlivapCallContext,
    _patch: Partial<BlivapNotificationSettings>,
  ): Promise<BlivapNotificationSettings> {
    return this.unavailable('updateNotificationSettings');
  }

  cancelBooking(
    _ctx: BlivapCallContext,
    _bookingId: string,
  ): Promise<BlivapDonationSummary> {
    return this.unavailable('cancelBooking');
  }

  resendVerificationEmail(_email: string): Promise<{ queued: boolean }> {
    return this.unavailable('resendVerificationEmail');
  }

  notifyUser(
    _payload: BlivapNotificationRequest,
  ): Promise<{ accepted: boolean }> {
    return this.unavailable('notifyUser');
  }
}
