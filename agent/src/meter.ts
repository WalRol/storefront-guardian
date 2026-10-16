import type { LlmResponse } from './llm/provider';
import type { StageMetric } from './types';

/** Mide tiempo, llamadas y tokens por etapa del pipeline. */
export class Meter {
  readonly stages: StageMetric[] = [];
  private current?: StageMetric;

  async stage<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const metric: StageMetric = { stage: name, durationMs: 0, llmCalls: 0, inputTokens: 0, outputTokens: 0 };
    this.stages.push(metric);
    this.current = metric;
    const started = Date.now();
    try {
      return await fn();
    } finally {
      metric.durationMs = Date.now() - started;
      this.current = undefined;
    }
  }

  record(res: LlmResponse) {
    if (!this.current) return;
    this.current.llmCalls++;
    this.current.inputTokens += res.inputTokens;
    this.current.outputTokens += res.outputTokens;
  }
}
