import { overview } from './metrics';
import type { DashboardData } from './types';
import { VerdictBadge } from './ui';

/** Vista agregada del pipeline: qué aportó cada agente en todos los PRs. */
export function PipelineMap({ data }: { data: DashboardData }) {
  const o = overview(data);
  const deterministic = o.findings.filter((f) => f.source !== 'llm').length;
  const byLlm = o.findings.filter((f) => f.source === 'llm').length;
  const onlyLlm = data.evalRuns.gemini.filter((r) => r.isBug && r.detectedBy.length === 1 && r.detectedBy[0] === 'llm').length;
  const attempted = o.fixes.length;
  const validated = o.fixes.filter((f) => f.status === 'validated').length;

  const stages = [
    {
      n: 1,
      name: 'Chequeos determinísticos',
      tag: 'Sin IA · US$ 0',
      what: 'Typecheck, tests, escáner de secretos y reglas estáticas.',
      stat: `${o.baseline.detected}/${o.baseline.bugs}`,
      statLabel: 'bugs detectados sin IA',
      foot: `${deterministic} hallazgos por reglas`,
    },
    {
      n: 2,
      name: 'Agente revisor',
      tag: 'IA',
      what: 'Lee el diff, los archivos y las convenciones del equipo. Secretos redactados antes de enviar.',
      stat: String(onlyLlm),
      statLabel: 'bugs que solo vio la IA',
      foot: `${byLlm} hallazgos con archivo, línea y sugerencia`,
    },
    {
      n: 3,
      name: 'Agente corrector',
      tag: 'IA + tests',
      what: 'Propone el fix y un test de regresión, en un worktree aislado.',
      stat: `${validated}/${attempted}`,
      statLabel: 'fixes intentados que pasaron rojo → verde',
      foot: 'Entrega patches, nunca hace commits',
    },
    {
      n: 4,
      name: 'Gate',
      tag: 'Determinístico',
      what: 'Decide según guardian.policy.yaml, que el equipo ajusta sin tocar código.',
      stat: null,
      statLabel: 'veredictos',
      foot: 'Bloquea el merge en GitHub Actions',
    },
  ];

  return (
    <div className="pipeline-map">
      {stages.map((s, i) => (
        <div className="pm-wrap" key={s.n}>
          <div className={`pm-stage ${s.tag.startsWith('IA') ? 'pm-ai' : ''}`}>
            <div className="pm-top">
              <span className="pm-n">{s.n}</span>
              <span className="pm-tag">{s.tag}</span>
            </div>
            <h3>{s.name}</h3>
            <p className="pm-what">{s.what}</p>
            {s.stat ? (
              <div className="pm-stat">
                <strong>{s.stat}</strong>
                <span>{s.statLabel}</span>
              </div>
            ) : (
              <div className="pm-verdicts">
                {(['BLOCK', 'REVIEW', 'APPROVE'] as const).map((v) => (
                  <div key={v}>
                    <VerdictBadge verdict={v} /> <strong>{o.verdicts[v] ?? 0}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="pm-foot">{s.foot}</div>
          </div>
          {i < stages.length - 1 && <div className="pm-arrow" aria-hidden="true">→</div>}
        </div>
      ))}
    </div>
  );
}
