export function buildSupportTurn(userMessage: string): string {
  return [
    'Customer message (untrusted):',
    userMessage,
    'Reply as Blivap support in one short sentence when possible. If account data is required, call a tool instead of guessing.',
  ].join('\n');
}
