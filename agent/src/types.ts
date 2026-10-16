export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CATEGORIES = [
  'security',
  'secrets',
  'authz',
  'money',
  'inventory',
  'performance',
  'logic',
  'quality',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Qué capa del pipeline produjo el hallazgo. */
export type Source = 'secrets' | 'static' | 'llm';

export interface Finding {
  id: string;
  source: Source;
  severity: Severity;
  category: Category;
  file: string;
  line?: number;
  title: string;
  explanation: string;
  suggestion?: string;
  /** 0..1. Los hallazgos determinísticos siempre tienen 1. */
  confidence: number;
}

export interface CheckResult {
  name: 'typecheck' | 'tests';
  ok: boolean;
  durationMs: number;
  /** Últimas líneas de la salida, útil como feedback para el corrector. */
  output: string;
}

export interface FixResult {
  findingId: string;
  status: 'validated' | 'failed' | 'skipped';
  attempts: number;
  explanation?: string;
  /** Diff listo para aplicar con `git apply` sobre la rama del PR. */
  patch?: string;
  reason?: string;
}

export type Verdict = 'APPROVE' | 'REVIEW' | 'BLOCK';

export interface GateDecision {
  verdict: Verdict;
  reasons: string[];
}

export interface StageMetric {
  stage: string;
  durationMs: number;
  llmCalls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface RunReport {
  label: string;
  title: string;
  base: string;
  provider: string;
  model: string;
  decision: GateDecision;
  checks: CheckResult[];
  findings: Finding[];
  fixes: FixResult[];
  redactions: number;
  stages: StageMetric[];
  totalMs: number;
}
