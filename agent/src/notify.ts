import type { Policy } from './policy';
import { equivalentCostUsd } from './report';
import type { RunReport } from './types';

export interface PrInfo {
  repo?: string;
  number?: number;
  url?: string;
}

/** Resumen de una corrida: se guarda en runs.jsonl y se envía al webhook (n8n, Power Automate, etc.). */
export function buildRunEvent(report: RunReport, policy: Policy, pr: PrInfo) {
  const fixesValidated = report.fixes.filter((f) => f.status === 'validated').length;
  return {
    event: 'guardian.run',
    at: new Date().toISOString(),
    repo: pr.repo ?? null,
    pr: { number: pr.number ?? null, title: report.title, url: pr.url ?? null },
    label: report.label,
    verdict: report.decision.verdict,
    reasons: report.decision.reasons,
    findings: report.findings.map((f) => ({
      severity: f.severity,
      category: f.category,
      source: f.source,
      file: f.file,
      line: f.line ?? null,
      title: f.title,
    })),
    counts: {
      findings: report.findings.length,
      critical: report.findings.filter((f) => f.severity === 'critical').length,
      high: report.findings.filter((f) => f.severity === 'high').length,
      fixesValidated,
      fixesFailed: report.fixes.filter((f) => f.status === 'failed').length,
    },
    seconds: Math.round(report.totalMs / 1000),
    model: `${report.provider}/${report.model}`,
    costUsd: Number(equivalentCostUsd(report, policy).toFixed(5)),
    // Estimación según los supuestos de guardian.policy.yaml (sección value).
    minutesSavedEstimate: policy.value.reviewMinutes + fixesValidated * policy.value.fixMinutes,
  };
}

/**
 * Envía el evento al webhook configurado. Un fallo de notificación nunca
 * debe romper la revisión: se informa y se sigue.
 */
export async function notifyWebhook(url: string, event: unknown, token?: string): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      // El token permite al receptor rechazar eventos que no vienen de Guardian.
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Guardian-Token': token } : {}) },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(10_000),
    });
    console.error(`› Webhook notificado (HTTP ${res.status})`);
  } catch (err) {
    console.error(`⚠ No se pudo notificar al webhook: ${err instanceof Error ? err.message : String(err)}`);
  }
}
