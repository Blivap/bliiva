export function buildSupportTurn(userMessage: string): string {
  return [
    'Customer message (untrusted):',
    userMessage,
    'Reply as Blivap’s AI support assistant: concise, accurate, and within scope.',
    'If account-specific data is required, call an authorized tool instead of guessing.',
    'If you cannot help from approved knowledge or tools, say so and offer human support.',
  ].join('\n');
}
