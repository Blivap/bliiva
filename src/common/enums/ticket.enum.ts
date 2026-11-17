export enum TicketStatus {
  Open = 'open',
  Assigned = 'assigned',
  InProgress = 'in_progress',
  WaitingOnUser = 'waiting_on_user',
  WaitingOnInternal = 'waiting_on_internal',
  Escalated = 'escalated',
  Resolved = 'resolved',
  Closed = 'closed',
  Cancelled = 'cancelled',
}

/** Active (non-terminal) ticket statuses used for unique conversation locks. */
export const ACTIVE_TICKET_STATUSES: readonly TicketStatus[] = [
  TicketStatus.Open,
  TicketStatus.Assigned,
  TicketStatus.InProgress,
  TicketStatus.WaitingOnUser,
  TicketStatus.WaitingOnInternal,
  TicketStatus.Escalated,
];
