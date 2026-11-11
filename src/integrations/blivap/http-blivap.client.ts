import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

interface Envelope<T> {
  message?: string;
  data?: T;
}


@Injectable()
export class HttpBlivapClient implements BlivapIntegrationPort {
  private readonly logger = new Logger(HttpBlivapClient.name);

  constructor(private readonly config: ConfigService) {}

  async getProfile(ctx: BlivapCallContext): Promise<BlivapUserProfile> {
    const raw = await this.userGet<Record<string, unknown>>(
      ctx,
      '/authentication/me',
    );
    return projectProfile(raw, ctx.userId);
  }

  async updateProfile(
    ctx: BlivapCallContext,
    patch: Record<string, unknown>,
  ): Promise<BlivapUserProfile> {
    const raw = await this.userPut<Record<string, unknown>>(
      ctx,
      '/authentication/me',
      patch,
    );
    return projectProfile(raw, ctx.userId);
  }

  async changePassword(
    ctx: BlivapCallContext,
    input: { oldPassword: string; password: string },
  ): Promise<{ ok: boolean }> {
    await this.userPut(ctx, '/authentication/change-password', input);
    return { ok: true };
  }

  async requestPasswordReset(email: string): Promise<{ queued: boolean }> {
    await this.serviceRequest('POST', '/authentication/forgot-password', {
      email,
    });
    return { queued: true };
  }

  async submitNinVerification(
    ctx: BlivapCallContext,
    nin: string,
  ): Promise<Record<string, unknown>> {
    return this.userPost<Record<string, unknown>>(ctx, '/nin-verification', {
      nin,
    });
  }

  getWalletSummary(ctx: BlivapCallContext): Promise<BlivapWalletSummary> {
    return this.userGet<BlivapWalletSummary>(ctx, '/wallet');
  }

  startWalletTopup(
    ctx: BlivapCallContext,
    input: { amountKobo: number; callbackUrl: string },
  ): Promise<BlivapTopupStart> {
    return this.userPost<BlivapTopupStart>(ctx, '/wallet/topups', input);
  }

  verifyWalletTopup(
    ctx: BlivapCallContext,
    reference: string,
  ): Promise<BlivapWalletSummary> {
    return this.userPost<BlivapWalletSummary>(
      ctx,
      `/wallet/topups/${encodeURIComponent(reference)}/verify`,
      {},
    );
  }

