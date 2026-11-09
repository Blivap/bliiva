import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { JsonCacheService } from '../../redis/json-cache.service.js';
import type { ActionRiskLevelName } from './actions.types.js';

export interface ActionConfirmationRecord {
  confirmationId: string;
  conversationId: string;
  userId: string;
  actionName: string;
  params: Record<string, string>;
  riskLevel: ActionRiskLevelName;
  summary: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

@Injectable()
export class ActionsConfirmationService {
  constructor(
    private readonly cache: JsonCacheService,
    private readonly config: ConfigService,
  ) {}

  async create(input: {
    conversationId: string;
    userId: string;
    actionName: string;
    params: Record<string, string>;
    riskLevel: ActionRiskLevelName;
    summary: string;
  }): Promise<ActionConfirmationRecord> {
    const ttl = this.config.get<number>('actions.confirmationTtlMs', 300000);
    const now = Date.now();
    const confirmationId = randomUUID();
    const record: ActionConfirmationRecord = {
      confirmationId,
      conversationId: input.conversationId,
      userId: input.userId,
      actionName: input.actionName,
      params: input.params,
      riskLevel: input.riskLevel,
      summary: input.summary,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttl).toISOString(),
      consumedAt: null,
    };
    await this.cache.set(this.key(confirmationId), record, ttl);
    return record;
  }

  async consume(input: {
    confirmationId: string;
    conversationId: string;
    userId: string;
    actionName: string;
  }): Promise<ActionConfirmationRecord | null> {
    const key = this.key(input.confirmationId);
    const record = await this.cache.get<ActionConfirmationRecord>(key);
    if (!record) return null;
    if (record.consumedAt) return null;
    if (Date.parse(record.expiresAt) <= Date.now()) {
      await this.cache.del(key);
      return null;
    }
    if (
      record.conversationId !== input.conversationId ||
      record.userId !== input.userId ||
      record.actionName !== input.actionName
    ) {
      return null;
    }
    const consumed: ActionConfirmationRecord = {
      ...record,
      consumedAt: new Date().toISOString(),
    };
    await this.cache.del(key);
    return consumed;
  }

  fingerprint(actionName: string, params: Record<string, string>): string {
    const normalized = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha256')
      .update(`${actionName}|${normalized}`)
      .digest('hex')
      .slice(0, 24);
  }

  private key(confirmationId: string): string {
    return `actions:confirm:${confirmationId}`;
  }
}
