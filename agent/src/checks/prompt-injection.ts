import type { ChangedFile } from '../diff';
import type { Finding } from '../types';

/** Archivo con el que se reportan los hallazgos en el título o la descripción del PR. */
export const PR_TEXT_FILE = '(descripción del PR)';

// Frases dirigidas al revisor automático. Un PR legítimo no le da órdenes a la
// herramienta que lo revisa: si aparecen, el autor intenta saltarse la revisión.
const PATTERNS: RegExp[] = [
  /\bignor(?:a|á|e|ar|en)\s+(?:todas?\s+)?(?:las\s+|tus\s+)?(?:instrucciones|reglas|indicaciones)\b/i,
  /\bignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|your)\s+(?:instructions|rules)\b/i,
  /"?findings"?\s*:\s*\[\s*\]/i,
  /\bfindings\s+vac[ií]os?\b/i,
  /\b(?:no\s+reportes?|do\s+not\s+report|don'?t\s+report)\s+(?:ning[uú]n\s+|any\s+)?(?:hallazgos?|problemas?|findings?|issues?)\b/i,
  /\b(?:aprob[aá]\w*|approve)\s+(?:este\s+PR\s+|this\s+PR\s+)?(?:sin|without)\s+(?:revis|review)/i,
  /\b(?:revisor|reviewer)\s+(?:autom[aá]tico|IA|AI|automated)\b/i,
];

const looksLikeInjection = (text: string) => PATTERNS.some((p) => p.test(text));

function finding(n: number, file: string, line: number | undefined, where: string): Finding {
  return {
    id: `injection-${n}`,
    source: 'static',
    severity: 'medium',
    category: 'security',
    file,
    line,
    title: 'Instrucciones dirigidas al revisor automático (prompt-injection)',
    explanation:
      `${where} contiene instrucciones para la herramienta de revisión (p. ej. ignorar reglas o aprobar sin revisar). ` +
      'La revisión IA las trata como datos, pero el PR pasa a revisión humana: nadie debería necesitar escribirle al bot.',
    suggestion: 'Quitar esas instrucciones. Si el cambio necesita una excepción, pedirla a una persona del equipo.',
    confidence: 1,
  };
}

export function scanPromptInjection(title: string, body: string, files: ChangedFile[]): Finding[] {
  const findings: Finding[] = [];
  if (looksLikeInjection(`${title}\n${body}`)) {
    findings.push(finding(1, PR_TEXT_FILE, undefined, 'El título o la descripción del PR'));
  }
  for (const file of files) {
    for (const { line, text } of file.added) {
      if (looksLikeInjection(text)) findings.push(finding(findings.length + 1, file.path, line, 'Una línea agregada'));
    }
  }
  return findings;
}