  async listBanks(ctx: BlivapCallContext): Promise<BlivapBankOption[]> {
    const rows = await this.userGet<unknown[]>(ctx, '/wallet/banks');
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const record = asRecord(row);
      return {
        bank: stringField(record.bank) ?? stringField(record.name) ?? '',
        code: stringField(record.code) ?? '',
      };
    });
  }

  async listBankAccounts(ctx: BlivapCallContext): Promise<BlivapBankAccount[]> {
    const rows = await this.userGet<unknown[]>(ctx, '/wallet/bank-accounts');
    return (Array.isArray(rows) ? rows : []).map((row) => projectBankAccount(row));
  }

  resolveBankAccount(
    ctx: BlivapCallContext,
    input: { accountNumber: string; bank?: string },
  ): Promise<Record<string, unknown>> {
    return this.userPost<Record<string, unknown>>(
      ctx,
      '/wallet/bank-accounts/resolve',
      input,
    );
  }

  async addBankAccount(
    ctx: BlivapCallContext,
    input: { accountNumber: string; bank?: string },
  ): Promise<BlivapBankAccount> {
    const raw = await this.userPost<unknown>(ctx, '/wallet/bank-accounts', input);
    return projectBankAccount(raw);
  }

  async setPrimaryBankAccount(
    ctx: BlivapCallContext,
    accountId: string,
  ): Promise<BlivapBankAccount> {
    const raw = await this.userPost<unknown>(
      ctx,
      `/wallet/bank-accounts/${encodeURIComponent(accountId)}/primary`,
      {},
    );
    return projectBankAccount(raw);
  }

  async removeBankAccount(
    ctx: BlivapCallContext,
    accountId: string,
  ): Promise<void> {
    await this.userDelete(
      ctx,
      `/wallet/bank-accounts/${encodeURIComponent(accountId)}`,
    );
  }

  async listPayouts(ctx: BlivapCallContext): Promise<BlivapPayoutSummary[]> {
    const rows = await this.userGet<unknown[]>(ctx, '/wallet/payouts?limit=20');
    return (Array.isArray(rows) ? rows : []).map((row) => projectPayout(row));
  }

  async getPayout(
    ctx: BlivapCallContext,
    payoutId: string,
  ): Promise<BlivapPayoutSummary> {
    const raw = await this.userGet<unknown>(
      ctx,
      `/wallet/payouts/${encodeURIComponent(payoutId)}`,
    );
    return projectPayout(raw);
  }

  async startWalletPayout(
    ctx: BlivapCallContext,
    input: { amountKobo: number; bankAccountId?: string },
  ): Promise<BlivapPayoutSummary> {
    const raw = await this.userPost<unknown>(ctx, '/wallet/payouts', input);
    return projectPayout(raw);
  }

  async confirmWalletPayout(
    ctx: BlivapCallContext,
    payoutId: string,
    otp: string,
  ): Promise<BlivapPayoutSummary> {
    const raw = await this.userPost<unknown>(
      ctx,
      `/wallet/payouts/${encodeURIComponent(payoutId)}/confirm`,
      { otp },
    );
    return projectPayout(raw);
  }

  async resendPayoutOtp(
    ctx: BlivapCallContext,
    payoutId: string,
  ): Promise<BlivapPayoutSummary> {
    const raw = await this.userPost<unknown>(
      ctx,
      `/wallet/payouts/${encodeURIComponent(payoutId)}/resend-otp`,
      {},
    );
    return projectPayout(raw);
  }

  async getDonationHistory(
    ctx: BlivapCallContext,
  ): Promise<BlivapDonationSummary[]> {
    const rows = await this.userGet<unknown[]>(ctx, '/bookings/mine');
    return (Array.isArray(rows) ? rows : []).map((row) => projectDonation(row));
  }

  async listBookings(
    ctx: BlivapCallContext,
    query: { filter?: string; limit?: number } = {},
  ): Promise<BlivapDonationSummary[]> {
    const params = new URLSearchParams();
    if (query.filter) params.set('filter', query.filter);
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    const rows = await this.userGet<unknown[]>(
      ctx,
      qs ? `/bookings?${qs}` : '/bookings',
    );
    return (Array.isArray(rows) ? rows : []).map((row) => projectDonation(row));
  }

  async getDonationStatus(
    ctx: BlivapCallContext,
    donationId: string,
  ): Promise<BlivapDonationSummary | null> {
    const rows = await this.getDonationHistory(ctx);
    return rows.find((row) => row.id === donationId) ?? null;
  }

  async requestBooking(
    ctx: BlivapCallContext,
    input: {
      donorUserId: string;
      hospitalId: string;
      scheduledAt: string;
      bloodRequestId?: string;
      donationType?: string;
    },
  ): Promise<BlivapDonationSummary> {
    const raw = await this.userPost<unknown>(ctx, '/bookings/request', input);
    return projectDonation(raw);
  }

  async acceptBooking(
    ctx: BlivapCallContext,
    bookingId: string,
  ): Promise<BlivapDonationSummary> {
    const raw = await this.userPatch<unknown>(
      ctx,
      `/bookings/${encodeURIComponent(bookingId)}/accept`,
      {},
    );
    return projectDonation(raw);
  }

  async declineBooking(
    ctx: BlivapCallContext,
    bookingId: string,
  ): Promise<BlivapDonationSummary> {
    const raw = await this.userPatch<unknown>(
      ctx,
      `/bookings/${encodeURIComponent(bookingId)}/decline`,
      {},
    );
    return projectDonation(raw);
  }

  async cancelBooking(
    ctx: BlivapCallContext,
    bookingId: string,
  ): Promise<BlivapDonationSummary> {
    const raw = await this.userPatch<unknown>(
      ctx,
      `/bookings/${encodeURIComponent(bookingId)}/cancel`,
      {},
    );
    return projectDonation(raw);
  }

  async reportBooking(
    ctx: BlivapCallContext,
    bookingId: string,
    input: { reason: string; details?: string },
  ): Promise<BlivapDonationSummary> {
    const raw = await this.userPatch<unknown>(
      ctx,
      `/bookings/${encodeURIComponent(bookingId)}/report`,
      input,
    );
    return projectDonation(raw);
  }

  async getBloodRequests(
    ctx: BlivapCallContext,
  ): Promise<BlivapBloodRequestSummary[]> {
    const rows = await this.userGet<unknown[]>(ctx, '/blood-requests/mine');
    return (Array.isArray(rows) ? rows : []).map((row) =>
      projectBloodRequest(row),
    );
  }

  async getBloodRequestStatus(
    ctx: BlivapCallContext,
    requestId: string,
  ): Promise<BlivapBloodRequestSummary | null> {
    const rows = await this.getBloodRequests(ctx);
    return rows.find((row) => row.id === requestId) ?? null;
  }

  async createBloodRequest(
    ctx: BlivapCallContext,
    input: {
      neededBloodType: string;
      location: { type: 'Point'; coordinates: [number, number] };
      city?: string;
      state?: string;
      urgent?: boolean;
      notes?: string;
    },
  ): Promise<BlivapBloodRequestSummary> {
    const raw = await this.userPost<unknown>(ctx, '/blood-requests', input);
    return projectBloodRequest(raw);
  }

  async getDonorProfile(
    ctx: BlivapCallContext,
  ): Promise<Record<string, unknown> | null> {
    try {
      return await this.userGet<Record<string, unknown>>(ctx, '/donors/me');
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  async listDonors(
    ctx: BlivapCallContext,
    query: { bloodType?: string; search?: string; limit?: number } = {},
  ): Promise<BlivapDonorListItem[]> {
    const params = new URLSearchParams();
    params.set('limit', String(Math.min(20, Math.max(1, query.limit ?? 10))));
    params.set('page', '1');
    if (query.bloodType) params.set('bloodType', query.bloodType);
    if (query.search) params.set('search', query.search);
    const rows = await this.userGet<unknown[]>(
      ctx,
      `/donors?${params.toString()}`,
    );
    return (Array.isArray(rows) ? rows : []).map((row) => projectDonorListItem(row));
  }

  registerDonor(
    ctx: BlivapCallContext,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.userPost<Record<string, unknown>>(ctx, '/donors/register', input);
  }

  updateDonorLocation(
    ctx: BlivapCallContext,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.userPatch<Record<string, unknown>>(ctx, '/donors/location', input);
  }

  updateMeetupCare(
    ctx: BlivapCallContext,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.userPut<Record<string, unknown>>(
      ctx,
      '/donors/me/meetup-care',
      input,
    );
  }

  getNotificationSettings(
    ctx: BlivapCallContext,
  ): Promise<BlivapNotificationSettings> {
    return this.userGet<BlivapNotificationSettings>(
      ctx,
      '/notifications/settings',
    );
  }

  async listNotifications(
    ctx: BlivapCallContext,
    limit = 10,
  ): Promise<BlivapNotificationItem[]> {
    const capped = Math.min(30, Math.max(1, limit));
    const raw = await this.userGet<unknown>(
      ctx,
      `/notifications?limit=${capped}`,
    );
    return normalizeNotificationRows(raw).map((row) => projectNotification(row));
  }

  updateNotificationSettings(
    ctx: BlivapCallContext,
    patch: Partial<BlivapNotificationSettings>,
  ): Promise<BlivapNotificationSettings> {
    return this.userPatch<BlivapNotificationSettings>(
      ctx,
      '/notifications/settings',
      patch,
    );
  }

  async markNotificationRead(
    ctx: BlivapCallContext,
    notificationId: string,
  ): Promise<void> {
    await this.userPatch(
      ctx,
      `/notifications/${encodeURIComponent(notificationId)}/read`,
      {},
      true,
    );
  }

  async markAllNotificationsRead(ctx: BlivapCallContext): Promise<void> {
    await this.userPost(ctx, '/notifications/mark-all-read', {}, true);
  }

  async listHospitals(ctx: BlivapCallContext): Promise<BlivapHospitalSummary[]> {
    const rows = await this.userGet<unknown[]>(ctx, '/hospitals');
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const record = asRecord(row);
      return {
        id: stringField(record.id) ?? stringField(record._id) ?? '',
        name: stringField(record.name) ?? 'Hospital',
        city: stringField(record.city) ?? null,
        state: stringField(record.state) ?? null,
      };
    });
  }

  async listWelfarePackages(
    ctx: BlivapCallContext,
  ): Promise<BlivapWelfarePackage[]> {
    const rows = await this.userGet<unknown[]>(ctx, '/welfare-packages');
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const record = asRecord(row);
      return {
        id: stringField(record.id) ?? stringField(record._id) ?? '',
        name: stringField(record.name) ?? 'Package',
        amountKobo:
          typeof record.amountKobo === 'number' ? record.amountKobo : undefined,
        description: stringField(record.description) ?? null,
      };
    });
  }

  async getMeetupSession(
    ctx: BlivapCallContext,
    sessionId: string,
  ): Promise<BlivapMeetupSession> {
    const raw = await this.userGet<unknown>(
      ctx,
      `/meetups/${encodeURIComponent(sessionId)}`,
    );
    return projectMeetup(raw);
  }

  async createMeetupSession(
    ctx: BlivapCallContext,
    bookingId: string,
  ): Promise<BlivapMeetupSession> {
    const raw = await this.userPost<unknown>(
      ctx,
      `/meetups/bookings/${encodeURIComponent(bookingId)}/session`,
      {},
    );
    return projectMeetup(raw);
  }

  async verifyMeetupCode(
    ctx: BlivapCallContext,
    sessionId: string,
    code: string,
  ): Promise<BlivapMeetupSession> {
    const raw = await this.userPost<unknown>(
      ctx,
      `/meetups/${encodeURIComponent(sessionId)}/verify-code`,
      { code },
    );
    return projectMeetup(raw);
  }

  async confirmMeetupRequester(
    ctx: BlivapCallContext,
    sessionId: string,
  ): Promise<BlivapMeetupSession> {
    const raw = await this.userPatch<unknown>(
      ctx,
      `/meetups/${encodeURIComponent(sessionId)}/requester-confirm`,
      {},
    );
    return projectMeetup(raw);
  }

  async confirmMeetupDonor(
    ctx: BlivapCallContext,
    sessionId: string,
  ): Promise<BlivapMeetupSession> {
    const raw = await this.userPatch<unknown>(
      ctx,
      `/meetups/${encodeURIComponent(sessionId)}/donor-confirm`,
      {},
    );
    return projectMeetup(raw);
  }

  async completeMeetup(
    ctx: BlivapCallContext,
    sessionId: string,
  ): Promise<BlivapMeetupSession> {
    const raw = await this.userPatch<unknown>(
      ctx,
      `/meetups/${encodeURIComponent(sessionId)}/complete`,
      {},
    );
    return projectMeetup(raw);
  }

  async terminateMeetup(
    ctx: BlivapCallContext,
    sessionId: string,
    reason?: string,
  ): Promise<BlivapMeetupSession> {
    const raw = await this.userPost<unknown>(
      ctx,
      `/meetups/${encodeURIComponent(sessionId)}/terminate`,
      reason ? { reason } : {},
    );
    return projectMeetup(raw);
  }

  async reportMeetup(
    ctx: BlivapCallContext,
    sessionId: string,
    input: { reason: string; details?: string },
  ): Promise<BlivapMeetupSession> {
    const raw = await this.userPost<unknown>(
      ctx,
      `/meetups/${encodeURIComponent(sessionId)}/report`,
      input,
    );
    return projectMeetup(raw);
  }

  async resendVerificationEmail(email: string): Promise<{ queued: boolean }> {
    await this.serviceRequest(
      'POST',
      `/authentication/resend-email-verification-link?email=${encodeURIComponent(email)}`,
    );
    return { queued: true };
  }

  async notifyUser(
    payload: BlivapNotificationRequest,
  ): Promise<{ accepted: boolean }> {
    await this.serviceRequest('POST', '/support/notify', payload);
    return { accepted: true };
  }


  private userGet<T>(ctx: BlivapCallContext, path: string): Promise<T> {
    return this.userRequest<T>('GET', ctx, path);
  }

  private userPost<T>(
    ctx: BlivapCallContext,
    path: string,
    body: unknown,
    allowEmpty = false,
  ): Promise<T> {
    return this.userRequest<T>('POST', ctx, path, body, allowEmpty);
  }

  private userPut<T>(
    ctx: BlivapCallContext,
    path: string,
    body: unknown,
    allowEmpty = false,
  ): Promise<T> {
    return this.userRequest<T>('PUT', ctx, path, body, allowEmpty);
  }

  private userPatch<T>(
    ctx: BlivapCallContext,
    path: string,
    body: unknown,
    allowEmpty = false,
  ): Promise<T> {
    return this.userRequest<T>('PATCH', ctx, path, body, allowEmpty);
  }

  private userDelete(ctx: BlivapCallContext, path: string): Promise<void> {
    return this.userRequest<void>('DELETE', ctx, path, undefined, true);
  }

  private async userRequest<T>(
    method: string,
    ctx: BlivapCallContext,
    path: string,
    body?: unknown,
    allowEmpty = false,
  ): Promise<T> {
    if (!ctx.accessToken) {
      throw new UnauthorizedException(
        'A Blivap access token is required for account actions.',
      );
    }
    const envelope = await this.request<Envelope<T>>(method, path, {
      authorization: `Bearer ${ctx.accessToken}`,
      body,
    });
    if (envelope.data === undefined) {
      if (allowEmpty) return undefined as T;
      throw new BadGatewayException('Blivap returned an empty payload.');
    }
    return envelope.data;
  }

  private async serviceRequest(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const serviceKey = this.config.get<string>('blivap.serviceApiKey', '');
    const headers: Record<string, string> = {};
    if (serviceKey) headers['x-service-api-key'] = serviceKey;
    return this.request(method, path, { headers, body });
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      authorization?: string;
      headers?: Record<string, string>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    const baseUrl = this.config
      .get<string>('blivap.baseUrl', 'http://localhost:2001')
      .replace(/\/$/, '');
    const timeoutMs = this.config.get<number>('blivap.timeoutMs', 10000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    this.logger.log(
      JSON.stringify({
        event: 'blivap.request.out',
        method,
        path,
      }),
    );
    let lastError: unknown;
    try {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers: {
              accept: 'application/json',
              ...(options.body !== undefined
                ? { 'content-type': 'application/json' }
                : {}),
              ...(options.authorization
                ? { authorization: options.authorization }
                : {}),
              ...options.headers,
            },
            body:
              options.body === undefined
                ? undefined
                : JSON.stringify(options.body),
            signal: controller.signal,
          });
          const text = await response.text();
          let parsed: unknown = {};
          if (text) {
            try {
              parsed = JSON.parse(text) as unknown;
            } catch {
              parsed = { message: text };
            }
          }
          if (!response.ok) {
            this.logger.warn(
              JSON.stringify({
                event: 'blivap.request.error',
                method,
                path,
                statusCode: response.status,
                durationMs: Date.now() - started,
                attempt,
              }),
            );
            throw mapHttpError(response.status, parsed);
          }
          this.logger.log(
            JSON.stringify({
              event: 'blivap.request.in',
              method,
              path,
              statusCode: response.status,
              durationMs: Date.now() - started,
              attempt,
            }),
          );
          return parsed as T;
        } catch (error) {
          lastError = error;
          if (error instanceof Error && error.name === 'AbortError') {
            this.logger.error(
              JSON.stringify({
                event: 'blivap.request.timeout',
                method,
                path,
                durationMs: Date.now() - started,
                attempt,
              }),
            );
            throw new ServiceUnavailableException('Blivap request timed out.');
          }
          if (
            error instanceof UnauthorizedException ||
            error instanceof ForbiddenException ||
            error instanceof NotFoundException ||
            error instanceof BadGatewayException ||
            error instanceof ServiceUnavailableException
          ) {
            throw error;
          }
          // One quick retry for transient Docker/host fetch failures.
          if (attempt < 2) {
            this.logger.warn(
              JSON.stringify({
                event: 'blivap.request.retry',
                method,
                path,
                attempt,
                message: error instanceof Error ? error.message : 'unknown',
              }),
            );
            await new Promise((resolve) => setTimeout(resolve, 200));
            continue;
          }
          this.logger.error(
            JSON.stringify({
              event: 'blivap.request.failed',
              method,
              path,
              durationMs: Date.now() - started,
              message: error instanceof Error ? error.message : 'unknown',
            }),
          );
          throw new ServiceUnavailableException(
            'Blivap is temporarily unavailable.',
          );
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new ServiceUnavailableException('Blivap is temporarily unavailable.');
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeNotificationRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === 'object',
    );
  }
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    for (const key of ['notifications', 'items', 'results', 'rows']) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value.filter(
          (row): row is Record<string, unknown> =>
            Boolean(row) && typeof row === 'object',
        );
      }
    }
  }
  return [];
}

