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
export class UpdateProfileHandler implements ActionHandler {
  readonly name = 'update_profile';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const patch: Record<string, unknown> = {};
    for (const key of [
      'firstname',
      'lastname',
      'phonenumber',
      'dateOfBirth',
      'profileImage',
    ]) {
      if (request.params[key]) patch[key] = request.params[key];
    }
    if (!Object.keys(patch).length) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'What should I update (firstname, lastname, phonenumber, dateOfBirth)?',
        failureCode: 'missing_profile_fields',
      };
    }
    const profile = await this.blivap.updateProfile(
      requireBlivapContext(request.actor),
      patch,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Profile updated for ${profile.firstname ?? ''} ${profile.lastname ?? ''}`.trim(),
      data: { userId: profile.id },
      resourceType: 'profile',
      resourceId: profile.id,
    };
  }
}

@Injectable()
export class ChangePasswordHandler implements ActionHandler {
  readonly name = 'change_password';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const oldPassword = request.params.oldPassword;
    const password = request.params.password ?? request.params.newPassword;
    if (!oldPassword || !password) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'I need your current password and the new password.',
        failureCode: 'missing_password_fields',
      };
    }
    await this.blivap.changePassword(requireBlivapContext(request.actor), {
      oldPassword,
      password,
    });
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: 'Password changed. Use the new password next time you sign in.',
      data: { ok: true },
      resourceType: 'account',
    };
  }
}

@Injectable()
export class RequestPasswordResetHandler implements ActionHandler {
  readonly name = 'request_password_reset_email';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const ctx = requireBlivapContext(request.actor);
    const profile = await this.blivap.getProfile(ctx);
    await this.blivap.requestPasswordReset(profile.email);
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Password reset email queued for ${profile.email}.`,
      data: { queued: true },
      resourceType: 'account',
    };
  }
}

@Injectable()
export class SubmitNinVerificationHandler implements ActionHandler {
  readonly name = 'submit_nin_verification';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const nin = request.params.nin;
    if (!nin || !/^\d{11}$/.test(nin)) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Share your 11-digit NIN to verify identity.',
        failureCode: 'missing_nin',
      };
    }
    const result = await this.blivap.submitNinVerification(
      requireBlivapContext(request.actor),
      nin,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: 'NIN verification submitted. Check Profile for status.',
      data: { submitted: true, keys: Object.keys(result) },
      resourceType: 'identity',
    };
  }
}

@Injectable()
export class RegisterDonorHandler implements ActionHandler {
  readonly name = 'register_donor';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const bloodType = request.params.bloodType;
    const city = request.params.city;
    const state = request.params.state;
    if (!bloodType || !city || !state) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'I need bloodType, city, and state to register you as a donor.',
        failureCode: 'missing_donor_fields',
      };
    }
    const result = await this.blivap.registerDonor(
      requireBlivapContext(request.actor),
      {
        bloodType,
        areaLocation: { city, state },
        expenseCoverage: request.params.expenseCoverage ?? 'self',
      },
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: 'Donor registration submitted. Complete any remaining screening in the app.',
      data: { keys: Object.keys(result) },
      resourceType: 'donor',
    };
  }
}

@Injectable()
export class UpdateDonorLocationHandler implements ActionHandler {
  readonly name = 'update_donor_location';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const lng = Number(request.params.lng ?? request.params.longitude);
    const lat = Number(request.params.lat ?? request.params.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Share latitude and longitude to update donor location.',
        failureCode: 'missing_location',
      };
    }
    await this.blivap.updateDonorLocation(requireBlivapContext(request.actor), {
      location: { type: 'Point', coordinates: [lng, lat] },
    });
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: 'Donor location updated.',
      data: { ok: true },
      resourceType: 'donor',
    };
  }
}

@Injectable()
export class UpdateMeetupCareHandler implements ActionHandler {
  readonly name = 'update_meetup_care';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const expenseCoverage = request.params.expenseCoverage;
    if (expenseCoverage !== 'requested' && expenseCoverage !== 'self') {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Choose meetup care: “self” (you cover) or “requested” (requester covers).',
        failureCode: 'missing_meetup_care',
      };
    }
    await this.blivap.updateMeetupCare(requireBlivapContext(request.actor), {
      expenseCoverage,
    });
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Meetup care set to ${expenseCoverage}.`,
      data: { expenseCoverage },
      resourceType: 'donor',
    };
  }
}

@Injectable()
export class MarkNotificationReadHandler implements ActionHandler {
  readonly name = 'mark_notification_read';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const notificationId = request.params.notificationId;
    if (!notificationId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which notification id should I mark read?',
        failureCode: 'missing_notification_id',
      };
    }
    await this.blivap.markNotificationRead(
      requireBlivapContext(request.actor),
      notificationId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: 'Notification marked read.',
      data: { notificationId },
      resourceType: 'notification',
      resourceId: notificationId,
    };
  }
}

@Injectable()
export class MarkAllNotificationsReadHandler implements ActionHandler {
  readonly name = 'mark_all_notifications_read';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    await this.blivap.markAllNotificationsRead(
      requireBlivapContext(request.actor),
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: 'All notifications marked read.',
      data: { ok: true },
      resourceType: 'notification',
    };
  }
}

@Injectable()
export class ListHospitalsHandler implements ActionHandler {
  readonly name = 'list_hospitals';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const rows = await this.blivap.listHospitals(requireBlivapContext(request.actor));
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: rows.length
        ? rows
            .slice(0, 12)
            .map(
              (row, i) =>
                `${i + 1}. ${row.name}${row.city ? ` · ${row.city}` : ''}${row.state ? `, ${row.state}` : ''}`,
            )
            .join('\n')
        : 'No hospitals listed.',
      data: { count: rows.length },
      choices: rows.slice(0, 8).map((row, i) => ({
        id: row.id,
        label: `hospital ${i + 1}`,
        params: { hospitalId: row.id },
      })),
      resourceType: 'hospital',
    };
  }
}

@Injectable()
export class ListWelfarePackagesHandler implements ActionHandler {
  readonly name = 'list_welfare_packages';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const rows = await this.blivap.listWelfarePackages(
      requireBlivapContext(request.actor),
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: rows.length
        ? rows
            .slice(0, 10)
            .map((row, i) => `${i + 1}. ${row.name}${row.description ? ` — ${row.description}` : ''}`)
            .join('\n')
        : 'No welfare packages listed.',
      data: { count: rows.length },
      resourceType: 'welfare_package',
    };
  }
}
