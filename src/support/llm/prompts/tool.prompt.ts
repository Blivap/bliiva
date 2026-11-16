/**
 * Tool guidance for the model. Real tool names stay on the request's tool
 * list (at most three per turn) and are not repeated here.
 */
export function buildToolPrompt(): string {
  return [
    'Use only the provided tools for this turn. At most three tools are attached. Do not invent tool names, endpoints, or results.',
    'The signed-in user is supplied by the server. Never pass a user id.',
    'For live account data, call one of the provided tools in this turn and answer from the result.',
    'Before any change, state exactly what will happen and wait for a clear yes. OTP or payment-reference pastes continue an action the user already started.',
    'Never ask for or repeat passwords, card numbers, or PINs. Ask for an OTP only when an active action flow requires it.',
    'Do not call tools for idle acks (ok, alright, thanks) or off-topic chat.',
    'After a tool returns, reply in a few short sentences: what you found, then one clear next step. Never include reasoning or tool-choice notes.',
    'On one failure, say so and suggest retry. If it keeps failing, ask whether they want a human specialist — wait for yes before treating it as escalated.',
    'Prefer the provided tools for live account ops and the KNOWLEDGE NOTES for how-to. Never invent policy.',
  ].join('\n');
}
