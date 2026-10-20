import { describe, expect, it } from 'vitest';
import { decide } from '../src/gate';
import type { Policy } from '../src/policy';
import type { CheckResult, Finding } from '../src/types';

const policy = {
  review: { minConfidence: 0.6, maxContextChars: 1000 },
  gate: {
    blockOn: { typecheckFail: true, testsFail: true, severities: ['critical', 'high'] },
    reviewOn: { severities: ['medium'] },
  },
} as unknown as Policy;

const green: CheckResult[] = [
  { name: 'typecheck', ok: true, durationMs: 1, output: '' },
  { name: 'tests', ok: true, durationMs: 1, output: '' },
];

const finding = (over: Partial<Finding>): Finding => ({
  id: 'llm-1',
  source: 'llm',
  severity: 'high',
  category: 'money',
  file: 'a.ts',
  title: 't',
  explanation: 'e',
  confidence: 0.9,
  ...over,
});

describe('gate', () => {
  it('aprueba si todo está en verde y no hay hallazgos', () => {
    expect(decide(green, [], [], policy).verdict).toBe('APPROVE');
  });

  it('bloquea si fallan los tests', () => {
    const red = [green[0], { ...green[1], ok: false }];
    expect(decide(red, [], [], policy).verdict).toBe('BLOCK');
  });

  it('bloquea hallazgos graves con confianza suficiente', () => {
    expect(decide(green, [finding({})], [], policy).verdict).toBe('BLOCK');
  });

  it('manda a revisión humana un hallazgo grave con confianza baja', () => {
    expect(decide(green, [finding({ confidence: 0.4 })], [], policy).verdict).toBe('REVIEW');
  });

  it('manda a revisión humana los hallazgos medium', () => {
    expect(decide(green, [finding({ severity: 'medium' })], [], policy).verdict).toBe('REVIEW');
  });

  it('ignora hallazgos low', () => {
    expect(decide(green, [finding({ severity: 'low' })], [], policy).verdict).toBe('APPROVE');
  });

  describe('archivos sensibles', () => {
    const strict = {
      ...policy,
      gate: { ...policy.gate, sensitivePaths: ['guardian.policy.yaml', 'agent/**', 'src/auth.ts'] },
    } as Policy;

    it('no aprueba solo un PR que toca un archivo sensible', () => {
      const decision = decide(green, [], [], strict, ['src/auth.ts', 'src/app.ts']);
      expect(decision.verdict).toBe('REVIEW');
      expect(decision.reasons[0]).toContain('src/auth.ts');
    });

    it('resuelve ** en cualquier profundidad y no confunde nombres parecidos', () => {
      expect(decide(green, [], [], strict, ['agent/src/gate.ts']).verdict).toBe('REVIEW');
      expect(decide(green, [], [], strict, ['src/auth.tsx', 'docs/guardian.policy.yaml']).verdict).toBe('APPROVE');
    });

    it('si ya bloquea, sigue bloqueando', () => {
      expect(decide(green, [finding({})], [], strict, ['guardian.policy.yaml']).verdict).toBe('BLOCK');
    });
  });
});
