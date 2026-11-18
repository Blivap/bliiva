export enum Priority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

/** @deprecated Prefer Priority.Medium — kept for callers that still say "normal". */
export const PriorityNormal = Priority.Medium;

export function normalizePriority(
  value: string | Priority | null | undefined,
): Priority {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  switch (raw) {
    case Priority.Low:
      return Priority.Low;
    case Priority.High:
      return Priority.High;
    case Priority.Urgent:
      return Priority.Urgent;
    case 'normal':
    case Priority.Medium:
      return Priority.Medium;
    default:
      return Priority.Medium;
  }
}
