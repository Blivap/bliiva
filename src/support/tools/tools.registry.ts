import { Injectable } from '@nestjs/common';
import { ActionsRegistry } from '../actions/actions.registry.js';
import type { SupportActionDefinition } from '../actions/actions.types.js';
import type { LlmToolDefinition } from '../llm/llm.types.js';

@Injectable()
export class ToolsRegistry {
  constructor(private readonly actions: ActionsRegistry) {}

  list(): LlmToolDefinition[] {
    return this.actions
      .list()
      .filter((action) => action.enabled)
      .map(toTool);
  }

  get(name: string): SupportActionDefinition | null {
    const action = this.actions.get(name);
    if (!action?.enabled) return null;
    return action;
  }
}

const BLIVAP_HINT: Record<string, string> = {
  get_profile: 'Blivap GET /authentication/me — profile details.',
  get_account_status:
    'Blivap GET /authentication/me — active / verified / ready.',
  get_identity_verification_status:
    'Blivap GET /authentication/me — email / NIN / identity progress.',
  resend_email_verification:
    'Blivap POST /authentication/resend-email-verification-link.',
  get_donor_profile: 'Blivap GET /donors/me — donor registration status.',
  get_donations: 'Blivap GET /bookings/mine — donations & bookings list.',
  get_donation: 'Blivap GET /bookings/mine filtered by donationId.',
  cancel_booking: 'Blivap PATCH /bookings/:id/cancel — high risk.',
  get_blood_requests: 'Blivap GET /blood-requests/mine — request list.',
  get_blood_request: 'Blivap GET /blood-requests/mine filtered by requestId.',
  get_wallet_summary: 'Blivap GET /wallet — balance & recent transactions.',
  get_notification_settings: 'Blivap GET /notifications/settings.',
  list_notifications: 'Blivap GET /notifications — recent / unread.',
  update_notification_settings: 'Blivap PATCH /notifications/settings.',
};

function toTool(action: SupportActionDefinition): LlmToolDefinition {
  const properties: Record<string, { type: 'string'; description: string }> =
    {};
  const required: string[] = [];
  for (const parameter of action.parameters) {
    properties[parameter.name] = {
      type: 'string',
      description: parameter.description,
    };
    if (parameter.required) required.push(parameter.name);
  }
  const confirmation = action.requiresConfirmation
    ? ' This does not complete until the signed-in user confirms in chat.'
    : '';
  const identity =
    ' The signed-in user is supplied by the server. Do not pass a user id.';
  const endpoint = BLIVAP_HINT[action.name]
    ? ` ${BLIVAP_HINT[action.name]}`
    : '';
  return {
    name: action.name,
    description: `${action.description}.${endpoint}${identity}${confirmation}`,
    parameters: { type: 'object', properties, required },
  };
}
