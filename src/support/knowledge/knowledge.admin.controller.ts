import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/auth/admin.guard.js';
import { CurrentActor } from '../../common/auth/current-actor.decorator.js';
import { SupportAuthGuard } from '../../common/auth/support-auth.guard.js';
import type { SupportActor } from '../../common/auth/support-actor.js';
import { okResponse } from '../../common/interfaces/api-response.interface.js';
import {
  KnowledgeFieldsDto,
  KnowledgeQueryDto,
  TestKnowledgeDto,
  UpdateKnowledgeDto,
} from './dto/knowledge.dto.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeRetrievalService } from '../intelligence/retrieval/knowledge-retrieval.service.js';

@ApiTags('support-admin')
@ApiSecurity('support-service')
@UseGuards(SupportAuthGuard, AdminGuard)
@Controller('support/admin/knowledge')
export class KnowledgeAdminController {
  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly retrieval: KnowledgeRetrievalService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List knowledge entries, including drafts' })
  async list(@Query() query: KnowledgeQueryDto) {
    const page = await this.knowledge.list(query);
    return okResponse('Knowledge entries', page.items, {
      page: page.page,
      limit: page.limit,
      total: page.total,
      totalPages: page.totalPages,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a draft knowledge entry' })
  async create(
    @CurrentActor() actor: SupportActor,
    @Body() dto: KnowledgeFieldsDto,
  ) {
    return okResponse(
      'Knowledge entry created',
      await this.knowledge.create(dto, actor),
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit a knowledge entry. Published edits return to draft.',
  })
  async update(
    @CurrentActor() actor: SupportActor,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDto,
  ) {
    return okResponse(
      'Knowledge entry updated',
      await this.knowledge.update(id, dto, actor),
    );
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a draft knowledge entry' })
  async publish(@CurrentActor() actor: SupportActor, @Param('id') id: string) {
    return okResponse(
      'Knowledge entry published',
      await this.knowledge.publish(id, actor),
    );
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a knowledge entry' })
  async archive(@CurrentActor() actor: SupportActor, @Param('id') id: string) {
    return okResponse(
      'Knowledge entry archived',
      await this.knowledge.archive(id, actor),
    );
  }

  @Post('test')
  @ApiOperation({ summary: 'Rank published knowledge for a sample message' })
  async test(@Body() dto: TestKnowledgeDto) {
    return okResponse(
      'Knowledge retrieval result',
      await this.retrieval.retrieve({
        text: dto.message,
        intent: dto.intent ?? null,
        category: dto.category ?? null,
      }),
    );
  }
}
