import path from 'node:path';
import { runShell, tail } from '../exec';
import type { Policy } from '../policy';
import type { CheckResult } from '../types';

/** Quita rutas temporales y tiempos de la salida para que el feedback sea estable y no filtre rutas locales. */
export function normalizeOutput(output: string, workDir: string): string {
  const variants = [workDir, workDir.replace(/\\/g, '/')];
  let out = output;
  for (const v of variants) out = out.split(v).join('<repo>');
  return out
    .replace(/\b\d+(\.\d+)?\s?(ms|s)\b/g, '<t>')
    .replace(/\b\d{2}:\d{2}:\d{2}\b/g, '<hh:mm:ss>');
}

export async function runCheck(
  name: CheckResult['name'],
  command: string,
  workDir: string,
  policy: Policy,
): Promise<CheckResult> {
  const result = await runShell(command, path.join(workDir, policy.project.dir));
  return {
    name,
    ok: result.code === 0 && !result.timedOut,
    durationMs: result.durationMs,
    output: tail(normalizeOutput(result.output, workDir)),
  };
}

export async function runProjectChecks(workDir: string, policy: Policy): Promise<CheckResult[]> {
  // Secuencial a propósito: en laptops modestas correr tsc y los tests en
  // paralelo duplica el uso de memoria sin ahorrar mucho tiempo.
  const typecheck = await runCheck('typecheck', policy.project.typecheck, workDir, policy);
  const tests = await runCheck('tests', policy.project.test, workDir, policy);
  return [typecheck, tests];
}
