import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/auth/admin.guard.js';
import { CurrentActor } from '../../common/auth/current-actor.decorator.js';
import { SupportAuthGuard } from '../../common/auth/support-auth.guard.js';
import type { SupportActor } from '../../common/auth/support-actor.js';
import { okResponse } from '../../common/interfaces/api-response.interface.js';
import {
  IntentFieldsDto,
  IntentQueryDto,
  TestIntentDto,
  UpdateIntentDto,
} from './dto/intent.dto.js';
import { IntentsService } from './intents.service.js';
import { RuleBasedRecognizerService } from './recognition/rule-based-recognizer.service.js';

@ApiTags('support-admin')
@ApiSecurity('support-service')
@UseGuards(SupportAuthGuard, AdminGuard)
@Controller('support/admin/intents')
export class IntentsAdminController {
  constructor(
    private readonly intents: IntentsService,
    private readonly recognizer: RuleBasedRecognizerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List intent definitions' })
  async list(@Query() query: IntentQueryDto) {
    const page = await this.intents.list(
      query.page,
      query.limit,
      query.category,
      query.enabled,
    );
    return okResponse('Intents', page.items, {
      page: page.page,
      limit: page.limit,
      total: page.total,
      totalPages: page.totalPages,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create an intent' })
  async create(
    @CurrentActor() actor: SupportActor,
    @Body() dto: IntentFieldsDto,
  ) {
    return okResponse('Intent created', await this.intents.create(dto, actor));
  }

  @Patch(':name')
  @ApiOperation({ summary: 'Update an intent' })
  async update(
    @CurrentActor() actor: SupportActor,
    @Param('name') name: string,
    @Body() dto: UpdateIntentDto,
  ) {
    return okResponse(
      'Intent updated',
      await this.intents.update(name, dto, actor),
    );
  }

  @Post(':name/enable')
  @ApiOperation({ summary: 'Enable an intent' })
  async enable(
    @CurrentActor() actor: SupportActor,
    @Param('name') name: string,
  ) {
    return okResponse(
      'Intent enabled',
      await this.intents.setEnabled(name, true, actor),
    );
  }

  @Post(':name/disable')
  @ApiOperation({ summary: 'Disable an intent' })
  async disable(
    @CurrentActor() actor: SupportActor,
    @Param('name') name: string,
  ) {
    return okResponse(
      'Intent disabled',
      await this.intents.setEnabled(name, false, actor),
    );
  }

  @Post('test')
  @ApiOperation({
    summary: 'Score a sample message against the enabled intent catalog',
  })
  async test(@Body() dto: TestIntentDto) {
    return okResponse(
      'Intent recognition result',
      await this.recognizer.recognize(dto.message),
    );
  }
}
