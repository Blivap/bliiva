import { TicketStatus } from '../../common/enums/index.js';
import { canTransition } from './ticket-transitions.js';

describe('ticket transitions', () => {
  it('allows the happy path', () => {
    expect(canTransition(TicketStatus.Open, TicketStatus.Assigned)).toBe(true);
    expect(canTransition(TicketStatus.Assigned, TicketStatus.InProgress)).toBe(
      true,
    );
    expect(canTransition(TicketStatus.InProgress, TicketStatus.Resolved)).toBe(
      true,
    );
    expect(canTransition(TicketStatus.Resolved, TicketStatus.Closed)).toBe(
      true,
    );
  });

  it('allows waiting toggles and reopen', () => {
    expect(
      canTransition(TicketStatus.InProgress, TicketStatus.WaitingOnUser),
    ).toBe(true);
    expect(
      canTransition(TicketStatus.WaitingOnUser, TicketStatus.InProgress),
    ).toBe(true);
    expect(
      canTransition(TicketStatus.InProgress, TicketStatus.WaitingOnInternal),
    ).toBe(true);
    expect(canTransition(TicketStatus.Resolved, TicketStatus.Open)).toBe(true);
  });

  it('rejects illegal jumps', () => {
    expect(canTransition(TicketStatus.Open, TicketStatus.Closed)).toBe(false);
    expect(canTransition(TicketStatus.Closed, TicketStatus.Open)).toBe(false);
    expect(canTransition(TicketStatus.Cancelled, TicketStatus.InProgress)).toBe(
      false,
    );
  });
});
