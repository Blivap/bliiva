import { Inject, Injectable } from '@nestjs/common';
import {
  BLIVAP_INTEGRATION,
  type BlivapIntegrationPort,
} from '../../../integrations/blivap/index.js';
import { formatWhen, shortId } from '../formatting.js';
import {
  ActionStatus,
  type ActionExecutionRequest,
  type ActionExecutionResult,
  type ActionHandler,
} from '../actions.types.js';
import { requireBlivapContext } from './blivap-context.js';

@Injectable()
export class GetDonationsHandler implements ActionHandler {
  readonly name = 'get_donations';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const rows = await this.blivap.getDonationHistory(
      requireBlivapContext(request.actor),
    );
    if (rows.length === 0) {
      return {
        status: ActionStatus.Success,
        actionName: this.name,
        message: 'No donation bookings yet.',
        data: { count: 0 },
      };
    }
    const upcoming = rows
      .filter(
        (row) => row.scheduledAt && Date.parse(row.scheduledAt) >= Date.now(),
      )
      .sort(
        (left, right) =>
          Date.parse(left.scheduledAt ?? '') -
          Date.parse(right.scheduledAt ?? ''),
      );
    const lines = rows.slice(0, 5).map((row, index) => {
      return `${index + 1}. ${row.status} · ${formatWhen(row.scheduledAt)} · ${shortId(row.id)}`;
    });
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: [
        upcoming[0]
          ? `Next: ${formatWhen(upcoming[0].scheduledAt)} (${upcoming[0].status}).`
          : 'No upcoming appointment.',
        ...lines,
      ].join('\n'),
      data: { count: rows.length, nextId: upcoming[0]?.id ?? null },
      choices: rows.slice(0, 3).map((row, index) => ({
        id: row.id,
        label: `booking ${index + 1}`,
        params: { donationId: row.id },
      })),
      resourceType: 'booking',
    };
  }
}

@Injectable()
export class GetDonationHandler implements ActionHandler {
  readonly name = 'get_donation';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const donationId = request.params.donationId;
    if (!donationId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which booking?',
        failureCode: 'missing_donation_id',
      };
    }
    const row = await this.blivap.getDonationStatus(
      requireBlivapContext(request.actor),
      donationId,
    );
    if (!row) {
      return {
        status: ActionStatus.Failed,
        actionName: this.name,
        message: 'Booking not found on this account.',
        failureCode: 'not_found',
        resourceType: 'booking',
        resourceId: donationId,
      };
    }
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: [
        `${shortId(row.id)}: ${row.status}`,
        `When: ${formatWhen(row.scheduledAt)}`,
        row.hospitalName ? `Hospital: ${row.hospitalName}` : null,
        row.donationType ? `Type: ${row.donationType}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      data: { status: row.status },
      resourceType: 'booking',
      resourceId: row.id,
    };
  }
}

@Injectable()
export class CancelBookingHandler implements ActionHandler {
  readonly name = 'cancel_booking';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const bookingId = request.params.bookingId;
    if (!bookingId) {
      const rows = await this.blivap.getDonationHistory(
        requireBlivapContext(request.actor),
      );
      if (rows.length === 0) {
        return {
          status: ActionStatus.Failed,
          actionName: this.name,
          message: 'No booking to cancel.',
          failureCode: 'empty',
        };
      }
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which booking to cancel?',
        choices: rows.slice(0, 5).map((row, index) => ({
          id: row.id,
          label: `booking ${index + 1} (${row.status})`,
          params: { bookingId: row.id },
        })),
        failureCode: 'missing_booking_id',
      };
    }
    const cancelled = await this.blivap.cancelBooking(
      requireBlivapContext(request.actor),
      bookingId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `${shortId(cancelled.id)} → ${cancelled.status}.`,
      data: { status: cancelled.status },
      resourceType: 'booking',
      resourceId: cancelled.id,
    };
  }
}
