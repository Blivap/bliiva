import { TicketStatus } from '../../common/enums/index.js';

/**
 * Allowed ticket status transitions.
 * RESOLVED → OPEN is reopen (user reply). ESCALATED → ASSIGNED after supervisor routes.
 */
const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  [TicketStatus.Open]: [
    TicketStatus.Assigned,
    TicketStatus.InProgress,
    TicketStatus.Escalated,
    TicketStatus.Cancelled,
  ],
  [TicketStatus.Assigned]: [
    TicketStatus.InProgress,
    TicketStatus.Escalated,
    TicketStatus.Cancelled,
  ],
  [TicketStatus.InProgress]: [
    TicketStatus.WaitingOnUser,
    TicketStatus.WaitingOnInternal,
    TicketStatus.Escalated,
    TicketStatus.Resolved,
    TicketStatus.Cancelled,
  ],
  [TicketStatus.WaitingOnUser]: [
    TicketStatus.InProgress,
    TicketStatus.Resolved,
    TicketStatus.Escalated,
    TicketStatus.Cancelled,
  ],
  [TicketStatus.WaitingOnInternal]: [
    TicketStatus.InProgress,
    TicketStatus.Escalated,
    TicketStatus.Cancelled,
  ],
  [TicketStatus.Escalated]: [
    TicketStatus.Assigned,
    TicketStatus.InProgress,
    TicketStatus.Cancelled,
  ],
  [TicketStatus.Resolved]: [TicketStatus.Open, TicketStatus.Closed],
  [TicketStatus.Closed]: [],
  [TicketStatus.Cancelled]: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: TicketStatus, to: TicketStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid ticket transition: ${from} → ${to}`);
  }
}

export function isTerminalStatus(status: TicketStatus): boolean {
  return status === TicketStatus.Closed || status === TicketStatus.Cancelled;
}

export function isWaitingStatus(status: TicketStatus): boolean {
  return (
    status === TicketStatus.WaitingOnUser ||
    status === TicketStatus.WaitingOnInternal
  );
}
