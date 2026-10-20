import { useState, type ReactNode } from 'react';
import { SEVERITY_LABEL, SOURCE_LABEL, VERDICT_LABEL } from './metrics';
import type { Severity, Source, Verdict } from './types';

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="var(--accent)" d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" />
      <path fill="none" stroke="var(--bg)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

export function VerdictBadge({ verdict, large = false }: { verdict: Verdict | 'ERROR'; large?: boolean }) {
  const label = verdict === 'ERROR' ? 'Error' : VERDICT_LABEL[verdict];
  return <span className={`verdict verdict-${verdict.toLowerCase()} ${large ? 'verdict-lg' : ''}`}>{label}</span>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`sev sev-${severity}`}>{SEVERITY_LABEL[severity]}</span>;
}

export function SourceChip({ source }: { source: Source | 'tests' }) {
  return <span className={`chip chip-${source}`}>{SOURCE_LABEL[source]}</span>;
}

export function Kpi({ label, value, detail, tone }: { label: string; value: ReactNode; detail?: ReactNode; tone?: 'good' }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone === 'good' ? 'tone-good' : ''}`}>{value}</div>
      {detail && <div className="kpi-detail">{detail}</div>}
    </div>
  );
}

export function Collapsible({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`collapsible ${open ? 'open' : ''}`}>
      <button className="collapsible-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="caret">›</span>
        {title}
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

/** Diff unificado con colores por línea. */
export function DiffView({ diff }: { diff: string }) {
  const lines = diff.replace(/\n$/, '').split('\n');
  return (
    <pre className="diff">
      {lines.map((line, i) => {
        const kind = line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')
          ? 'meta'
          : line.startsWith('@@')
            ? 'hunk'
            : line.startsWith('+')
              ? 'add'
              : line.startsWith('-')
                ? 'del'
                : 'ctx';
        return (
          <span key={i} className={`diff-line diff-${kind}`}>
            {line || ' '}
            {'\n'}
          </span>
        );
      })}
    </pre>
  );
}
