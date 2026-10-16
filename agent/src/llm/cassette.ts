import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from './provider';

interface Cassette {
  key: string;
  provider: string;
  model: string;
  promptSha256: string;
  response: LlmResponse;
}

const fileFor = (dir: string, key: string) =>
  path.join(dir, `${key.replace(/[^a-zA-Z0-9._-]+/g, '_')}.json`);

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** Envuelve un proveedor real y guarda cada respuesta para poder reproducirla sin red ni API key. */
export class RecordingProvider implements LlmProvider {
  constructor(
    private inner: LlmProvider,
    private dir: string,
  ) {}

  get name() {
    return this.inner.name;
  }
  get model() {
    return this.inner.model;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const response = await this.inner.complete(req);
    const cassette: Cassette = {
      key: req.key,
      provider: this.inner.name,
      model: this.inner.model,
      promptSha256: sha256(req.system + req.prompt),
      response,
    };
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(fileFor(this.dir, req.key), JSON.stringify(cassette, null, 2) + '\n');
    return response;
  }
}

/** Reproduce respuestas grabadas. Permite correr la demo y el eval completos sin costo ni red. */
export class ReplayProvider implements LlmProvider {
  name = 'replay';
  model = 'grabado';

  constructor(private dir: string) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const file = fileFor(this.dir, req.key);
    if (!fs.existsSync(file)) {
      throw new LlmError(
        `No hay respuesta grabada para "${req.key}". Graba una corrida con --record usando un proveedor real.`,
      );
    }
    const cassette = JSON.parse(fs.readFileSync(file, 'utf8')) as Cassette;
    this.model = `${cassette.provider}/${cassette.model} (grabado)`;
    if (cassette.promptSha256 !== sha256(req.system + req.prompt)) {
      console.warn(`⚠ replay: el prompt de "${req.key}" cambió desde la grabación; se usa la respuesta grabada igual.`);
    }
    return { ...cassette.response, latencyMs: 0 };
  }
}
