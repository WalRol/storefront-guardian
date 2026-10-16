import type { ChangedFile } from '../diff';
import type { Finding } from '../types';

interface SecretRule {
  id: string;
  description: string;
  pattern: RegExp;
  /** Grupo de captura que contiene el secreto (para redactar y medir entropía). */
  group: number;
  minEntropy?: number;
}

// Subconjunto de las reglas típicas de gitleaks. En producción se usaría
// gitleaks/trufflehog en el CI; aquí se mantienen en código para no exigir
// binarios extra a quien corra el prototipo.
const RULES: SecretRule[] = [
  {
    id: 'aws-access-key',
    description: 'Access key de AWS',
    pattern: /\b(AKIA[0-9A-Z]{16})\b/,
    group: 1,
  },
  {
    id: 'private-key',
    description: 'Clave privada',
    pattern: /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/,
    group: 1,
  },
  {
    id: 'connection-string',
    description: 'Cadena de conexión con credenciales',
    pattern: /\b((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:'"`]+:[^\s@'"`]+@[^\s'"`]+)/,
    group: 1,
  },
  {
    id: 'generic-secret',
    description: 'Secreto asignado a una variable',
    pattern: /(?:api[_-]?key|secret|token|passw(?:or)?d|credential)\w*['"]?\s*[:=]\s*['"`]([^'"`\s]{16,})['"`]/i,
    group: 1,
    minEntropy: 3.5,
  },
];

/** Entropía de Shannon en bits por carácter: distingue claves aleatorias de textos normales. */
export function entropy(value: string): number {
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export interface SecretMatch {
  rule: SecretRule;
  value: string;
}

export function findSecrets(text: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  for (const rule of RULES) {
    const global = new RegExp(rule.pattern.source, rule.pattern.flags + 'g');
    for (const m of text.matchAll(global)) {
      const value = m[rule.group];
      if (rule.minEntropy && entropy(value) < rule.minEntropy) continue;
      matches.push({ rule, value });
    }
  }
  return matches;
}

/** Busca secretos solo en las líneas agregadas por el PR. */
export function scanSecrets(files: ChangedFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    for (const { line, text } of file.added) {
      for (const { rule } of findSecrets(text)) {
        findings.push({
          id: `secret-${findings.length + 1}`,
          source: 'secrets',
          severity: 'critical',
          category: 'secrets',
          file: file.path,
          line,
          title: `${rule.description} en el código (${rule.id})`,
          explanation:
            'Un secreto commiteado queda en el historial de git aunque se borre después. ' +
            'Cualquiera con acceso al repo puede usarlo.',
          suggestion:
            'Leerlo de una variable de entorno o gestor de secretos y rotar la credencial expuesta.',
          confidence: 1,
        });
      }
    }
  }
  return findings;
}

/** Reemplaza los secretos por marcadores antes de enviar texto a un proveedor externo. */
export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const { rule, value } of findSecrets(text)) {
    out = out.split(value).join(`[REDACTED:${rule.id}]`);
    count++;
  }
  return { text: out, count };
}
