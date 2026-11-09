import { Inject, Injectable } from '@nestjs/common';
import {
  BLIVAP_INTEGRATION,
  type BlivapIntegrationPort,
} from '../../../integrations/blivap/index.js';
import { yesNo } from '../formatting.js';
import {
  ActionStatus,
  type ActionExecutionRequest,
  type ActionExecutionResult,
  type ActionHandler,
} from '../actions.types.js';
import { requireBlivapContext } from './blivap-context.js';

@Injectable()
export class GetProfileHandler implements ActionHandler {
  readonly name = 'get_profile';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const profile = await this.blivap.getProfile(
      requireBlivapContext(request.actor),
    );
    const name = [profile.firstname, profile.lastname]
      .filter(Boolean)
      .join(' ');
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: [
        name ? `Profile: ${name}` : 'Profile',
        `Email: ${profile.email}`,
        profile.phonenumber ? `Phone: ${profile.phonenumber}` : null,
        `Email verified: ${yesNo(profile.emailVerified)}`,
        `Public id: ${profile.publicId ?? 'none'}`,
      ]
        .filter(Boolean)
        .join('\n'),
      data: {
        email: profile.email,
        emailVerified: profile.emailVerified,
        publicId: profile.publicId,
      },
      resourceType: 'user',
      resourceId: profile.id,
    };
  }
}

@Injectable()
export class GetAccountStatusHandler implements ActionHandler {
  readonly name = 'get_account_status';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const profile = await this.blivap.getProfile(
      requireBlivapContext(request.actor),
    );
    if (profile.isDeleted) {
      return {
        status: ActionStatus.Success,
        actionName: this.name,
        message: 'Account is deleted. Ask a specialist about reactivation.',
        escalate: true,
        resourceType: 'user',
        resourceId: profile.id,
      };
    }
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: [
        `Suspended: ${yesNo(profile.isSuspended)}`,
        `Email verified: ${yesNo(profile.emailVerified)}`,
        `Identity verified: ${yesNo(profile.identityVerified)}`,
        profile.identityProfileLocked ? 'Identity details are locked.' : null,
        profile.emailVerified
          ? 'Still locked out? Use Forgot password.'
          : 'Email not verified — I can resend the link.',
      ]
        .filter(Boolean)
        .join('\n'),
      data: {
        emailVerified: profile.emailVerified,
        identityVerified: profile.identityVerified,
        isSuspended: profile.isSuspended,
      },
      resourceType: 'user',
      resourceId: profile.id,
      choices: profile.emailVerified
        ? undefined
        : [
            {
              id: 'resend',
              label: 'resend verification email',
              params: { followUpAction: 'resend_email_verification' },
            },
          ],
    };
  }
}

@Injectable()
export class ResendEmailVerificationHandler implements ActionHandler {
  readonly name = 'resend_email_verification';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const profile = await this.blivap.getProfile(
      requireBlivapContext(request.actor),
    );
    if (profile.emailVerified) {
      return {
        status: ActionStatus.Rejected,
        actionName: this.name,
        message: 'Email already verified.',
        failureCode: 'already_verified',
        resourceType: 'user',
        resourceId: profile.id,
      };
    }
    await this.blivap.resendVerificationEmail(profile.email);
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: 'Verification email sent. Check inbox/spam.',
      resourceType: 'user',
      resourceId: profile.id,
    };
  }
}

@Injectable()
export class GetIdentityVerificationHandler implements ActionHandler {
  readonly name = 'get_identity_verification_status';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const profile = await this.blivap.getProfile(
      requireBlivapContext(request.actor),
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: [
        `Email verified: ${yesNo(profile.emailVerified)}`,
        `Identity verified: ${yesNo(profile.identityVerified)}`,
        profile.identityProfileLocked
          ? 'Identity locked — ask a specialist to unlock.'
          : 'Finish remaining steps in the app.',
      ].join('\n'),
      data: {
        emailVerified: profile.emailVerified,
        identityVerified: profile.identityVerified,
        identityProfileLocked: profile.identityProfileLocked,
      },
      resourceType: 'user',
      resourceId: profile.id,
    };
  }
}