function mapHttpError(status: number, body: unknown): Error {
  const message =
    body &&
    typeof body === 'object' &&
    'message' in body &&
    typeof (body as { message: unknown }).message === 'string'
      ? (body as { message: string }).message
      : 'Blivap request failed.';
  if (status === 401) return new UnauthorizedException(message);
  if (status === 403) return new ForbiddenException(message);
  if (status === 404) return new NotFoundException(message);
  if (status >= 500) return new ServiceUnavailableException(message);
  return new BadGatewayException(message);
}

function projectProfile(
  raw: Record<string, unknown>,
  expectedUserId: string,
): BlivapUserProfile {
  const id = stringField(raw.id) ?? stringField(raw._id) ?? expectedUserId;
  if (id !== expectedUserId) {
    throw new ForbiddenException(
      'Blivap profile does not match the signed-in user.',
    );
  }
  return {
    id,
    email: stringField(raw.email) ?? '',
    firstname: stringField(raw.firstname) ?? undefined,
    lastname: stringField(raw.lastname) ?? undefined,
    phonenumber: stringField(raw.phonenumber) ?? null,
    emailVerified: raw.emailVerified === true,
    roles: Array.isArray(raw.roles)
      ? raw.roles.filter((role): role is string => typeof role === 'string')
      : [],
    publicId: stringField(raw.publicId) ?? null,
    identityVerified: raw.nationalIdentificationNumberVerified === true,
    identityProfileLocked: raw.identityProfileLocked === true,
    isSuspended: raw.isSuspended === true,
    isDeleted: raw.isDeleted === true,
  };
}

