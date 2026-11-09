import { Inject, Injectable } from '@nestjs/common';
import {
  BLIVAP_INTEGRATION,
  type BlivapIntegrationPort,
} from '../../../integrations/blivap/index.js';
import { formatWhen, yesNo } from '../formatting.js';
import {
  ActionStatus,
  type ActionExecutionRequest,
  type ActionExecutionResult,
  type ActionHandler,
} from '../actions.types.js';
import { requireBlivapContext } from './blivap-context.js';

@Injectable()
export class GetNotificationSettingsHandler implements ActionHandler {
  readonly name = 'get_notification_settings';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const settings = await this.blivap.getNotificationSettings(
      requireBlivapContext(request.actor),
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: [
        `Push: ${yesNo(settings.pushEnabled)}`,
        `Donation reminders: ${yesNo(settings.donationReminders)}`,
        `Nearby drives: ${yesNo(settings.nearbyDrives)}`,
        `Eligibility alerts: ${yesNo(settings.eligibilityAlerts)}`,
        `Reward updates: ${yesNo(settings.rewardUpdates)}`,
        `App updates: ${yesNo(settings.appUpdates)}`,
      ].join('\n'),
      data: { ...settings },
      resourceType: 'notification_settings',
      resourceId: request.actor.userId ?? undefined,
    };
  }
}

@Injectable()
export class ListNotificationsHandler implements ActionHandler {
  readonly name = 'list_notifications';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const rows = await this.blivap.listNotifications(
      requireBlivapContext(request.actor),
      8,
    );
    if (rows.length === 0) {
      return {
        status: ActionStatus.Success,
        actionName: this.name,
        message: 'No recent notifications.',
        data: { count: 0 },
      };
    }
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: rows
        .map((row, index) => {
          const read = row.read ? 'read' : 'unread';
          return `${index + 1}. ${row.title} (${read}) · ${formatWhen(row.createdAt)}`;
        })
        .join('\n'),
      data: { count: rows.length },
      resourceType: 'notification',
    };
  }
}

@Injectable()
export class UpdateNotificationSettingsHandler implements ActionHandler {
  readonly name = 'update_notification_settings';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const pushEnabled = parseBoolean(request.params.pushEnabled);
    if (pushEnabled === null) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Turn push on or off?',
        failureCode: 'missing_push_enabled',
      };
    }
    const settings = await this.blivap.updateNotificationSettings(
      requireBlivapContext(request.actor),
      { pushEnabled },
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Push ${settings.pushEnabled ? 'on' : 'off'}.`,
      data: { pushEnabled: settings.pushEnabled },
      resourceType: 'notification_settings',
      resourceId: request.actor.userId ?? undefined,
    };
  }
}

function parseBoolean(value?: string): boolean | null {
  if (value === 'true' || value === 'on' || value === 'yes') return true;
  if (value === 'false' || value === 'off' || value === 'no') return false;
  return null;
}
