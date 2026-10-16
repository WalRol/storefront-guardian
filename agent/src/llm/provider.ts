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

export class LlmError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

/**
 * Prueba varios proveedores/modelos en orden. Si uno no está disponible
 * (saturado, retirado o sin cuota), pasa al siguiente. Los tiers gratuitos
 * cambian seguido: la cadena evita que el sistema se caiga por eso.
 */
export class FallbackProvider implements LlmProvider {
  /** Índice del último modelo que respondió: las siguientes llamadas empiezan por él. */
  private active = 0;

  constructor(private chain: LlmProvider[]) {}

  get name() {
    return this.chain[this.active].name;
  }
  get model() {
    return this.chain[this.active].model;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    let lastError: unknown;
    const order = [...this.chain.keys()].map((i) => (this.active + i) % this.chain.length);
    for (const index of order) {
      const provider = this.chain[index];
      try {
        const res = await provider.complete(req);
        this.active = index;
        return res;
      } catch (err) {
        const unavailable = err instanceof LlmError && [404, 429, 503].includes(err.status ?? 0);
        if (!unavailable) throw err;
        console.error(`› ${provider.name}/${provider.model} no disponible (HTTP ${err.status}); probando el siguiente…`);
        lastError = err;
      }
    }
    throw lastError;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST JSON con un reintento corto ante 429/5xx. Los reintentos largos no
 * convienen: si un modelo está saturado es más rápido pasar al siguiente de
 * la cadena (FallbackProvider) que esperarlo.
 */
export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  { retries = 1, timeoutMs = 120_000 } = {},
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
      throw new LlmError(`HTTP ${res.status} de ${new URL(url).host}: ${detail}`, res.status);
    }
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 3000);
  }
}
