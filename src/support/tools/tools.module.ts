import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { ToolsExecutor } from './tools.executor.js';
import { ToolsRegistry } from './tools.registry.js';

@Module({
  imports: [ActionsModule, AuditModule],
  providers: [ToolsRegistry, ToolsExecutor],
  exports: [ToolsRegistry, ToolsExecutor],
})
export class ToolsModule {}
