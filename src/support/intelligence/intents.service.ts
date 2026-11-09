import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { isDuplicateKeyError } from '../../common/auth/mongo-errors.js';
import type { SupportActor } from '../../common/auth/support-actor.js';
import {
  toPaginatedResult,
  type PaginatedResult,
} from '../../common/dto/pagination.dto.js';
import { IntentSensitivity } from '../../common/enums/index.js';
import { AuditRepository } from '../audit/audit.repository.js';
import { IntentRepository } from './intent.repository.js';
import { EscalationPolicy } from './interfaces/intent-recognizer.interface.js';
import { IntentCatalogService } from './recognition/intent-catalog.service.js';
import { toIntentDefinition } from './recognition/map-intent.js';
import type { IntentFieldsDto, UpdateIntentDto } from './dto/intent.dto.js';

@Injectable()
export class IntentsService {
  constructor(
    private readonly intents: IntentRepository,
    private readonly catalog: IntentCatalogService,
    private readonly audit: AuditRepository,
  ) {}

  async list(
    page: number,
    limit: number,
    category?: string,
    enabled?: boolean,
  ) {
    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (enabled !== undefined) filter.enabled = enabled;
    const [items, total] = await this.intents.findPaginated(
      filter,
      page,
      limit,
    );
    return toPaginatedResult(
      items.map((item) => toIntentDefinition(item)),
      total,
      page,
      limit,
    );
  }

  async create(dto: IntentFieldsDto, actor: SupportActor) {
    assertHasSignals(dto);
    try {
      const created = await this.intents.create({
        name: dto.name,
        description: dto.description,
        category: dto.category,
        keywords: dto.keywords,
        phrases: dto.phrases,
        synonyms: dto.synonyms,
        examples: dto.examples,
        negativeKeywords: dto.negativeKeywords ?? [],
        priority: dto.priority ?? 0,
        confidenceThreshold: dto.confidenceThreshold ?? null,
        clarificationLabel: dto.clarificationLabel ?? '',
        enabled: true,
        sensitivity: dto.sensitivity ?? IntentSensitivity.Low,
        requiresAuthentication: dto.requiresAuthentication ?? false,
        escalationPolicy:
          dto.escalationPolicy ?? EscalationPolicy.AnswerFromKnowledge,
      });
      await this.catalog.invalidate();
      await this.auditChange(actor, 'intent.created', created.name);
      return toIntentDefinition(created);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('An intent with that name already exists.');
      }
      throw error;
    }
  }

  async update(name: string, dto: UpdateIntentDto, actor: SupportActor) {
    const existing = await this.intents.findByName(name);
    if (!existing) throw new NotFoundException('Intent not found.');
    if (dto.name && dto.name !== name) {
      throw new BadRequestException('Intent name cannot be changed.');
    }
    const merged = { ...toIntentDefinition(existing), ...stripUndefined(dto) };
    assertHasSignals(merged);
    const updated = await this.intents.updateByName(name, {
      ...stripUndefined(dto),
      name: existing.name,
    });
    if (!updated) throw new NotFoundException('Intent not found.');
    await this.catalog.invalidate();
    await this.auditChange(actor, 'intent.updated', name);
    return toIntentDefinition(updated);
  }

  async setEnabled(name: string, enabled: boolean, actor: SupportActor) {
    const updated = await this.intents.updateByName(name, { enabled });
    if (!updated) throw new NotFoundException('Intent not found.');
    await this.catalog.invalidate();
    await this.auditChange(
      actor,
      enabled ? 'intent.enabled' : 'intent.disabled',
      name,
    );
    return toIntentDefinition(updated);
  }

  private async auditChange(actor: SupportActor, action: string, name: string) {
    await this.audit.createAudit({
      action,
      resourceType: 'intent',
      resourceId: null,
      actorId: actor.userId ? new Types.ObjectId(actor.userId) : null,
      actorType: 'administrator',
      metadata: { name },
    });
  }
}

function assertHasSignals(intent: {
  keywords?: string[];
  phrases?: string[];
  synonyms?: string[];
  examples?: string[];
}) {
  const signals = [
    ...(intent.keywords ?? []),
    ...(intent.phrases ?? []),
    ...(intent.synonyms ?? []),
    ...(intent.examples ?? []),
  ].map((value) => value.trim());
  if (!signals.some(Boolean)) {
    throw new BadRequestException(
      'Add at least one keyword, phrase, synonym, or example.',
    );
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

export type IntentPage = PaginatedResult<ReturnType<typeof toIntentDefinition>>;
