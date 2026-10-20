import { useEffect, useState } from 'react';
import { CATEGORY_LABEL, fmtInt, fmtSeconds, fmtUsd, VERDICT_HINT } from './metrics';
import type { Case, Finding, FixResult } from './types';
import { Collapsible, DiffView, SeverityBadge, SourceChip, VerdictBadge } from './ui';

type Status = 'ok' | 'warn' | 'fail' | 'skip';

interface Step {
  name: string;
  status: Status;
  summary: string;
}

function buildSteps(pr: Case): Step[] {
  const r = pr.report;
  const typecheck = r.checks.find((c) => c.name === 'typecheck');
  const tests = r.checks.find((c) => c.name === 'tests');
  const ruleFindings = r.findings.filter((f) => f.source !== 'llm');
  const llmFindings = r.findings.filter((f) => f.source === 'llm');
  const review = r.stages.find((s) => s.stage === 'revisión IA');
  const validated = r.fixes.filter((f) => f.status === 'validated').length;
  const checksOk = r.checks.every((c) => c.ok);
  const verdict = r.decision.verdict;

  return [
    { name: 'Preparación', status: 'ok', summary: 'Worktree aislado con el PR aplicado' },
    {
      name: 'Chequeos determinísticos',
      status: !checksOk ? 'fail' : ruleFindings.length ? 'warn' : 'ok',
      summary: `Typecheck ${typecheck?.ok ? '✓' : '✗'} · Tests ${tests?.ok ? '✓' : '✗'} · ${ruleFindings.length} por reglas`,
    },
    {
      name: 'Agente revisor',
      status: llmFindings.length ? 'warn' : 'ok',
      summary: `${llmFindings.length} hallazgo${llmFindings.length === 1 ? '' : 's'} · ${fmtInt((review?.inputTokens ?? 0) + (review?.outputTokens ?? 0))} tokens`,
    },
    {
      name: 'Agente corrector',
      status: r.fixes.length === 0 ? 'skip' : validated === r.fixes.length ? 'ok' : 'warn',
      summary: r.fixes.length === 0 ? 'Nada que corregir' : `${validated}/${r.fixes.length} fix validado rojo → verde`,
    },
    {
      name: 'Gate',
      status: verdict === 'APPROVE' ? 'ok' : verdict === 'REVIEW' ? 'warn' : 'fail',
      summary: VERDICT_HINT[verdict],
    },
  ];
}

const STEP_MS = 650;

