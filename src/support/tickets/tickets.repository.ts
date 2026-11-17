import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ACTIVE_TICKET_STATUSES,
  Priority,
  TicketStatus,
} from '../../common/enums/index.js';
import {
  SupportTicket,
  SupportTicketDocument,
} from './schemas/ticket.schema.js';
import {
  SupportAssignment,
  SupportAssignmentDocument,
} from './schemas/assignment.schema.js';

@Injectable()
export class TicketsRepository {
  constructor(
    @InjectModel(SupportTicket.name)
    private readonly ticketModel: Model<SupportTicketDocument>,
    @InjectModel(SupportAssignment.name)
    private readonly assignmentModel: Model<SupportAssignmentDocument>,
  ) {}

  createTicket(data: Partial<SupportTicket>) {
    return this.ticketModel.create(data);
  }

  findById(id: string | Types.ObjectId) {
    return this.ticketModel.findById(id).exec();
  }

  findByTicketNumber(ticketNumber: string) {
    return this.ticketModel.findOne({ ticketNumber }).exec();
  }

  createAssignment(data: Partial<SupportAssignment>) {
    return this.assignmentModel.create(data);
  }

  updateTicket(
    id: string | Types.ObjectId,
    patch: Partial<SupportTicket> | Record<string, unknown>,
  ) {
    return this.ticketModel
      .findByIdAndUpdate(id, { $set: patch }, { new: true })
      .exec();
  }

  findActiveByConversation(conversationId: Types.ObjectId, category: string) {
    return this.ticketModel
      .findOne({
        conversationId,
        category,
        status: { $in: [...ACTIVE_TICKET_STATUSES] },
      })
      .exec();
  }

  countActiveByAgent(agentId: Types.ObjectId) {
    return this.ticketModel
      .countDocuments({
        assignedAgentId: agentId,
        status: { $in: [...ACTIVE_TICKET_STATUSES] },
      })
      .exec();
  }

  findPaginated(filter: Record<string, unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return Promise.all([
      this.ticketModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.ticketModel.countDocuments(filter).exec(),
    ]);
  }

  findByStatusOlderThan(status: TicketStatus, olderThan: Date, limit = 100) {
    return this.ticketModel
      .find({
        status,
        $or: [
          { statusChangedAt: { $lte: olderThan } },
          { statusChangedAt: null, updatedAt: { $lte: olderThan } },
        ],
      })
      .sort({ statusChangedAt: 1, updatedAt: 1 })
      .limit(limit)
      .exec();
  }

  findOpenBreaches(olderThan: Date, priorities: Priority[], limit = 100) {
    return this.ticketModel
      .find({
        status: {
          $in: [
            TicketStatus.Open,
            TicketStatus.Assigned,
            TicketStatus.InProgress,
            TicketStatus.Escalated,
          ],
        },
        priority: { $in: priorities },
        breachedAt: null,
        createdAt: { $lte: olderThan },
      })
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec();
  }
}
