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
      /** Archivos (relativos a project.dir) que el corrector recibe como referencia, p. ej. esquema y datos semilla. */
      contextFiles: z.array(z.string()).default([]),
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
      /** Globs (desde la raíz del repo) que nunca se aprueban solos: como mínimo, van a revisión humana. */
      sensitivePaths: z.array(z.string()).default([]),
    })
    .default({}),
  /**
   * Supuestos para estimar el tiempo que el sistema le ahorra al equipo.
   * Son hipótesis a validar midiendo con el equipo real, no datos.
   */
  value: z
    .object({
      /** Minutos que un desarrollador dedica a la primera pasada de revisión de un PR. */
      reviewMinutes: z.number().default(15),
      /** Minutos para reproducir, corregir y escribir el test de un bug ya detectado. */
      fixMinutes: z.number().default(30),
    })
    .default({}),
  /** Precios de referencia (USD por millón de tokens) para estimar el costo equivalente pago. */
  pricing: z
    .object({ inputPerMTok: z.number().default(0.3), outputPerMTok: z.number().default(2.5) })
    .default({}),
});

export type Policy = z.infer<typeof policySchema>;

/** Ruta de la política, relativa a la raíz del repo. */
export const POLICY_FILE = 'guardian.policy.yaml';

export function loadPolicy(file: string): Policy {
  const raw = parse(fs.readFileSync(file, 'utf8'));
  return policySchema.parse(raw);
}

export function loadContext(policy: Policy, repoDir: string): string {
  if (!policy.contextFile) return '';
  const file = path.join(repoDir, policy.contextFile);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
