import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { git } from './exec';
import { createProvider, PROVIDERS, type ProviderName } from './llm';
import { runPipeline } from './pipeline';
import { loadPolicy } from './policy';
import { equivalentCostUsd } from './report';
import type { Category, Finding, RunReport, Verdict } from './types';

interface EvalCase {
  id: string;
  title: string;
  body: string;
  expected: { verdict: Verdict; findings: { category: Category; file: string }[] };
}

/**
 * Categorías aceptadas como equivalentes al evaluar. Un modelo puede llamar
 * "logic" a un error de cálculo de dinero y sigue siendo una detección válida.
 */
const ACCEPTED: Record<Category, Category[]> = {
  money: ['money', 'logic'],
  inventory: ['inventory', 'logic'],
  authz: ['authz', 'security'],
  security: ['security', 'authz'],
  secrets: ['secrets', 'security'],
  performance: ['performance'],
  logic: ['logic', 'money', 'inventory'],
  quality: ['quality'],
};

interface CaseResult {
  id: string;
  expectedVerdict: Verdict;
  verdict: Verdict | 'ERROR';
  isBug: boolean;
  detected: boolean;
  detectedBy: string[];
  /** Hallazgos medium+ que no corresponden a ningún bug esperado. */
  falsePositives: number;
  fixValidated: boolean | null;
  seconds: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  error?: string;
}

function matches(f: Finding, e: EvalCase['expected']['findings'][number]) {
  return f.file === e.file && ACCEPTED[e.category].includes(f.category);
}

function evaluate(c: EvalCase, report: RunReport, costUsd: number): CaseResult {
  const isBug = c.expected.findings.length > 0;
  const testsFailed = report.checks.some((ch) => ch.name === 'tests' && !ch.ok);

  const hits = report.findings.filter((f) => c.expected.findings.some((e) => matches(f, e)));
  const detectedBy = [...new Set(hits.map((f) => f.source))] as string[];
  if (isBug && testsFailed) detectedBy.unshift('tests');

  const relevant = report.findings.filter((f) => ['critical', 'high', 'medium'].includes(f.severity));
  const falsePositives = relevant.filter((f) => !hits.includes(f)).length;

  const fixValidated = isBug
    ? report.fixes.some((fx) => fx.status === 'validated' && hits.some((h) => h.id === fx.findingId))
    : null;

  return {
    id: c.id,
    expectedVerdict: c.expected.verdict,
    verdict: report.decision.verdict,
    isBug,
    detected: isBug && detectedBy.length > 0,
    detectedBy,
    falsePositives,
    fixValidated,
    seconds: report.totalMs / 1000,
    inputTokens: report.stages.reduce((s, m) => s + m.inputTokens, 0),
    outputTokens: report.stages.reduce((s, m) => s + m.outputTokens, 0),
    costUsd,
  };
}

const pct = (n: number, d: number) => (d === 0 ? '-' : `${Math.round((100 * n) / d)}% (${n}/${d})`);

function renderSummary(results: CaseResult[], providerLabel: string): string {
  const bugs = results.filter((r) => r.isBug);
  const clean = results.filter((r) => !r.isBug);
  const ok = results.filter((r) => r.verdict !== 'ERROR');
  const byLayer = (layer: string) => bugs.filter((r) => r.detectedBy.includes(layer)).length;
  const blockingBugs = bugs.filter((r) => r.expectedVerdict === 'BLOCK');
  const fixable = bugs.filter((r) => r.fixValidated !== null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const lines = [
    `# Resultados del eval — ${providerLabel}`,
    '',
    `Fecha: ${new Date().toISOString().slice(0, 10)} · Casos: ${results.length} (${bugs.length} con bugs, ${clean.length} limpios)`,
    '',
    '## Resumen',
    '| Métrica | Resultado |',
    '|---|---|',
    `| Bugs detectados (cualquier capa) | ${pct(bugs.filter((r) => r.detected).length, bugs.length)} |`,
    `| — detectados por tests existentes | ${pct(byLayer('tests'), bugs.length)} |`,
    `| — detectados por reglas determinísticas | ${pct(byLayer('static') + byLayer('secrets'), bugs.length)} |`,
    `| — detectados por revisión IA | ${pct(byLayer('llm'), bugs.length)} |`,
    `| Veredicto correcto (APPROVE/REVIEW/BLOCK) | ${pct(results.filter((r) => r.verdict === r.expectedVerdict).length, results.length)} |`,
    `| Bugs graves bloqueados | ${pct(blockingBugs.filter((r) => r.verdict === 'BLOCK').length, blockingBugs.length)} |`,
    `| PRs limpios aprobados | ${pct(clean.filter((r) => r.verdict === 'APPROVE').length, clean.length)} |`,
    `| Falsos positivos (medium+) en total | ${results.reduce((s, r) => s + r.falsePositives, 0)} |`,
    `| Bugs con fix validado rojo→verde | ${pct(fixable.filter((r) => r.fixValidated).length, blockingBugs.length)} |`,
    `| Tiempo promedio por PR | ${avg(ok.map((r) => r.seconds)).toFixed(1)} s (máx ${Math.max(0, ...ok.map((r) => r.seconds)).toFixed(1)} s) |`,
    `| Tokens promedio por PR (entrada/salida) | ${Math.round(avg(ok.map((r) => r.inputTokens)))} / ${Math.round(avg(ok.map((r) => r.outputTokens)))} |`,
    `| Costo equivalente en tier pago, promedio por PR | US$ ${avg(ok.map((r) => r.costUsd)).toFixed(4)} |`,
    '',
    '## Detalle por caso',
    '| Caso | Esperado | Obtenido | Detectado por | Fix validado | FP | Tiempo |',
    '|---|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.expectedVerdict} | ${r.verdict === r.expectedVerdict ? '✅' : '❌'} ${r.verdict} | ${r.detectedBy.join(', ') || '-'} | ${r.fixValidated === null ? '-' : r.fixValidated ? '✅' : '❌'} | ${r.falsePositives} | ${r.seconds.toFixed(1)} s |`,
    ),
  ];
  const errors = results.filter((r) => r.error);
  if (errors.length) lines.push('', '## Errores', ...errors.map((r) => `- ${r.id}: ${r.error}`));
  return lines.join('\n') + '\n';
}

