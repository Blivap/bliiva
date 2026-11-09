import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Types } from 'mongoose';
import type { SupportActor } from '../../common/auth/support-actor.js';
import { toPaginatedResult } from '../../common/dto/pagination.dto.js';
import { KnowledgeStatus } from '../../common/enums/index.js';
import type { SupportKnowledge } from './schemas/knowledge.schema.js';
import { AuditRepository } from '../audit/audit.repository.js';
import {
  KNOWLEDGE_INDEXER,
  type KnowledgeIndexer,
} from '../rag/knowledge-indexer.js';
import type {
  KnowledgeFieldsDto,
  KnowledgeQueryDto,
  UpdateKnowledgeDto,
} from './dto/knowledge.dto.js';
import { KnowledgeCatalogService } from './knowledge-catalog.service.js';
import { KnowledgeRepository } from './knowledge.repository.js';
import { toKnowledgeEntry } from './map-knowledge.js';

const CONTENT_FIELDS = [
  'title',
  'category',
  'intent',
  'questions',
  'phrases',
  'keywords',
  'synonyms',
  'answer',
  'requiresAuthentication',
  'requiresHumanSupport',
] as const;

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly knowledge: KnowledgeRepository,
    private readonly catalog: KnowledgeCatalogService,
    private readonly audit: AuditRepository,
    private readonly moduleRef: ModuleRef,
    @Optional()
    @Inject(KNOWLEDGE_INDEXER)
    private readonly indexer?: KnowledgeIndexer,
  ) {}

  async list(query: KnowledgeQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = query.category;
    if (query.intent) filter.intent = query.intent;
    if (query.status) filter.status = query.status;
    const [items, total] = await this.knowledge.findPaginated(
      filter,
      query.page,
      query.limit,
    );
    return toPaginatedResult(
      items.map((item) => toKnowledgeEntry(item)),
      total,
      query.page,
      query.limit,
    );
  }

  async create(dto: KnowledgeFieldsDto, actor: SupportActor) {
    const created = await this.knowledge.create({
      title: dto.title,
      category: dto.category,
      intent: dto.intent,
      questions: dto.questions,
      phrases: dto.phrases ?? [],
      keywords: dto.keywords,
      synonyms: dto.synonyms ?? [],
      answer: dto.answer,
      status: KnowledgeStatus.Draft,
      version: 1,
      priority: dto.priority ?? 0,
      requiresAuthentication: dto.requiresAuthentication ?? false,
      requiresHumanSupport: dto.requiresHumanSupport ?? false,
      language: dto.language ?? 'en',
      publishedAt: null,
      createdBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
      updatedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
    });
    await this.auditChange(actor, 'knowledge.created', String(created._id));
    return toKnowledgeEntry(created);
  }

  async update(id: string, dto: UpdateKnowledgeDto, actor: SupportActor) {
    const existing = await this.require(id);
    const changesContent = CONTENT_FIELDS.some(
      (field) => dto[field] !== undefined,
    );
    const patch: Record<string, unknown> = {
      ...stripUndefined(dto),
      updatedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
    };
    if (changesContent && existing.status === KnowledgeStatus.Published) {
      patch.status = KnowledgeStatus.Draft;
      patch.publishedAt = null;
      patch.version = existing.version + 1;
    }
    const updated = await this.knowledge.updateById(
      id,
      patch as Partial<SupportKnowledge>,
    );
    if (!updated) throw new NotFoundException('Knowledge entry not found.');
    await this.catalog.invalidate();
    await this.auditChange(actor, 'knowledge.updated', id);
    await this.reindex(id);
    return toKnowledgeEntry(updated);
  }

  async publish(id: string, actor: SupportActor) {
    const existing = await this.require(id);
    if (existing.status === KnowledgeStatus.Archived) {
      throw new BadRequestException(
        'Archived entries must be restored to draft before publishing.',
      );
    }
    const updated = await this.knowledge.updateById(id, {
      status: KnowledgeStatus.Published,
      publishedAt: new Date(),
      updatedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
    });
    if (!updated) throw new NotFoundException('Knowledge entry not found.');
    await this.catalog.invalidate();
    await this.auditChange(actor, 'knowledge.published', id);
    await this.reindex(id);
    return toKnowledgeEntry(updated);
  }

  async archive(id: string, actor: SupportActor) {
    await this.require(id);
    const updated = await this.knowledge.updateById(id, {
      status: KnowledgeStatus.Archived,
      updatedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
    });
    if (!updated) throw new NotFoundException('Knowledge entry not found.');
    await this.catalog.invalidate();
    await this.auditChange(actor, 'knowledge.archived', id);
    await this.reindex(id);
    return toKnowledgeEntry(updated);
  }

  private async reindex(id: string): Promise<void> {
    const indexer = this.indexer ?? this.lookupIndexer();
    if (!indexer) return;
    try {
      await indexer.syncDocument(id);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'support.knowledge.reindex_failed',
          id,
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
    }
  }

  private lookupIndexer(): KnowledgeIndexer | undefined {
    try {
      return this.moduleRef.get(KNOWLEDGE_INDEXER, { strict: false });
    } catch {
      return undefined;
    }
  }

  private async require(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Knowledge entry not found.');
    }
    const existing = await this.knowledge.findById(id);
    if (!existing) throw new NotFoundException('Knowledge entry not found.');
    return existing;
  }

  private async auditChange(actor: SupportActor, action: string, id: string) {
    await this.audit.createAudit({
      action,
      resourceType: 'knowledge',
      resourceId: Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null,
      actorId: actor.userId ? new Types.ObjectId(actor.userId) : null,
      actorType: 'administrator',
      metadata: { id },
    });
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
