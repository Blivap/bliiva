import { LlmError } from './llm.types.js';

/** Rejects extra inference calls instead of queueing an unbounded backlog. */
export class LlmLimiter {
  private active = 0;

  constructor(private readonly limit: number) {}

  tryAcquire(): boolean {
    if (this.active >= this.limit) return false;
    this.active += 1;
    return true;
  }

  acquire(): void {
    if (!this.tryAcquire()) {
      throw new LlmError(
        'The support model is already handling the maximum number of requests.',
        'busy',
      );
    }
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
  }
}
