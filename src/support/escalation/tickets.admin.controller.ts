import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentActor } from '../../common/auth/current-actor.decorator.js';
import { StaffGuard } from '../../common/auth/admin.guard.js';
import { SupportAuthGuard } from '../../common/auth/support-auth.guard.js';
import {
  SupportRole,
  type SupportActor,
} from '../../common/auth/support-actor.js';
import {
  PaginationQueryDto,
  toPaginatedResult,
} from '../../common/dto/pagination.dto.js';
import { okResponse } from '../../common/interfaces/api-response.interface.js';
import { AgentsRepository } from '../agents/agents.repository.js';
import { TicketsRepository } from '../tickets/tickets.repository.js';

@ApiTags('support-admin')
@ApiSecurity('support-service')
@UseGuards(SupportAuthGuard, StaffGuard)
@Controller('support/admin/tickets')
export class TicketsAdminController {
  constructor(
    private readonly tickets: TicketsRepository,
    private readonly agents: AgentsRepository,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List escalation tickets visible to this staff member',
  })
  async list(
    @CurrentActor() actor: SupportActor,
    @Query() query: PaginationQueryDto,
  ) {
    const filter = await this.filterFor(actor);
    const [items, total] = await this.tickets.findPaginated(
      filter,
      query.page,
      query.limit,
    );
    const page = toPaginatedResult(items, total, query.page, query.limit);
    return okResponse('Tickets', page.items, {
      page: page.page,
      limit: page.limit,
      total: page.total,
      totalPages: page.totalPages,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Read an escalation ticket, including recognition context',
  })
  async get(@CurrentActor() actor: SupportActor, @Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Ticket not found.');
    }
    const ticket = await this.tickets.findById(id);
    if (!ticket) throw new NotFoundException('Ticket not found.');
    if (actor.roles.includes(SupportRole.Agent) && !this.isSupervisor(actor)) {
      const agent = await this.agents.findByUserId(actor.userId ?? '');
      if (!agent || String(ticket.assignedAgentId) !== String(agent._id)) {
        throw new ForbiddenException('You cannot access this ticket.');
      }
    }
    return okResponse('Ticket', ticket);
  }

  private isSupervisor(actor: SupportActor): boolean {
    return (
      actor.roles.includes(SupportRole.Supervisor) ||
      actor.roles.includes(SupportRole.Administrator)
    );
  }

  private async filterFor(
    actor: SupportActor,
  ): Promise<Record<string, unknown>> {
    if (this.isSupervisor(actor)) return {};
    const agent = actor.userId
      ? await this.agents.findByUserId(actor.userId)
      : null;
    if (!agent)
      throw new ForbiddenException('No support agent profile is linked.');
    return { assignedAgentId: agent._id };
  }
}
