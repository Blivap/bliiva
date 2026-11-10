import { Injectable, Logger } from '@nestjs/common';
import type { SupportActor } from '../../common/auth/support-actor.js';
import { OrchestratorResponseType } from '../../common/enums/index.js';
import { ActionStatus } from '../actions/actions.types.js';
import { AiSettingsService } from '../ai/ai-settings.service.js';
import {
  emptyContext,
  type ConversationContextState,
} from '../intelligence/context/conversation-context.js';
import { LlmService } from '../llm/llm.service.js';
import {
  buildKnowledgePrompt,
  buildSupportTurn,
  buildSystemPrompt,
  buildToolPrompt,
} from '../llm/prompts/index.js';
import { SCOPE_REDIRECT_MESSAGE } from '../intelligence/response/response-composer.js';
import {
  detectPromptInjection,
  redactForPrompt,
  sanitizeForModel,
} from '../llm/redaction.js';
import { LlmError, type LlmMessage } from '../llm/llm.types.js';
import { RagService } from '../rag/rag.service.js';
import { sharesGrounding } from '../rag/retrieval/hybrid-rank.js';
import { ToolsExecutor } from '../tools/tools.executor.js';
import { ToolsRegistry } from '../tools/tools.registry.js';
import type {
  SupportAgentHistoryMessage,
  SupportAgentTurnResult,
} from './support-agent.types.js';

@Injectable()
export class SupportAgentService {
  private readonly logger = new Logger(SupportAgentService.name);

  constructor(
    private readonly settings: AiSettingsService,
    private readonly llm: LlmService,
    private readonly rag: RagService,
    private readonly tools: ToolsRegistry,
    private readonly executor: ToolsExecutor,
  ) {}

  enabled(): boolean {
    return this.settings.current().llm.enabled;
  }

  async runTurn(input: {
    conversationId: string;
    content: string;
    actor: SupportActor;
    context: ConversationContextState;
    history: SupportAgentHistoryMessage[];
    category?: string | null;
    confirmationId?: string;
  }): Promise<SupportAgentTurnResult> {
    const started = Date.now();
    const llm = this.settings.current().llm;
    const base = emptyResult(input.context, started);

    if (!llm.enabled) {
      return { ...base, outcome: 'fallback', reason: 'llm_disabled' };
    }

    const redactedUser = redactForPrompt(input.content);
    if (detectPromptInjection(input.content)) {
      return {
        ...base,
        outcome: 'escalate',
        escalate: true,
        escalationReason: 'prompt_injection',
        responseType: OrchestratorResponseType.Escalated,
        content: 'I can’t do that. Want a human specialist?',
        reason: 'prompt_injection',
        latencyMs: Date.now() - started,
      };
    }

    // Keep chat turns light: embeddings + tools thrash small Ollama hosts
    // (chat model unload → embed load → chat reload → timeout → "Couldn't match").
    const conversational = isConversational(input.content);
    const useTools = input.actor.isAuthenticated && !conversational;
    const retrieval = conversational
      ? {
          chunks: [],
          durationMs: 0,
          semanticAvailable: false,
          embeddingMismatch: false,
          missingEmbeddings: 0,
          failed: false,
        }
      : await this.rag.retrieve({
          text: input.content,
          category: input.category ?? undefined,
          keywordOnly: true,
        });
    const chunks = retrieval.chunks.map((chunk) => ({
      ...chunk,
      content: this.rag.clip(chunk.content),
    }));

    const messages: LlmMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...(useTools
        ? [{ role: 'system' as const, content: buildToolPrompt() }]
        : []),
      {
        role: 'system',
        content: buildKnowledgePrompt(
          chunks.map((chunk) => ({
            title: chunk.title,
            category: chunk.category,
            version: chunk.version,
            content: chunk.content,
          })),
        ),
      },
      ...trimHistory(input.history, llm.maxContextMessages).map((message) => ({
        role: message.role,
        content: redactForPrompt(message.content),
      })),
      { role: 'user', content: buildSupportTurn(redactedUser) },
    ];

    const tools = useTools ? this.tools.list() : [];
    let toolCalls = 0;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let model: string | null = null;
    let nextContext = { ...input.context };

