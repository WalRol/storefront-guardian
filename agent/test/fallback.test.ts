import { describe, expect, it } from 'vitest';
import { FallbackProvider, LlmError, type LlmProvider } from '../src/llm/provider';

function fake(model: string, behavior: () => void): LlmProvider & { calls: number } {
  return {
    name: 'fake',
    model,
    calls: 0,
    async complete() {
      this.calls++;
      behavior();
      return { text: model, inputTokens: 1, outputTokens: 1, latencyMs: 0 };
    },
  };
}

const req = { key: 'k', system: 's', prompt: 'p' };

describe('FallbackProvider', () => {
  it('pasa al siguiente modelo si uno está saturado y recuerda el que funcionó', async () => {
    const down = fake('a', () => {
      throw new LlmError('saturado', 503);
    });
    const up = fake('b', () => undefined);
    const chain = new FallbackProvider([down, up]);

    expect((await chain.complete(req)).text).toBe('b');
    expect((await chain.complete(req)).text).toBe('b');
    expect(chain.model).toBe('b');
    expect(down.calls).toBe(1);
  });

  it('no reintenta un modelo sin cuota hasta que pase el retryDelay', async () => {
    let failing = true;
    const quota = fake('a', () => {
      if (failing) throw new LlmError('{"retryDelay": "3600s"}', 429);
    });
    const backup = fake('b', () => {
      throw new LlmError('saturado', 503);
    });
    const chain = new FallbackProvider([quota, backup]);

    await expect(chain.complete(req)).rejects.toThrow();
    failing = false;
    await expect(chain.complete(req)).rejects.toThrow();
    expect(quota.calls).toBe(1);
  });

  it('propaga errores que no son de disponibilidad', async () => {
    const broken = fake('a', () => {
      throw new LlmError('bad request', 400);
    });
    const chain = new FallbackProvider([broken, fake('b', () => undefined)]);
    await expect(chain.complete(req)).rejects.toThrow('bad request');
  });
});
