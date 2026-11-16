import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/auth/admin.guard.js';
import { SupportAuthGuard } from '../../common/auth/support-auth.guard.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { okResponse } from '../../common/interfaces/api-response.interface.js';
import { asMetaString } from '../intelligence/orchestrator/turn-log.js';
import { MessagesRepository } from '../messages/messages.repository.js';
import { AnalyticsService } from './analytics.service.js';
import { TurnLogQueryDto } from './dto/turn-log-query.dto.js';

@ApiTags('support-admin')
@ApiSecurity('support-service')
@UseGuards(SupportAuthGuard, AdminGuard)
@Controller('support/admin/intelligence')
export class IntelligenceAdminController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly messages: MessagesRepository,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Recognition and resolution metrics' })
  async metrics() {
    return okResponse('Intelligence metrics', await this.analytics.metrics());
  }

  @Get('failures')
  @ApiOperation({
    summary: 'Review messages the assistant could not recognize',
  })
  async failures(@Query() query: PaginationQueryDto) {
    const page = await this.analytics.failures(query.page, query.limit);
    return okResponse('Recognition failures', page.items, {
      page: page.page,
      limit: page.limit,
      total: page.total,
      totalPages: page.totalPages,
    });
  }

  @Get('unresolved')
  @ApiOperation({ summary: 'Review questions that stayed unresolved' })
  async unresolved(@Query() query: PaginationQueryDto) {
    const page = await this.analytics.unresolved(query.page, query.limit);
    return okResponse('Unresolved questions', page.items, {
      page: page.page,
      limit: page.limit,
      total: page.total,
      totalPages: page.totalPages,
    });
  }

  @Get('turns')
  @ApiOperation({
    summary: 'Recent chat turns with the reason and error cause',
  })
  async turns(@Query() query: TurnLogQueryDto) {
    const errorsOnly = query.errorsOnly === 'true';
    const [items, total] = await this.messages.findBotTurns(
      query.page,
      query.limit,
      errorsOnly,
    );
    const turns = items.map((item) => {
      const metadata = (item.metadata ?? {}) as Record<string, unknown>;
      return {
        id: String(item._id),
        conversationId: String(item.conversationId),
        createdAt: (item as { createdAt?: Date }).createdAt ?? null,
        user: asMetaString(metadata.userExcerpt),
        reply: item.content,
        responseType: asMetaString(metadata.responseType),
        reason: asMetaString(metadata.reason),
        errorCode: asMetaString(metadata.errorCode),
        errorMessage: asMetaString(metadata.errorMessage),
        model: asMetaString(metadata.model),
        source: asMetaString(metadata.source),
      };
    });
    const totalPages = Math.ceil(total / query.limit) || 0;
    return okResponse('Chat turns', turns, {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
    });
  }
}
