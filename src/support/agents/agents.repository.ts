import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentAvailability } from '../../common/enums/index.js';
import { SupportAgent, SupportAgentDocument } from './schemas/agent.schema.js';

@Injectable()
export class AgentsRepository {
  constructor(
    @InjectModel(SupportAgent.name)
    private readonly model: Model<SupportAgentDocument>,
  ) {}

  create(data: Partial<SupportAgent>) {
    return this.model.create(data);
  }

  findById(id: string | Types.ObjectId) {
    return this.model.findById(id).exec();
  }

  findByUserId(userId: string | Types.ObjectId) {
    return this.model.findOne({ userId }).exec();
  }

  findActiveOnline() {
    return this.model
      .find({ isActive: true, availability: AgentAvailability.Online })
      .lean()
      .exec();
  }
}