function projectDonation(raw: unknown): BlivapDonationSummary {
  const row = asRecord(raw);
  return {
    id: stringField(row.id) ?? stringField(row._id) ?? '',
    status: stringField(row.status) ?? 'unknown',
    donationType: stringField(row.donationType) ?? undefined,
    scheduledAt: dateField(row.scheduledAt ?? row.scheduledFor ?? row.date),
    hospitalId: stringField(row.hospitalId) ?? null,
    hospitalName: stringField(row.hospitalName) ?? null,
    role: stringField(row.role) ?? null,
  };
}

function projectDonorListItem(raw: unknown): BlivapDonorListItem {
  const row = asRecord(raw);
  const area = asRecord(row.areaLocation);
  return {
    id: stringField(row.id) ?? stringField(row._id) ?? '',
    userId: stringField(row.userId) ?? '',
    publicId: stringField(row.publicId) ?? null,
    bloodType: stringField(row.bloodType) ?? 'unknown',
    city: stringField(area.city) ?? stringField(row.city) ?? null,
    state: stringField(area.state) ?? stringField(row.state) ?? null,
    isActiveDonor: row.isActiveDonor === true,
    isInDonationCooldown: row.isInDonationCooldown === true,
    averageRating:
      typeof row.averageRating === 'number' ? row.averageRating : undefined,
  };
}