    try {
      for (let round = 0; round <= llm.maxToolCalls; round += 1) {
        const response = await this.llm.chat({
          messages,
          tools,
          temperature: llm.temperature,
          maxOutputTokens: llm.maxOutputTokens,
        });
        model = response.model;
        promptTokens = (promptTokens ?? 0) + (response.promptTokens ?? 0);
        completionTokens =
          (completionTokens ?? 0) + (response.completionTokens ?? 0);

        if (response.toolCalls.length === 0) {
          const answer = sanitizeAnswer(response.message.content);
          if (!answer) {
            return {
              ...base,
              outcome: 'fallback',
              reason: 'empty_model_answer',
              model,
              promptTokens,
              completionTokens,
              retrievalDurationMs: retrieval.durationMs,
              knowledgeRefs: knowledgeRefs(chunks),
              chunks,
              latencyMs: Date.now() - started,
              errorCode: 'empty_response',
            };
          }

          if (
            chunks.length === 0 &&
            !looksLikeIdentityAnswer(answer) &&
            toolCalls === 0
          ) {
            // No grounding and no tools — redirect to Blivap help, never open a ticket.
            return {
              ...base,
              outcome: 'answered',
              escalate: false,
              responseType: OrchestratorResponseType.Answered,
              content: SCOPE_REDIRECT_MESSAGE,
              reason: 'out_of_scope',
              model,
              promptTokens,
              completionTokens,
              retrievalDurationMs: retrieval.durationMs,
              knowledgeRefs: [],
              chunks,
              toolCalls,
              latencyMs: Date.now() - started,
            };
          }

          if (
            chunks.length > 0 &&
            toolCalls === 0 &&
            !sharesGrounding(
              answer,
              chunks.map((chunk) => chunk.content),
            ) &&
            looksLikePolicyClaim(answer)
          ) {
            return {
              ...base,
              outcome: 'fallback',
              reason: 'ungrounded_answer',
              model,
              promptTokens,
              completionTokens,
              retrievalDurationMs: retrieval.durationMs,
              knowledgeRefs: knowledgeRefs(chunks),
              chunks,
              toolCalls,
              latencyMs: Date.now() - started,
            };
          }

          nextContext = {
            ...nextContext,
            conversationState: 'answered',
            unsuccessfulAttempts: 0,
            presentedKnowledgeIds: [
              ...nextContext.presentedKnowledgeIds,
              ...chunks.map((chunk) => chunk.documentId),
            ].slice(-10),
            pendingClarification: {
              kind: 'follow_up',
              question: 'Anything else?',
              options: [
                {
                  intent: nextContext.currentIntent ?? 'GENERAL_ENQUIRY',
                  label: 'yes',
                },
                { intent: 'REQUEST_HUMAN', label: 'no I need more help' },
              ],
            },
          };

          return {
            ...base,
            outcome: 'answered',
            responseType: OrchestratorResponseType.Answered,
            content: answer,
            reason: 'llm_answer',
            context: nextContext,
            knowledgeRefs: knowledgeRefs(chunks),
            chunks,
            toolCalls,
            model,
            promptTokens,
            completionTokens,
            retrievalDurationMs: retrieval.durationMs,
            latencyMs: Date.now() - started,
          };
        }

        if (round >= llm.maxToolCalls) {
          return {
            ...base,
            outcome: 'escalate',
            escalate: true,
            escalationReason: 'tool_loop_limit',
            responseType: OrchestratorResponseType.Escalated,
            content: 'Lookup failed. Want a specialist?',
            reason: 'tool_loop_limit',
            model,
            promptTokens,
            completionTokens,
            retrievalDurationMs: retrieval.durationMs,
            knowledgeRefs: knowledgeRefs(chunks),
            chunks,
            toolCalls,
            latencyMs: Date.now() - started,
          };
        }

        messages.push({
          role: 'assistant',
          content: response.message.content,
          toolCalls: response.toolCalls,
        });

        for (const call of response.toolCalls) {
          toolCalls += 1;
          const result = await this.executor.execute({
            name: call.name,
            arguments: call.arguments,
            conversationId: input.conversationId,
            actor: input.actor,
            context: nextContext,
            confirmationId: input.confirmationId,
          });

          if (result.status === ActionStatus.NeedsConfirmation) {
            nextContext = {
              ...nextContext,
              pendingActionName: result.name,
              pendingActionParams: stringParams(call.arguments),
              pendingConfirmationId: result.confirmationId ?? null,
              conversationState: 'awaiting_action_confirmation',
              pendingClarification: {
                kind: 'action_confirm',
                question: result.message,
                options: [
                  {
                    intent: nextContext.currentIntent ?? 'GENERAL_ENQUIRY',
                    label: 'yes',
                    actionName: result.name,
                  },
                  {
                    intent: nextContext.currentIntent ?? 'GENERAL_ENQUIRY',
                    label: 'no',
                  },
                ],
                actionName: result.name,
                confirmationId: result.confirmationId,
              },
            };
            return {
              ...base,
              outcome: 'action_confirmation',
              responseType: OrchestratorResponseType.ActionConfirmationRequired,
              content: result.message,
              reason: 'action_confirmation_required',
              context: nextContext,
              knowledgeRefs: knowledgeRefs(chunks),
              chunks,
              toolCalls,
              model,
              promptTokens,
              completionTokens,
              retrievalDurationMs: retrieval.durationMs,
              latencyMs: Date.now() - started,
            };
          }

          if (result.status === ActionStatus.NeedsParameter) {
            nextContext = {
              ...nextContext,
              pendingActionName: result.name,
              pendingActionParams: stringParams(call.arguments),
              pendingConfirmationId: null,
              conversationState: 'awaiting_action_parameter',
              pendingClarification: {
                kind: 'action_resource',
                question: result.message,
                options: (result.choices ?? []).map((choice) => ({
                  intent: nextContext.currentIntent ?? 'GENERAL_ENQUIRY',
                  label: choice.label,
                  actionName: result.name,
                  params: choice.params,
                })),
                actionName: result.name,
              },
            };
            return {
              ...base,
              outcome: 'action_parameter',
              responseType: OrchestratorResponseType.ClarificationRequired,
              content: result.message,
              reason: 'action_parameter_required',
              context: nextContext,
              knowledgeRefs: knowledgeRefs(chunks),
              chunks,
              toolCalls,
              model,
              promptTokens,
              completionTokens,
              retrievalDurationMs: retrieval.durationMs,
              latencyMs: Date.now() - started,
            };
          }

          if (result.status === ActionStatus.Failed && result.escalate) {
            return {
              ...base,
              outcome: 'escalate',
              escalate: true,
              escalationReason: result.failureCode ?? 'tool_failed',
              responseType: OrchestratorResponseType.Escalated,
              content: result.message,
              reason: 'tool_failed',
              knowledgeRefs: knowledgeRefs(chunks),
              chunks,
              toolCalls,
              model,
              promptTokens,
              completionTokens,
              retrievalDurationMs: retrieval.durationMs,
              latencyMs: Date.now() - started,
            };
          }

          const payload = sanitizeForModel({
            status: result.status,
            message: result.message,
            data: result.data ?? null,
            failureCode: result.failureCode ?? null,
          });
          messages.push({
            role: 'tool',
            toolName: call.name,
            content: JSON.stringify(payload),
          });
        }
      }

      return {
        ...base,
        outcome: 'fallback',
        reason: 'tool_loop_exhausted',
        model,
        promptTokens,
        completionTokens,
        retrievalDurationMs: retrieval.durationMs,
        knowledgeRefs: knowledgeRefs(chunks),
        chunks,
        toolCalls,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      const code = error instanceof LlmError ? error.code : 'unknown';
      this.logger.warn(
        JSON.stringify({
          event: 'support.agent.failed',
          conversationId: input.conversationId,
          code,
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
      const unavailable =
        code === 'runtime_unreachable' ||
        code === 'model_unavailable' ||
        code === 'model_loading' ||
        code === 'busy' ||
        code === 'timeout';
      return {
        ...base,
        outcome: unavailable ? 'unavailable' : 'fallback',
        reason: code,
        errorCode: code,
        model,
        promptTokens,
        completionTokens,
        retrievalDurationMs: retrieval.durationMs,
        knowledgeRefs: knowledgeRefs(chunks),
        chunks,
        toolCalls,
        latencyMs: Date.now() - started,
      };
    }
  }
}

function emptyResult(
  context: ConversationContextState,
  started: number,
): SupportAgentTurnResult {
  return {
    outcome: 'fallback',
    responseType: OrchestratorResponseType.Answered,
    content: '',
    reason: 'fallback',
    context: { ...emptyContext(), ...context },
    knowledgeRefs: [],
    chunks: [],
    toolCalls: 0,
    model: null,
    promptTokens: null,
    completionTokens: null,
    latencyMs: Date.now() - started,
    retrievalDurationMs: 0,
    errorCode: null,
    escalate: false,
    escalationReason: null,
  };
}

function trimHistory(
  history: SupportAgentHistoryMessage[],
  max: number,
): SupportAgentHistoryMessage[] {
  return history.slice(-Math.max(1, max));
}

function knowledgeRefs(
  chunks: Array<{ documentId: string; title: string; score: number }>,
) {
  const seen = new Set<string>();
  const refs: Array<{ id: string; title: string; score: number }> = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.documentId)) continue;
    seen.add(chunk.documentId);
    refs.push({
      id: chunk.documentId,
      title: chunk.title,
      score: chunk.score,
    });
  }
  return refs;
}

