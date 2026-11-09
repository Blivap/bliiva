import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { SupportAuthGuard } from '../../common/auth/support-auth.guard.js';
import { SUPPORT_CATEGORIES } from '../../common/constants/support-categories.js';
import { okResponse } from '../../common/interfaces/api-response.interface.js';

@ApiTags('support')
@ApiSecurity('support-service')
@UseGuards(SupportAuthGuard)
@Controller('support/categories')
export class CategoriesController {
  @Get()
  @ApiOperation({
    summary: 'List support categories the assistant understands',
  })
  list() {
    return okResponse('Support categories', SUPPORT_CATEGORIES);
  }
}
