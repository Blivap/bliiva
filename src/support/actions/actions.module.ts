import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ActionsAuditService } from './actions.audit.service.js';
import { ActionsConfirmationService } from './actions.confirmation.service.js';
import { ActionsExecutor } from './actions.executor.js';
import { ActionsRegistry } from './actions.registry.js';
import { ActionsResolver } from './actions.resolver.js';
import { ACTION_HANDLERS } from './actions.types.js';
import {
  GetAccountStatusHandler,
  GetIdentityVerificationHandler,
  GetProfileHandler,
  ResendEmailVerificationHandler,
} from './handlers/account.handlers.js';
import { GetDonorProfileHandler } from './handlers/donor.handlers.js';
import {
  CancelBookingHandler,
  GetDonationHandler,
  GetDonationsHandler,
} from './handlers/donations.handlers.js';
import {
  GetNotificationSettingsHandler,
  ListNotificationsHandler,
  UpdateNotificationSettingsHandler,
} from './handlers/notifications.handlers.js';
import {
  GetBloodRequestHandler,
  GetBloodRequestsHandler,
} from './handlers/requests.handlers.js';
import { GetWalletSummaryHandler } from './handlers/wallet.handlers.js';

const HANDLERS = [
  GetProfileHandler,
  GetAccountStatusHandler,
  ResendEmailVerificationHandler,
  GetIdentityVerificationHandler,
  GetDonorProfileHandler,
  GetDonationsHandler,
  GetDonationHandler,
  CancelBookingHandler,
  GetBloodRequestsHandler,
  GetBloodRequestHandler,
  GetWalletSummaryHandler,
  GetNotificationSettingsHandler,
  ListNotificationsHandler,
  UpdateNotificationSettingsHandler,
];

@Module({
  imports: [AuditModule],
  providers: [
    ActionsRegistry,
    ActionsResolver,
    ActionsConfirmationService,
    ActionsAuditService,
    ActionsExecutor,
    ...HANDLERS,
    {
      provide: ACTION_HANDLERS,
      useFactory: (...handlers: InstanceType<(typeof HANDLERS)[number]>[]) =>
        handlers,
      inject: HANDLERS,
    },
  ],
  exports: [
    ActionsRegistry,
    ActionsResolver,
    ActionsExecutor,
    ActionsConfirmationService,
  ],
})
export class ActionsModule {}
