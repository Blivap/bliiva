import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { TicketLifecycleService } from './ticket-lifecycle.service.js';

export const TICKET_AUTOMATION_QUEUE = 'support-ticket-automation';

@Processor(TICKET_AUTOMATION_QUEUE)
export class TicketAutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(TicketAutomationProcessor.name);

  constructor(private readonly lifecycle: TicketLifecycleService) {
    super();
  }

  async process(_job: Job): Promise<{ changed: number }> {
    const result = await this.lifecycle.runAutomationPass();
    this.logger.log(
      JSON.stringify({
        event: 'support.ticket.automation.pass',
        changed: result.changed,
      }),
    );
    return result;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(
      JSON.stringify({
        event: 'support.ticket.automation.failed',
        jobId: job?.id,
        message: error.message,
      }),
    );
  }
}
