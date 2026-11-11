import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Types } from 'mongoose';
import type { SupportActor } from '../../../common/auth/support-actor.js';
import {
  ConversationStatus,
  MessageSenderType,
  MessageType,
  OrchestratorResponseType,
  Priority,
} from '../../../common/enums/index.js';
import {
  BLIVAP_INTEGRATION,
  type BlivapIntegrationPort,
} from '../../../integrations/blivap/index.js';
import { withActionGuidance } from '../../actions/action-guidance.js';
import { ActionsExecutor } from '../../actions/actions.executor.js';
import { ActionsResolver } from '../../actions/actions.resolver.js';
import {
  ActionStatus,
  type ActionExecutionResult,
} from '../../actions/actions.types.js';
import { extractPendingActionParams } from '../../actions/pending-params.js';
import { SupportAgentService } from '../../agent/support-agent.service.js';
import type { SupportAgentTurnResult } from '../../agent/support-agent.types.js';
import { AnalyticsService } from '../../analytics/analytics.service.js';
import { AuditRepository } from '../../audit/audit.repository.js';
import { ConversationsRepository } from '../../conversations/conversations.repository.js';
import { EscalationService } from '../../escalation/escalation.service.js';
import { LlmMetricsService } from '../../llm/analytics/llm-metrics.service.js';
import { MessagesRepository } from '../../messages/messages.repository.js';
import { SafetyService } from '../../safety/safety.service.js';
import {
  emptyContext,
  nextRepeatCount,
  readContext,
  resolvePendingReply,
  type ConversationContextState,
} from '../context/conversation-context.js';
import {
  botOfferedAction,
  inferOfferedAction,
  isGoAhead,
  pendingFromBotOffer,
  priorUserAskedForLiveData,
} from '../context/offered-action.js';
import { DecisionEngineService } from '../decision/decision-engine.service.js';
import { IntelligenceSettingsService } from '../intelligence-settings.service.js';
import {
  SupportDecisionKind,
  type SupportDecision,
} from '../interfaces/decision.interface.js';
import type { IntentDefinition } from '../interfaces/intent-definition.interface.js';
import {
  policyRequiresHuman,
  type IntentRecognitionResult,
} from '../interfaces/intent-recognizer.interface.js';
import { IntentCatalogService } from '../recognition/intent-catalog.service.js';
import { RuleBasedRecognizerService } from '../recognition/rule-based-recognizer.service.js';
import {
  composeResponse,
  ESCALATION_OFFER_QUESTION,
  temporaryErrorMessage,
} from '../response/response-composer.js';
import { KnowledgeRetrievalService } from '../retrieval/knowledge-retrieval.service.js';
import { extractEntities } from '../text/entities.js';
import { normalizeText } from '../text/text-normalizer.js';
import { detectUtterance } from '../text/utterances.js';

export interface OrchestratorConversation {
  id: string;
  userId: string | null;
  status: ConversationStatus;
  category: string;
  currentIntent: string | null;
  priority: Priority;
  context: Record<string, unknown>;
  assignedAgentId: string | null;
}

export interface OrchestratorTurn {
  responseType: OrchestratorResponseType;
  content: string;
  reference: string | null;
  message: {
    id: string;
    senderType: MessageSenderType;
    content: string;
    messageType: MessageType;
    createdAt: Date;
    metadata: Record<string, unknown>;
  };
  state: {
    id: string;
    status: ConversationStatus;
    category: string;
    currentIntent: string | null;
    priority: Priority;
    lastMessageAt: Date;
    conversationState: string;
    pendingClarification: { question: string; options: string[] } | null;
  };
}

@Injectable()
export class SupportOrchestratorService {
  private readonly logger = new Logger(SupportOrchestratorService.name);

  constructor(
    private readonly conversations: ConversationsRepository,
    private readonly messages: MessagesRepository,
    private readonly catalog: IntentCatalogService,
    private readonly recognizer: RuleBasedRecognizerService,
    private readonly retrieval: KnowledgeRetrievalService,
    private readonly decisions: DecisionEngineService,
    private readonly settings: IntelligenceSettingsService,
    private readonly safety: SafetyService,
    private readonly escalation: EscalationService,
    private readonly analytics: AnalyticsService,
    private readonly audit: AuditRepository,
    private readonly actions: ActionsExecutor,
    private readonly actionResolver: ActionsResolver,
    @Optional()
    @Inject(SupportAgentService)
    private readonly agent: SupportAgentService | null,
    @Optional()
    @Inject(LlmMetricsService)
    private readonly llmMetrics: LlmMetricsService | null,
    @Optional()
    @Inject(BLIVAP_INTEGRATION)
    private readonly blivap: BlivapIntegrationPort | null,
  ) {}

  async process(
    conversation: OrchestratorConversation,
    content: string,
    actor: SupportActor,
  ): Promise<OrchestratorTurn> {
    const started = Date.now();
    const userMessage = await this.messages.create({
      conversationId: new Types.ObjectId(conversation.id),
      senderType: MessageSenderType.User,
      senderId: actor.userId ? new Types.ObjectId(actor.userId) : null,
      content,
      messageType: MessageType.Text,
      intent: null,
      confidence: null,
      metadata: {},
    });

    try {
      return await this.respond(conversation, content, actor, started);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'support.message.failed',
          conversationId: conversation.id,
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
      return this.finish(conversation, {
        responseType: OrchestratorResponseType.TemporaryError,
        content: temporaryErrorMessage(),
        reference: null,
        decision: null,
        recognition: null,
        context: readContext(conversation.context),
        status: conversation.status,
        category: conversation.category,
        priority: conversation.priority,
        assignedAgentId: conversation.assignedAgentId,
        started,
        userText: content,
        safetyRedact: false,
        lowScore: false,
      });
    } finally {
      void userMessage;
    }
  }

