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

  getWalletSummary(ctx: BlivapCallContext): Promise<BlivapWalletSummary> {
    return this.userGet<BlivapWalletSummary>(ctx, '/wallet');
  }

  async getDonationHistory(
    ctx: BlivapCallContext,
  ): Promise<BlivapDonationSummary[]> {
    const rows = await this.userGet<unknown[]>(ctx, '/bookings/mine');
    return rows.map((row) => projectDonation(row));
  }

  async getDonationStatus(
    ctx: BlivapCallContext,
    donationId: string,
  ): Promise<BlivapDonationSummary | null> {
    const rows = await this.getDonationHistory(ctx);
    return rows.find((row) => row.id === donationId) ?? null;
  }

  async getBloodRequests(
    ctx: BlivapCallContext,
  ): Promise<BlivapBloodRequestSummary[]> {
    const rows = await this.userGet<unknown[]>(ctx, '/blood-requests/mine');
    return rows.map((row) => projectBloodRequest(row));
  }

  async getBloodRequestStatus(
    ctx: BlivapCallContext,
    requestId: string,
  ): Promise<BlivapBloodRequestSummary | null> {
    const rows = await this.getBloodRequests(ctx);
    return rows.find((row) => row.id === requestId) ?? null;
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
    const rows = await this.userGet<unknown[]>(
      ctx,
      `/notifications?limit=${Math.min(30, Math.max(1, limit))}`,
    );
    return rows.map((row) => projectNotification(row));
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

  private userPatch<T>(
    ctx: BlivapCallContext,
    path: string,
    body: unknown,
  ): Promise<T> {
    return this.userRequest<T>('PATCH', ctx, path, body);
  }

  private async userRequest<T>(
    method: string,
    ctx: BlivapCallContext,
    path: string,
    body?: unknown,
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
          options.body === undefined ? undefined : JSON.stringify(options.body),
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
        throw mapHttpError(response.status, parsed);
      }
      return parsed as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
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
      this.logger.error(
        JSON.stringify({
          event: 'blivap.request.failed',
          path,
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
      throw new ServiceUnavailableException(
        'Blivap is temporarily unavailable.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
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