function projectBloodRequest(raw: unknown): BlivapBloodRequestSummary {
  const row = asRecord(raw);
  return {
    id: stringField(row.id) ?? stringField(row._id) ?? '',
    status: stringField(row.status) ?? 'unknown',
    neededBloodType: stringField(row.neededBloodType) ?? undefined,
    urgency: stringField(row.urgency) ?? undefined,
    urgent: row.urgent === true,
    city: stringField(row.city) ?? null,
    state: stringField(row.state) ?? null,
    createdAt: dateField(row.createdAt),
  };
}

function projectNotification(raw: unknown): BlivapNotificationItem {
  const row = asRecord(raw);
  return {
    id: stringField(row.id) ?? stringField(row._id) ?? '',
    title: stringField(row.title) ?? 'Notification',
    body: stringField(row.body) ?? '',
    type: stringField(row.type) ?? undefined,
    read: row.read === true,
    createdAt: dateField(row.createdAt),
  };
}


function projectBankAccount(raw: unknown): BlivapBankAccount {
  const row = asRecord(raw);
  return {
    id: stringField(row.id) ?? stringField(row._id) ?? '',
    bankCode: stringField(row.bankCode) ?? '',
    bankName: stringField(row.bankName) ?? '',
    accountNumber: stringField(row.accountNumber) ?? '',
    accountName: stringField(row.accountName) ?? '',
    isPrimary: row.isPrimary === true,
  };
}

