import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../../common/auth/current-actor.decorator.js';
import { SupportAuthGuard } from '../../common/auth/support-auth.guard.js';
import type { SupportActor } from '../../common/auth/support-actor.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { okResponse } from '../../common/interfaces/api-response.interface.js';
import { ConversationsService } from './conversations.service.js';
import {
  CreateConversationDto,
  SendMessageDto,
} from './dto/conversation.dto.js';

@ApiTags('support')
@ApiSecurity('support-service')
@UseGuards(SupportAuthGuard)
@Controller('support/conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Start a support conversation for the current user',
  })
  async create(
    @CurrentActor() actor: SupportActor,
    @Body() dto: CreateConversationDto,
  ) {
    return okResponse(
      'Conversation started',
      await this.conversations.create(actor, dto),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get the current conversation state' })
  async get(@CurrentActor() actor: SupportActor, @Param('id') id: string) {
    return okResponse('Conversation', await this.conversations.get(actor, id));
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List messages in a conversation' })
  async messages(
    @CurrentActor() actor: SupportActor,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    const page = await this.conversations.messagesFor(
      actor,
      id,
      query.page,
      query.limit,
    );
    return okResponse('Messages', page.items, {
      page: page.page,
      limit: page.limit,
      total: page.total,
      totalPages: page.totalPages,
    });
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Send a message and receive the assistant response',
  })
  async send(
    @CurrentActor() actor: SupportActor,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return okResponse(
      'Message processed',
      await this.conversations.send(actor, id, dto),
    );
  }
}