export function PrDetail({ pr }: { pr: Case }) {
  const steps = buildSteps(pr);
  const [shown, setShown] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => setShown(0), [pr.id, run]);
  useEffect(() => {
    if (shown >= steps.length) return;
    const id = window.setTimeout(() => setShown(shown + 1), STEP_MS);
    return () => window.clearTimeout(id);
  }, [shown, steps.length]);

  const r = pr.report;
  const real = pr.real;
  const done = shown >= steps.length;
  const fixFor = (f: Finding) => r.fixes.find((x) => x.findingId === f.id);
  const tokensIn = real?.inputTokens ?? r.stages.reduce((s, m) => s + m.inputTokens, 0);
  const tokensOut = real?.outputTokens ?? r.stages.reduce((s, m) => s + m.outputTokens, 0);

  return (
    <div className="detail">
      <a href="#/" className="back">
        ← Volver al panel
      </a>

      <div className="detail-head">
        <div>
          <span className="pr-id">{pr.id}</span>
          <h1>{pr.title}</h1>
          <p className="lead">{pr.body}</p>
        </div>
        <div className={`verdict-card vc-${r.decision.verdict.toLowerCase()} ${done ? 'show' : ''}`}>
          <div className="vc-label">Veredicto</div>
          <VerdictBadge verdict={r.decision.verdict} large />
          <div className="vc-hint">{VERDICT_HINT[r.decision.verdict]}</div>
        </div>
      </div>

      <div className="panel stepper-panel">
        <div className="stepper-head">
          <h2>Pipeline</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setRun((n) => n + 1)}>
            ↻ Reproducir
          </button>
        </div>
        <ol className="stepper">
          {steps.map((s, i) => {
            const state = i < shown ? s.status : i === shown ? 'running' : 'pending';
            return (
              <li key={s.name} className={`step step-${state}`}>
                <span className="step-dot">{i < shown ? STATUS_ICON[s.status] : i + 1}</span>
                <div>
                  <div className="step-name">{s.name}</div>
                  <div className="step-summary">{i < shown ? s.summary : i === shown ? 'Ejecutando…' : 'En espera'}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <h2>Hallazgos {r.findings.length > 0 && <span className="count">{r.findings.length}</span>}</h2>
          {r.findings.length === 0 && (
            <div className="panel empty">Sin hallazgos: el cambio respeta las reglas y las convenciones del equipo.</div>
          )}
          {r.findings.map((f) => (
            <FindingCard key={f.id} finding={f} fix={fixFor(f)} />
          ))}

          {r.decision.reasons.length > 0 && (
            <div className="panel reasons">
              <h3>Por qué el gate decidió así</h3>
              <ul>
                {r.decision.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <Collapsible title={<>Cambio del PR <span className="muted">(diff)</span></>}>
            <DiffView diff={pr.diff} />
          </Collapsible>
        </div>

        <aside className="detail-side">
          <div className="panel side-panel">
            <h3>Métricas de la corrida real</h3>
            <dl className="stats">
              <dt>Tiempo total</dt>
              <dd>{real ? fmtSeconds(real.seconds) : '—'}</dd>
              <dt>Modelo</dt>
              <dd>{real?.model ?? r.model}</dd>
              <dt>Tokens (entrada / salida)</dt>
              <dd>
                {fmtInt(tokensIn)} / {fmtInt(tokensOut)}
              </dd>
              <dt>Costo en tier pago</dt>
              <dd>{real ? fmtUsd(real.costUsd) : fmtUsd(r.costUsd)}</dd>
              <dt>Secretos redactados</dt>
              <dd>{r.redactions}</dd>
              <dt>Ahorro estimado</dt>
              <dd>{pr.minutesSaved} min</dd>
            </dl>
          </div>

          <div className="panel side-panel">
            <h3>Resultado esperado</h3>
            <div className="expected">
              <VerdictBadge verdict={pr.expected.verdict} />
              {pr.expected.verdict === r.decision.verdict ? (
                <span className="ok">✓ coincide</span>
              ) : (
                <span className="warn">≠ obtenido</span>
              )}
            </div>
            <p className="muted small">
              {pr.expected.findings.length
                ? `Bug sembrado: ${pr.expected.findings.map((f) => CATEGORY_LABEL[f.category] ?? f.category).join(', ')}`
                : 'PR limpio: no debería tener hallazgos.'}
            </p>
          </div>

          <div className="panel side-panel">
            <h3>Chequeos</h3>
            {r.checks.map((c) => (
              <Collapsible
                key={c.name}
                title={
                  <>
                    <span className={c.ok ? 'ok' : 'bad'}>{c.ok ? '✓' : '✗'}</span> {c.name === 'tests' ? 'Tests' : 'Typecheck'}
                  </>
                }
              >
                <pre className="output">{c.output.trim() || 'Sin salida.'}</pre>
              </Collapsible>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

const STATUS_ICON: Record<Status, string> = { ok: '✓', warn: '!', fail: '✗', skip: '–' };

function FindingCard({ finding: f, fix }: { finding: Finding; fix?: FixResult }) {
  return (
    <article className={`panel finding finding-${f.severity}`}>
      <div className="finding-head">
        <SeverityBadge severity={f.severity} />
        <SourceChip source={f.source} />
        <span className="muted small">{CATEGORY_LABEL[f.category] ?? f.category}</span>
        {f.source === 'llm' && <span className="muted small">· confianza {Math.round(f.confidence * 100)}%</span>}
      </div>
      <h3>{f.title}</h3>
      <code className="loc">
        {f.file}
        {f.line ? `:${f.line}` : ''}
      </code>
      <p>{f.explanation}</p>
      {f.suggestion && (
        <p className="suggestion">
          <strong>Sugerencia:</strong> {f.suggestion}
        </p>
      )}
      {fix?.status === 'validated' && (
        <div className="fix fix-ok">
          <div className="fix-head">
            <span className="redgreen">
              <span className="rg-red">rojo</span> → <span className="rg-green">verde</span>
            </span>
            Corrección validada en {fix.attempts} intento{fix.attempts === 1 ? '' : 's'}
          </div>
          <p className="small">{fix.explanation}</p>
          {fix.patch && (
            <Collapsible title="Ver patch con el fix y su test de regresión">
              <DiffView diff={fix.patch} />
            </Collapsible>
          )}
        </div>
      )}
      {fix?.status === 'failed' && (
        <div className="fix fix-failed">
          <div className="fix-head">No se logró una corrección validada: queda para el desarrollador.</div>
          {fix.reason && <p className="small muted">{fix.reason.split('\n')[0]}</p>}
        </div>
      )}
    </article>
  );
}
