import { unzipSync, strFromU8 } from 'fflate';

/**
 * Tiny XLSX reader (zip + XML, like the Python reference reader) — enough for the
 * `Parametros` / `Tablas_Referencia_SJL` sheets of base_chronosleep.xlsx.
 * Tolerates namespace-prefixed XML (`<x:row>`) as produced by Open XML SDK.
 */

const NS = '(?:[A-Za-z0-9]+:)?';
const re = (pattern: string, flags = 'g') => new RegExp(pattern.replaceAll('NS', NS), flags);

const decodeXml = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

function sharedStrings(files: Record<string, Uint8Array>): string[] {
  const raw = files['xl/sharedStrings.xml'];
  if (!raw) return [];
  const xml = strFromU8(raw);
  const out: string[] = [];
  for (const si of xml.matchAll(re('<NSsi>([\\s\\S]*?)</NSsi>'))) {
    const text = [...(si[1] ?? '').matchAll(re('<NSt[^>]*>([\\s\\S]*?)</NSt>'))]
      .map((m) => decodeXml(m[1] ?? ''))
      .join('');
    out.push(text);
  }
  return out;
}

function sheetPath(files: Record<string, Uint8Array>, sheetName: string): string {
  const wb = strFromU8(files['xl/workbook.xml'] ?? new Uint8Array());
  const sheet = [...wb.matchAll(re('<NSsheet\\b[^>]*>'))]
    .map((m) => m[0])
    .find((tag) => tag.includes(`name="${sheetName}"`));
  const rid = sheet?.match(/\br:id="([^"]+)"/)?.[1];
  if (!rid) throw new Error(`xlsx: sheet "${sheetName}" not found`);
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels'] ?? new Uint8Array());
  const rel = [...rels.matchAll(re('<NSRelationship\\b[^>]*>'))]
    .map((m) => m[0])
    .find((t) => t.includes(`Id="${rid}"`));
  const target = rel?.match(/Target="([^"]+)"/)?.[1];
  if (!target) throw new Error(`xlsx: relationship for "${sheetName}" not found`);
  if (target.startsWith('/')) return target.slice(1);
  return target.startsWith('xl/') ? target : `xl/${target}`;
}

export type Cell = string | number | boolean | null;

export function readSheet(bytes: Uint8Array, sheetName: string): Cell[][] {
  const files = unzipSync(bytes);
  const shared = sharedStrings(files);
  const xml = strFromU8(files[sheetPath(files, sheetName)] ?? new Uint8Array());
  const rows: Cell[][] = [];
  for (const row of xml.matchAll(re('<NSrow\\b[^>]*>([\\s\\S]*?)</NSrow>'))) {
    const cells = new Map<number, Cell>();
    let max = -1;
    for (const c of (row[1] ?? '').matchAll(re('<NSc\\b([^>]*?)(?:/>|>([\\s\\S]*?)</NSc>)'))) {
      const attrs = c[1] ?? '';
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1] ?? 'A';
      let col = 0;
      for (const ch of ref) col = col * 26 + (ch.charCodeAt(0) - 64);
      col -= 1;
      max = Math.max(max, col);
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const inner = c[2] ?? '';
      let value: Cell;
      if (type === 'inlineStr') {
        value = decodeXml(inner.match(re('<NSt[^>]*>([\\s\\S]*?)</NSt>', ''))?.[1] ?? '');
      } else {
        const v = inner.match(re('<NSv>([\\s\\S]*?)</NSv>', ''))?.[1];
        if (v === undefined || v === '') value = null;
        else if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'str' || type === 'e') value = decodeXml(v);
        else if (type === 'b') value = v === '1';
        else value = Number.isNaN(Number(v)) ? v : Number(v);
      }
      cells.set(col, value);
    }
    if (max >= 0) rows.push(Array.from({ length: max + 1 }, (_, i) => cells.get(i) ?? null));
  }
  return rows;
}

/** `Parametros` sheet -> { parametro: valor } (header: parametro, valor, ...). */
export function readParametros(bytes: Uint8Array): Record<string, Cell> {
  const rows = readSheet(bytes, 'Parametros');
  const header = (rows[0] ?? []).map((h) => String(h ?? '').trim().toLowerCase());
  const pi = header.indexOf('parametro');
  const vi = header.indexOf('valor');
  if (pi < 0 || vi < 0) throw new Error('xlsx: Parametros needs columns parametro and valor');
  const out: Record<string, Cell> = {};
  for (const r of rows.slice(1)) {
    const name = r[pi];
    if (name !== null && name !== undefined && name !== '') out[String(name)] = r[vi] ?? null;
  }
  return out;
}
