import { LlmError, postJson, type LlmProvider, type LlmRequest, type LlmResponse } from './provider';

interface OllamaResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

/** Modelo local: el código nunca sale de la máquina. */
export class OllamaProvider implements LlmProvider {
  name = 'ollama';

  constructor(
    private baseUrl: string,
    public model: string,
  ) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const started = Date.now();
    const data = (await postJson(
      `${this.baseUrl}/api/chat`,
      {
        model: this.model,
        stream: false,
        format: 'json',
        options: { temperature: 0.1, num_ctx: 16384 },
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.prompt },
        ],
      },
      {},
      { retries: 1, timeoutMs: 600_000 },
    )) as OllamaResponse;

    const text = data.message?.content ?? '';
    if (!text) throw new LlmError('Ollama devolvió una respuesta vacía');
    return {
      text,
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
      latencyMs: Date.now() - started,
    };
  }
}
