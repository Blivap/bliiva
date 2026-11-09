import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/auth/admin.guard.js';
import { SupportAuthGuard } from '../../common/auth/support-auth.guard.js';
import {
  PaginationQueryDto,
  toPaginatedResult,
} from '../../common/dto/pagination.dto.js';
import { okResponse } from '../../common/interfaces/api-response.interface.js';
import { AuditRepository } from '../audit/audit.repository.js';
import { ActionsRegistry } from './actions.registry.js';

@ApiTags('support-admin')
@ApiSecurity('support-service')
@UseGuards(SupportAuthGuard, AdminGuard)
@Controller('support/admin/actions')
export class ActionsAdminController {
  constructor(
    private readonly registry: ActionsRegistry,
    private readonly audit: AuditRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List registered support actions' })
  list() {
    return okResponse(
      'Support actions',
      this.registry.list().map((action) => ({
        name: action.name,
        description: action.description,
        category: action.category,
        riskLevel: action.riskLevel,
        readOnly: action.readOnly,
        requiresAuthentication: action.requiresAuthentication,
        requiresConfirmation: action.requiresConfirmation,
        enabled: action.enabled,
        intents: action.intents,
      })),
    );
  }

  @Post(':name/enable')
  @ApiOperation({ summary: 'Enable a registered action' })
  enable(@Param('name') name: string) {
    const action = this.registry.setEnabled(name, true);
    if (!action) throw new NotFoundException('Action not found.');
    return okResponse('Action enabled', action);
  }

  @Post(':name/disable')
  @ApiOperation({ summary: 'Disable a registered action' })
  disable(@Param('name') name: string) {
    const action = this.registry.setEnabled(name, false);
    if (!action) throw new NotFoundException('Action not found.');
    return okResponse('Action disabled', action);
  }

  @Get('history')
  @ApiOperation({ summary: 'Review action execution history' })
  async history(@Query() query: PaginationQueryDto) {
    const [items, total] = await this.audit.findActionLogs(
      {},
      query.page,
      query.limit,
    );
    const page = toPaginatedResult(items, total, query.page, query.limit);
    return okResponse('Action history', page.items, {
      page: page.page,
      limit: page.limit,
      total: page.total,
      totalPages: page.totalPages,
    });
  }

  @Get('failures')
  @ApiOperation({ summary: 'Review failed or rejected action executions' })
  async failures(@Query() query: PaginationQueryDto) {
    const [items, total] = await this.audit.findActionLogs(
      { status: { $in: ['failed', 'rejected'] } },
      query.page,
      query.limit,
    );
    const page = toPaginatedResult(items, total, query.page, query.limit);
    return okResponse('Action failures', page.items, {
      page: page.page,
      limit: page.limit,
      total: page.total,
      totalPages: page.totalPages,
    });
  }
}
