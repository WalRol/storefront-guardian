import { dedupe, review } from './agents/reviewer';
import { fixFinding, selectFixable } from './agents/fixer';
import { runProjectChecks } from './checks/project';
import { scanSecrets } from './checks/secrets';
import { scanStaticRules } from './checks/static-rules';
import { parseDiff } from './diff';
import { decide } from './gate';
import type { LlmProvider } from './llm';
import { Meter } from './meter';
import { loadContext, type Policy } from './policy';
import type { CheckResult, Finding, FixResult, RunReport } from './types';
import { prepareWorkspace } from './workspace';

export interface PipelineOptions {
  repoDir: string;
  base: string;
  head?: string;
  patch?: string;
  title: string;
  body: string;
  /** Identificador estable de la corrida (para las grabaciones del modo replay). */
  label?: string;
  policy: Policy;
  /** null = solo capa determinística (sin IA). */
  provider: LlmProvider | null;
  fix: boolean;
  log?: (msg: string) => void;
}

/**
 * Orquestación del pipeline:
 *   1. preparación   → worktree aislado con el PR aplicado
 *   2. determinístico → typecheck, tests, secretos, reglas estáticas (sin IA, sin costo)
 *   3. revisión IA    → el revisor busca lo que las herramientas no ven
 *   4. corrección IA  → el corrector propone fixes y los valida rojo → verde
 *   5. gate           → decisión determinística según la política del equipo
 */
export async function runPipeline(opts: PipelineOptions): Promise<RunReport> {
  const log = opts.log ?? (() => undefined);
  const { policy, provider } = opts;
  const meter = new Meter();
  const started = Date.now();

  log('Preparando workspace aislado…');
  const ws = await meter.stage('preparación', () => prepareWorkspace(opts));
  const label = opts.label ?? ws.diffHash;

  try {
    const changedFiles = parseDiff(ws.diff);
    const context = loadContext(policy, ws.dir);

    log('Chequeos determinísticos (typecheck, tests, secretos, reglas)…');
    let checks: CheckResult[] = [];
    let deterministic: Finding[] = [];
    await meter.stage('chequeos determinísticos', async () => {
      deterministic = [...scanSecrets(changedFiles), ...scanStaticRules(changedFiles)];
      checks = await runProjectChecks(ws.dir, policy);
    });

    let llmFindings: Finding[] = [];
    let redactions = 0;
    if (provider) {
      log(`Revisión IA (${provider.name})…`);
      const input = {
        key: `${label}/review`,
        title: opts.title,
        body: opts.body,
        diff: ws.diff,
        changedFiles,
        workDir: ws.dir,
        context,
        checks,
        deterministic,
        maxContextChars: policy.review.maxContextChars,
      };
      ({ findings: llmFindings, redactions } = await meter.stage('revisión IA', () =>
        review(input, provider, meter),
      ));
    }
    const findings = dedupe(deterministic, llmFindings);

    const fixes: FixResult[] = [];
    const fixable = provider && opts.fix && policy.fix.enabled ? selectFixable(findings, policy) : [];
    if (provider && fixable.length > 0) {
      await meter.stage('corrección IA', async () => {
        for (const finding of fixable) {
          log(`Corrigiendo ${finding.id}: ${finding.title}…`);
          fixes.push(
            await fixFinding(finding, { ws, policy, provider, meter, context, keyPrefix: label }),
          );
        }
      });
    }

    const decision = decide(checks, findings, fixes, policy);
    return {
      label,
      title: opts.title,
      base: opts.base,
      provider: provider?.name ?? 'none',
      model: provider?.model ?? 'sin IA',
      decision,
      checks,
      findings,
      fixes,
      redactions,
      stages: meter.stages,
      totalMs: Date.now() - started,
    };
  } finally {
    await ws.cleanup();
  }
}
