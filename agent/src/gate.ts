import { POLICY_FILE, type Policy } from './policy';
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
  changedPaths: string[] = [],
): GateDecision {
  const { blockOn, reviewOn, sensitivePaths = [] } = policy.gate;
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

  // Si el PR toca un archivo sensible, ni un prompt injection exitoso ni una IA caída
  // lo llevan a APROBADO: que el revisor no encuentre nada no alcanza.
  const sensitive = changedPaths.filter((p) => sensitivePaths.some((glob) => globToRegExp(glob).test(p)));
  if (block.length === 0 && sensitive.length > 0) {
    review.push(`Toca archivos sensibles (${sensitive.join(', ')}): requieren revisión humana aunque no haya hallazgos.`);
  }

  const verdict: Verdict = block.length > 0 ? 'BLOCK' : review.length > 0 ? 'REVIEW' : 'APPROVE';
  const reasons = [...block, ...review];
  // No cambia el veredicto: deja explícito que el PR no pudo cambiar las reglas con las que se lo evaluó.
  if (changedPaths.includes(POLICY_FILE)) {
    reasons.push(`Este PR modifica ${POLICY_FILE}: se evaluó con la política de la rama base. El cambio rige recién después del merge.`);
  }
  if (verdict === 'APPROVE') reasons.push('Compila, los tests pasan y no se encontraron problemas relevantes.');
  return { verdict, reasons };
}

/** Glob mínimo: `**` cualquier ruta, `*` cualquier nombre dentro de una carpeta. */
function globToRegExp(glob: string): RegExp {
  const source = glob
    .split('**')
    .map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
    .join('.*');
  return new RegExp(`^${source}$`);
}
