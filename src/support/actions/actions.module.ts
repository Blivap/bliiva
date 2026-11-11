import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ActionsAuditService } from './actions.audit.service.js';
import { ActionsConfirmationService } from './actions.confirmation.service.js';
import { ActionsExecutor } from './actions.executor.js';
import { ActionsRegistry } from './actions.registry.js';
import { ActionsResolver } from './actions.resolver.js';
import { ACTION_HANDLERS } from './actions.types.js';
import {
  ChangePasswordHandler,
  ListHospitalsHandler,
  ListWelfarePackagesHandler,
  MarkAllNotificationsReadHandler,
  MarkNotificationReadHandler,
  RegisterDonorHandler,
  RequestPasswordResetHandler,
  SubmitNinVerificationHandler,
  UpdateDonorLocationHandler,
  UpdateMeetupCareHandler,
  UpdateProfileHandler,
} from './handlers/account-extended.handlers.js';
import {
  GetAccountStatusHandler,
  GetIdentityVerificationHandler,
  GetProfileHandler,
  ResendEmailVerificationHandler,
} from './handlers/account.handlers.js';
import {
  AcceptBookingHandler,
  CreateBloodRequestHandler,
  DeclineBookingHandler,
  ListBookingsHandler,
  ReportBookingHandler,
  RequestBookingHandler,
} from './handlers/bookings-extended.handlers.js';
import {
  GetDonorProfileHandler,
  ListDonorsHandler,
} from './handlers/donor.handlers.js';
import {
  CancelBookingHandler,
  GetDonationHandler,
  GetDonationsHandler,
} from './handlers/donations.handlers.js';
import {
  CompleteMeetupHandler,
  ConfirmMeetupDonorHandler,
  ConfirmMeetupRequesterHandler,
  CreateMeetupSessionHandler,
  GetMeetupSessionHandler,
  ReportMeetupHandler,
  TerminateMeetupHandler,
  VerifyMeetupCodeHandler,
} from './handlers/meetup.handlers.js';
import {
  GetNotificationSettingsHandler,
  ListNotificationsHandler,
  UpdateNotificationSettingsHandler,
} from './handlers/notifications.handlers.js';
import {
  GetBloodRequestHandler,
  GetBloodRequestsHandler,
} from './handlers/requests.handlers.js';
import {
  AddBankAccountHandler,
  ConfirmWalletPayoutHandler,
  GetPayoutHandler,
  ListBankAccountsHandler,
  ListBanksHandler,
  ListPayoutsHandler,
  RemoveBankAccountHandler,
  ResendPayoutOtpHandler,
  SetPrimaryBankAccountHandler,
  StartWalletPayoutHandler,
  StartWalletTopupHandler,
  VerifyWalletTopupHandler,
} from './handlers/wallet-extended.handlers.js';
import { GetWalletSummaryHandler } from './handlers/wallet.handlers.js';

const HANDLERS = [
  GetProfileHandler,
  GetAccountStatusHandler,
  ResendEmailVerificationHandler,
  GetIdentityVerificationHandler,
  GetDonorProfileHandler,
  ListDonorsHandler,
  GetDonationsHandler,
  GetDonationHandler,
  CancelBookingHandler,
  GetBloodRequestsHandler,
  GetBloodRequestHandler,
  GetWalletSummaryHandler,
  GetNotificationSettingsHandler,
  ListNotificationsHandler,
  UpdateNotificationSettingsHandler,
  ListBanksHandler,
  ListBankAccountsHandler,
  ListPayoutsHandler,
  GetPayoutHandler,
  StartWalletTopupHandler,
  VerifyWalletTopupHandler,
  StartWalletPayoutHandler,
  ConfirmWalletPayoutHandler,
  ResendPayoutOtpHandler,
  AddBankAccountHandler,
  SetPrimaryBankAccountHandler,
  RemoveBankAccountHandler,
  ListBookingsHandler,
  RequestBookingHandler,
  AcceptBookingHandler,
  DeclineBookingHandler,
  ReportBookingHandler,
  CreateBloodRequestHandler,
  UpdateProfileHandler,
  ChangePasswordHandler,
  RequestPasswordResetHandler,
  SubmitNinVerificationHandler,
  RegisterDonorHandler,
  UpdateDonorLocationHandler,
  UpdateMeetupCareHandler,
  MarkNotificationReadHandler,
  MarkAllNotificationsReadHandler,
  ListHospitalsHandler,
  ListWelfarePackagesHandler,
  GetMeetupSessionHandler,
  CreateMeetupSessionHandler,
  VerifyMeetupCodeHandler,
  ConfirmMeetupRequesterHandler,
  ConfirmMeetupDonorHandler,
  CompleteMeetupHandler,
  TerminateMeetupHandler,
  ReportMeetupHandler,
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
