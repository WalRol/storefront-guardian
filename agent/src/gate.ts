import type { Policy } from './policy';
import type { CheckResult, Finding, FixResult, GateDecision, Verdict } from './types';

/**
 * Decide si el PR puede avanzar. Es lógica determinística a propósito: la
 * decisión tiene que ser explicable, auditable y configurable por el equipo
 * (guardian.policy.yaml), no depender de la "opinión" de un modelo.
 */
export function decide(
  checks: CheckResult[],
  findings: Finding[],
  fixes: FixResult[],
  policy: Policy,
): GateDecision {
  const { blockOn, reviewOn } = policy.gate;
  const block: string[] = [];
  const review: string[] = [];

  for (const check of checks) {
    if (check.ok) continue;
    if (check.name === 'typecheck' && blockOn.typecheckFail) block.push('El proyecto no compila (typecheck).');
    if (check.name === 'tests' && blockOn.testsFail) block.push('Hay tests fallando.');
  }

  for (const f of findings) {
    const fix = fixes.find((x) => x.findingId === f.id && x.status === 'validated');
    const label = `[${f.severity}] ${f.title} — ${f.file}${f.line ? `:${f.line}` : ''}${fix ? ' (fix validado disponible)' : ''}`;
    const confident = f.confidence >= policy.review.minConfidence;

    if (blockOn.severities.includes(f.severity)) {
      // Un hallazgo grave pero con baja confianza no bloquea solo: pasa a revisión humana.
      (confident ? block : review).push(confident ? label : `${label} (confianza baja: ${f.confidence})`);
    } else if (reviewOn.severities.includes(f.severity) && confident) {
      review.push(label);
    }
  }

  const verdict: Verdict = block.length > 0 ? 'BLOCK' : review.length > 0 ? 'REVIEW' : 'APPROVE';
  const reasons = [...block, ...review];
  if (verdict === 'APPROVE') reasons.push('Compila, los tests pasan y no se encontraron problemas relevantes.');
  return { verdict, reasons };
}
