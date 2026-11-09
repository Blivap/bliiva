import { Module } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service.js';

@Module({
  providers: [AiSettingsService],
  exports: [AiSettingsService],
})
export class AiModule {}
