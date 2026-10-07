import specCopy from '@spec/copy_i18n.json';
import { en } from './en';
import { es, type Messages } from './es';
import { pt } from './pt';

export type { Messages };
export type MessageLocale = 'es' | 'en' | 'pt';

type Dict = Record<string, unknown>;

const isObject = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * `spec/copy_i18n.json` is the normative catalog (never duplicated). Our own catalog only
 * *adds* keys; redefining a spec key is a build-time error caught by tests/unit/i18n.test.ts.
 */
export function deepMerge(base: Dict, extra: Dict, path = ''): Dict {
  const out: Dict = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const here = path ? `${path}.${k}` : k;
    const existing = out[k];
    if (existing === undefined) {
      out[k] = v;
    } else if (isObject(existing) && isObject(v)) {
      out[k] = deepMerge(existing, v, here);
    } else {
      throw new Error(`i18n: key "${here}" is already defined by spec/copy_i18n.json`);
    }
  }
  return out;
}

const EXTRAS: Record<MessageLocale, Messages> = { es, en, pt };

const cache = new Map<MessageLocale, Dict>();

export function getMessages(locale: MessageLocale): Dict {
  const hit = cache.get(locale);
  if (hit) return hit;
  const spec = (specCopy as unknown as Record<string, Dict>)[locale];
  if (!spec) throw new Error(`i18n: missing spec catalog for locale ${locale}`);
  const merged = deepMerge(spec, EXTRAS[locale] as unknown as Dict);
  cache.set(locale, merged);
  return merged;
}

/** Picks top-level namespaces for client providers (keeps the client bundle small). */
export function pickMessages(locale: MessageLocale, namespaces: readonly string[]): Dict {
  const all = getMessages(locale);
  const out: Dict = {};
  for (const ns of namespaces) if (ns in all) out[ns] = all[ns];
  return out;
}
