export interface LlmRequest {
  /** Clave lógica y estable de la llamada (p. ej. "<diff-hash>/review/0"); usada por el modo replay. */
  key: string;
  system: string;
  prompt: string;
}

export interface LlmResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface LlmProvider {
  name: string;
  model: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}

export class LlmError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST JSON con reintentos ante 429/5xx. Los tiers gratuitos tienen límites
 * de requests por minuto bajos, así que esperar y reintentar es parte normal
 * del funcionamiento, no un caso excepcional.
 */
export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  { retries = 4, timeoutMs = 120_000 } = {},
): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return res.json();

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= retries) {
      const detail = (await res.text()).slice(0, 500);
      throw new LlmError(`HTTP ${res.status} de ${new URL(url).host}: ${detail}`);
    }
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 5000);
  }
}
