import { Injectable } from '@nestjs/common';
import { ActionsRegistry } from '../actions/actions.registry.js';
import type { SupportActionDefinition } from '../actions/actions.types.js';
import type { LlmToolDefinition } from '../llm/llm.types.js';

@Injectable()
export class ToolsRegistry {
  constructor(private readonly actions: ActionsRegistry) {}

  list(): LlmToolDefinition[] {
    return this.actions
      .list()
      .filter((action) => action.enabled)
      .map(toTool);
  }

  get(name: string): SupportActionDefinition | null {
    const action = this.actions.get(name);
    if (!action?.enabled) return null;
    return action;
  }
}

function toTool(action: SupportActionDefinition): LlmToolDefinition {
  const properties: Record<string, { type: 'string'; description: string }> =
    {};
  const required: string[] = [];
  for (const parameter of action.parameters) {
    properties[parameter.name] = {
      type: 'string',
      description: parameter.description,
    };
    if (parameter.required) required.push(parameter.name);
  }
  const confirmation = action.requiresConfirmation
    ? ' This does not complete until the signed-in user confirms in chat.'
    : '';
  const identity =
    ' The signed-in user is supplied by the server. Do not pass a user id.';
  return {
    name: action.name,
    description: `${action.description}.${identity}${confirmation}`,
    parameters: { type: 'object', properties, required },
  };
}
