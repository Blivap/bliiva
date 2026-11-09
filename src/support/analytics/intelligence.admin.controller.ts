import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/auth/admin.guard.js';
import { SupportAuthGuard } from '../../common/auth/support-auth.guard.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { okResponse } from '../../common/interfaces/api-response.interface.js';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('support-admin')
@ApiSecurity('support-service')
@UseGuards(SupportAuthGuard, AdminGuard)
@Controller('support/admin/intelligence')
export class IntelligenceAdminController {
  constructor(private readonly analytics: AnalyticsService) {}

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
}
