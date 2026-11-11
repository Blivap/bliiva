import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BLIVAP_INTEGRATION,
  type BlivapIntegrationPort,
} from '../../../integrations/blivap/index.js';
import { formatKobo, formatWhen, shortId } from '../formatting.js';
import {
  ActionStatus,
  type ActionExecutionRequest,
  type ActionExecutionResult,
  type ActionHandler,
} from '../actions.types.js';
import { requireBlivapContext } from './blivap-context.js';

@Injectable()
export class ListBanksHandler implements ActionHandler {
  readonly name = 'list_banks';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const banks = await this.blivap.listBanks(requireBlivapContext(request.actor));
    const lines = banks.slice(0, 15).map((b, i) => `${i + 1}. ${b.bank} (${b.code})`);
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: lines.length ? lines.join('\n') : 'No banks available.',
      data: { count: banks.length },
    };
  }
}

@Injectable()
export class ListBankAccountsHandler implements ActionHandler {
  readonly name = 'list_bank_accounts';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const rows = await this.blivap.listBankAccounts(
      requireBlivapContext(request.actor),
    );
    if (!rows.length) {
      return {
        status: ActionStatus.Success,
        actionName: this.name,
        message: 'No saved bank accounts yet.',
        data: { count: 0 },
      };
    }
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: rows
        .map(
          (row, i) =>
            `${i + 1}. ${row.bankName} · ${row.accountName} · ****${row.accountNumber.slice(-4)}${row.isPrimary ? ' · primary' : ''} · ${shortId(row.id)}`,
        )
        .join('\n'),
      data: { count: rows.length },
      choices: rows.map((row, i) => ({
        id: row.id,
        label: `account ${i + 1}`,
        params: { bankAccountId: row.id },
      })),
      resourceType: 'bank_account',
    };
  }
}

@Injectable()
export class ListPayoutsHandler implements ActionHandler {
  readonly name = 'list_payouts';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const rows = await this.blivap.listPayouts(requireBlivapContext(request.actor));
    if (!rows.length) {
      return {
        status: ActionStatus.Success,
        actionName: this.name,
        message: 'No withdrawals yet.',
        data: { count: 0 },
      };
    }
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: rows
        .slice(0, 8)
        .map(
          (row, i) =>
            `${i + 1}. ${row.status} · ${formatKobo(row.amountKobo, row.currency)} · ${row.bankName} ****${row.accountLast4} · ${formatWhen(row.createdAt)} · ${shortId(row.id)}`,
        )
        .join('\n'),
      data: { count: rows.length },
      choices: rows.slice(0, 5).map((row, i) => ({
        id: row.id,
        label: `payout ${i + 1}`,
        params: { payoutId: row.id },
      })),
      resourceType: 'payout',
    };
  }
}

@Injectable()
export class GetPayoutHandler implements ActionHandler {
  readonly name = 'get_payout';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const payoutId = request.params.payoutId;
    if (!payoutId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which withdrawal should I open? Share the payout id.',
        failureCode: 'missing_payout_id',
      };
    }
    const row = await this.blivap.getPayout(
      requireBlivapContext(request.actor),
      payoutId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: [
        `Status: ${row.status}`,
        `Amount: ${formatKobo(row.amountKobo, row.currency)}`,
        `Bank: ${row.bankName} ****${row.accountLast4}`,
        row.failureReason ? `Note: ${row.failureReason}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      data: { ...row },
      resourceType: 'payout',
      resourceId: row.id,
    };
  }
}

@Injectable()
export class StartWalletTopupHandler implements ActionHandler {
  readonly name = 'start_wallet_topup';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
    private readonly config: ConfigService,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const amountNaira = Number(request.params.amountNaira ?? request.params.amount);
    if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'How much should I top up (NGN)?',
        failureCode: 'missing_amount',
      };
    }
    const amountKobo = Math.round(amountNaira * 100);
    const callbackUrl =
      request.params.callbackUrl ||
      this.config.get<string>(
        'blivap.topupCallbackUrl',
        'https://app.blivap.com/wallet',
      );
    const topup = await this.blivap.startWalletTopup(
      requireBlivapContext(request.actor),
      { amountKobo, callbackUrl },
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: [
        `Top-up started for ${formatKobo(topup.amountKobo, 'NGN')}.`,
        `Open this Paystack link to pay: ${topup.authorizationUrl}`,
        `Reference: ${topup.reference}. After paying, say “verify top-up ${topup.reference}”.`,
      ].join('\n'),
      data: { ...topup },
      resourceType: 'wallet_topup',
      resourceId: topup.reference,
    };
  }
}

@Injectable()
export class VerifyWalletTopupHandler implements ActionHandler {
  readonly name = 'verify_wallet_topup';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const reference = request.params.reference;
    if (!reference) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Paste the top-up reference to verify.',
        failureCode: 'missing_reference',
      };
    }
    const wallet = await this.blivap.verifyWalletTopup(
      requireBlivapContext(request.actor),
      reference,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Wallet funded. Available: ${formatKobo(wallet.availableKobo, wallet.currency)}.`,
      data: {
        availableKobo: wallet.availableKobo,
        currency: wallet.currency,
      },
      resourceType: 'wallet',
    };
  }
}

