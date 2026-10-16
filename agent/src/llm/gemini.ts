import { LlmError, postJson, type LlmProvider, type LlmRequest, type LlmResponse } from './provider';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

export class GeminiProvider implements LlmProvider {
  name = 'gemini';

  constructor(
    private apiKey: string,
    public model: string,
  ) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const started = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    const data = (await postJson(
      url,
      {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      },
      { 'x-goog-api-key': this.apiKey },
    )) as GeminiResponse;

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new LlmError('Gemini devolvió una respuesta vacía');
    const usage = data.usageMetadata ?? {};
    return {
      text,
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
      latencyMs: Date.now() - started,
    };
  }
}
