import { CATEGORY_LABEL, fmtSeconds, fmtUsd, overview } from './metrics';
import { PipelineMap } from './PipelineMap';
import type { DashboardData, Source } from './types';
import { Kpi, SourceChip, VerdictBadge } from './ui';

export function Overview({ data }: { data: DashboardData }) {
  const o = overview(data);
  const { real, baseline, noContext } = o;
  const hours = o.minutesSaved / 60;
  const fixesOk = o.fixes.filter((f) => f.status === 'validated').length;
  const showcase = data.cases.find((c) => c.id === '06-idor-order-history') ?? data.cases[0];

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">Agentes de IA para el ciclo de desarrollo de e-commerce</span>
          <h1>
            Cada Pull Request revisado, corregido y decidido en <span className="hl">~{Math.round(real.avgSeconds)} segundos</span>.
          </h1>
          <p className="lead">
            Storefront Guardian revisa los cambios de las tiendas online, encuentra los bugs que los tests no ven,
            propone correcciones <strong>demostradas con un test</strong> y decide si el cambio puede avanzar.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href={`#/pr/${showcase.id}`}>
              Ver un PR bloqueado
            </a>
            <a className="btn btn-ghost" href="#prs">
              Ver los {data.cases.length} PRs revisados
            </a>
          </div>
        </div>
      </section>

      <section className="kpis">
        <Kpi
          label="Bugs detectados"
          value={`${real.detected}/${real.bugs}`}
          tone="good"
          detail={`Solo con reglas, sin IA: ${baseline.detected}/${baseline.bugs}`}
        />
        <Kpi
          label="Bugs graves bloqueados"
          value={`${real.blocked}/${real.blocking}`}
          tone="good"
          detail="No llegan a producción"
        />
        <Kpi
          label="Fixes validados rojo → verde"
          value={`${fixesOk}/${o.fixes.length}`}
          detail="El test falla con el bug y pasa con el fix"
        />
        <Kpi
          label="Falsos positivos"
          value={real.falsePositives}
          tone="good"
          detail={`PRs limpios aprobados: ${real.cleanApproved}/${real.clean}`}
        />
        <Kpi
          label="Tiempo por PR"
          value={fmtSeconds(real.avgSeconds)}
          detail={`Promedio · máximo ${fmtSeconds(real.maxSeconds)}`}
        />
        <Kpi label="Costo por PR" value={fmtUsd(real.avgCost)} detail="Equivalente en tier pago · hoy US$ 0" />
        <Kpi
          label="Horas de revisión ahorradas"
          value={`${hours.toFixed(1)} h`}
          detail={`Estimación en ${data.cases.length} PRs: ${data.policy.value.reviewMinutes} min por revisión + ${data.policy.value.fixMinutes} min por fix`}
        />
        <Kpi
          label="Veredicto correcto"
          value={`${real.correctVerdicts}/${real.total}`}
          detail="Aprobado · revisión humana · bloqueado"
        />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Cómo trabajan los agentes</h2>
          <p>Primero lo determinístico, que es gratis e instantáneo. La IA solo donde las reglas no llegan.</p>
        </div>
        <PipelineMap data={data} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Cuánto aporta la IA</h2>
          <p>Los mismos {real.total} PRs, revisados solo con la capa determinística y con el pipeline completo.</p>
        </div>
        <div className="panel compare">
          <div className="compare-legend">
            <span><i className="dot dot-muted" /> Solo reglas y tests (sin IA)</span>
            <span><i className="dot dot-good" /> Pipeline completo con IA</span>
          </div>
          <Compare label="Bugs detectados" before={baseline.detected} after={real.detected} max={real.bugs} />
          <Compare label="Bugs graves bloqueados" before={baseline.blocked} after={real.blocked} max={real.blocking} />
          <Compare label="Veredicto correcto" before={baseline.correctVerdicts} after={real.correctVerdicts} max={real.total} />
          <p className="bars-note">
            ¿Y el archivo de convenciones del equipo? Sin él, la IA detecta igual {noContext.detected}/{noContext.bugs}:
            el contexto no la vuelve más perspicaz, la vuelve más estricta con las reglas del equipo (por ejemplo,
            escala un N+1 de medio a alto).
          </p>
        </div>
      </section>

      <section className="section" id="prs">
        <div className="section-head">
          <h2>Pull Requests revisados</h2>
          <p>
            {real.bugs} con bugs típicos de e-commerce sembrados a propósito y {real.clean} limpios para medir falsos
            positivos. Haz clic en uno para ver qué hizo cada agente.
          </p>
        </div>
        <div className="panel table-wrap">
          <table className="prs">
            <thead>
              <tr>
                <th>Veredicto</th>
                <th>Pull Request</th>
                <th>Detectado por</th>
                <th className="num">Fix</th>
                <th className="num">Tiempo</th>
                <th className="num">Costo</th>
              </tr>
            </thead>
            <tbody>
              {data.cases.map((c) => {
                const r = c.real;
                const categories = [...new Set(c.expected.findings.map((f) => CATEGORY_LABEL[f.category] ?? f.category))];
                return (
                  <tr key={c.id} onClick={() => (window.location.hash = `#/pr/${c.id}`)}>
                    <td>
                      <VerdictBadge verdict={c.report.decision.verdict} />
                    </td>
                    <td>
                      <a className="pr-title" href={`#/pr/${c.id}`} onClick={(e) => e.stopPropagation()}>
                        {c.title}
                      </a>
                      <div className="pr-meta">
                        {categories.length ? categories.join(' · ') : 'Sin bugs: cambio limpio'}
                      </div>
                    </td>
                    <td>
                      <div className="chips">
                        {r?.detectedBy.length
                          ? r.detectedBy.map((s) => <SourceChip key={s} source={s as Source | 'tests'} />)
                          : <span className="muted">—</span>}
                      </div>
                    </td>
                    <td className="num">{r?.fixValidated === true ? <span className="ok">✓</span> : r?.fixValidated === false ? <span className="muted">✗</span> : <span className="muted">—</span>}</td>
                    <td className="num">{r ? fmtSeconds(r.seconds) : '—'}</td>
                    <td className="num">{r ? fmtUsd(r.costUsd) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Compare({ label, before, after, max }: { label: string; before: number; after: number; max: number }) {
  return (
    <div className="cmp">
      <div className="cmp-label">{label}</div>
      <div className="cmp-bars">
        <div className="cmp-row">
          <div className="bar-track">
            <div className="bar-fill bar-muted" style={{ width: `${(100 * before) / max}%` }} />
          </div>
          <span className="cmp-val muted">
            {before}/{max}
          </span>
        </div>
        <div className="cmp-row">
          <div className="bar-track">
            <div className="bar-fill bar-good" style={{ width: `${(100 * after) / max}%` }} />
          </div>
          <span className="cmp-val">
            {after}/{max}
          </span>
        </div>
      </div>
    </div>
  );
}
