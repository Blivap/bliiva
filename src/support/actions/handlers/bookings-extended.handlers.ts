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
export class ListBookingsHandler implements ActionHandler {
  readonly name = 'list_bookings';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const rows = await this.blivap.listBookings(requireBlivapContext(request.actor), {
      filter: request.params.filter,
      limit: 20,
    });
    if (!rows.length) {
      return {
        status: ActionStatus.Success,
        actionName: this.name,
        message: 'No bookings found for that filter.',
        data: { count: 0 },
      };
    }
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: rows
        .slice(0, 8)
        .map(
          (row, i) =>
            `${i + 1}. ${row.status} · ${formatWhen(row.scheduledAt)} · ${row.hospitalName ?? 'hospital'} · ${shortId(row.id)}`,
        )
        .join('\n'),
      data: { count: rows.length },
      choices: rows.slice(0, 5).map((row, i) => ({
        id: row.id,
        label: `booking ${i + 1}`,
        params: { bookingId: row.id, donationId: row.id },
      })),
      resourceType: 'booking',
    };
  }
}

@Injectable()
export class RequestBookingHandler implements ActionHandler {
  readonly name = 'request_booking';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const { donorUserId, hospitalId, scheduledAt } = request.params;
    if (!donorUserId || !hospitalId || !scheduledAt) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message:
          'I need donorUserId, hospitalId, and scheduledAt (ISO date) to request a booking.',
        failureCode: 'missing_booking_params',
      };
    }
    const booking = await this.blivap.requestBooking(
      requireBlivapContext(request.actor),
      {
        donorUserId,
        hospitalId,
        scheduledAt,
        bloodRequestId: request.params.bloodRequestId,
        donationType: request.params.donationType,
      },
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Booking requested (${booking.status}) for ${formatWhen(booking.scheduledAt)} · ${shortId(booking.id)}.`,
      data: { bookingId: booking.id, status: booking.status },
      resourceType: 'booking',
      resourceId: booking.id,
    };
  }
}

@Injectable()
export class AcceptBookingHandler implements ActionHandler {
  readonly name = 'accept_booking';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const bookingId = request.params.bookingId ?? request.params.donationId;
    if (!bookingId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which booking should I accept?',
        failureCode: 'missing_booking_id',
      };
    }
    const booking = await this.blivap.acceptBooking(
      requireBlivapContext(request.actor),
      bookingId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Booking accepted (${booking.status}) · ${shortId(booking.id)}.`,
      data: { bookingId: booking.id, status: booking.status },
      resourceType: 'booking',
      resourceId: booking.id,
    };
  }
}

@Injectable()
export class DeclineBookingHandler implements ActionHandler {
  readonly name = 'decline_booking';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const bookingId = request.params.bookingId ?? request.params.donationId;
    if (!bookingId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which booking should I decline?',
        failureCode: 'missing_booking_id',
      };
    }
    const booking = await this.blivap.declineBooking(
      requireBlivapContext(request.actor),
      bookingId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Booking declined (${booking.status}) · ${shortId(booking.id)}.`,
      data: { bookingId: booking.id, status: booking.status },
      resourceType: 'booking',
      resourceId: booking.id,
    };
  }
}

@Injectable()
export class ReportBookingHandler implements ActionHandler {
  readonly name = 'report_booking';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const bookingId = request.params.bookingId ?? request.params.donationId;
    const reason = request.params.reason;
    if (!bookingId || !reason) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Share the booking id and a short reason to report.',
        failureCode: 'missing_report_params',
      };
    }
    const booking = await this.blivap.reportBooking(
      requireBlivapContext(request.actor),
      bookingId,
      { reason, details: request.params.details },
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Report submitted for booking ${shortId(booking.id)}.`,
      data: { bookingId: booking.id },
      resourceType: 'booking',
      resourceId: booking.id,
    };
  }
}

@Injectable()
export class CreateBloodRequestHandler implements ActionHandler {
  readonly name = 'create_blood_request';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const neededBloodType = request.params.neededBloodType;
    const lng = Number(request.params.lng ?? request.params.longitude);
    const lat = Number(request.params.lat ?? request.params.latitude);
    if (!neededBloodType || !Number.isFinite(lng) || !Number.isFinite(lat)) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message:
          'I need neededBloodType plus latitude and longitude to create a blood request.',
        failureCode: 'missing_blood_request_params',
      };
    }
    const created = await this.blivap.createBloodRequest(
      requireBlivapContext(request.actor),
      {
        neededBloodType,
        location: { type: 'Point', coordinates: [lng, lat] },
        city: request.params.city,
        state: request.params.state,
        urgent: request.params.urgent === 'true',
        notes: request.params.notes,
      },
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Blood request created (${created.status}) for ${created.neededBloodType} · ${shortId(created.id)}.`,
      data: { requestId: created.id, status: created.status },
      resourceType: 'blood_request',
      resourceId: created.id,
    };
  }
}
