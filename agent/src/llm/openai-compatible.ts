import { LlmError, postJson, type LlmProvider, type LlmRequest, type LlmResponse } from './provider';

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Cualquier API compatible con el formato de chat de OpenAI: Groq, OpenAI,
 * Azure OpenAI, GitHub Models, etc. Cambiar de proveedor es cambiar la URL.
 */
export class OpenAICompatibleProvider implements LlmProvider {
  constructor(
    public name: string,
    private baseUrl: string,
    private apiKey: string,
    public model: string,
  ) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const started = Date.now();
    const data = (await postJson(
      `${this.baseUrl}/chat/completions`,
      {
        model: this.model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.prompt },
        ],
      },
      { Authorization: `Bearer ${this.apiKey}` },
    )) as ChatResponse;

    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) throw new LlmError(`${this.name} devolvió una respuesta vacía`);
    return {
      text,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  }
}
