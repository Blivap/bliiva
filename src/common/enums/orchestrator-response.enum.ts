export enum OrchestratorResponseType {
  Answered = 'ANSWERED',
  ClarificationRequired = 'CLARIFICATION_REQUIRED',
  ActionCompleted = 'ACTION_COMPLETED',
  ActionConfirmationRequired = 'ACTION_CONFIRMATION_REQUIRED',
  Escalated = 'ESCALATED',
  HumanHandling = 'HUMAN_HANDLING',
  Unsupported = 'UNSUPPORTED',
  TemporaryError = 'TEMPORARY_ERROR',
}