@Injectable()
export class StartWalletPayoutHandler implements ActionHandler {
  readonly name = 'start_wallet_payout';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const amountNaira = Number(request.params.amountNaira ?? request.params.amount);
    if (!Number.isFinite(amountNaira) || amountNaira < 100) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'How much should I withdraw (NGN, minimum 100)?',
        failureCode: 'missing_amount',
      };
    }
    const amountKobo = Math.round(amountNaira * 100);
    const payout = await this.blivap.startWalletPayout(
      requireBlivapContext(request.actor),
      {
        amountKobo,
        bankAccountId: request.params.bankAccountId || undefined,
      },
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: [
        `Withdrawal started for ${formatKobo(payout.amountKobo, payout.currency)}.`,
        `Enter the 6-character code emailed to you to confirm (payout ${shortId(payout.id)}).`,
      ].join('\n'),
      data: { payoutId: payout.id, status: payout.status },
      resourceType: 'payout',
      resourceId: payout.id,
    };
  }
}

@Injectable()
export class ConfirmWalletPayoutHandler implements ActionHandler {
  readonly name = 'confirm_wallet_payout';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const payoutId = request.params.payoutId;
    const otp = request.params.otp;
    if (!payoutId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which payout id should I confirm?',
        failureCode: 'missing_payout_id',
      };
    }
    if (!otp || !/^[A-Za-z0-9]{6}$/.test(otp)) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Enter the 6-character OTP from your email.',
        failureCode: 'missing_otp',
      };
    }
    const payout = await this.blivap.confirmWalletPayout(
      requireBlivapContext(request.actor),
      payoutId,
      otp,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Withdrawal ${payout.status}. ${formatKobo(payout.amountKobo, payout.currency)} to ${payout.bankName} ****${payout.accountLast4}.`,
      data: { payoutId: payout.id, status: payout.status },
      resourceType: 'payout',
      resourceId: payout.id,
    };
  }
}

@Injectable()
export class ResendPayoutOtpHandler implements ActionHandler {
  readonly name = 'resend_payout_otp';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const payoutId = request.params.payoutId;
    if (!payoutId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which payout needs a new OTP?',
        failureCode: 'missing_payout_id',
      };
    }
    const payout = await this.blivap.resendPayoutOtp(
      requireBlivapContext(request.actor),
      payoutId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `New code sent for payout ${shortId(payout.id)}. Enter the 6-character OTP to confirm.`,
      data: { payoutId: payout.id },
      resourceType: 'payout',
      resourceId: payout.id,
    };
  }
}

@Injectable()
export class AddBankAccountHandler implements ActionHandler {
  readonly name = 'add_bank_account';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const accountNumber = request.params.accountNumber;
    if (!accountNumber || !/^\d{10}$/.test(accountNumber)) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Share the 10-digit account number to save.',
        failureCode: 'missing_account_number',
      };
    }
    const account = await this.blivap.addBankAccount(
      requireBlivapContext(request.actor),
      { accountNumber, bank: request.params.bank || undefined },
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Saved ${account.bankName} · ${account.accountName} · ****${account.accountNumber.slice(-4)}.`,
      data: { bankAccountId: account.id },
      resourceType: 'bank_account',
      resourceId: account.id,
    };
  }
}

@Injectable()
export class SetPrimaryBankAccountHandler implements ActionHandler {
  readonly name = 'set_primary_bank_account';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const bankAccountId = request.params.bankAccountId;
    if (!bankAccountId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which bank account should be primary?',
        failureCode: 'missing_bank_account_id',
      };
    }
    const account = await this.blivap.setPrimaryBankAccount(
      requireBlivapContext(request.actor),
      bankAccountId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: `Primary account set to ${account.bankName} ****${account.accountNumber.slice(-4)}.`,
      data: { bankAccountId: account.id },
      resourceType: 'bank_account',
      resourceId: account.id,
    };
  }
}

@Injectable()
export class RemoveBankAccountHandler implements ActionHandler {
  readonly name = 'remove_bank_account';
  constructor(
    @Inject(BLIVAP_INTEGRATION) private readonly blivap: BlivapIntegrationPort,
  ) {}
  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const bankAccountId = request.params.bankAccountId;
    if (!bankAccountId) {
      return {
        status: ActionStatus.NeedsParameter,
        actionName: this.name,
        message: 'Which bank account should I remove?',
        failureCode: 'missing_bank_account_id',
      };
    }
    await this.blivap.removeBankAccount(
      requireBlivapContext(request.actor),
      bankAccountId,
    );
    return {
      status: ActionStatus.Success,
      actionName: this.name,
      message: 'Bank account removed.',
      data: { bankAccountId },
      resourceType: 'bank_account',
      resourceId: bankAccountId,
    };
  }
}