  private async respond(
    conversation: OrchestratorConversation,
    content: string,
    actor: SupportActor,
    started: number,
  ): Promise<OrchestratorTurn> {
    let context = readContext(conversation.context);
    const normalized = normalizeText(content);
    const utterance = detectUtterance(normalized);
    const safety = this.safety.inspect(content);
    const closed = conversation.status === ConversationStatus.Closed;
    // After a ticket is queued (Waiting) or a human is live, stop bot product help.
    const humanHandling =
      conversation.status === ConversationStatus.Human ||
      (conversation.status === ConversationStatus.Waiting &&
        context.specialistNotified);
    const repeatCount = nextRepeatCount(context, normalized);
    const intents = await this.catalog.getEnabled();
    let pending = resolvePendingReply(context, normalized, utterance);

    // New substantive question abandons a stale “Want me to show…?” offer.
    if (
      pending.type === 'none' &&
      !isGoAhead(utterance, normalized) &&
      !utterance.softAck &&
      !utterance.closing &&
      !utterance.greeting &&
      normalized.split(/\s+/).length >= 3 &&
      (context.pendingClarification?.kind === 'action_offer' ||
        (context.pendingClarification?.kind === 'follow_up' &&
          botOfferedAction(context.lastBotResponse)))
    ) {
      context = {
        ...context,
        pendingClarification: null,
        pendingActionName: null,
        pendingActionParams: {},
        pendingConfirmationId: null,
        currentIntent: null,
      };
      pending = { type: 'none' };
    }

    const focusText =
      utterance.correction && utterance.correctionRemainder
        ? utterance.correctionRemainder
        : utterance.greetingRemainder
          ? utterance.greetingRemainder
          : content;

    let recognition = await this.recognizeTurn(
      content,
      normalized,
      utterance,
      context,
      intents,
      pending,
    );
    let preferredKnowledgeId: string | null = null;
    let actionParams: Record<string, string> = {
      ...context.pendingActionParams,
      ...recognition.entities,
    };
    if (pending.type === 'select') {
      if (pending.option.knowledgeId) {
        preferredKnowledgeId = pending.option.knowledgeId;
      }
      if (pending.option.params) {
        actionParams = { ...actionParams, ...pending.option.params };
      }
      if (pending.option.actionName) {
        actionParams.followUpAction = pending.option.actionName;
      }
    }

    const priorLiveAsk = priorUserAskedForLiveData(context.lastUserMessage);
    const acceptingOffer =
      (pending.type === 'affirm' &&
        (context.pendingClarification?.kind === 'action_confirm' ||
          context.pendingClarification?.kind === 'action_offer' ||
          (context.pendingClarification?.kind === 'follow_up' &&
            (botOfferedAction(context.lastBotResponse) || priorLiveAsk)))) ||
      (pending.type === 'none' &&
        isGoAhead(utterance, normalized) &&
        (botOfferedAction(context.lastBotResponse) || priorLiveAsk));

    // Pin sticky intent when the user accepts an offered lookup/action.
    if (
      acceptingOffer ||
      (pending.type === 'affirm' &&
        context.pendingClarification?.kind === 'escalation_confirm')
    ) {
      if (context.currentIntent) {
        recognition = {
          ...recognition,
          intent: context.currentIntent,
          confidence: 1,
          requiresClarification: false,
        };
      }
    }

    const knowledge = await this.retrieval.retrieve({
      text: focusText,
      intent: recognition.intent,
      category: recognition.category,
      preferredKnowledgeId,
    });

    let resolvedActionName: string | null = null;
    let unsupportedActionReason: string | null = null;
    const pendingConfirm =
      context.pendingClarification?.kind === 'action_confirm' &&
      pending.type === 'affirm';
    const pendingRejectConfirm =
      (context.pendingClarification?.kind === 'action_confirm' ||
        context.pendingClarification?.kind === 'action_offer') &&
      pending.type === 'reject';
    const pendingResource =
      context.pendingClarification?.kind === 'action_resource' &&
      pending.type === 'select';
    const pendingEscalateAffirm =
      context.pendingClarification?.kind === 'escalation_confirm' &&
      (pending.type === 'affirm' ||
        (pending.type === 'select' &&
          pending.option.intent === 'REQUEST_HUMAN'));
    const pendingEscalateReject =
      context.pendingClarification?.kind === 'escalation_confirm' &&
      (pending.type === 'reject' ||
        (pending.type === 'select' &&
          pending.option.intent !== 'REQUEST_HUMAN'));

    const pendingOfferAffirm =
      (context.pendingClarification?.kind === 'action_offer' &&
        pending.type === 'affirm') ||
      (context.pendingClarification?.kind === 'follow_up' &&
        pending.type === 'affirm' &&
        (botOfferedAction(context.lastBotResponse) || priorLiveAsk)) ||
      (pending.type === 'none' &&
        isGoAhead(utterance, normalized) &&
        (botOfferedAction(context.lastBotResponse) || priorLiveAsk));

    if (pendingConfirm && context.pendingActionName) {
      resolvedActionName = context.pendingActionName;
    } else if (pendingResource && context.pendingActionName) {
      resolvedActionName = context.pendingActionName;
    } else if (
      pending.type === 'none' &&
      context.pendingClarification?.kind === 'action_resource' &&
      context.pendingActionName
    ) {
      const free = extractPendingActionParams(
        context.pendingActionName,
        normalized,
        content,
      );
      if (free) {
        actionParams = { ...actionParams, ...free };
        resolvedActionName = context.pendingActionName;
      }
    } else if (pendingOfferAffirm) {
      const offered =
        (context.pendingClarification?.actionName
          ? {
              actionName: context.pendingClarification.actionName,
              params: {},
            }
          : null) ??
        inferOfferedAction({
          lastBotResponse: context.lastBotResponse,
          lastUserMessage: context.lastUserMessage,
          currentIntent: context.currentIntent ?? recognition.intent,
          pendingActionName: context.pendingActionName,
        });
      if (offered) {
        resolvedActionName = offered.actionName;
        actionParams = { ...actionParams, ...offered.params };
      }
    } else if (!pendingRejectConfirm && !pendingEscalateAffirm && !pendingEscalateReject) {
      const resolved = this.actionResolver.resolve({
        intent: recognition.intent ?? context.currentIntent,
        message: focusText,
        params: actionParams,
        lastBotResponse: context.lastBotResponse,
        userGoAhead: isGoAhead(utterance, normalized),
      });
      if (resolved && 'unsupported' in resolved) {
        unsupportedActionReason = resolved.unsupported;
      } else if (resolved) {
        resolvedActionName = resolved.action.name;
        actionParams = { ...actionParams, ...resolved.params };
      }
    }

    if (actionParams.followUpAction) {
      resolvedActionName = actionParams.followUpAction;
    }

    const baseDecision = this.decisions.decide({
      safety,
      recognition,
      knowledge,
      context,
      intents,
      authenticated: actor.isAuthenticated,
      humanHandling,
      conversationClosed: closed,
      repeatCount,
      followUpFailure: utterance.followUpFailure,
      greeting: utterance.greeting && pending.type === 'none',
      closing: utterance.closing && pending.type === 'none',
      actionName: resolvedActionName,
      actionParams,
      unsupportedActionReason,
    });

    // Keep operational/safety turns instant. Chatty turns (greet, close,
    // unclear, off-topic) go to the LLM so it can speak in its own words.
    const locked =
      baseDecision.kind === SupportDecisionKind.Emergency ||
      baseDecision.kind === SupportDecisionKind.Escalate ||
      baseDecision.kind === SupportDecisionKind.OfferEscalate ||
      baseDecision.kind === SupportDecisionKind.HumanHandling ||
      baseDecision.kind === SupportDecisionKind.ClosedConversation ||
      baseDecision.kind === SupportDecisionKind.UnsupportedAction ||
      baseDecision.kind === SupportDecisionKind.Authenticate ||
      baseDecision.kind === SupportDecisionKind.Answer ||
      baseDecision.kind === SupportDecisionKind.RunAction;
    const pendingActionFlow =
      pendingConfirm ||
      pendingRejectConfirm ||
      pendingResource ||
      pendingEscalateAffirm ||
      pendingEscalateReject ||
      pendingOfferAffirm;
    // Soft acks / bare yes with nothing pending must not reopen tasks or hit the LLM.
    const softAckIdle =
      !humanHandling &&
      !closed &&
      (utterance.softAck || utterance.affirmation) &&
      pending.type === 'none' &&
      !context.pendingClarification;
    const identityAsk =
      !humanHandling &&
      !closed &&
      utterance.botIdentityAsk &&
      pending.type === 'none' &&
      !resolvedActionName;
    if (
      !locked &&
      !pendingActionFlow &&
      !softAckIdle &&
      !identityAsk &&
      this.agent?.enabled() &&
      pending.type === 'none'
    ) {
      const agentTurn = await this.tryAgent(
        conversation,
        content,
        actor,
        // Don't ground the LLM on a stale intent when this turn didn't match one.
        recognition.intent
          ? context
          : { ...context, currentIntent: null },
        recognition.category,
        recognition.intent,
      );
      if (agentTurn) return agentTurn;
    }
    let decision = pendingEscalateAffirm
      ? {
          ...baseDecision,
          kind: SupportDecisionKind.Escalate,
          responseType: OrchestratorResponseType.Escalated,
          reason:
            context.pendingClarification?.escalationReason ??
            'human_requested',
          escalationReason:
            context.pendingClarification?.escalationReason ??
            'human_requested',
          priority: readPriority(
            context.pendingClarification?.priority,
            Priority.Medium,
          ),
          clarificationOptions: [],
          countsAsUnresolved: false,
          actionName: null,
        }
      : pendingEscalateReject
        ? {
            ...baseDecision,
            kind: SupportDecisionKind.Answer,
            responseType: OrchestratorResponseType.Answered,
            reason: 'escalation_declined',
            knowledge: null,
            clarificationOptions: [],
            escalationReason: null,
            countsAsUnresolved: false,
            appendDisclaimer: false,
            actionName: null,
          }
        : locked
          ? baseDecision
          : pendingRejectConfirm
            ? {
                ...baseDecision,
                kind: SupportDecisionKind.Answer,
                responseType: OrchestratorResponseType.Answered,
                reason: 'action_confirmation_cancelled',
                knowledge: null,
                clarificationOptions: [],
                escalationReason: null,
                countsAsUnresolved: false,
                appendDisclaimer: false,
                actionName: null,
              }
            : pending.type === 'affirm' &&
                context.pendingClarification?.kind === 'follow_up' &&
                !pendingOfferAffirm &&
                !resolvedActionName
              ? {
                  ...baseDecision,
                  kind: SupportDecisionKind.Close,
                  responseType: OrchestratorResponseType.Answered,
                  reason: 'follow_up_confirmed',
                  knowledge: null,
                  clarificationOptions: [],
                  escalationReason: null,
                  countsAsUnresolved: false,
                  appendDisclaimer: false,
                  actionName: null,
                  intent: null,
                }
              : pending.type === 'reject' &&
                  context.pendingClarification?.kind === 'follow_up'
                ? {
                    ...baseDecision,
                    kind: SupportDecisionKind.Answer,
                    responseType: OrchestratorResponseType.Answered,
                    reason: 'follow_up_more_help',
                    knowledge: null,
                    clarificationOptions: [],
                    escalationReason: null,
                    countsAsUnresolved: false,
                    appendDisclaimer: false,
                    actionName: null,
                    intent: null,
                  }
              : pending.type === 'reject' &&
                  context.pendingClarification?.kind !== 'action_confirm' &&
                  context.pendingClarification?.kind !== 'escalation_confirm'
                ? {
                    ...baseDecision,
                    kind: SupportDecisionKind.Clarify,
                    responseType:
                      OrchestratorResponseType.ClarificationRequired,
                    reason: 'clarification_rejected',
                    knowledge: null,
                    clarificationOptions: [],
                    escalationReason: null,
                    countsAsUnresolved: true,
                    appendDisclaimer: false,
                    actionName: null,
                  }
                : baseDecision;

    let reference: string | null = null;
    let ticketQueued = false;
    let assignedAgentId = conversation.assignedAgentId;
    let status = conversation.status;
    if (
      (softAckIdle || identityAsk) &&
      decision.kind !== SupportDecisionKind.HumanHandling &&
      decision.kind !== SupportDecisionKind.Escalate &&
      decision.kind !== SupportDecisionKind.Emergency &&
      decision.kind !== SupportDecisionKind.ClosedConversation &&
      decision.kind !== SupportDecisionKind.RunAction &&
      decision.kind !== SupportDecisionKind.UnsupportedAction
    ) {
      decision = {
        ...baseDecision,
        kind: SupportDecisionKind.Answer,
        responseType: OrchestratorResponseType.Answered,
        reason: identityAsk ? 'bot_identity' : 'soft_ack',
        knowledge: null,
        clarificationOptions: [],
        escalationReason: null,
        countsAsUnresolved: false,
        appendDisclaimer: false,
        actionName: null,
        intent: null,
      };
    }

    let actionContent: string | null =
      decision.reason === 'action_confirmation_cancelled'
        ? context.pendingClarification?.kind === 'action_offer'
          ? 'Okay — I won’t look that up. What else can I help with on Blivap?'
          : 'Cancelled — nothing changed.'
        : decision.reason === 'escalation_declined'
          ? 'Okay — I won’t escalate. How else can I help with Blivap?'
          : decision.reason === 'follow_up_more_help'
            ? 'Sure — what else can I help you with on Blivap?'
            : decision.reason === 'soft_ack'
              ? 'Alright — I’m here if you need anything on Blivap.'
              : decision.reason === 'bot_identity'
                ? "I'm Bliiva — Blivap’s official AI support assistant. I can help with your Blivap account, donations, bookings, wallet, notifications, and more."
                : null;
    let nextContextOverride: ConversationContextState | null = null;

    if (
      decision.kind === SupportDecisionKind.RunAction &&
      decision.actionName
    ) {
      const actionResult = await this.actions.execute({
        actionName: decision.actionName,
        conversationId: conversation.id,
        actor,
        params: decision.actionParams ?? actionParams,
        confirmationId:
          pendingConfirm && context.pendingConfirmationId
            ? context.pendingConfirmationId
            : undefined,
        context,
        idempotencyKey:
          decision.actionName.startsWith('cancel_') ||
          decision.actionName.startsWith('update_') ||
          decision.actionName.startsWith('resend_')
            ? `${conversation.id}:${decision.actionName}:${JSON.stringify(decision.actionParams ?? {})}`
            : undefined,
      });
      const guidanceOutcome =
        actionResult.status === ActionStatus.Success
          ? 'success'
          : actionResult.status === ActionStatus.Rejected
            ? 'rejected'
            : actionResult.status === ActionStatus.Failed
              ? 'failed'
              : null;
      actionContent =
        guidanceOutcome && decision.actionName
          ? withActionGuidance(
              decision.actionName,
              actionResult.message,
              guidanceOutcome,
            )
          : actionResult.message;
      if (actionResult.status === ActionStatus.NeedsConfirmation) {
        decision = {
          ...decision,
          responseType: OrchestratorResponseType.ActionConfirmationRequired,
          reason: 'action_confirmation_required',
        };
        nextContextOverride = {
          ...context,
          pendingActionName: decision.actionName ?? null,
          pendingActionParams: decision.actionParams ?? {},
          pendingConfirmationId: actionResult.confirmationId ?? null,
          conversationState: 'awaiting_action_confirmation',
          pendingClarification: {
            kind: 'action_confirm',
            question: actionResult.message,
            options: [
              {
                intent: decision.intent ?? 'GENERAL_ENQUIRY',
                label: 'yes',
                actionName: decision.actionName ?? undefined,
              },
              {
                intent: decision.intent ?? 'GENERAL_ENQUIRY',
                label: 'no',
              },
            ],
            actionName: decision.actionName ?? undefined,
            confirmationId: actionResult.confirmationId,
          },
        };
      } else if (actionResult.status === ActionStatus.NeedsParameter) {
        decision = {
          ...decision,
          responseType: OrchestratorResponseType.ClarificationRequired,
          reason: 'action_parameter_required',
        };
        nextContextOverride = {
          ...context,
          pendingActionName: actionResult.actionName,
          pendingActionParams: decision.actionParams ?? {},
          pendingConfirmationId: null,
          conversationState: 'awaiting_action_parameter',
          pendingClarification: {
            kind: 'action_resource',
            question: actionResult.message,
            options: (actionResult.choices ?? []).map((choice) => ({
              intent: decision.intent ?? 'GENERAL_ENQUIRY',
              label: choice.label,
              actionName: actionResult.actionName,
              params: choice.params,
            })),
            actionName: actionResult.actionName,
          },
        };
      } else if (
        actionResult.status === ActionStatus.Success ||
        actionResult.status === ActionStatus.Rejected
      ) {
        decision = {
          ...decision,
          responseType:
            actionResult.status === ActionStatus.Success
              ? OrchestratorResponseType.ActionCompleted
              : OrchestratorResponseType.Unsupported,
          reason: actionResult.failureCode ?? 'action_completed',
        };
        const moneyFollowUp = moneyActionFollowUp(
          actionResult.actionName,
          actionResult,
        );
        nextContextOverride = {
          ...context,
          pendingActionName: moneyFollowUp?.actionName ?? null,
          pendingActionParams: moneyFollowUp?.params ?? {},
          pendingConfirmationId: null,
          conversationState: moneyFollowUp
            ? 'awaiting_action_parameter'
            : 'answered',
          pendingClarification: moneyFollowUp
            ? {
                kind: 'action_resource',
                question: actionResult.message,
                options: [],
                actionName: moneyFollowUp.actionName,
              }
            : actionResult.choices?.length
              ? {
                  kind: 'action_resource',
                  question: actionResult.message,
                  options: actionResult.choices.map((choice) => ({
                    intent: decision.intent ?? 'GENERAL_ENQUIRY',
                    label: choice.label,
                    actionName:
                      choice.params.followUpAction ??
                      decision.actionName ??
                      undefined,
                    params: choice.params,
                  })),
                  actionName: decision.actionName ?? undefined,
                }
              : {
                  kind: 'follow_up',
                  question: 'Anything else?',
                  options: [
                    {
                      intent: decision.intent ?? 'GENERAL_ENQUIRY',
                      label: 'yes',
                    },
                    { intent: 'REQUEST_HUMAN', label: 'no I need more help' },
                  ],
                },
          unsuccessfulAttempts: 0,
        };
        if (actionResult.escalate) {
          decision = {
            ...decision,
            kind: SupportDecisionKind.OfferEscalate,
            responseType: OrchestratorResponseType.ClarificationRequired,
            reason: actionResult.failureCode ?? 'action_escalate',
            escalationReason: actionResult.failureCode ?? 'action_escalate',
            priority: Priority.Medium,
            clarificationOptions: [
              { intent: 'REQUEST_HUMAN', label: 'yes' },
              { intent: 'GENERAL_ENQUIRY', label: 'no' },
            ],
          };
          actionContent = [
            actionResult.message,
            ESCALATION_OFFER_QUESTION,
          ].join('\n\n');
        }
      } else if (actionResult.status === ActionStatus.Failed) {
        const attempts = context.unsuccessfulAttempts + 1;
        const deadEnd =
          actionResult.escalate === true ||
          attempts >= this.settings.current().maxClarificationAttempts;
        if (deadEnd) {
          decision = {
            ...decision,
            kind: SupportDecisionKind.OfferEscalate,
            responseType: OrchestratorResponseType.ClarificationRequired,
            reason: 'action_failed_dead_end',
            escalationReason: 'action_failed_dead_end',
            priority: Priority.Medium,
            countsAsUnresolved: true,
            clarificationOptions: [
              { intent: 'REQUEST_HUMAN', label: 'yes' },
              { intent: 'GENERAL_ENQUIRY', label: 'no' },
            ],
          };
          actionContent = [
            actionResult.message,
            ESCALATION_OFFER_QUESTION,
          ].join('\n\n');
          nextContextOverride = {
            ...context,
            pendingActionName: null,
            pendingActionParams: {},
            pendingConfirmationId: null,
            conversationState: 'clarifying',
            unsuccessfulAttempts: attempts,
            pendingClarification: {
              kind: 'escalation_confirm',
              question: ESCALATION_OFFER_QUESTION,
              options: [
                { intent: 'REQUEST_HUMAN', label: 'yes' },
                { intent: 'GENERAL_ENQUIRY', label: 'no' },
              ],
              escalationReason: 'action_failed_dead_end',
              priority: 'medium',
            },
          };
        } else {
          decision = {
            ...decision,
            responseType: OrchestratorResponseType.TemporaryError,
            reason: 'action_failed',
            countsAsUnresolved: true,
          };
          nextContextOverride = {
            ...context,
            pendingActionName: decision.actionName ?? null,
            pendingActionParams: decision.actionParams ?? {},
            pendingConfirmationId: null,
            conversationState: 'clarifying',
            unsuccessfulAttempts: attempts,
            // Keep a retryable offer so “yes” / “try again” re-runs the lookup.
            pendingClarification: decision.actionName
              ? {
                  kind: 'action_offer',
                  question: actionResult.message,
                  options: [
                    {
                      intent: decision.intent ?? 'GENERAL_ENQUIRY',
                      label: 'yes',
                      actionName: decision.actionName,
                    },
                    {
                      intent: decision.intent ?? 'GENERAL_ENQUIRY',
                      label: 'no',
                    },
                  ],
                  actionName: decision.actionName,
                }
              : null,
          };
        }
      }
    }

    if (
      decision.kind === SupportDecisionKind.Escalate ||
      decision.kind === SupportDecisionKind.Emergency
    ) {
      const recent = await this.messages.findRecent(conversation.id, 8);
      try {
        const result = await this.escalation.escalate({
          conversationId: conversation.id,
          userId: conversation.userId,
          category: decision.category ?? conversation.category,
          intent: decision.intent,
          confidence: decision.confidence,
          reason: decision.escalationReason ?? decision.reason,
          priority: decision.priority,
          subject: content,
          originalQuestion: content,
          recentMessages: [...recent].reverse().map((message) => ({
            senderType: message.senderType,
            content: message.content,
          })),
          knowledge: [
            ...context.presentedKnowledgeIds.map((id) => ({
              id,
              title: 'previously presented',
            })),
            ...(decision.knowledge
              ? [
                  {
                    id: decision.knowledge.knowledgeId,
                    title: decision.knowledge.title,
                  },
                ]
              : []),
          ],
        });
        reference = result.ticketNumber;
        ticketQueued = true;
        assignedAgentId = result.assignedAgentId;
        status = result.assignedAgentId
          ? ConversationStatus.Human
          : ConversationStatus.Waiting;
        await this.audit.createAudit({
          action: 'support.escalated',
          resourceType: 'ticket',
          resourceId: new Types.ObjectId(result.ticketId),
          actorId: actor.userId ? new Types.ObjectId(actor.userId) : null,
          actorType: actor.isAuthenticated ? 'user' : 'guest',
          metadata: {
            reason: decision.reason,
            intent: decision.intent,
            category: decision.category,
            confidence: decision.confidence,
            ticketNumber: result.ticketNumber,
          },
        });
      } catch (error) {
        this.logger.error(
          JSON.stringify({
            event: 'support.escalation.failed',
            conversationId: conversation.id,
            message: error instanceof Error ? error.message : 'unknown',
          }),
        );
        status = ConversationStatus.Waiting;
      }
    } else if (decision.kind === SupportDecisionKind.Close) {
      status = ConversationStatus.Resolved;
    } else if (
      status === ConversationStatus.Resolved &&
      decision.kind !== SupportDecisionKind.ClosedConversation
    ) {
      status = ConversationStatus.Bot;
    }

    // Never block the reply on a profile round-trip — greet instantly from cache.
    const userName: string | null = context.recognizedEntities.userName ?? null;
    if (
      decision.kind === SupportDecisionKind.Greet &&
      !userName &&
      actor.isAuthenticated
    ) {
      void this.warmUserName(conversation.id, actor);
    }
    const suppressBotMessage =
      decision.kind === SupportDecisionKind.HumanHandling &&
      context.specialistNotified;
    const composed = suppressBotMessage
      ? { content: '', knowledgeId: null, knowledgeTitle: null }
      : composeResponse(decision, { ticketQueued, userName });
    const contentOut = suppressBotMessage
      ? ''
      : (actionContent ?? composed.content);

    // Silent internal report — never tell the user we reported anything.
    if (decision.reason === 'disallowed_topic') {
      void this.audit
        .createAudit({
          action: 'support.disallowed_topic',
          resourceType: 'conversation',
          resourceId: Types.ObjectId.isValid(conversation.id)
            ? new Types.ObjectId(conversation.id)
            : null,
          actorId: actor.userId ? new Types.ObjectId(actor.userId) : null,
          actorType: actor.isAuthenticated ? 'user' : 'guest',
          metadata: {
            conversationId: conversation.id,
            reasons: safety.reasons,
            preview: content.slice(0, 200),
          },
        })
        .catch((error: unknown) => {
          this.logger.warn(
            JSON.stringify({
              event: 'support.disallowed_topic.audit_failed',
              conversationId: conversation.id,
              message: error instanceof Error ? error.message : 'unknown',
            }),
          );
        });
    }
    const entityPatch = {
      ...recognition.entities,
      ...(userName ? { userName } : {}),
    };
    const nextBase = this.nextContext(
      context,
      content,
      normalized,
      decision,
      contentOut,
      entityPatch,
      safety.frustrated,
      repeatCount,
    );
    const next = nextContextOverride
      ? {
          ...nextBase,
          ...nextContextOverride,
          currentIntent:
            decision.intent === null
              ? null
              : (decision.intent ?? nextBase.currentIntent),
          previousIntent: context.currentIntent,
          lastUserMessage: content,
          lastUserMessageNormalized: normalized,
          lastBotResponse: contentOut || context.lastBotResponse,
          recognizedEntities: {
            ...context.recognizedEntities,
            ...entityPatch,
          },
          version: 1 as const,
        }
      : nextBase;

    return this.finish(conversation, {
      responseType: decision.responseType,
      content: contentOut,
      reference,
      decision,
      recognition,
      context: next,
      status,
      category: decision.category ?? conversation.category,
      priority:
        decision.kind === SupportDecisionKind.Escalate ||
        decision.kind === SupportDecisionKind.Emergency
          ? decision.priority
          : conversation.priority,
      assignedAgentId,
      started,
      userText: content,
      safetyRedact:
        safety.emergency ||
        safety.personalClinicalDecision ||
        safety.securityIncident ||
        safety.unauthorizedTransaction,
      lowScore: Boolean(decision.knowledge && decision.knowledge.score < 0.5),
      knowledgeId: composed.knowledgeId,
      knowledgeTitle: composed.knowledgeTitle,
      suppressBotMessage,
    });
  }

