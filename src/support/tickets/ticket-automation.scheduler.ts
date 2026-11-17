import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { TICKET_AUTOMATION_QUEUE } from './ticket-automation.processor.js';

@Injectable()
export class TicketAutomationScheduler implements OnModuleInit {
  private readonly logger = new Logger(TicketAutomationScheduler.name);

  constructor(
    @InjectQueue(TICKET_AUTOMATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'support-ticket-sla-pass',
      { every: 15 * 60 * 1000 },
      {
        name: 'sla-pass',
        data: {},
        opts: {
          removeOnComplete: 20,
          removeOnFail: 50,
        },
      },
    );
    this.logger.log(
      JSON.stringify({
        event: 'support.ticket.automation.scheduled',
        everyMs: 15 * 60 * 1000,
      }),
    );
  }
}
