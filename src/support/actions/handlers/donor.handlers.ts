import { Inject, Injectable } from '@nestjs/common';
import {
  BLIVAP_INTEGRATION,
  type BlivapIntegrationPort,
} from '../../../integrations/blivap/index.js';
import {
  ActionStatus,
  type ActionExecutionRequest,
  type ActionExecutionResult,
  type ActionHandler,
} from '../actions.types.js';
import { requireBlivapContext } from './blivap-context.js';

@Injectable()
export class GetDonorProfileHandler implements ActionHandler {
  readonly name = 'get_donor_profile';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const profile = await this.blivap.getDonorProfile(
      requireBlivapContext(request.actor),
    );
    if (!profile) {
      return {
        status: ActionStatus.Success,
        actionName: this.name,
        message: 'No donor profile yet. Register in the app.',
        data: { registered: false },
      };
    }
    const status =
      typeof profile.status === 'string'
        ? profile.status
        : typeof profile.registrationStatus === 'string'
          ? profile.registrationStatus
          : 'on file';
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Donor profile: ${status}.`,
      data: { registered: true, status },
      resourceType: 'donor_profile',
      resourceId: request.actor.userId ?? undefined,
    };
  }
}
