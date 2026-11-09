import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsRepository } from './agents.repository.js';
import { SupportAgent, SupportAgentSchema } from './schemas/agent.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportAgent.name, schema: SupportAgentSchema },
    ]),
  ],
  providers: [AgentsRepository],
  exports: [AgentsRepository, MongooseModule],
})
export class AgentsModule {}
