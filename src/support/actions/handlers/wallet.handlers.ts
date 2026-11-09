import { Inject, Injectable } from '@nestjs/common';
import {
  BLIVAP_INTEGRATION,
  type BlivapIntegrationPort,
} from '../../../integrations/blivap/index.js';
import { formatKobo, formatWhen } from '../formatting.js';
import {
  ActionStatus,
  type ActionExecutionRequest,
  type ActionExecutionResult,
  type ActionHandler,
} from '../actions.types.js';
import { requireBlivapContext } from './blivap-context.js';

@Injectable()
export class GetWalletSummaryHandler implements ActionHandler {
  readonly name = 'get_wallet_summary';

  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const wallet = await this.blivap.getWalletSummary(
      requireBlivapContext(request.actor),
    );
    const focus = request.params.focus ?? 'all';
    const recent = wallet.entries.slice(0, 5).map((entry, index) => {
      return `${index + 1}. ${entry.label} · ${entry.status} · ${formatKobo(entry.amountKobo, wallet.currency)} · ${formatWhen(entry.createdAt)}`;
    });
    const balanceLines = [
      `Available: ${formatKobo(wallet.availableKobo, wallet.currency)}`,
      `Held: ${formatKobo(wallet.heldKobo, wallet.currency)}`,
      `Payout held: ${formatKobo(wallet.payoutHeldKobo, wallet.currency)}`,
    ];
    const message =
      focus === 'transactions'
        ? recent.length
          ? recent.join('\n')
          : 'No transactions yet.'
        : focus === 'balance'
          ? balanceLines.join('\n')
          : [
              ...balanceLines,
              ...(recent.length ? recent : ['No recent activity.']),
            ].join('\n');

    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message,
      data: {
        availableKobo: wallet.availableKobo,
        heldKobo: wallet.heldKobo,
        payoutHeldKobo: wallet.payoutHeldKobo,
        currency: wallet.currency,
        entryCount: wallet.entries.length,
      },
      resourceType: 'wallet',
      resourceId: request.actor.userId ?? undefined,
    };
  }
}
