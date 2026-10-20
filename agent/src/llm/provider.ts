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
  /** Modelos sin cuota: no se reintentan hasta este instante (ms). */
  private cooldownUntil = new Map<number, number>();

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
      if ((this.cooldownUntil.get(index) ?? 0) > Date.now()) continue;
      try {
        const res = await provider.complete(req);
        this.active = index;
        return res;
      } catch (err) {
        const unavailable = err instanceof LlmError && [404, 429, 503, 504].includes(err.status ?? 0);
        if (!unavailable) throw err;
        if (err.status === 429) {
          // Cuota agotada: respetar el retryDelay que informa la API (puede ser horas en cuotas diarias).
          const delay = Number(/"retryDelay":\s*"(\d+)s"/.exec(err.message)?.[1] ?? 60);
          this.cooldownUntil.set(index, Date.now() + delay * 1000);
        }
        console.error(`› ${provider.name}/${provider.model} no disponible (HTTP ${err.status}); probando el siguiente…`);
        lastError = err;
      }
    }
    throw lastError ?? new LlmError('Todos los modelos de la cadena están sin cuota por ahora', 429);
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
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Timeout o red caída: como un 504, para que la cadena pase al siguiente modelo.
      const reason = err instanceof Error && err.name === 'TimeoutError' ? `sin respuesta en ${timeoutMs / 1000} s` : String(err);
      throw new LlmError(`${new URL(url).host}: ${reason}`, 504);
    }
    if (res.ok) return res.json();

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= retries) {
      const detail = (await res.text()).slice(0, 2000);
      throw new LlmError(`HTTP ${res.status} de ${new URL(url).host}: ${detail}`, res.status);
    }
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 3000);
  }
}
