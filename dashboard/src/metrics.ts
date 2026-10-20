import type { DashboardData, EvalResult, Finding, Severity, Source, Verdict } from './types';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Mismas métricas que eval/results/*.md, calculadas sobre una corrida. */
export function summarize(results: EvalResult[]) {
  const bugs = results.filter((r) => r.isBug);
  const clean = results.filter((r) => !r.isBug);
  const blocking = bugs.filter((r) => r.expectedVerdict === 'BLOCK');
  const ok = results.filter((r) => r.verdict !== 'ERROR');
  const byLayer = (layer: string) => bugs.filter((r) => r.detectedBy.includes(layer)).length;
  return {
    total: results.length,
    bugs: bugs.length,
    detected: bugs.filter((r) => r.detected).length,
    byTests: byLayer('tests'),
    byRules: bugs.filter((r) => r.detectedBy.some((l) => l === 'static' || l === 'secrets')).length,
    byLlm: byLayer('llm'),
    correctVerdicts: results.filter((r) => r.verdict === r.expectedVerdict).length,
    blocking: blocking.length,
    blocked: blocking.filter((r) => r.verdict === 'BLOCK').length,
    clean: clean.length,
    cleanApproved: clean.filter((r) => r.verdict === 'APPROVE').length,
    falsePositives: results.reduce((s, r) => s + r.falsePositives, 0),
    fixesValidated: blocking.filter((r) => r.fixValidated).length,
    avgSeconds: avg(ok.map((r) => r.seconds)),
    maxSeconds: Math.max(0, ...ok.map((r) => r.seconds)),
    avgCost: avg(ok.map((r) => r.costUsd)),
  };
}

export function overview(data: DashboardData) {
  const minutesSaved = data.cases.reduce((s, c) => s + c.minutesSaved, 0);
  return {
    real: summarize(data.evalRuns.gemini),
    baseline: summarize(data.evalRuns.none),
    noContext: summarize(data.evalRuns.noContext),
    minutesSaved,
    findings: data.cases.flatMap((c) => c.report.findings),
    fixes: data.cases.flatMap((c) => c.report.fixes),
    verdicts: countBy(data.cases.map((c) => c.report.decision.verdict)),
  };
}

export function countBy<T extends string>(xs: T[]): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  APPROVE: 'Aprobado',
  REVIEW: 'Revisión humana',
  BLOCK: 'Bloqueado',
};

export const VERDICT_HINT: Record<Verdict, string> = {
  APPROVE: 'Puede avanzar',
  REVIEW: 'Requiere criterio de un desarrollador',
  BLOCK: 'No debe avanzar',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

export const SOURCE_LABEL: Record<Source | 'tests', string> = {
  tests: 'Tests',
  secrets: 'Secretos',
  static: 'Regla',
  llm: 'IA',
};

export const CATEGORY_LABEL: Record<string, string> = {
  security: 'Seguridad',
  secrets: 'Secretos',
  authz: 'Autorización',
  money: 'Dinero',
  inventory: 'Stock',
  performance: 'Performance',
  logic: 'Lógica',
  quality: 'Calidad',
};

export const isDeterministic = (f: Finding) => f.source !== 'llm';

export const fmtSeconds = (s: number) => `${s.toFixed(s < 10 ? 1 : 0)} s`;
export const fmtUsd = (n: number) => `US$ ${n.toFixed(4)}`;
export const fmtInt = (n: number) => n.toLocaleString('es-AR');
