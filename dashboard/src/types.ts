// Espejo de los tipos de agent/src/types.ts que llegan en public/data.json.

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Verdict = 'APPROVE' | 'REVIEW' | 'BLOCK';
export type Source = 'secrets' | 'static' | 'llm';

export interface Finding {
  id: string;
  source: Source;
  severity: Severity;
  category: string;
  file: string;
  line?: number;
  title: string;
  explanation: string;
  suggestion?: string;
  confidence: number;
}

export interface CheckResult {
  name: 'typecheck' | 'tests';
  ok: boolean;
  durationMs: number;
  output: string;
}

export interface FixResult {
  findingId: string;
  status: 'validated' | 'failed' | 'skipped';
  attempts: number;
  explanation?: string;
  patch?: string;
  reason?: string;
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
  provider: string;
  model: string;
  decision: { verdict: Verdict; reasons: string[] };
  checks: CheckResult[];
  findings: Finding[];
  fixes: FixResult[];
  redactions: number;
  stages: StageMetric[];
  totalMs: number;
  costUsd: number;
}

/** Resultado de un caso en una corrida del eval (eval/results/*.json). */
export interface EvalResult {
  id: string;
  expectedVerdict: Verdict;
  verdict: Verdict | 'ERROR';
  isBug: boolean;
  detected: boolean;
  detectedBy: string[];
  falsePositives: number;
  fixValidated: boolean | null;
  seconds: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model?: string;
}

export interface Case {
  id: string;
  title: string;
  body: string;
  expected: { verdict: Verdict; findings: { category: string; file: string }[] };
  diff: string;
  report: RunReport;
  real: EvalResult | null;
  minutesSaved: number;
}

export interface DashboardData {
  generatedAt: string;
  policy: {
    value: { reviewMinutes: number; fixMinutes: number };
    pricing: { inputPerMTok: number; outputPerMTok: number };
  };
  evalRuns: { gemini: EvalResult[]; none: EvalResult[]; noContext: EvalResult[] };
  cases: Case[];
}
