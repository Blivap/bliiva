import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AiSettingsService } from '../ai/ai-settings.service.js';
import { LlmService } from './llm.service.js';
import { LlmError } from './llm.types.js';

export interface LlmProbeStatus {
  ok: boolean;
  utilized: boolean;
  reason: string;
  provider: string;
  model: string;
  baseUrl: string;
  checkedAt: string | null;
  message: string;
}

/**
 * On boot, verify whether the self-hosted LLM is actually usable.
 * Failures only log inside the API — Compose `stack-check` fails the deploy.
 */
@Injectable()
export class LlmStartupProbeService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LlmStartupProbeService.name);
  private last: LlmProbeStatus | null = null;
  private inflight: Promise<LlmProbeStatus> | null = null;

  constructor(
    private readonly settings: AiSettingsService,
    private readonly llm: LlmService,
  ) {}

  onApplicationBootstrap(): void {
    this.inflight = this.probe().finally(() => {
      this.inflight = null;
    });
    void this.inflight.catch((error: unknown) => {
      this.logger.warn(
        `LLM startup probe crashed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    });
  }

  /**
   * Readiness for `/health/llm` and Compose stack-check.
   * Waits for the in-flight boot probe when present.
   */
  async readiness(): Promise<LlmProbeStatus> {
    if (this.inflight) {
      return this.inflight;
    }
    if (this.last) {
      return this.last;
    }
    return this.probe();
  }

  lastStatus(): LlmProbeStatus | null {
    return this.last;
  }

  /** Exposed for tests and boot. */
  async probe(): Promise<LlmProbeStatus> {
    const llm = this.settings.current().llm;
    const base = {
      provider: llm.provider,
      model: llm.model,
      baseUrl: safeBaseUrl(llm.baseUrl),
      checkedAt: new Date().toISOString(),
    };

    if (!llm.enabled) {
      const status: LlmProbeStatus = {
        ...base,
        ok: false,
        utilized: false,
        reason: 'llm_disabled',
        message:
          'LLM is not utilized — LLM_ENABLED=false. Support will use the rules engine only.',
      };
      this.last = status;
      this.logger.warn(status.message);
      return status;
    }

    this.logger.log(
      `LLM startup probe — checking ${llm.provider} model ${llm.model} at ${base.baseUrl}…`,
    );

    const health = await this.llm.health();
    if (!health.ok) {
      const status: LlmProbeStatus = {
        ...base,
        ok: false,
        utilized: true,
        reason: 'health_failed',
        message: `LLM is not ready — ${health.message} (reachable=${health.runtimeReachable}, modelAvailable=${health.modelAvailable}). Chat will fall back until the model responds.`,
      };
      this.last = status;
      this.logger.warn(status.message);
      return status;
    }

    try {
      const started = Date.now();
      const response = await this.llm.chat({
        messages: [
          {
            role: 'user',
            content: 'Reply with the single word OK.',
          },
        ],
        maxOutputTokens: 16,
      });
      const content = response.message.content?.trim() ?? '';
      if (!content) {
        const status: LlmProbeStatus = {
          ...base,
          ok: false,
          utilized: true,
          reason: 'empty_reply',
          message:
            'LLM health looked OK but the probe chat returned an empty reply. Chat may fall back until the model works.',
        };
        this.last = status;
        this.logger.warn(status.message);
        return status;
      }

      const status: LlmProbeStatus = {
        ...base,
        ok: true,
        utilized: true,
        reason: 'ok',
        checkedAt: new Date().toISOString(),
        message: `LLM startup probe OK — model=${response.model} durationMs=${Date.now() - started} reply=${JSON.stringify(content.slice(0, 80))}`,
      };
      this.last = status;
      this.logger.log(status.message);
      return status;
    } catch (error) {
      const code = error instanceof LlmError ? error.code : 'unknown';
      const errMessage = error instanceof Error ? error.message : 'unknown';
      const status: LlmProbeStatus = {
        ...base,
        ok: false,
        utilized: true,
        reason: 'chat_failed',
        message: `LLM probe chat failed (${code}): ${errMessage}. Chat will fall back until the model works.`,
      };
      this.last = status;
      this.logger.warn(status.message);
      return status;
    }
  }
}

function safeBaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '(invalid LLM_BASE_URL)';
  }
}
