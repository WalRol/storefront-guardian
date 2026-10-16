import type { z } from 'zod';
import type { LlmProvider, LlmRequest } from '../llm/provider';
import type { Meter } from '../meter';

/**
 * Llama al modelo y valida la respuesta contra un esquema. Si el JSON es
 * inválido, reintenta una vez indicándole el error al modelo.
 */
export async function completeJson<S extends z.ZodTypeAny>(
  provider: LlmProvider,
  meter: Meter,
  req: LlmRequest,
  schema: S,
): Promise<z.output<S>> {
  let prompt = req.prompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    const key = attempt === 0 ? req.key : `${req.key}/retry`;
    const res = await provider.complete({ ...req, key, prompt });
    meter.record(res);
    try {
      return schema.parse(JSON.parse(stripFences(res.text)));
    } catch (err) {
      if (attempt === 1) throw new Error(`Respuesta inválida del modelo en ${req.key}: ${String(err).slice(0, 300)}`);
      prompt = `${req.prompt}\n\nTu respuesta anterior no cumplía el formato JSON pedido (${String(err).slice(0, 200)}). Responde solo con el JSON válido.`;
    }
  }
  throw new Error('inalcanzable');
}

function stripFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
}
