import fs from 'node:fs';
import path from 'node:path';
import { git } from './exec';
import { createProvider } from './llm';
import { runPipeline } from './pipeline';
import { loadPolicy } from './policy';
import { equivalentCostUsd } from './report';

/**
 * Genera los datos del dashboard: corre cada caso del eval en modo replay
 * (respuestas grabadas de Gemini; typecheck, tests y validación rojo → verde
 * se ejecutan de verdad) y lo combina con las métricas de las corridas reales.
 *
 * Los tiempos y costos que muestra el dashboard salen de eval/results/gemini.json:
 * en replay no hay latencia del modelo y los tiempos no serían representativos.
 */
async function main() {
  const repoDir = (await git(['rev-parse', '--show-toplevel'], process.cwd())).trim();
  const policy = loadPolicy(path.join(repoDir, 'guardian.policy.yaml'));
  const provider = createProvider('replay', {
    cassetteDir: path.join(repoDir, 'agent', 'cassettes', 'eval'),
    record: false,
  });

  const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(repoDir, file), 'utf8'));
  const evalRuns = {
    gemini: readJson('eval/results/gemini.json'),
    none: readJson('eval/results/none.json'),
    noContext: readJson('eval/results/gemini-sin-contexto.json'),
  };
  const real = new Map(evalRuns.gemini.map((r: { id: string }) => [r.id, r]));

  const casesDir = path.join(repoDir, 'eval', 'cases');
  const ids = fs.readdirSync(casesDir).sort();
  const cases = [];

  for (const id of ids) {
    const c = JSON.parse(fs.readFileSync(path.join(casesDir, id, 'case.json'), 'utf8'));
    process.stderr.write(`› ${id} … `);
    const report = await runPipeline({
      repoDir,
      base: 'HEAD',
      patch: path.join(casesDir, id, 'change.patch'),
      title: c.title,
      body: c.body,
      label: id,
      policy,
      provider,
      fix: true,
    });
    console.error(report.decision.verdict);
    const fixesValidated = report.fixes.filter((f) => f.status === 'validated').length;
    cases.push({
      id,
      title: c.title,
      body: c.body,
      expected: c.expected,
      diff: fs.readFileSync(path.join(casesDir, id, 'change.patch'), 'utf8'),
      report: { ...report, costUsd: equivalentCostUsd(report, policy) },
      real: real.get(id) ?? null,
      minutesSaved: policy.value.reviewMinutes + fixesValidated * policy.value.fixMinutes,
    });
  }

  const out = path.join(repoDir, 'dashboard', 'public', 'data.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const data = {
    generatedAt: new Date().toISOString(),
    policy: { value: policy.value, pricing: policy.pricing, gate: policy.gate },
    evalRuns,
    cases,
  };
  fs.writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
  console.error(`› Datos del dashboard en ${path.relative(repoDir, out)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