async function main() {
  const { values } = parseArgs({
    options: {
      provider: { type: 'string' },
      record: { type: 'boolean', default: false },
      'no-fix': { type: 'boolean', default: false },
      only: { type: 'string' },
      'no-context': { type: 'boolean', default: false },
    },
  });

  const repoDir = (await git(['rev-parse', '--show-toplevel'], process.cwd())).trim();
  const envFile = path.join(repoDir, '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

  const providerName = (values.provider ?? process.env.GUARDIAN_PROVIDER ?? 'replay') as ProviderName;
  if (!PROVIDERS.includes(providerName)) throw new Error(`Proveedor inválido: ${providerName}`);
  const policy = loadPolicy(path.join(repoDir, 'guardian.policy.yaml'));
  if (values['no-context']) policy.contextFile = undefined;

  const variant = values['no-context'] ? '-sin-contexto' : '';
  const provider = createProvider(providerName, {
    cassetteDir: path.join(repoDir, 'agent', 'cassettes', `eval${variant}`),
    record: values.record,
  });

  const casesDir = path.join(repoDir, 'eval', 'cases');
  const ids = fs.readdirSync(casesDir).filter((id) => !values.only || id.includes(values.only)).sort();
  const results: CaseResult[] = [];

  for (const id of ids) {
    const c = JSON.parse(fs.readFileSync(path.join(casesDir, id, 'case.json'), 'utf8')) as EvalCase;
    process.stderr.write(`› ${id} … `);
    try {
      const report = await runPipeline({
        repoDir,
        base: 'HEAD',
        patch: path.join(casesDir, id, 'change.patch'),
        title: c.title,
        body: c.body,
        label: id,
        policy,
        provider,
        fix: !values['no-fix'],
      });
      const result = evaluate(c, report, equivalentCostUsd(report, policy));
      results.push(result);
      console.error(`${result.verdict} (esperado ${c.expected.verdict}) en ${result.seconds.toFixed(1)} s`);
    } catch (err) {
      const error = err instanceof Error ? err.message.split('\n')[0] : String(err);
      console.error(`ERROR: ${error}`);
      results.push({
        id, expectedVerdict: c.expected.verdict, verdict: 'ERROR', isBug: c.expected.findings.length > 0,
        detected: false, detectedBy: [], falsePositives: 0, fixValidated: null, seconds: 0,
        inputTokens: 0, outputTokens: 0, costUsd: 0, error,
      });
    }
  }

  const providerLabel = `${providerName}${provider ? ` (${provider.model})` : ''}${variant}`;
  const summary = renderSummary(results, providerLabel);
  const outDir = path.join(repoDir, 'eval', 'results');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${providerName}${variant}${values.only ? `-${values.only}` : ''}`);
  fs.writeFileSync(`${file}.md`, summary);
  fs.writeFileSync(`${file}.json`, JSON.stringify(results, null, 2));
  console.log(summary);
  console.error(`› Resultados en ${file}.md`);
}

main().catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
