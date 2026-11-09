import { describe, expect, it, vi } from 'vitest';
import type { SupportActor } from '../../common/auth/support-actor.js';
import { ActionRiskLevel, ActionStatus } from '../actions/actions.types.js';
import { emptyContext } from '../intelligence/context/conversation-context.js';
import { ToolsExecutor } from './tools.executor.js';
import { ToolsRegistry } from './tools.registry.js';

const actor: SupportActor = {
  userId: '64b0000000000000000000aa',
  guestSessionId: null,
  roles: ['user'],
  isAuthenticated: true,
  accessToken: 'token',
};

describe('ToolsExecutor', () => {
  it('rejects unknown tools', async () => {
    const executor = new ToolsExecutor(
      {
        get: () => null,
      } as unknown as ToolsRegistry,
      { execute: vi.fn() } as never,
      { findActionByIdempotency: vi.fn() } as never,
    );
    const result = await executor.execute({
      name: 'drop_database',
      arguments: {},
      conversationId: '64b0000000000000000000bb',
      actor,
      context: emptyContext(),
    });
    expect(result.status).toBe('unknown_tool');
  });

  it('blocks cross-user identity arguments', async () => {
    const executor = new ToolsExecutor(
      {
        get: () => ({
          name: 'get_profile',
          requiresAuthentication: true,
          requiredPermissions: [],
          parameters: [],
          readOnly: true,
          enabled: true,
          riskLevel: ActionRiskLevel.Low,
        }),
      } as never,
      { execute: vi.fn() } as never,
      { findActionByIdempotency: vi.fn() } as never,
    );
    const result = await executor.execute({
      name: 'get_profile',
      arguments: { userId: '64b0000000000000000000cc' },
      conversationId: '64b0000000000000000000bb',
      actor,
      context: emptyContext(),
    });
    expect(result.failureCode).toBe('cross_user');
  });

  it('validates required arguments', async () => {
    const executor = new ToolsExecutor(
      {
        get: () => ({
          name: 'get_donation',
          requiresAuthentication: true,
          requiredPermissions: [],
          parameters: [
            {
              name: 'donationId',
              description: 'id',
              required: true,
              source: 'user',
            },
          ],
          readOnly: true,
          enabled: true,
          riskLevel: ActionRiskLevel.Low,
        }),
      } as never,
      { execute: vi.fn() } as never,
      { findActionByIdempotency: vi.fn() } as never,
    );
    const result = await executor.execute({
      name: 'get_donation',
      arguments: {},
      conversationId: '64b0000000000000000000bb',
      actor,
      context: emptyContext(),
    });
    expect(result.status).toBe('invalid_arguments');
  });

  it('executes a registered tool through the action executor', async () => {
    const execute = vi.fn(async () => ({
      status: ActionStatus.Success,
      actionName: 'get_wallet_summary',
      message: 'Available: NGN 12.50',
      data: { available: 12.5, password: 'secret' },
    }));
    const executor = new ToolsExecutor(
      {
        get: () => ({
          name: 'get_wallet_summary',
          requiresAuthentication: true,
          requiredPermissions: [],
          parameters: [],
          readOnly: true,
          enabled: true,
          riskLevel: ActionRiskLevel.Low,
        }),
      } as never,
      { execute } as never,
      { findActionByIdempotency: vi.fn() } as never,
    );
    const result = await executor.execute({
      name: 'get_wallet_summary',
      arguments: {},
      conversationId: '64b0000000000000000000bb',
      actor,
      context: emptyContext(),
    });
    expect(result.status).toBe(ActionStatus.Success);
    expect(result.data).toEqual({ available: 12.5 });
  });

  it('rejects an unauthenticated caller', async () => {
    const executor = new ToolsExecutor(
      {
        get: () => ({
          name: 'get_wallet_summary',
          requiresAuthentication: true,
          requiredPermissions: [],
          parameters: [],
          readOnly: true,
          enabled: true,
          riskLevel: ActionRiskLevel.Low,
        }),
      } as never,
      { execute: vi.fn() } as never,
      { findActionByIdempotency: vi.fn() } as never,
    );
    const result = await executor.execute({
      name: 'get_wallet_summary',
      arguments: {},
      conversationId: '64b0000000000000000000bb',
      actor: { ...actor, isAuthenticated: false, userId: null },
      context: emptyContext(),
    });
    expect(result.failureCode).toBe('unauthenticated');
  });

  it('rejects a caller without the required role', async () => {
    const executor = new ToolsExecutor(
      {
        get: () => ({
          name: 'get_hospital_status',
          requiresAuthentication: true,
          requiredPermissions: ['hospital_admin'],
          parameters: [],
          readOnly: true,
          enabled: true,
          riskLevel: ActionRiskLevel.Low,
        }),
      } as never,
      { execute: vi.fn() } as never,
      { findActionByIdempotency: vi.fn() } as never,
    );
    const result = await executor.execute({
      name: 'get_hospital_status',
      arguments: {},
      conversationId: '64b0000000000000000000bb',
      actor,
      context: emptyContext(),
    });
    expect(result.failureCode).toBe('forbidden');
  });

  it('does not repeat a successful modification', async () => {
    const execute = vi.fn();
    const executor = new ToolsExecutor(
      {
        get: () => ({
          name: 'cancel_booking',
          requiresAuthentication: true,
          requiredPermissions: [],
          parameters: [
            {
              name: 'bookingId',
              description: 'id',
              required: true,
              source: 'user',
            },
          ],
          readOnly: false,
          enabled: true,
          riskLevel: ActionRiskLevel.High,
        }),
      } as never,
      { execute } as never,
      {
        findActionByIdempotency: vi.fn(async () => ({ status: 'success' })),
      } as never,
    );
    const result = await executor.execute({
      name: 'cancel_booking',
      arguments: { bookingId: 'bk_1' },
      conversationId: '64b0000000000000000000bb',
      actor,
      context: emptyContext(),
    });
    expect(result.failureCode).toBe('duplicate_modification');
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns a confirmation requirement without claiming success', async () => {
    const executor = new ToolsExecutor(
      {
        get: () => ({
          name: 'cancel_booking',
          requiresAuthentication: true,
          requiredPermissions: [],
          parameters: [
            {
              name: 'bookingId',
              description: 'id',
              required: true,
              source: 'user',
            },
          ],
          readOnly: false,
          enabled: true,
          riskLevel: ActionRiskLevel.High,
        }),
      } as never,
      {
        execute: vi.fn(async () => ({
          status: ActionStatus.NeedsConfirmation,
          actionName: 'cancel_booking',
          message: 'Confirm cancellation of booking bk_1.',
          confirmationId: 'confirm-1',
        })),
      } as never,
      { findActionByIdempotency: vi.fn(async () => null) } as never,
    );
    const result = await executor.execute({
      name: 'cancel_booking',
      arguments: { bookingId: 'bk_1' },
      conversationId: '64b0000000000000000000bb',
      actor,
      context: emptyContext(),
    });
    expect(result.status).toBe(ActionStatus.NeedsConfirmation);
    expect(result.confirmationId).toBe('confirm-1');
  });
});
