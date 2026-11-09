import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditRepository } from './audit.repository.js';
import {
  SupportActionLog,
  SupportActionLogSchema,
} from './schemas/action-log.schema.js';
import {
  SupportAuditLog,
  SupportAuditLogSchema,
} from './schemas/audit-log.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportAuditLog.name, schema: SupportAuditLogSchema },
      { name: SupportActionLog.name, schema: SupportActionLogSchema },
    ]),
  ],
  providers: [AuditRepository],
  exports: [AuditRepository, MongooseModule],
})
export class AuditModule {}
