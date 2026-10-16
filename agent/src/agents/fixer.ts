import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { runCheck, runProjectChecks } from '../checks/project';
import { redactSecrets, scanSecrets } from '../checks/secrets';
import { parseDiff } from '../diff';
import { git, tail } from '../exec';
import type { LlmProvider } from '../llm';
import type { Meter } from '../meter';
import type { Policy } from '../policy';
import type { Finding, FixResult } from '../types';
import type { Workspace } from '../workspace';
import { completeJson } from './json';

const SYSTEM = `Eres un ingeniero senior que corrige bugs en un e-commerce escrito en TypeScript.
Recibes un problema detectado en un Pull Request y debes:
1. Corregirlo con el cambio MÍNIMO necesario, sin refactors ni cambios de estilo.
2. Escribir un test de regresión que FALLE con el código actual (con el bug) y PASE con tu corrección.
   El test debe verificar el comportamiento observable (respuesta HTTP, resultado de una función),
   usando el mismo estilo, imports y helpers que el test de ejemplo.

Responde únicamente con JSON:
{"explanation":"qué cambiaste y por qué, en español","files":[{"path":"ruta/del/archivo","content":"contenido COMPLETO del archivo corregido"}],"test":"contenido COMPLETO del archivo de test de regresión"}`;

const SECRETS_SYSTEM = `Eres un ingeniero senior. El Pull Request introduce un secreto en el código fuente.
Reemplázalo por la lectura de una variable de entorno (process.env) con un nombre descriptivo, fallando
de forma explícita si no está definida. No cambies nada más.

Responde únicamente con JSON:
{"explanation":"qué cambiaste, en español","files":[{"path":"ruta/del/archivo","content":"contenido COMPLETO del archivo corregido"}],"test":""}`;

const responseSchema = z.object({
  explanation: z.string(),
  files: z.array(z.object({ path: z.string(), content: z.string() })).min(1),
  test: z.string().default(''),
});

interface FixContext {
  ws: Workspace;
  policy: Policy;
  provider: LlmProvider;
  meter: Meter;
  context: string;
  keyPrefix: string;
}

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

/** Un "rojo" válido es un fallo de aserción, no un error de compilación o de import. */
function isAssertionFailure(output: string): boolean {
  const assertion = /AssertionError|expected .+ to |toBe|toEqual|Expected:/i.test(output);
  const brokenTest = /Cannot find module|SyntaxError|Failed to load|Transform failed|is not exported/i.test(output);
  return assertion && !brokenTest;
}

export async function fixFinding(finding: Finding, ctx: FixContext): Promise<FixResult> {
  const { ws, policy } = ctx;
  const isSecret = finding.category === 'secrets';
  const projectDir = path.join(ws.dir, policy.project.dir);
  const testRel = `test/guardian-${finding.id}.test.ts`;
  const testAbs = path.join(projectDir, testRel);
  const exampleRel = policy.project.testExample;
  const allowed = new Set(parseDiff(ws.diff).map((f) => f.path));

  let feedback = '';
  for (let attempt = 1; attempt <= policy.fix.maxAttempts; attempt++) {
    await ws.reset();

    const fileContent = read(path.join(ws.dir, finding.file));
    const promptParts = [
      `# Problema detectado\n[${finding.severity}] ${finding.title}\nArchivo: ${finding.file}:${finding.line ?? '?'}\n${finding.explanation}\nSugerencia: ${finding.suggestion ?? '-'}`,
      ctx.context && `# Convenciones del equipo\n${ctx.context}`,
      `# Archivo actual: ${finding.file}\n\`\`\`ts\n${fileContent}\n\`\`\``,
      !isSecret && exampleRel &&
        `# Test de ejemplo (${policy.project.dir}/${exampleRel}); tu test irá en ${policy.project.dir}/${testRel}\n\`\`\`ts\n${read(path.join(projectDir, exampleRel))}\n\`\`\``,
      feedback && `# Tu intento anterior falló\n${feedback}\nCorrige el problema y vuelve a intentarlo.`,
    ];
    const { text: prompt } = redactSecrets(promptParts.filter(Boolean).join('\n\n'));

    let proposal: z.output<typeof responseSchema>;
    try {
      proposal = await completeJson(
        ctx.provider,
        ctx.meter,
        { key: `${ctx.keyPrefix}/fix/${finding.id}/${attempt}`, system: isSecret ? SECRETS_SYSTEM : SYSTEM, prompt },
        responseSchema,
      );
    } catch (err) {
      return { findingId: finding.id, status: 'failed', attempts: attempt, reason: String(err) };
    }

    // Guardarraíl: el corrector solo puede tocar archivos que ya modificaba el PR.
    const outOfScope = proposal.files.filter((f) => !allowed.has(f.path));
    if (outOfScope.length > 0) {
      feedback = `Modificaste archivos fuera del alcance del PR: ${outOfScope.map((f) => f.path).join(', ')}. Solo puedes modificar: ${[...allowed].join(', ')}.`;
      continue;
    }

    // ROJO: el test de regresión debe fallar sobre el código con el bug.
    if (!isSecret) {
      if (!proposal.test.trim()) {
        feedback = 'No incluiste el test de regresión.';
        continue;
      }
      fs.mkdirSync(path.dirname(testAbs), { recursive: true });
      fs.writeFileSync(testAbs, proposal.test);
      const red = await runCheck('tests', policy.project.testFile.replace('{file}', testRel), ws.dir, policy);
      if (red.ok) {
        feedback = 'El test de regresión PASA con el código actual (que tiene el bug): no reproduce el problema. Escribe un test que falle por el bug.';
        continue;
      }
      if (!isAssertionFailure(red.output)) {
        feedback = `El test de regresión no compila o no carga (no es un fallo de aserción):\n${red.output}`;
        continue;
      }
    }

    // VERDE: con la corrección, compila y pasa toda la suite (incluido el test nuevo).
    for (const file of proposal.files) fs.writeFileSync(path.join(ws.dir, file.path), file.content);
    const checks = await runProjectChecks(ws.dir, policy);
    const failed = checks.filter((c) => !c.ok);
    if (failed.length > 0) {
      feedback = failed.map((c) => `## ${c.name} falla\n${c.output}`).join('\n');
      continue;
    }

    if (isSecret) {
      const remaining = scanSecrets(parseDiff(await git(['diff', ws.baseSha], ws.dir)));
      if (remaining.some((f) => f.file === finding.file)) {
        feedback = 'El archivo todavía contiene el secreto.';
        continue;
      }
    }

    await git(['add', '-A', '--', policy.project.dir], ws.dir);
    const patch = await git(['diff', '--cached', 'HEAD'], ws.dir);
    await ws.reset();
    return { findingId: finding.id, status: 'validated', attempts: attempt, explanation: proposal.explanation, patch };
  }

  await ws.reset();
  return {
    findingId: finding.id,
    status: 'failed',
    attempts: policy.fix.maxAttempts,
    reason: `No se logró una corrección validada en ${policy.fix.maxAttempts} intentos. Último error:\n${tail(feedback, 15)}`,
  };
}

/** Elige qué hallazgos vale la pena intentar corregir según la política. */
export function selectFixable(findings: Finding[], policy: Policy): Finding[] {
  return findings
    .filter(
      (f) =>
        policy.fix.severities.includes(f.severity) &&
        !policy.fix.skipCategories.includes(f.category) &&
        f.confidence >= policy.review.minConfidence,
    )
    .slice(0, policy.fix.maxFixes);
}