  private async tryAgent(
    conversation: OrchestratorConversation,
    content: string,
    actor: SupportActor,
    context: ConversationContextState,
    category: string | null,
    recognizedIntent: string | null = null,
  ): Promise<OrchestratorTurn | null> {
    // Handoff already started — never resume product help via the LLM.
    if (context.specialistNotified) {
      return null;
    }
    const recent = await this.messages.findRecent(conversation.id, 12);
    const history = [...recent]
      .reverse()
      .filter(
        (message) =>
          message.senderType === MessageSenderType.User ||
          message.senderType === MessageSenderType.Bot,
      )
      .slice(0, -1)
      .map((message) => ({
        role:
          message.senderType === MessageSenderType.User
            ? ('user' as const)
            : ('assistant' as const),
        content: message.content,
      }));
    if (!this.agent) return null;
    const result = await this.agent.runTurn({
      conversationId: conversation.id,
      content,
      actor,
      context,
      history,
      category,
      confirmationId: context.pendingConfirmationId ?? undefined,
    });
    await this.recordLlmAnalytics(conversation.id, result);
    if (result.outcome === 'fallback') {
      return null;
    }
    // Timeouts / Ollama reloads used to disappear into "Couldn't match that".
    // Surface a temporary error so the user can retry once the model is warm.
    if (
      result.outcome === 'unavailable' ||
      result.outcome === 'temporary_error'
    ) {
      return this.finish(conversation, {
        responseType: OrchestratorResponseType.TemporaryError,
        content: temporaryErrorMessage(),
        reference: null,
        decision: null,
        recognition: null,
        context,
        status: conversation.status,
        category: conversation.category,
        priority: conversation.priority,
        assignedAgentId: conversation.assignedAgentId,
        started: Date.now(),
        userText: content,
        safetyRedact: false,
        lowScore: false,
        extraMetadata: {
          reason: result.reason,
          errorCode: result.errorCode,
          model: result.model,
        },
      });
    }

    const offeringEscalation =
      result.context.pendingClarification?.kind === 'escalation_confirm' ||
      result.responseType === OrchestratorResponseType.ClarificationRequired;

    // LLM path never auto-opens a ticket. Offers wait for a yes; explicit
    // human language is handled on the rules path via REQUEST_HUMAN.
    // Stick only when recognition found an intent. Short “do it” follow-ups
    // resolve via lastBotResponse in the action resolver, so empty recognition
    // must clear sticky intent or off-topic turns keep reopening verification.
    const nextIntent = recognizedIntent;

    return this.finish(conversation, {
      responseType: result.responseType,
      content: result.content,
      reference: null,
      decision: {
        kind: offeringEscalation
          ? SupportDecisionKind.OfferEscalate
          : SupportDecisionKind.Answer,
        responseType: result.responseType,
        reason: result.reason,
        intent: nextIntent,
        category: category ?? conversation.category,
        confidence: result.knowledgeRefs[0]?.score ?? 0.9,
        knowledge: null,
        clarificationOptions:
          result.context.pendingClarification?.options ?? [],
        escalationReason: result.escalationReason,
        priority: Priority.Medium,
        appendDisclaimer: false,
        empathetic: false,
        repeatedQuestion: false,
        countsAsUnresolved: offeringEscalation,
      },
      recognition: null,
      context: {
        ...result.context,
        currentIntent: nextIntent,
        previousIntent: context.currentIntent,
        lastUserMessage: content,
        lastUserMessageNormalized: normalizeText(content),
        lastBotResponse: result.content,
        version: 1,
      },
      status: conversation.status,
      category: category ?? conversation.category,
      priority: conversation.priority,
      assignedAgentId: conversation.assignedAgentId,
      started: Date.now() - result.latencyMs,
      userText: content,
      safetyRedact: false,
      lowScore: Boolean(
        result.knowledgeRefs[0] && result.knowledgeRefs[0].score < 0.5,
      ),
      knowledgeId: result.knowledgeRefs[0]?.id ?? null,
      knowledgeTitle: result.knowledgeRefs[0]?.title ?? null,
      extraMetadata: {
        source: 'llm',
        model: result.model,
        toolCalls: result.toolCalls,
        knowledgeRefs: result.knowledgeRefs,
      },
    });
  }

