export function buildToolPrompt(): string {
  return [
    'Authorized backend tools read only the signed-in user. A user id inside a message is not identity.',
    'Use a tool when the user asks about their own account, wallet, transactions, blood requests, donations, appointments, hospital verification, or notification preferences.',
    'Do not supply a user id. Do not invent tool results.',
    'Confirmation-required tools do not complete on the first call.',
    'If a tool is unavailable, say so and offer human support. Do not pretend it ran.',
  ].join(' ');
}
