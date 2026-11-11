import { Inject, Injectable } from '@nestjs/common';
import {
  BLIVAP_INTEGRATION,
  type BlivapIntegrationPort,
} from '../../../integrations/blivap/index.js';
import { shortId } from '../formatting.js';
import {
  ActionStatus,
  type ActionExecutionRequest,
  type ActionExecutionResult,
  type ActionHandler,
} from '../actions.types.js';
import { requireBlivapContext } from './blivap-context.js';

@Injectable()
export class GetMeetupSessionHandler implements ActionHandler {
  readonly name = 'get_meetup_session';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which meetup session id should I open?',
        failureCode: 'missing_session_id',
      };
    }
    const session = await this.blivap.getMeetupSession(
      requireBlivapContext(request.actor),
      sessionId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Meetup ${shortId(session.id)} · status ${session.status}${session.bookingId ? ` · booking ${shortId(session.bookingId)}` : ''}.`,
      data: { ...session },
      resourceType: 'meetup',
      resourceId: session.id,
    };
  }
}

@Injectable()
export class CreateMeetupSessionHandler implements ActionHandler {
  readonly name = 'create_meetup_session';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const bookingId = request.params.bookingId ?? request.params.donationId;
    if (!bookingId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which booking should I start a meetup for?',
        failureCode: 'missing_booking_id',
      };
    }
    const session = await this.blivap.createMeetupSession(
      requireBlivapContext(request.actor),
      bookingId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Meetup session created (${session.status}) · ${shortId(session.id)}.`,
      data: { sessionId: session.id, status: session.status },
      resourceType: 'meetup',
      resourceId: session.id,
    };
  }
}

@Injectable()
export class VerifyMeetupCodeHandler implements ActionHandler {
  readonly name = 'verify_meetup_code';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const sessionId = request.params.sessionId;
    const code = request.params.code;
    if (!sessionId || !code) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Share the meetup session id and verification code.',
        failureCode: 'missing_meetup_code',
      };
    }
    const session = await this.blivap.verifyMeetupCode(
      requireBlivapContext(request.actor),
      sessionId,
      code,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Meetup code verified. Status: ${session.status}.`,
      data: { sessionId: session.id, status: session.status },
      resourceType: 'meetup',
      resourceId: session.id,
    };
  }
}

@Injectable()
export class ConfirmMeetupRequesterHandler implements ActionHandler {
  readonly name = 'confirm_meetup_requester';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which meetup session should I confirm as requester?',
        failureCode: 'missing_session_id',
      };
    }
    const session = await this.blivap.confirmMeetupRequester(
      requireBlivapContext(request.actor),
      sessionId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Requester confirmation recorded. Status: ${session.status}.`,
      data: { sessionId: session.id, status: session.status },
      resourceType: 'meetup',
      resourceId: session.id,
    };
  }
}

@Injectable()
export class ConfirmMeetupDonorHandler implements ActionHandler {
  readonly name = 'confirm_meetup_donor';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which meetup session should I confirm as donor?',
        failureCode: 'missing_session_id',
      };
    }
    const session = await this.blivap.confirmMeetupDonor(
      requireBlivapContext(request.actor),
      sessionId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Donor confirmation recorded. Status: ${session.status}.`,
      data: { sessionId: session.id, status: session.status },
      resourceType: 'meetup',
      resourceId: session.id,
    };
  }
}

@Injectable()
export class CompleteMeetupHandler implements ActionHandler {
  readonly name = 'complete_meetup';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which meetup session should I complete?',
        failureCode: 'missing_session_id',
      };
    }
    const session = await this.blivap.completeMeetup(
      requireBlivapContext(request.actor),
      sessionId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Meetup completed. Status: ${session.status}.`,
      data: { sessionId: session.id, status: session.status },
      resourceType: 'meetup',
      resourceId: session.id,
    };
  }
}

@Injectable()
export class TerminateMeetupHandler implements ActionHandler {
  readonly name = 'terminate_meetup';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which meetup session should I terminate?',
        failureCode: 'missing_session_id',
      };
    }
    const session = await this.blivap.terminateMeetup(
      requireBlivapContext(request.actor),
      sessionId,
      request.params.reason,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Meetup terminated. Status: ${session.status}.`,
      data: { sessionId: session.id, status: session.status },
      resourceType: 'meetup',
      resourceId: session.id,
    };
  }
}

@Injectable()
export class ReportMeetupHandler implements ActionHandler {
  readonly name = 'report_meetup';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const sessionId = request.params.sessionId;
    const reason = request.params.reason;
    if (!sessionId || !reason) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Share the meetup session id and a short reason to report.',
        failureCode: 'missing_report_params',
      };
    }
    const session = await this.blivap.reportMeetup(
      requireBlivapContext(request.actor),
      sessionId,
      { reason, details: request.params.details },
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Meetup report submitted for ${shortId(session.id)}.`,
      data: { sessionId: session.id },
      resourceType: 'meetup',
      resourceId: session.id,
    };
  }
}
