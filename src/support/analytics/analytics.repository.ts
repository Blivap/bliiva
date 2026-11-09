import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SupportIntelligenceEvent,
  SupportIntelligenceEventDocument,
} from './schemas/intelligence-event.schema.js';
import {
  SupportLlmEvent,
  SupportLlmEventDocument,
} from './schemas/llm-event.schema.js';

@Injectable()
export class AnalyticsRepository {
  constructor(
    @InjectModel(SupportIntelligenceEvent.name)
    private readonly model: Model<SupportIntelligenceEventDocument>,
    @InjectModel(SupportLlmEvent.name)
    private readonly llmModel: Model<SupportLlmEventDocument>,
  ) {}

  createLlmEvent(data: Partial<SupportLlmEvent>) {
    return this.llmModel.create([data]).then((docs) => docs[0]!);
  }

  async llmMetrics() {
    const [summary] = await this.llmModel.aggregate<{
      requests: number;
      latencySum: number;
      toolCalls: number;
      escalations: number;
      unavailable: number;
      errors: number;
      promptTokens: number;
      completionTokens: number;
    }>([
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          latencySum: { $sum: '$latencyMs' },
          toolCalls: { $sum: '$toolCalls' },
          escalations: { $sum: { $cond: ['$escalated', 1, 0] } },
          unavailable: { $sum: { $cond: ['$unavailable', 1, 0] } },
          errors: {
            $sum: { $cond: [{ $ifNull: ['$errorCode', false] }, 1, 0] },
          },
          promptTokens: { $sum: { $ifNull: ['$promptTokens', 0] } },
          completionTokens: { $sum: { $ifNull: ['$completionTokens', 0] } },
        },
      },
    ]);
    const requests = summary?.requests ?? 0;
    return {
      requests,
      averageLatencyMs: requests
        ? Math.round((summary?.latencySum ?? 0) / requests)
        : null,
      toolCalls: summary?.toolCalls ?? 0,
      escalations: summary?.escalations ?? 0,
      unavailable: summary?.unavailable ?? 0,
      errors: summary?.errors ?? 0,
      promptTokens: summary?.promptTokens ?? 0,
      completionTokens: summary?.completionTokens ?? 0,
    };
  }

  create(data: Partial<SupportIntelligenceEvent>) {
    return this.model.create(data);
  }

  findPaginated(filter: Record<string, unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
  }

  async metrics() {
    const [summary] = await this.model.aggregate<{
      totalMessagesProcessed: number;
      recognized: number;
      unrecognized: number;
      clarifications: number;
      automatedResolutions: number;
      escalations: number;
      latencySum: number;
    }>([
      {
        $group: {
          _id: null,
          totalMessagesProcessed: { $sum: 1 },
          recognized: { $sum: { $cond: ['$recognized', 1, 0] } },
          unrecognized: { $sum: { $cond: ['$unrecognized', 1, 0] } },
          clarifications: { $sum: { $cond: ['$clarification', 1, 0] } },
          automatedResolutions: { $sum: { $cond: ['$resolved', 1, 0] } },
          escalations: { $sum: { $cond: ['$escalated', 1, 0] } },
          latencySum: { $sum: '$latencyMs' },
        },
      },
    ]);
    const categories = await this.model.aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: { category: { $type: 'string' } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    const unresolved = await this.model.aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: { unresolved: true, questionExcerpt: { $type: 'string' } } },
      { $group: { _id: '$questionExcerpt', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    const lowScore = await this.model.aggregate<{
      _id: unknown;
      count: number;
    }>([
      { $match: { lowScore: true, knowledgeId: { $ne: null } } },
      { $group: { _id: '$knowledgeId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const total = summary?.totalMessagesProcessed ?? 0;
    return {
      totalMessagesProcessed: total,
      recognized: summary?.recognized ?? 0,
      unrecognized: summary?.unrecognized ?? 0,
      clarifications: summary?.clarifications ?? 0,
      automatedResolutions: summary?.automatedResolutions ?? 0,
      escalations: summary?.escalations ?? 0,
      averageLatencyMs: total
        ? Math.round((summary?.latencySum ?? 0) / total)
        : 0,
      topCategories: categories.map((row) => ({
        category: row._id,
        count: row.count,
      })),
      topUnresolvedQuestions: unresolved.map((row) => ({
        excerpt: row._id,
        count: row.count,
      })),
      lowScoreKnowledge: lowScore.map((row) => ({
        knowledgeId: String(row._id),
        count: row.count,
      })),
    };
  }
}
