import type { Policy } from './policy';
import type { Finding, FixResult, RunReport, Severity } from './types';

const VERDICT_LABEL = {
  APPROVE: '✅ APROBADO — puede avanzar',
  REVIEW: '🟡 REVISIÓN HUMANA — requiere criterio de un desarrollador',
  BLOCK: '⛔ BLOQUEADO — no debe avanzar',
} as const;

const SEVERITY_ICON: Record<Severity, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪' };
const SOURCE_LABEL = { secrets: 'escáner de secretos', static: 'regla estática', llm: 'revisión IA' } as const;

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function equivalentCostUsd(report: RunReport, policy: Policy): number {
  const input = report.stages.reduce((s, m) => s + m.inputTokens, 0);
  const output = report.stages.reduce((s, m) => s + m.outputTokens, 0);
  return (input * policy.pricing.inputPerMTok + output * policy.pricing.outputPerMTok) / 1_000_000;
}

function renderFinding(f: Finding, fix: FixResult | undefined): string {
  const lines = [
    `#### ${SEVERITY_ICON[f.severity]} [${f.severity}] ${f.title}`,
    `\`${f.file}${f.line ? `:${f.line}` : ''}\` · ${f.category} · ${SOURCE_LABEL[f.source]} · confianza ${f.confidence}`,
    '',
    f.explanation,
  ];
  if (f.suggestion) lines.push('', `**Sugerencia:** ${f.suggestion}`);
  if (fix?.status === 'validated') {
    lines.push(
      '',
      `**✅ Corrección validada** en ${fix.attempts} intento(s): el test de regresión falla con el bug y pasa con el fix; typecheck y suite completa en verde.`,
      '',
      fix.explanation ?? '',
      '',
      '<details><summary>Ver patch (aplicar con <code>git apply</code>)</summary>',
      '',
      '```diff',
      fix.patch?.trimEnd() ?? '',
      '```',
      '</details>',
    );
  } else if (fix?.status === 'failed') {
    lines.push('', `**⚠️ No se pudo generar una corrección validada.** ${fix.reason?.split('\n')[0] ?? ''}`);
  }
  return lines.join('\n');
}

export function renderMarkdown(report: RunReport, policy: Policy): string {
  const out: string[] = [];
  out.push(`## 🛡️ Storefront Guardian: ${VERDICT_LABEL[report.decision.verdict]}`);
  out.push('', `**PR:** ${report.title}`);
  out.push('', '### Motivos', ...report.decision.reasons.map((r) => `- ${r}`));

  out.push('', '### Chequeos determinísticos', '| Chequeo | Resultado | Tiempo |', '|---|---|---|');
  for (const c of report.checks) out.push(`| ${c.name} | ${c.ok ? '✅' : '❌'} | ${seconds(c.durationMs)} |`);

  out.push('', `### Hallazgos (${report.findings.length})`);
  if (report.findings.length === 0) out.push('', 'Sin hallazgos.');
  for (const f of report.findings) {
    out.push('', renderFinding(f, report.fixes.find((x) => x.findingId === f.id)));
  }

  out.push('', '### Métricas', '| Etapa | Tiempo | Llamadas IA | Tokens (entrada/salida) |', '|---|---|---|---|');
  for (const s of report.stages) {
    out.push(`| ${s.stage} | ${seconds(s.durationMs)} | ${s.llmCalls} | ${s.inputTokens} / ${s.outputTokens} |`);
  }
  out.push(
    '',
    `Tiempo total: **${seconds(report.totalMs)}** · Modelo: ${report.provider}/${report.model} · ` +
      `Secretos redactados antes de enviar al modelo: ${report.redactions} · ` +
      `Costo equivalente en tier pago: US$ ${equivalentCostUsd(report, policy).toFixed(4)}`,
  );
  return out.join('\n') + '\n';
}
