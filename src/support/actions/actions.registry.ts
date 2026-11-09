import { Injectable } from '@nestjs/common';
import {
  ActionRiskLevel,
  type SupportActionDefinition,
} from './actions.types.js';

const DEFINITIONS: SupportActionDefinition[] = [
  {
    name: 'get_profile',
    description: 'Retrieve the signed-in user profile summary',
    category: 'user_profile',
    intents: ['PROFILE_UPDATE'],
    requiresAuthentication: true,
    requiresConfirmation: false,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Low,
    readOnly: true,
    enabled: true,
    parameters: [],
    handler: 'get_profile',
  },
  {
    name: 'get_account_status',
    description: 'Check account verification and activation status',
    category: 'account_authentication',
    intents: ['ACCOUNT_LOGIN', 'ACCOUNT_STATUS'],
    requiresAuthentication: true,
    requiresConfirmation: false,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Low,
    readOnly: true,
    enabled: true,
    parameters: [],
    handler: 'get_account_status',
  },
  {
    name: 'resend_email_verification',
    description: 'Resend the email verification link for the signed-in user',
    category: 'account_authentication',
    intents: ['ACCOUNT_LOGIN', 'ACCOUNT_STATUS'],
    requiresAuthentication: true,
    requiresConfirmation: true,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Medium,
    readOnly: false,
    enabled: true,
    parameters: [],
    handler: 'resend_email_verification',
  },
  {
    name: 'get_donor_profile',
    description: 'Retrieve the signed-in donor registration profile',
    category: 'donor_registration',
    intents: ['DONOR_REGISTRATION'],
    requiresAuthentication: true,
    requiresConfirmation: false,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Low,
    readOnly: true,
    enabled: true,
    parameters: [],
    handler: 'get_donor_profile',
  },
  {
    name: 'get_donations',
    description: 'List donation bookings and upcoming appointments',
    category: 'blood_donation_process',
    intents: ['DONATION_STATUS', 'APPOINTMENT_STATUS'],
    requiresAuthentication: true,
    requiresConfirmation: false,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Low,
    readOnly: true,
    enabled: true,
    parameters: [],
    handler: 'get_donations',
  },
  {
    name: 'get_donation',
    description: 'Retrieve one donation booking owned by the signed-in user',
    category: 'blood_donation_process',
    intents: ['DONATION_STATUS', 'APPOINTMENT_STATUS'],
    requiresAuthentication: true,
    requiresConfirmation: false,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Low,
    readOnly: true,
    enabled: true,
    parameters: [
      {
        name: 'donationId',
        description: 'Donation or booking id',
        required: true,
        source: 'user',
      },
    ],
    handler: 'get_donation',
  },
  {
    name: 'get_blood_requests',
    description: 'List blood requests owned by the signed-in user',
    category: 'blood_requests',
    intents: ['BLOOD_REQUEST_HELP', 'BLOOD_REQUEST_STATUS'],
    requiresAuthentication: true,
    requiresConfirmation: false,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Low,
    readOnly: true,
    enabled: true,
    parameters: [],
    handler: 'get_blood_requests',
  },
  {
    name: 'get_blood_request',
    description: 'Retrieve one blood request owned by the signed-in user',
    category: 'blood_requests',
    intents: ['BLOOD_REQUEST_HELP', 'BLOOD_REQUEST_STATUS'],
    requiresAuthentication: true,
    requiresConfirmation: false,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Low,
    readOnly: true,
    enabled: true,
    parameters: [
      {
        name: 'requestId',
        description: 'Blood request id',
        required: true,
        source: 'user',
      },
    ],
    handler: 'get_blood_request',
  },
  {
    name: 'get_wallet_summary',
    description: 'Retrieve wallet balance and recent transactions',
    category: 'wallet_transactions',
    intents: ['WALLET_BALANCE', 'WALLET_TRANSACTIONS'],
    requiresAuthentication: true,
    requiresConfirmation: false,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Low,
    readOnly: true,
    enabled: true,
    parameters: [],
    handler: 'get_wallet_summary',
  },
  {
    name: 'get_notification_settings',
    description: 'Retrieve notification preferences',
    category: 'notifications',
    intents: ['NOTIFICATION_HELP'],
    requiresAuthentication: true,
    requiresConfirmation: false,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Low,
    readOnly: true,
    enabled: true,
    parameters: [],
    handler: 'get_notification_settings',
  },
  {
    name: 'list_notifications',
    description: 'List recent notifications for the signed-in user',
    category: 'notifications',
    intents: ['NOTIFICATION_HELP'],
    requiresAuthentication: true,
    requiresConfirmation: false,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Low,
    readOnly: true,
    enabled: true,
    parameters: [],
    handler: 'list_notifications',
  },
  {
    name: 'update_notification_settings',
    description: 'Update permitted notification preferences',
    category: 'notifications',
    intents: ['NOTIFICATION_HELP'],
    requiresAuthentication: true,
    requiresConfirmation: true,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Medium,
    readOnly: false,
    enabled: true,
    parameters: [
      {
        name: 'pushEnabled',
        description: 'Enable or disable push notifications',
        required: false,
        source: 'user',
      },
    ],
    handler: 'update_notification_settings',
  },
  {
    name: 'get_identity_verification_status',
    description: 'Check email and identity verification progress',
    category: 'hospital_verification',
    intents: ['HOSPITAL_VERIFICATION', 'ACCOUNT_STATUS'],
    requiresAuthentication: true,
    requiresConfirmation: false,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.Low,
    readOnly: true,
    enabled: true,
    parameters: [],
    handler: 'get_identity_verification_status',
  },
  {
    name: 'cancel_booking',
    description: 'Cancel an eligible booking owned by the signed-in requester',
    category: 'blood_donation_process',
    intents: ['CANCEL_BOOKING'],
    requiresAuthentication: true,
    requiresConfirmation: true,
    requiredPermissions: [],
    riskLevel: ActionRiskLevel.High,
    readOnly: false,
    enabled: true,
    parameters: [
      {
        name: 'bookingId',
        description: 'Booking id to cancel',
        required: true,
        source: 'user',
      },
    ],
    handler: 'cancel_booking',
  },
];

@Injectable()
export class ActionsRegistry {
  private readonly disabled = new Set<string>();

  list(): SupportActionDefinition[] {
    return DEFINITIONS.map((item) => ({
      ...item,
      enabled: item.enabled && !this.disabled.has(item.name),
    }));
  }

  get(name: string): SupportActionDefinition | null {
    const found = DEFINITIONS.find((item) => item.name === name);
    if (!found) return null;
    return {
      ...found,
      enabled: found.enabled && !this.disabled.has(found.name),
    };
  }

  setEnabled(name: string, enabled: boolean): SupportActionDefinition | null {
    const found = this.get(name);
    if (!found) return null;
    if (enabled) this.disabled.delete(name);
    else this.disabled.add(name);
    return this.get(name);
  }

  forIntent(intent: string): SupportActionDefinition[] {
    return this.list().filter(
      (item) => item.enabled && item.intents.includes(intent),
    );
  }
}
