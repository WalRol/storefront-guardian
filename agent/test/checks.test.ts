import { describe, expect, it } from 'vitest';
import { redactSecrets, scanSecrets } from '../src/checks/secrets';
import { scanStaticRules } from '../src/checks/static-rules';
import { parseDiff } from '../src/diff';

const DIFF = `diff --git a/src/pay.ts b/src/pay.ts
new file mode 100644
--- /dev/null
+++ b/src/pay.ts
@@ -0,0 +1,3 @@
+const URL = 'https://api.example';
+const PAYMENTS_API_KEY = 'pgw_live_9f8a7c6b5e4d3c2b1a0f9e8d7c6b5a4f';
+export const q = (c: string) => \`SELECT * FROM p WHERE category = '\${c}'\`;
diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,3 +10,3 @@ export function createApp() {
   app.use(x);
-  res.status(500).json({ error: 'E' });
+  res.status(500).json({ error: 'E', stack: err.stack });
   return app;
`;

describe('parseDiff', () => {
  it('extrae archivos y números de línea de las líneas agregadas', () => {
    const files = parseDiff(DIFF);
    expect(files.map((f) => f.path)).toEqual(['src/pay.ts', 'src/app.ts']);
    expect(files[0].added.map((l) => l.line)).toEqual([1, 2, 3]);
    expect(files[1].added).toEqual([
      { line: 11, text: "  res.status(500).json({ error: 'E', stack: err.stack });" },
    ]);
  });
});

describe('secretos', () => {
  it('detecta claves con alta entropía asignadas a variables', () => {
    const findings = scanSecrets(parseDiff(DIFF));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'src/pay.ts', line: 2, severity: 'critical' });
  });

  it('ignora valores de baja entropía como tokens de prueba', () => {
    expect(scanSecrets(parseDiff(DIFF.replace(/pgw_live_\w+/, 'aaaaaaaaaaaaaaaaaaaa')))).toHaveLength(0);
  });

  it('redacta el secreto antes de enviarlo al modelo', () => {
    const { text, count } = redactSecrets(DIFF);
    expect(count).toBe(1);
    expect(text).not.toContain('pgw_live_');
    expect(text).toContain('[REDACTED:generic-secret]');
  });
});

describe('reglas estáticas', () => {
  it('detecta SQL interpolado y stack expuesto', () => {
    const ids = scanStaticRules(parseDiff(DIFF)).map((f) => f.title);
    expect(ids).toEqual([
      expect.stringContaining('sql-interpolation'),
      expect.stringContaining('stack-in-response'),
    ]);
  });
});
