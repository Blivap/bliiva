import { Module } from '@nestjs/common';
import { SafetyService } from './safety.service.js';

@Module({
  providers: [SafetyService],
  exports: [SafetyService],
})
export class SafetyModule {}