function sanitizeAnswer(value: string): string {
  const cleaned = value
    .replace(/<\/?think>/gi, '')
    .replace(/\b(password|otp|access token)\s*[:=]\s*\S+/gi, '$1: [redacted]')
    .trim();
  // Never surface "report to authorities" lectures if the model slips.
  if (
    /\b(report (this )?to (the )?(appropriate )?authorities|violates? (our |platform )?polic)/i.test(
      cleaned,
    )
  ) {
    return SCOPE_REDIRECT_MESSAGE;
  }
  return cleaned.slice(0, 4000);
}

function looksLikePolicyClaim(answer: string): boolean {
  return /\b(policy|must|required|blivap|procedure|register|wallet|donation|hospital|appointment)\b/i.test(
    answer,
  );
}

function looksLikeIdentityAnswer(answer: string): boolean {
  return /\b(ai|assistant|bot|support)\b/i.test(answer);
}

function isConversational(text: string): boolean {
  return /\b((what is|whats|who is) your name|who are you|what are you called|are you (an?|and)?\s*(ai|bot|robot|assistant|llm)|are you (real|human)|is this (an? )?(ai|bot)|how are you|thanks|thank you|hello|hi)\b/i.test(
    text,
  );
}

function stringParams(args: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') params[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') {
      params[key] = String(value);
    }
  }
  return params;
}
