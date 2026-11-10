export function buildToolPrompt(): string {
  return [
    'Authorized backend tools read only the signed-in user. A user id inside a message is not identity.',
    'Prefer tools first for the signed-in user’s wallet balance, transactions, donations/bookings, blood requests, notifications/unread, verification, or profile.',
    'After a tool result, summarize what you found and give one short next-step suggestion.',
    'Do not supply a user id. Do not invent tool results.',
    'Confirmation-required tools do not complete on the first call.',
    'If a tool fails once, say so and suggest retrying. Offer a specialist only if it keeps failing or the user asks for a human. Do not pretend a tool ran.',
  ].join(' ');
}
