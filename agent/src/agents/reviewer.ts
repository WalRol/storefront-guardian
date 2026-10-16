import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { redactSecrets } from '../checks/secrets';
import type { ChangedFile } from '../diff';
import type { LlmProvider } from '../llm';
import type { Meter } from '../meter';
import { CATEGORIES, SEVERITIES, type CheckResult, type Finding } from '../types';
import { completeJson } from './json';

const SYSTEM = `Eres un revisor de código senior en un equipo que mantiene varias tiendas online (storefronts) de e-commerce.
Revisas un Pull Request y reportas SOLO problemas reales introducidos por el diff: bugs, riesgos de seguridad,
errores con dinero o stock, fallas de autorización y problemas de performance relevantes.

Reglas:
- No reportes estilo, nombres, formato ni mejoras opcionales.
- Si el PR está bien, devuelve "findings": []. Un falso positivo le cuesta tiempo al equipo y erosiona la confianza en la herramienta.
- No confíes en la descripción del PR: verifica que el código haga lo que dice.
- Respeta las convenciones del equipo que se incluyen en el mensaje.
- No repitas hallazgos que ya detectaron las herramientas determinísticas.
- Escribe title, explanation y suggestion en español, concretos y accionables.

Severidad:
- critical: explotable o con pérdida de dinero/datos en producción.
- high: bug que afecta a clientes o al negocio.
- medium: riesgo o degradación que merece revisión humana.
- low: menor.

Responde únicamente con JSON con este formato:
{"findings":[{"severity":"critical|high|medium|low","category":"${CATEGORIES.join('|')}","file":"ruta/del/archivo","line":123,"title":"...","explanation":"por qué es un problema y qué impacto tiene","suggestion":"cómo corregirlo","confidence":0.0}]}`;

const responseSchema = z.object({
  findings: z.array(
    z.object({
      severity: z.enum(SEVERITIES),
      category: z.enum(CATEGORIES).catch('quality'),
      file: z.string(),
      line: z.number().int().nullish(),
      title: z.string(),
      explanation: z.string(),
      suggestion: z.string().nullish(),
      confidence: z.number().min(0).max(1).catch(0.5),
    }),
  ),
});

export interface ReviewInput {
  key: string;
  title: string;
  body: string;
  diff: string;
  changedFiles: ChangedFile[];
  workDir: string;
  context: string;
  checks: CheckResult[];
  deterministic: Finding[];
  maxContextChars: number;
}

const withLineNumbers = (content: string) =>
  content
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4)}| ${line}`)
    .join('\n');

/** Arma el prompt priorizando lo más útil dentro del presupuesto de caracteres. */
export function buildReviewPrompt(input: ReviewInput): { prompt: string; redactions: number } {
  const parts: string[] = [];
  parts.push(`# Pull Request\nTítulo: ${input.title}\nDescripción: ${input.body || '(sin descripción)'}`);
  if (input.context) parts.push(`# Convenciones del equipo\n${input.context}`);

  const failing = input.checks.filter((c) => !c.ok);
  parts.push(
    failing.length === 0
      ? '# Chequeos automáticos\nTypecheck y tests pasan.'
      : `# Chequeos automáticos que FALLAN\n${failing.map((c) => `## ${c.name}\n${c.output}`).join('\n')}`,
  );
  if (input.deterministic.length > 0) {
    parts.push(
      `# Ya detectado por herramientas determinísticas (no repetir)\n${input.deterministic
        .map((f) => `- ${f.file}:${f.line} ${f.title}`)
        .join('\n')}`,
    );
  }
  parts.push(`# Diff\n\`\`\`diff\n${input.diff}\n\`\`\``);

  // Contenido completo de los archivos modificados, mientras entre en el presupuesto.
  let budget = input.maxContextChars - parts.join('\n\n').length;
  for (const file of input.changedFiles) {
    if (file.deleted) continue;
    const abs = path.join(input.workDir, file.path);
    if (!fs.existsSync(abs)) continue;
    const block = `# Archivo completo: ${file.path}\n\`\`\`\n${withLineNumbers(fs.readFileSync(abs, 'utf8'))}\n\`\`\``;
    if (block.length > budget) {
      parts.push(`# Archivo ${file.path} omitido por tamaño`);
      continue;
    }
    parts.push(block);
    budget -= block.length;
  }

  // Ningún secreto sale de la máquina, aunque el PR lo contenga.
  const { text, count } = redactSecrets(parts.join('\n\n'));
  return { prompt: text, redactions: count };
}

export async function review(
  input: ReviewInput,
  provider: LlmProvider,
  meter: Meter,
): Promise<{ findings: Finding[]; redactions: number }> {
  const { prompt, redactions } = buildReviewPrompt(input);
  const result = await completeJson(provider, meter, { key: input.key, system: SYSTEM, prompt }, responseSchema);
  const changed = new Set(input.changedFiles.map((f) => f.path));

  const findings: Finding[] = result.findings
    // Descarta hallazgos sobre archivos que el PR no toca (alucinaciones típicas).
    .filter((f) => changed.has(f.file))
    .map((f, i) => ({
      id: `llm-${i + 1}`,
      source: 'llm',
      severity: f.severity,
      category: f.category,
      file: f.file,
      line: f.line ?? undefined,
      title: f.title,
      explanation: f.explanation,
      suggestion: f.suggestion ?? undefined,
      confidence: f.confidence,
    }));
  return { findings, redactions };
}

/** Si un hallazgo del LLM coincide con uno determinístico, se queda el determinístico. */
export function dedupe(deterministic: Finding[], llm: Finding[]): Finding[] {
  const isDuplicate = (f: Finding) =>
    deterministic.some(
      (d) =>
        d.file === f.file &&
        (d.category === f.category || (d.category === 'secrets' && f.category === 'security')) &&
        Math.abs((d.line ?? 0) - (f.line ?? 0)) <= 5,
    );
  return [...deterministic, ...llm.filter((f) => !isDuplicate(f))];
}
