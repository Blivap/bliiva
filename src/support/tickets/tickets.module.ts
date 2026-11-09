import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SupportAssignment,
  SupportAssignmentSchema,
} from './schemas/assignment.schema.js';
import { SupportTicket, SupportTicketSchema } from './schemas/ticket.schema.js';
import { TicketsRepository } from './tickets.repository.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: SupportAssignment.name, schema: SupportAssignmentSchema },
    ]),
  ],
  providers: [TicketsRepository],
  exports: [TicketsRepository, MongooseModule],
})
export class TicketsModule {}
