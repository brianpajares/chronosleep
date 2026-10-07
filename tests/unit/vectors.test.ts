import { describe, expect, it } from 'vitest';
import vectors from '../../spec/test_vectors.json';
import { calculate } from '@/domain/chronosleep';

const TOL = 1e-6;

/** Deep comparison: numbers at rel/abs 1e-6, everything else strictly equal. */
export function deepCompare(actual: unknown, expected: unknown, path = '$'): string[] {
  const diffs: string[] = [];
  if (typeof expected === 'number') {
    if (typeof actual !== 'number') {
      return [`${path}: expected number ${expected}, got ${String(actual)}`];
    }
    const ok = Math.abs(actual - expected) <= Math.max(TOL, TOL * Math.abs(expected));
    if (!ok) diffs.push(`${path}: ${actual} != ${expected}`);
    return diffs;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      return [
        `${path}: array length ${Array.isArray(actual) ? actual.length : 'n/a'} != ${expected.length}`,
      ];
    }
    expected.forEach((e, i) => diffs.push(...deepCompare(actual[i], e, `${path}[${i}]`)));
    return diffs;
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object') return [`${path}: expected object`];
    const a = actual as Record<string, unknown>;
    const e = expected as Record<string, unknown>;
    const ak = Object.keys(a).sort().join(',');
    const ek = Object.keys(e).sort().join(',');
    if (ak !== ek) diffs.push(`${path}: keys [${ak}] != [${ek}]`);
    for (const k of Object.keys(e)) diffs.push(...deepCompare(a[k], e[k], `${path}.${k}`));
    return diffs;
  }
  if (actual !== expected) {
    diffs.push(`${path}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
  return diffs;
}

describe('engine vs spec/test_vectors.json (AT-04, NT-05)', () => {
  it('has the 21 official vectors', () => {
    expect(vectors).toHaveLength(21);
  });

  for (const v of vectors) {
    it(`${v.case_id} ${v.metadata.label}`, () => {
      const out = calculate(v.inputs);
      expect(deepCompare(out, v.expected_outputs)).toEqual([]);
    });
  }
});
