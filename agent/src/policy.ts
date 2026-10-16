import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { CATEGORIES, SEVERITIES } from './types';

const severity = z.enum(SEVERITIES);

const policySchema = z.object({
  project: z.object({
    /** Carpeta del proyecto a revisar, relativa a la raíz del repo. */
    dir: z.string(),
    install: z.string().default('npm ci'),
    typecheck: z.string(),
    test: z.string(),
    /** Corre un solo archivo de test. `{file}` se reemplaza por la ruta relativa a `dir`. */
    testFile: z.string(),
    /** Archivo de test que el corrector toma como ejemplo de estilo. */
    testExample: z.string().optional(),
  }),
  /** Reglas y convenciones del equipo que el revisor debe conocer. */
  contextFile: z.string().optional(),
  review: z
    .object({
      /** Límite de caracteres enviados al modelo (controla costo y latencia). */
      maxContextChars: z.number().default(60_000),
      minConfidence: z.number().min(0).max(1).default(0.6),
    })
    .default({}),
  fix: z
    .object({
      enabled: z.boolean().default(true),
      severities: z.array(severity).default(['critical', 'high']),
      skipCategories: z.array(z.enum(CATEGORIES)).default(['performance']),
      maxAttempts: z.number().int().min(1).max(5).default(2),
      maxFixes: z.number().int().min(0).default(3),
    })
    .default({}),
  gate: z
    .object({
      blockOn: z
        .object({
          typecheckFail: z.boolean().default(true),
          testsFail: z.boolean().default(true),
          severities: z.array(severity).default(['critical', 'high']),
        })
        .default({}),
      reviewOn: z.object({ severities: z.array(severity).default(['medium']) }).default({}),
    })
    .default({}),
  /** Precios de referencia (USD por millón de tokens) para estimar el costo equivalente pago. */
  pricing: z
    .object({ inputPerMTok: z.number().default(0.3), outputPerMTok: z.number().default(2.5) })
    .default({}),
});

export type Policy = z.infer<typeof policySchema>;

export function loadPolicy(file: string): Policy {
  const raw = parse(fs.readFileSync(file, 'utf8'));
  return policySchema.parse(raw);
}

export function loadContext(policy: Policy, repoDir: string): string {
  if (!policy.contextFile) return '';
  const file = path.join(repoDir, policy.contextFile);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
