import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SupportAuditLog,
  SupportAuditLogDocument,
} from './schemas/audit-log.schema.js';
import {
  SupportActionLog,
  SupportActionLogDocument,
} from './schemas/action-log.schema.js';

@Injectable()
export class AuditRepository {
  constructor(
    @InjectModel(SupportAuditLog.name)
    private readonly auditModel: Model<SupportAuditLogDocument>,
    @InjectModel(SupportActionLog.name)
    private readonly actionModel: Model<SupportActionLogDocument>,
  ) {}

  createAudit(data: Partial<SupportAuditLog>) {
    return this.auditModel.create(data);
  }

  createActionLog(data: Partial<SupportActionLog>) {
    return this.actionModel.create(data);
  }

  findActionByIdempotency(idempotencyKey: string) {
    return this.actionModel
      .findOne({ idempotencyKey, status: 'success' })
      .lean()
      .exec();
  }

  findActionLogs(filter: Record<string, unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return Promise.all([
      this.actionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.actionModel.countDocuments(filter).exec(),
    ]);
  }
}
