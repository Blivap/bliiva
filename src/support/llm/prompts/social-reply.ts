/**
 * Shape for greetings, thanks, ok, and bye.
 * The model still writes the reply. This is the rule it has to follow.
 * The same text is the fallback when the model is unavailable.
 */

export type SocialTurn = 'greeting' | 'thanks' | 'ok' | 'bye' | 'identity';

const MENU = [
  '- 👤 **Account:** sign-up, sign-in, password, verification',
  '- 🩸 **Donations:** becoming a donor, bookings, meetups',
  '- 💳 **Wallet:** top-ups, withdrawals, bank accounts',
  '- 🙋 **Something else?** I can connect you to our team',
].join('\n');

export function renderSocialReply(
  kind: SocialTurn,
  firstName: string | null,
): string {
  const name = firstName?.trim() || null;
  if (kind === 'identity') {
    return [
      "I'm **Bliiva** 🩸, Blivap's support assistant.",
      '',
      'I can help you with:',
      MENU,
      '',
      'What would you like help with today?',
    ].join('\n');
  }
  if (kind === 'greeting') {
    const hello = name ? `Hi ${name}!` : 'Hi there!';
    return [
      `${hello} 👋 I'm **Bliiva** 🩸, Blivap's support assistant.`,
      '',
      'I can help you with:',
      MENU,
      '',
      'What would you like help with today?',
    ].join('\n');
  }
  if (kind === 'thanks') {
    return [
      "You're welcome! 💚",
      '',
      'I can still help with:',
      MENU,
      '',
      'What else should we look at?',
    ].join('\n');
  }
  if (kind === 'ok') {
    return [
      'Got it 😊',
      '',
      "Whenever you're ready, I can help with:",
      MENU,
      '',
      'What would you like to do next?',
    ].join('\n');
  }
  return [
    'Bye for now 💚',
    '',
    'Come back anytime for:',
    MENU,
    '',
    'Take care.',
  ].join('\n');
}

export function socialReplyGuide(
  kind: SocialTurn,
  firstName: string | null,
): string {
  const name = firstName?.trim() || null;
  return [
    'REPLY SHAPE — write the customer reply in this shape.',
    'Keep the **bold** markers, emoji, and bullet lines.',
    kind === 'identity'
      ? 'They asked who you are. Answer with your name. Do not say you are not sure.'
      : kind === 'bye'
        ? 'End with "Take care." Do not add a question.'
        : 'End with exactly one question. Do not add a second question.',
    name
      ? `Their first name is ${name}. Use it in the first line when the shape does.`
      : 'No first name is available. Do not invent one.',
    'Do not say an action was completed.',
    '',
    renderSocialReply(kind, name),
  ].join('\n');
}

export function socialTurnOf(
  normalized: string,
  signals: {
    greeting: boolean;
    softAck: boolean;
    closing: boolean;
    botIdentityAsk: boolean;
    greetingRemainder: string | null;
    smallTalkOffTopic: boolean;
  },
): SocialTurn | null {
  if (signals.greetingRemainder || signals.smallTalkOffTopic) {
    return null;
  }
  if (signals.botIdentityAsk) return 'identity';
  if (signals.greeting) return 'greeting';
  if (signals.softAck) return 'ok';
  if (!signals.closing) return null;
  if (
    /^(thanks|thank you|thank you very much|ok thanks|okay thanks)$/.test(
      normalized,
    )
  ) {
    return 'thanks';
  }
  return 'bye';
}
