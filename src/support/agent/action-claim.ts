/**
 * The model must not announce a completed mutation unless a tool in this
 * turn actually succeeded. Reads (get_/list_) do not confirm a delete,
 * cancel, refund, or transfer.
 */
const CLAIMS_DONE =
  /\b(has|have|been|is now|was)\b.*\b(deleted|cancel(l)?ed|closed|removed|updated|submitted|transferred|refunded|withdrawn)\b/i;

const DENIAL =
  /\b(not|no|never|cannot|can't|unable|didn't|did not|won't|will not)\b/i;

export function claimsCompletedAction(reply: string): boolean {
  const match = CLAIMS_DONE.exec(reply);
  if (!match || match.index === undefined) return false;
  const start = Math.max(0, match.index - 24);
  const window = reply.slice(start, match.index + match[0].length);
  return !DENIAL.test(window);
}

/** A successful read does not prove a mutation finished. */
export function toolConfirmsCompletion(name: string): boolean {
  return !/^(get_|list_)/.test(name);
}
