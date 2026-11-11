import { Injectable, Logger } from '@nestjs/common';
import type { SupportActor } from '../../common/auth/support-actor.js';
import { OrchestratorResponseType } from '../../common/enums/index.js';
import { ActionStatus } from '../actions/actions.types.js';
import { AiSettingsService } from '../ai/ai-settings.service.js';
import {
  emptyContext,
  type ConversationContextState,
} from '../intelligence/context/conversation-context.js';
import {
  inferImmediateLiveDataAction,
  pendingFromBotOffer,
} from '../intelligence/context/offered-action.js';
import { resolveIntelligenceSettings } from '../intelligence/intelligence-settings.js';
import { rankKnowledge } from '../intelligence/retrieval/rank-knowledge.js';
import { KnowledgeCatalogService } from '../knowledge/knowledge-catalog.service.js';
import { LlmService } from '../llm/llm.service.js';
import {
  buildKnowledgePrompt,
  buildSupportTurn,
  buildSystemPrompt,
  buildToolPrompt,
} from '../llm/prompts/index.js';
import { ESCALATION_OFFER_QUESTION } from '../intelligence/response/response-composer.js';
import {
  detectPromptInjection,
  redactForPrompt,
  sanitizeForModel,
} from '../llm/redaction.js';
import { LlmError, type LlmMessage } from '../llm/llm.types.js';
import { RagService } from '../rag/rag.service.js';
import type { RetrievedChunk } from '../rag/rag.types.js';
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
    private readonly catalog: KnowledgeCatalogService,
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
        outcome: 'answered',
        escalate: false,
        escalationReason: 'prompt_injection',
        responseType: OrchestratorResponseType.ClarificationRequired,
        content: `I can’t do that. ${ESCALATION_OFFER_QUESTION}`,
        reason: 'prompt_injection',
        context: offerEscalationContext(input.context, 'prompt_injection'),
        latencyMs: Date.now() - started,
      };
    }

    // After handoff, never resume product help — specialist owns the thread.
    if (input.context.specialistNotified) {
      return {
        ...base,
        outcome: 'answered',
        responseType: OrchestratorResponseType.HumanHandling,
        content: '',
        reason: 'specialist_notified',
        context: {
          ...input.context,
          conversationState: 'escalated',
          pendingClarification: null,
          currentIntent: null,
        },
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
    let chunks = retrieval.chunks.map((chunk) => ({
      ...chunk,
      content: this.rag.clip(chunk.content),
    }));
    // When RAG is off or empty (common on small Ollama hosts), still ground
    // how-to answers with the published Phase 2 knowledge catalog.
    if (!conversational && chunks.length === 0) {
      chunks = await this.catalogKnowledgeChunks(
        input.content,
        input.category ?? null,
        input.context.currentIntent ?? null,
      );
    }

    const toolDefs = useTools ? this.tools.list() : [];
    const actionCatalog = useTools
      ? this.tools
          .list()
          .map((tool) => this.tools.get(tool.name))
          .filter((action): action is NonNullable<typeof action> =>
            Boolean(action),
          )
      : [];
    const messages: LlmMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...(useTools
        ? [
            {
              role: 'system' as const,
              content: buildToolPrompt(actionCatalog),
            },
          ]
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
      ...(!input.context.currentIntent
        ? [
            {
              role: 'system' as const,
              content:
                'No active task. Answer only this message. Do not reopen a prior balance/bookings/verification offer unless they ask again.',
            },
          ]
        : []),
      ...trimHistory(input.history, llm.maxContextMessages).map((message) => ({
        role: message.role,
        content: redactForPrompt(message.content),
      })),
      { role: 'user', content: buildSupportTurn(redactedUser) },
    ];

    const tools = toolDefs;
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
          // Clear live-data asks must never become “Want me to show it?” —
          // run the allowlisted lookup now when the model skipped tools.
          const forced =
            useTools && !conversational && toolCalls === 0
              ? inferImmediateLiveDataAction(input.content)
              : null;
          if (forced) {
            const forcedResult = await this.executor.execute({
              name: forced.actionName,
              arguments: forced.params,
              conversationId: input.conversationId,
              actor: input.actor,
              context: nextContext,
              confirmationId: input.confirmationId,
            });
            toolCalls += 1;
            this.logger.log(
              JSON.stringify({
                event: 'support.agent.forced_tool',
                conversationId: input.conversationId,
                action: forced.actionName,
                status: forcedResult.status,
              }),
            );
            if (forcedResult.status === ActionStatus.Success) {
              nextContext = {
                ...nextContext,
                conversationState: 'answered',
                unsuccessfulAttempts: 0,
                pendingClarification: {
                  kind: 'follow_up',
                  question: 'Anything else?',
                  options: [
                    {
                      intent:
                        nextContext.currentIntent ?? 'GENERAL_ENQUIRY',
                      label: 'yes',
                    },
                    {
                      intent: 'REQUEST_HUMAN',
                      label: 'no I need more help',
                    },
                  ],
                },
                pendingActionName: null,
                pendingActionParams: {},
                pendingConfirmationId: null,
              };
              return {
                ...base,
                outcome: 'answered',
                responseType: OrchestratorResponseType.Answered,
                content: forcedResult.message,
                reason: 'forced_live_data_action',
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
            // Fall through to model text / offer handling if force failed.
          }

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

          // Never park a clear live-data ask as an action_offer — execute above
          // already handled offers; if force failed, strip offer framing.
          const offer =
            conversational || forced
              ? null
              : pendingFromBotOffer({
                  botContent: answer,
                  currentIntent: nextContext.currentIntent,
                });
          nextContext = {
            ...nextContext,
            conversationState: 'answered',
            unsuccessfulAttempts: 0,
            presentedKnowledgeIds: [
              ...nextContext.presentedKnowledgeIds,
              ...chunks.map((chunk) => chunk.documentId),
            ].slice(-10),
            // Soft acks / presence: no follow-up trap.
            // If the model offered to show/check something, remember that
            // offer so the next "yes" runs the action instead of looping.
            pendingClarification: conversational
              ? null
              : offer
                ? {
                    kind: 'action_offer',
                    question: offer.question,
                    options: offer.options,
                    actionName: offer.actionName,
                  }
                : {
                    kind: 'follow_up',
                    question: 'Anything else?',
                    options: [
                      {
                        intent:
                          nextContext.currentIntent ?? 'GENERAL_ENQUIRY',
                        label: 'yes',
                      },
                      {
                        intent: 'REQUEST_HUMAN',
                        label: 'no I need more help',
                      },
                    ],
                  },
            pendingActionName: offer?.actionName ?? nextContext.pendingActionName,
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
          const deadEnd = input.context.unsuccessfulAttempts >= 1;
          const attempts = input.context.unsuccessfulAttempts + 1;
          return {
            ...base,
            outcome: 'answered',
            escalate: false,
            escalationReason: deadEnd ? 'tool_loop_limit' : null,
            responseType: deadEnd
              ? OrchestratorResponseType.ClarificationRequired
              : OrchestratorResponseType.Answered,
            content: deadEnd
              ? `I still couldn’t finish that lookup. ${ESCALATION_OFFER_QUESTION}`
              : 'I couldn’t finish that lookup. Please try again, or tell me another detail to check.',
            reason: 'tool_loop_limit',
            model,
            promptTokens,
            completionTokens,
            retrievalDurationMs: retrieval.durationMs,
            knowledgeRefs: knowledgeRefs(chunks),
            chunks,
            toolCalls,
            latencyMs: Date.now() - started,
            context: deadEnd
              ? offerEscalationContext(
                  { ...nextContext, unsuccessfulAttempts: attempts },
                  'tool_loop_limit',
                )
              : {
                  ...nextContext,
                  unsuccessfulAttempts: attempts,
                  conversationState: 'clarifying',
                },
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
            const reason = result.failureCode ?? 'tool_failed';
            return {
              ...base,
              outcome: 'answered',
              escalate: false,
              escalationReason: reason,
              responseType: OrchestratorResponseType.ClarificationRequired,
              content: [result.message, ESCALATION_OFFER_QUESTION].join('\n\n'),
              reason: 'tool_failed',
              knowledgeRefs: knowledgeRefs(chunks),
              chunks,
              toolCalls,
              model,
              promptTokens,
              completionTokens,
              retrievalDurationMs: retrieval.durationMs,
              latencyMs: Date.now() - started,
              context: offerEscalationContext(nextContext, reason),
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

  private async catalogKnowledgeChunks(
    text: string,
    category: string | null,
    intent: string | null,
  ): Promise<RetrievedChunk[]> {
    try {
      const entries = await this.catalog.getPublished();
      const settings = resolveIntelligenceSettings({});
      const ranking = rankKnowledge({
        text,
        entries,
        intent,
        category,
        settings,
      });
      // Soften the Phase 2 auto-answer bar slightly: the LLM still has to
      // ground on the note, and intent may be unknown on the agent path.
      const groundedFloor = Math.min(0.4, settings.knowledgeMinScore);
      const picks = ranking.ambiguous
        ? ranking.matches.slice(0, 2)
        : ranking.best
          ? [ranking.best]
          : ranking.matches[0] && ranking.matches[0].score >= groundedFloor
            ? [ranking.matches[0]]
            : [];
      return picks.map((match, index) => ({
        id: `${match.knowledgeId}:${index}`,
        documentId: match.knowledgeId,
        title: match.title,
        category: match.category,
        version: 1,
        chunkIndex: index,
        content: this.rag.clip(match.answer),
        score: match.score,
        embeddingModel: 'catalog',
      }));
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'support.agent.catalog_knowledge_failed',
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
      return [];
    }
  }
}

function offerEscalationContext(
  context: ConversationContextState,
  reason: string,
): ConversationContextState {
  return {
    ...context,
    conversationState: 'clarifying',
    pendingClarification: {
      kind: 'escalation_confirm',
      question: ESCALATION_OFFER_QUESTION,
      options: [
        { intent: 'REQUEST_HUMAN', label: 'yes' },
        { intent: 'GENERAL_ENQUIRY', label: 'no' },
      ],
      escalationReason: reason,
      priority: 'medium',
    },
  };
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
  let cleaned = value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .replace(/\b(password|otp|access token)\s*[:=]\s*\S+/gi, '$1: [redacted]')
    .trim();

  // Drop leaked chain-of-thought when the model wrote planning instead of a reply.
  if (looksLikeLeakedReasoning(cleaned)) {
    cleaned = stripLeakedReasoning(cleaned);
  }

  return cleaned.slice(0, 4000);
}

function looksLikeLeakedReasoning(value: string): boolean {
  return /\b(okay,? let'?s see|alright,? let'?s (see|go)|the (user|customer) (sent|said|asked)|i (should|need to) (check|reply|respond|call|see|acknowledge|inform)|i('ll| will) (reply|respond|make sure|assume)|let me (call|check|see|reply)|looking at the tools|available tools|there('s| is) a function|tools provided|no tools? (are |is )?needed|warm,? calm|plain language tone|knowledge notes|chain[- ]of[- ]thought|first,? i (should|need to)|invite them to ask|not explicitly listed)\b/i.test(
    value,
  );
}

function stripLeakedReasoning(value: string): string {
  const parts = value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const kept = parts.filter((part) => !looksLikeLeakedReasoning(part));
  if (kept.length > 0) return kept.join('\n\n').trim();

  // Single-block leak with no separable reply — hide it entirely.
  return '';
}

function isConversational(text: string): boolean {
  const trimmed = text.trim();
  if (/^(bliiva|blivap)[.!]?$/i.test(trimmed)) {
    return true;
  }
  if (
    /^(?:(?:bliiva|blivap)\s+)?(ok|okay|alright|all right|sure|got it|cool|great|thanks|thank you|thank you very much|hello|hi|hey|are you there|you there|anybody there|anyone there|still there|you around|are you around|can you hear me)(?:\s+(?:bliiva|blivap))?[.!]?$/i.test(
      trimmed,
    )
  ) {
    return true;
  }
  return /\b((what is|whats|who is) your name|who are you|what are you|what are you called|what can you do|what do you do|how can you help|are you (an?|and)?\s*(ai|bot|robot|assistant|llm)|are you (real|human|there|around)|is this (an? )?(ai|bot)|how are you|thanks|thank you|hello|hi)\b/i.test(
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
