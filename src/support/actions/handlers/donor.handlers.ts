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

@Injectable()
export class ListDonorsHandler implements ActionHandler {
  readonly name = 'list_donors';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const bloodType = normalizeBloodType(
      request.params.bloodType ?? request.params.search,
    );
    const rows = await this.blivap.listDonors(
      requireBlivapContext(request.actor),
      {
        bloodType: bloodType || undefined,
        search: !bloodType ? request.params.search : undefined,
        limit: 10,
      },
    );
    if (!rows.length) {
      return {
        status: ActionStatus.Success,
        actionName: this.name,
        message: bloodType
          ? `No ${bloodType} donors found right now. Try Donors in the app with filters, or ask again later.`
          : 'No donors found right now. Open Donors in the app to browse.',
        data: { count: 0, bloodType: bloodType || null },
      };
    }
    const label = bloodType ? `${bloodType} donors` : 'Donors';
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: [
        `${label} (showing ${rows.length}):`,
        ...rows.map((row, i) => {
          const place = [row.city, row.state].filter(Boolean).join(', ');
          const cooldown = row.isInDonationCooldown ? ' · cooling down' : '';
          const handle = row.publicId || shortId(row.id);
          return `${i + 1}. ${row.bloodType} · ${handle}${place ? ` · ${place}` : ''}${cooldown}`;
        }),
        'Open a donor in the app to book. Cooling-down donors can’t be booked.',
      ].join('\n'),
      data: { count: rows.length, bloodType: bloodType || null },
      choices: rows.slice(0, 5).map((row, i) => ({
        id: row.id,
        label: `donor ${i + 1}`,
        params: { donorUserId: row.userId, donorId: row.id },
      })),
      resourceType: 'donor',
    };
  }
}

function normalizeBloodType(value?: string): string {
  if (!value) return '';
  const match = value
    .trim()
    .match(/^(AB|A|B|O)\s*([+-]|plus|minus|positive|negative)$/i);
  if (!match) return '';
  const sign = match[2]!.toLowerCase();
  const compact =
    sign === '+' || sign === 'plus' || sign === 'positive'
      ? '+'
      : sign === '-' || sign === 'minus' || sign === 'negative'
        ? '-'
        : sign;
  return `${match[1]!.toUpperCase()}${compact}`;
}
