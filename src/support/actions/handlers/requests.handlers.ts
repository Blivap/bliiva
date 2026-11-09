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
export class GetBloodRequestsHandler implements ActionHandler {
  readonly name = 'get_blood_requests';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const rows = await this.blivap.getBloodRequests(
      requireBlivapContext(request.actor),
    );
    if (rows.length === 0) {
      return {
        status: ActionStatus.Success,
        actionName: this.name,
        message: 'No blood requests on this account.',
        data: { count: 0 },
      };
    }
    if (rows.length === 1) {
      const row = rows[0]!;
      return {
        status: ActionStatus.Success,
        actionName: this.name,
        message: describeRequest(row),
        data: { count: 1, status: row.status },
        resourceType: 'blood_request',
        resourceId: row.id,
      };
    }
    return {
      status: ActionStatus.NeedsParameter,
      actionName: 'get_blood_request',
      message: 'Which blood request?',
      choices: rows.slice(0, 5).map((row, index) => ({
        id: row.id,
        label: `request ${index + 1} (${row.status}${row.neededBloodType ? `, ${row.neededBloodType}` : ''})`,
        params: { requestId: row.id },
      })),
      data: { count: rows.length },
      failureCode: 'ambiguous_request',
    };
  }
}

@Injectable()
export class GetBloodRequestHandler implements ActionHandler {
  readonly name = 'get_blood_request';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const requestId = request.params.requestId;
    if (!requestId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which blood request?',
        failureCode: 'missing_request_id',
      };
    }
    const row = await this.blivap.getBloodRequestStatus(
      requireBlivapContext(request.actor),
      requestId,
    );
    if (!row) {
      return {
        status: ActionStatus.Failed,
        actionName: this.name,
        message: 'Blood request not found on this account.',
        failureCode: 'not_found',
        resourceType: 'blood_request',
        resourceId: requestId,
      };
    }
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: describeRequest(row),
      data: { status: row.status },
      resourceType: 'blood_request',
      resourceId: row.id,
    };
  }
}

function describeRequest(row: {
  id: string;
  status: string;
  neededBloodType?: string;
  urgent?: boolean;
  city?: string | null;
  state?: string | null;
  createdAt?: string | null;
}): string {
  const place = [row.city, row.state].filter(Boolean).join(', ');
  return [
    `${shortId(row.id)}: ${row.status}`,
    row.neededBloodType ? `Type: ${row.neededBloodType}` : null,
    row.urgent ? 'Urgent: yes' : null,
    place ? `Location: ${place}` : null,
    row.createdAt ? `Created: ${formatWhen(row.createdAt)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
