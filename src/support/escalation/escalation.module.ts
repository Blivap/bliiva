import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { TicketsModule } from '../tickets/tickets.module.js';
import { EscalationService } from './escalation.service.js';

@Module({
  imports: [TicketsModule, AgentsModule],
  providers: [EscalationService],
  exports: [EscalationService],
})
export class EscalationModule {}
