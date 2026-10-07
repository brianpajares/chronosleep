import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import specCopy from '../../spec/copy_i18n.json';
import { deepMerge, getMessages, type MessageLocale } from '@/messages';

const LOCALES: MessageLocale[] = ['es', 'en', 'pt'];

type Leaf = { path: string; value: string };

function leaves(node: unknown, path = ''): Leaf[] {
  if (typeof node === 'string') return [{ path, value: node }];
  if (Array.isArray(node)) return node.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  return [];
}

function placeholders(s: string): string[] {
  const names = new Set<string>();
  const walk = (els: MessageFormatElement[]) => {
    for (const el of els) {
      if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) {
        names.add(el.value);
      } else if (el.type === TYPE.select || el.type === TYPE.plural) {
        names.add(el.value);
        for (const opt of Object.values(el.options)) walk(opt.value);
      } else if (el.type === TYPE.tag) {
        walk(el.children);
      }
    }
  };
  walk(parse(s));
  return [...names].sort();
}

describe('i18n catalog (AT-15, NT-07)', () => {
  const catalogs = Object.fromEntries(LOCALES.map((l) => [l, getMessages(l)])) as Record<
    MessageLocale,
    Record<string, unknown>
  >;

  it('extras never redefine keys of spec/copy_i18n.json', () => {
    expect(() => deepMerge({ a: { b: 'x' } }, { a: { b: 'y' } })).toThrow(/already defined/);
    for (const l of LOCALES) expect(() => getMessages(l)).not.toThrow();
  });

  it('contains every spec leaf verbatim', () => {
    for (const l of LOCALES) {
      const spec = (specCopy as unknown as Record<string, unknown>)[l];
      const merged = new Map(leaves(catalogs[l]).map((x) => [x.path, x.value]));
      for (const leaf of leaves(spec)) {
        expect(merged.get(leaf.path), `${l}:${leaf.path}`).toBe(leaf.value);
      }
    }
  });

  it('has identical key sets in es / en / pt (100% critical keys)', () => {
    const base = leaves(catalogs.es).map((x) => x.path).sort();
    for (const l of ['en', 'pt'] as const) {
      expect(leaves(catalogs[l]).map((x) => x.path).sort(), l).toEqual(base);
    }
  });

  it('uses the same ICU placeholders in every locale', () => {
    const es = new Map(leaves(catalogs.es).map((x) => [x.path, placeholders(x.value)]));
    for (const l of ['en', 'pt'] as const) {
      for (const leaf of leaves(catalogs[l])) {
        expect(placeholders(leaf.value), `${l}:${leaf.path}`).toEqual(es.get(leaf.path));
      }
    }
  });

  it('every message parses as valid ICU MessageFormat', () => {
    for (const l of LOCALES) {
      for (const leaf of leaves(catalogs[l])) {
        expect(() => new IntlMessageFormat(leaf.value, l), `${l}:${leaf.path}`).not.toThrow();
      }
    }
  });

  it('no empty strings', () => {
    for (const l of LOCALES) {
      for (const leaf of leaves(catalogs[l])) expect(leaf.value.trim().length, `${l}:${leaf.path}`).toBeGreaterThan(0);
    }
  });

  it('never claims diagnosis/treatment affirmatively (wellness guardrail)', () => {
    const forbidden = [/\bcura(r|mos)?\b/i, /\bcure\b/i, /tu cronotipo es/i, /your chronotype is/i, /seu cronotipo é/i, /riesgo alto/i, /high risk/i];
    for (const l of LOCALES) {
      for (const leaf of leaves(catalogs[l])) {
        for (const re of forbidden) expect(re.test(leaf.value), `${l}:${leaf.path}`).toBe(false);
      }
    }
  });
});
