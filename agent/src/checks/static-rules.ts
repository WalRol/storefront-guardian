import type { ChangedFile } from '../diff';
import type { Category, Finding, Severity } from '../types';

interface StaticRule {
  id: string;
  category: Category;
  severity: Severity;
  appliesTo: RegExp;
  pattern: RegExp;
  title: string;
  explanation: string;
  suggestion: string;
}

// Reglas determinísticas baratas y de alta precisión. Lo que se puede
// detectar con un patrón no se le pide al LLM (costo cero, sin falsos negativos
// por variabilidad del modelo). En producción: Semgrep con reglas propias.
const RULES: StaticRule[] = [
  {
    id: 'sql-interpolation',
    category: 'security',
    severity: 'critical',
    appliesTo: /\.[cm]?[jt]s$/,
    pattern: /\b(?:SELECT|INSERT|UPDATE|DELETE|WHERE|AND|OR|VALUES|SET)\b.*\$\{/i,
    title: 'SQL construido con interpolación de strings',
    explanation:
      'Interpolar valores en una consulta SQL permite inyección SQL si el valor viene del usuario.',
    suggestion: 'Usar parámetros del driver (`?` o `@nombre`) en lugar de `${...}`.',
  },
  {
    id: 'stack-in-response',
    category: 'security',
    severity: 'high',
    appliesTo: /\.[cm]?[jt]s$/,
    pattern: /\.(?:json|send)\(.*\b(?:err|error)\.stack\b/,
    title: 'Stack trace expuesto en la respuesta HTTP',
    explanation:
      'El stack revela rutas internas, versiones y estructura del código a cualquier cliente.',
    suggestion: 'Loguear el detalle en el servidor y devolver solo un código de error genérico.',
  },
];

export function scanStaticRules(files: ChangedFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    for (const rule of RULES) {
      if (!rule.appliesTo.test(file.path)) continue;
      for (const { line, text } of file.added) {
        if (!rule.pattern.test(text)) continue;
        findings.push({
          id: `static-${findings.length + 1}`,
          source: 'static',
          severity: rule.severity,
          category: rule.category,
          file: file.path,
          line,
          title: `${rule.title} (${rule.id})`,
          explanation: rule.explanation,
          suggestion: rule.suggestion,
          confidence: 1,
        });
      }
    }
  }
  return findings;
}