  private async recordLlmAnalytics(
    conversationId: string,
    result: SupportAgentTurnResult,
  ): Promise<void> {
    if (!this.llmMetrics) return;
    try {
      await this.llmMetrics.record({
        kind: result.escalate ? 'escalation' : 'chat',
        model: result.model,
        latencyMs: result.latencyMs,
        success:
          result.outcome === 'answered' ||
          result.outcome === 'action_confirmation' ||
          result.outcome === 'action_parameter',
        errorCode: result.errorCode,
        relevance: result.knowledgeRefs[0]?.score ?? null,
        knowledgeIds: result.knowledgeRefs.map((item) => item.id),
        conversationId,
      });
      if (result.toolCalls > 0) {
        await this.llmMetrics.record({
          kind: 'tool',
          model: result.model,
          latencyMs: result.latencyMs,
          success: !result.escalate,
          conversationId,
        });
      }
      if (result.retrievalDurationMs > 0) {
        await this.llmMetrics.record({
          kind: 'retrieve',
          model: result.model,
          latencyMs: result.retrievalDurationMs,
          success: !result.errorCode,
          relevance: result.knowledgeRefs[0]?.score ?? null,
          knowledgeIds: result.knowledgeRefs.map((item) => item.id),
          conversationId,
        });
      }
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'support.llm.analytics_failed',
          conversationId,
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
    }
  }

