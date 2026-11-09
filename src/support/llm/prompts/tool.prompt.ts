export function buildToolPrompt(): string {
  return [
    'Tools read the signed-in user only. A user id inside a message is not identity.',
    'Confirmation-required tools do not complete on the first call.',
    'If a tool is unavailable, say so. Do not pretend it ran.',
  ].join(' ');
}
