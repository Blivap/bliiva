import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module.js';
import { RagModule } from '../rag/rag.module.js';
import { KnowledgeCatalogService } from './knowledge-catalog.service.js';
import { KnowledgeRepository } from './knowledge.repository.js';
import { KnowledgeService } from './knowledge.service.js';
import {
  SupportKnowledge,
  SupportKnowledgeSchema,
} from './schemas/knowledge.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportKnowledge.name, schema: SupportKnowledgeSchema },
    ]),
    AuditModule,
    forwardRef(() => RagModule),
  ],
  providers: [KnowledgeRepository, KnowledgeCatalogService, KnowledgeService],
  exports: [
    KnowledgeRepository,
    KnowledgeCatalogService,
    KnowledgeService,
    MongooseModule,
  ],
})
export class KnowledgeModule {}