  private async warmUserName(
    conversationId: string,
    actor: SupportActor,
  ): Promise<void> {
    const name = await this.resolveUserName(actor);
    if (!name) return;
    try {
      const conversation = await this.conversations.findById(conversationId);
      if (!conversation) return;
      const context = readContext(
        (conversation.context ?? {}) as Record<string, unknown>,
      );
      if (context.recognizedEntities.userName) return;
      await this.conversations.updateById(conversationId, {
        context: {
          ...context,
          recognizedEntities: {
            ...context.recognizedEntities,
            userName: name,
          },
        },
      });
    } catch (error) {
      this.logger.debug(
        JSON.stringify({
          event: 'support.greeting.name_cache_failed',
          conversationId,
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
    }
  }

  private async resolveUserName(actor: SupportActor): Promise<string | null> {
    if (
      !this.blivap ||
      !actor.isAuthenticated ||
      !actor.userId ||
      !actor.accessToken
    ) {
      return null;
    }
    try {
      const profile = await this.blivap.getProfile({
        userId: actor.userId,
        accessToken: actor.accessToken,
      });
      const first = profile.firstname?.trim();
      if (first) return first;
      const last = profile.lastname?.trim();
      return last || null;
    } catch (error) {
      this.logger.debug(
        JSON.stringify({
          event: 'support.greeting.profile_unavailable',
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
      return null;
    }
  }

  private async recognizeTurn(
    content: string,
    normalized: string,
    utterance: ReturnType<typeof detectUtterance>,
    context: ConversationContextState,
    intents: IntentDefinition[],
    pending: ReturnType<typeof resolvePendingReply>,
  ): Promise<IntentRecognitionResult> {
    if (pending.type === 'select') {
      const forced = intents.find(
        (intent) => intent.name === pending.option.intent,
      );
      if (forced) {
        return {
          intent: forced.name,
          category: forced.category,
          confidence: 0.93,
          matchedKeywords: [],
          matchedPhrases: [pending.option.label],
          alternatives: [],
          requiresClarification: false,
          requiresAuthentication: forced.requiresAuthentication,
          requiresHumanSupport: policyRequiresHuman(forced.escalationPolicy),
          entities: extractEntities(content),
          sensitivity: forced.sensitivity,
          escalationPolicy: forced.escalationPolicy,
          priority: forced.priority,
        };
      }
    }

    const text =
      utterance.correction && utterance.correctionRemainder
        ? utterance.correctionRemainder
        : utterance.greetingRemainder
          ? utterance.greetingRemainder
          : content;
    return this.recognizer.recognize(text, {
      currentIntent: context.currentIntent,
      correction: utterance.correction,
      followUpCue: utterance.followUpFailure,
    });
  }

  private nextContext(
    state: ConversationContextState,
    content: string,
    normalized: string,
    decision: SupportDecision,
    response: string,
    entities: Record<string, string>,
    frustrated: boolean,
    repeatCount: number,
  ): ConversationContextState {
    let conversationState = state.conversationState;
    let unsuccessfulAttempts = state.unsuccessfulAttempts;
    let pendingClarification = state.pendingClarification;
    let presented = state.presentedKnowledgeIds;

    if (decision.kind === SupportDecisionKind.Answer) {
      conversationState = 'answered';
      unsuccessfulAttempts = 0;
      const offer = pendingFromBotOffer({
        botContent: response,
        currentIntent: decision.intent ?? state.currentIntent,
      });
      pendingClarification = offer
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
                  decision.intent ?? state.currentIntent ?? 'GENERAL_ENQUIRY',
                label: 'yes',
              },
              { intent: 'REQUEST_HUMAN', label: 'no I need more help' },
            ],
          };
      if (decision.knowledge) {
        presented = [...presented, decision.knowledge.knowledgeId].slice(-10);
      }
    } else if (decision.kind === SupportDecisionKind.Clarify) {
      conversationState = 'clarifying';
      unsuccessfulAttempts += 1;
      pendingClarification = decision.clarificationOptions.length
        ? {
            kind: decision.clarificationOptions.some(
              (option) => option.knowledgeId,
            )
              ? 'knowledge'
              : 'intent',
            question: response,
            options: decision.clarificationOptions,
          }
        : null;
    } else if (decision.kind === SupportDecisionKind.OfferEscalate) {
      conversationState = 'clarifying';
      pendingClarification = {
        kind: 'escalation_confirm',
        question: response,
        options:
          decision.clarificationOptions.length > 0
            ? decision.clarificationOptions
            : [
                { intent: 'REQUEST_HUMAN', label: 'yes' },
                { intent: 'GENERAL_ENQUIRY', label: 'no' },
              ],
        escalationReason: decision.escalationReason ?? decision.reason,
        priority: decision.priority,
      };
    } else if (decision.kind === SupportDecisionKind.Fallback) {
      conversationState = 'clarifying';
      unsuccessfulAttempts += 1;
      pendingClarification = null;
    } else if (
      decision.kind === SupportDecisionKind.Escalate ||
      decision.kind === SupportDecisionKind.Emergency
    ) {
      conversationState = 'escalated';
      pendingClarification = null;
    } else if (decision.kind === SupportDecisionKind.Close) {
      conversationState = 'closing';
      unsuccessfulAttempts = 0;
      pendingClarification = null;
    } else if (decision.kind === SupportDecisionKind.Greet) {
      conversationState = 'idle';
    }

    const specialistNotified =
      state.specialistNotified ||
      decision.kind === SupportDecisionKind.Escalate ||
      decision.kind === SupportDecisionKind.Emergency ||
      decision.kind === SupportDecisionKind.HumanHandling;

    // Never keep a stale intent after handoff, close, greet, soft-ack, or
    // when the decision explicitly cleared it — that caused verification loops.
    const clearIntent =
      decision.intent === null ||
      decision.kind === SupportDecisionKind.Escalate ||
      decision.kind === SupportDecisionKind.Emergency ||
      decision.kind === SupportDecisionKind.Close ||
      decision.kind === SupportDecisionKind.HumanHandling ||
      decision.kind === SupportDecisionKind.Greet ||
      decision.reason === 'soft_ack' ||
      decision.reason === 'bot_identity' ||
      decision.reason === 'follow_up_more_help' ||
      decision.reason === 'follow_up_confirmed' ||
      decision.reason === 'disallowed_topic' ||
      decision.kind === SupportDecisionKind.UnsupportedAction;
    if (
      decision.kind === SupportDecisionKind.Answer &&
      (decision.reason === 'soft_ack' ||
        decision.reason === 'bot_identity' ||
        decision.reason === 'follow_up_more_help')
    ) {
      pendingClarification = null;
      conversationState = 'idle';
    }
    if (decision.kind === SupportDecisionKind.UnsupportedAction) {
      pendingClarification = null;
      conversationState = 'idle';
    }

    return {
      ...emptyContext(),
      ...state,
      previousIntent: state.currentIntent,
      currentIntent: clearIntent
        ? null
        : (decision.intent ?? state.currentIntent),
      lastUserMessage: content,
      lastUserMessageNormalized: normalized,
      lastBotResponse: response || state.lastBotResponse,
      lastClarificationQuestion:
        decision.kind === SupportDecisionKind.Clarify
          ? response
          : state.lastClarificationQuestion,
      pendingClarification,
      recognizedEntities: { ...state.recognizedEntities, ...entities },
      conversationState,
      unsuccessfulAttempts,
      presentedKnowledgeIds: presented,
      frustrated: frustrated || state.frustrated,
      repeatCount,
      specialistNotified,
      version: 1,
    };
  }

  private async finish(
    conversation: OrchestratorConversation,
    input: {
      responseType: OrchestratorResponseType;
      content: string;
      reference: string | null;
      decision: SupportDecision | null;
      recognition: IntentRecognitionResult | null;
      context: ConversationContextState;
      status: ConversationStatus;
      category: string;
      priority: Priority;
      assignedAgentId: string | null;
      started: number;
      userText: string;
      safetyRedact: boolean;
      lowScore: boolean;
      knowledgeId?: string | null;
      knowledgeTitle?: string | null;
      extraMetadata?: Record<string, unknown>;
      suppressBotMessage?: boolean;
    },
  ): Promise<OrchestratorTurn> {
    const metadata: Record<string, unknown> = {
      responseType: input.responseType,
      reason: input.decision?.reason ?? 'temporary_error',
      intent: input.decision?.intent ?? null,
      category: input.category,
      confidence: input.decision?.confidence ?? null,
      knowledgeId: input.knowledgeId ?? null,
      knowledgeTitle: input.knowledgeTitle ?? null,
      matchedKeywords: input.recognition?.matchedKeywords ?? [],
      matchedPhrases: input.recognition?.matchedPhrases ?? [],
      escalationReason: input.decision?.escalationReason ?? null,
      ticketNumber: input.reference,
      ...(input.suppressBotMessage ? { silent: true } : {}),
      ...input.extraMetadata,
    };
    const bot = input.suppressBotMessage
      ? null
      : await this.messages.create({
          conversationId: new Types.ObjectId(conversation.id),
          senderType: MessageSenderType.Bot,
          senderId: null,
          content: input.content,
          messageType: MessageType.Text,
          intent: input.decision?.intent ?? null,
          confidence: input.decision?.confidence ?? null,
          metadata,
        });
    const updated = await this.conversations.updateById(conversation.id, {
      status: input.status,
      category: input.category,
      currentIntent: input.context.currentIntent,
      priority: input.priority,
      assignedAgentId: input.assignedAgentId
        ? new Types.ObjectId(input.assignedAgentId)
        : null,
      context: input.context as unknown as Record<string, unknown>,
      lastMessageAt: new Date(),
    });
    const latencyMs = Date.now() - input.started;
    const decision = input.decision;
    try {
      await this.analytics.record({
        conversationId: conversation.id,
        outcome: input.responseType,
        category: decision?.category ?? null,
        intent: decision?.intent ?? null,
        confidence: decision?.confidence ?? null,
        latencyMs,
        knowledgeId: input.knowledgeId ?? null,
        recognized:
          Boolean(decision?.intent) &&
          decision?.kind !== SupportDecisionKind.Greet,
        unrecognized: decision?.kind === SupportDecisionKind.Fallback,
        clarification: decision?.kind === SupportDecisionKind.Clarify,
        resolved:
          decision?.kind === SupportDecisionKind.Answer ||
          decision?.kind === SupportDecisionKind.Close,
        escalated:
          decision?.kind === SupportDecisionKind.Escalate ||
          decision?.kind === SupportDecisionKind.Emergency,
        lowScore: input.lowScore,
        unresolved: decision?.countsAsUnresolved === true,
        question: input.userText,
        forceRedact: input.safetyRedact,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'support.analytics.failed',
          conversationId: conversation.id,
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
    }

    const aiSource =
      typeof input.extraMetadata?.source === 'string'
        ? input.extraMetadata.source
        : decision?.kind === SupportDecisionKind.RunAction
          ? 'action'
          : 'rules';
    this.logger.log(
      JSON.stringify({
        event: 'support.message.processed',
        conversationId: conversation.id,
        outcome: input.responseType,
        intent: decision?.intent ?? null,
        category: input.category,
        latencyMs,
        silent: Boolean(input.suppressBotMessage),
        aiActive: this.agent?.enabled() === true,
        aiSource,
        reason: decision?.reason ?? input.extraMetadata?.reason ?? null,
      }),
    );

    const createdAtValue = bot
      ? (bot as { createdAt?: Date }).createdAt
      : undefined;
    const createdAt =
      createdAtValue instanceof Date ? createdAtValue : new Date();
    return {
      responseType: input.responseType,
      content: input.content,
      reference: input.reference,
      message: {
        id: bot
          ? String(bot._id)
          : `silent:${conversation.id}:${createdAt.getTime()}`,
        senderType: MessageSenderType.Bot,
        content: input.content,
        messageType: MessageType.Text,
        createdAt,
        metadata,
      },
      state: {
        id: conversation.id,
        status: updated?.status ?? input.status,
        category: updated?.category ?? input.category,
        currentIntent: input.context.currentIntent,
        priority: updated?.priority ?? input.priority,
        lastMessageAt: updated?.lastMessageAt ?? new Date(),
        conversationState: input.context.conversationState,
        pendingClarification: input.context.pendingClarification
          ? {
              question: input.context.pendingClarification.question,
              options: input.context.pendingClarification.options.map(
                (option) => option.label,
              ),
            }
          : null,
      },
    };
  }
}

function readPriority(value: string | undefined, fallback: Priority): Priority {
  if (
    value === Priority.Low ||
    value === Priority.Medium ||
    value === Priority.High ||
    value === Priority.Urgent
  ) {
    return value;
  }
  return fallback;
}

/** After top-up/payout start, collect reference or OTP as the next action. */
function moneyActionFollowUp(
  actionName: string,
  result: ActionExecutionResult,
): { actionName: string; params: Record<string, string> } | null {
  if (result.status !== ActionStatus.Success) return null;
  if (actionName === 'start_wallet_payout') {
    const payoutId =
      (typeof result.data?.payoutId === 'string' && result.data.payoutId) ||
      result.resourceId;
    if (!payoutId) return null;
    return {
      actionName: 'confirm_wallet_payout',
      params: { payoutId },
    };
  }
  if (actionName === 'start_wallet_topup') {
    const reference =
      (typeof result.data?.reference === 'string' && result.data.reference) ||
      result.resourceId;
    if (!reference) return null;
    return {
      actionName: 'verify_wallet_topup',
      params: { reference },
    };
  }
  if (actionName === 'resend_payout_otp') {
    const payoutId =
      (typeof result.data?.payoutId === 'string' && result.data.payoutId) ||
      result.resourceId;
    if (!payoutId) return null;
    return {
      actionName: 'confirm_wallet_payout',
      params: { payoutId },
    };
  }
  return null;
}