function projectPayout(raw: unknown): BlivapPayoutSummary {
  const row = asRecord(raw);
  return {
    id: stringField(row.id) ?? stringField(row._id) ?? '',
    reference: stringField(row.reference) ?? '',
    amountKobo: typeof row.amountKobo === 'number' ? row.amountKobo : 0,
    currency: stringField(row.currency) ?? 'NGN',
    status: stringField(row.status) ?? 'unknown',
    bankName: stringField(row.bankName) ?? '',
    accountName: stringField(row.accountName) ?? '',
    accountLast4: stringField(row.accountLast4) ?? '',
    failureReason: stringField(row.failureReason) ?? null,
    receiptAvailable: row.receiptAvailable === true,
    createdAt: dateField(row.createdAt),
    paidAt: dateField(row.paidAt),
  };
}

function projectMeetup(raw: unknown): BlivapMeetupSession {
  const row = asRecord(raw);
  return {
    id: stringField(row.id) ?? stringField(row._id) ?? '',
    bookingId: stringField(row.bookingId) ?? undefined,
    status: stringField(row.status) ?? 'unknown',
    codeHint: stringField(row.codeHint) ?? stringField(row.code) ?? null,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value && typeof value === 'object' && 'toHexString' in value) {
    return String((value as { toHexString: () => string }).toHexString());
  }
  return undefined;
}

function dateField(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}
