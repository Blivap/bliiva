/** Why the ticket was created — not a status. */
export enum TicketSource {
  HumanRequested = 'human_requested',
  LowConfidence = 'low_confidence',
  NoKnowledge = 'no_knowledge',
  SecurityReport = 'security_report',
  UnauthorizedCharge = 'unauthorized_charge',
  Complaint = 'complaint',
  Emergency = 'emergency',
  ActionFailed = 'action_failed',
  ToolLoopLimit = 'tool_loop_limit',
  PromptInjection = 'prompt_injection',
  FollowUpUnresolved = 'follow_up_unresolved',
  RepeatedQuestion = 'repeated_question',
  FrustratedUnresolved = 'frustrated_unresolved',
  RepeatedFailure = 'repeated_failure',
  KnowledgeRequiresHuman = 'knowledge_requires_human',
  MedicalEmergency = 'medical_emergency',
  AdminCreated = 'admin_created',
  Other = 'other',
}

export function ticketSourceFromReason(reason: string | null | undefined): TicketSource {
  const key = (reason ?? '').trim().toLowerCase();
  const map: Record<string, TicketSource> = {
    human_requested: TicketSource.HumanRequested,
    low_confidence: TicketSource.LowConfidence,
    no_knowledge: TicketSource.NoKnowledge,
    knowledge_requires_human: TicketSource.KnowledgeRequiresHuman,
    security_report: TicketSource.SecurityReport,
    security_incident: TicketSource.SecurityReport,
    unauthorized_charge: TicketSource.UnauthorizedCharge,
    unauthorized_transaction: TicketSource.UnauthorizedCharge,
    complaint: TicketSource.Complaint,
    serious_complaint: TicketSource.Complaint,
    emergency: TicketSource.Emergency,
    medical_emergency: TicketSource.MedicalEmergency,
    action_failed: TicketSource.ActionFailed,
    action_failed_dead_end: TicketSource.ActionFailed,
    action_escalate: TicketSource.ActionFailed,
    tool_loop_limit: TicketSource.ToolLoopLimit,
    prompt_injection: TicketSource.PromptInjection,
    follow_up_unresolved: TicketSource.FollowUpUnresolved,
    repeated_question: TicketSource.RepeatedQuestion,
    frustrated_unresolved: TicketSource.FrustratedUnresolved,
    repeated_failure: TicketSource.RepeatedFailure,
    admin_created: TicketSource.AdminCreated,
  };
  return map[key] ?? TicketSource.Other;
}
