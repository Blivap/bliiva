import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { SupportActor } from '../../common/auth/support-actor.js';
import { ConversationStatus, Priority } from '../../common/enums/index.js';
import { ConversationsService } from './conversations.service.js';

const userA: SupportActor = {
  userId: '64b0000000000000000000aa',
  guestSessionId: null,
  roles: ['user'],
  isAuthenticated: true,
  accessToken: null,
};
const userB: SupportActor = {
  ...userA,
  userId: '64b0000000000000000000bb',
};

describe('conversation access', () => {
  it('rejects a user who opens another user conversation', async () => {
    const id = new Types.ObjectId();
    const record = {
      _id: id,
      userId: new Types.ObjectId(userA.userId!),
      guestSessionId: null,
      status: ConversationStatus.Bot,
      category: 'general_enquiries',
      currentIntent: null,
      priority: Priority.Medium,
      context: {},
      lastMessageAt: new Date(),
      assignedAgentId: null,
    };
    const service = new ConversationsService(
      { findById: async () => record } as never,
      {} as never,
      {} as never,
    );
    await expect(service.get(userB, id.toHexString())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.get(userA, id.toHexString())).resolves.toMatchObject({
      id: id.toHexString(),
    });
  });
});
