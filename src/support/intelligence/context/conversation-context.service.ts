import { Injectable } from '@nestjs/common';
import {
  emptyContext,
  readContext,
  type ConversationContextState,
} from './conversation-context.js';

@Injectable()
export class ConversationContextService {
  empty(): ConversationContextState {
    return emptyContext();
  }

  read(raw: unknown): ConversationContextState {
    return readContext(raw);
  }
}
