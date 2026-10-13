import { describe, expect, it, vi } from 'vitest';
import { DriveArtifacts } from '@/server/drive/cache';
import { manifest, manifestEntry, readBundled, sha256 } from '@/server/drive/manifest';
import { readParametros, readSheet } from '@/server/drive/xlsx';
import { POPULATION_REFERENCE } from '@/domain/chronosleep';

describe('drive manifest + bundled baseline (AT-19, NT-03)', () => {
  it('lists the 7 artifacts and every bundled copy matches its SHA-256', () => {
    expect(manifest.files).toHaveLength(7);
    for (const f of manifest.files) {
      const bytes = readBundled(f.file);
      expect(sha256(bytes)).toBe(f.sha256);
    }
  });
});

describe('DriveArtifacts: checksum, 24 h cache and last-known-good (AT-19/AT-20)', () => {
  const entry = manifestEntry('model_params.json');
  const good = readBundled('model_params.json');
  const t0 = 1_000_000;

  it('promotes a checksum-valid Drive file and caches it for 24 h', async () => {
    let now = t0;
    const remote = vi.fn(async () => good);
    const d = new DriveArtifacts({ remote, now: () => now });
    const a = await d.get(entry.file);
    expect(a.source).toBe('drive');
    expect(a.degraded).toBe(false);
    now += 23 * 3600 * 1000;
    const b = await d.get(entry.file);
    expect(b.source).toBe('cache');
    expect(remote).toHaveBeenCalledTimes(1); // no Drive call per request
    now += 2 * 3600 * 1000; // > 24 h
    await d.get(entry.file);
    expect(remote).toHaveBeenCalledTimes(2);
  });

  it('never replaces a valid cache with a file whose checksum is wrong', async () => {
    let now = t0;
    let payload: Uint8Array = good;
    const onDegraded = vi.fn();
    const d = new DriveArtifacts({ remote: async () => payload, now: () => now, onDegraded });
    await d.get(entry.file);
    payload = new TextEncoder().encode('{"tampered":true}');
    now += 25 * 3600 * 1000;
    const r = await d.get(entry.file);
    expect(r.source).toBe('cache');
    expect(r.degraded).toBe(true);
    expect(sha256(r.bytes)).toBe(entry.sha256);
    expect(onDegraded).toHaveBeenCalledWith(entry.file, 'checksum_mismatch');
    expect(d.state.degraded).toBe(true);
  });

  it('serves the last valid copy when Drive returns 5xx/timeouts', async () => {
    let now = t0;
    let fail = false;
    const d = new DriveArtifacts({
      remote: async () => {
        if (fail) throw new Error('HTTP 503');
        return good;
      },
      now: () => now,
    });
    await d.get(entry.file);
    fail = true;
    now += 30 * 3600 * 1000;
    const r = await d.get(entry.file);
    expect(r.source).toBe('cache');
    expect(r.degraded).toBe(true);
  });

  it('falls back to the bundled baseline on a cold start with Drive down', async () => {
    const d = new DriveArtifacts({
      remote: async () => {
        throw new Error('ECONNRESET');
      },
    });
    const r = await d.get(entry.file);
    expect(r.source).toBe('bundled');
    expect(r.degraded).toBe(true);
  });

  it('works without any Drive configuration (bundled, not degraded)', async () => {
    const d = new DriveArtifacts();
    const r = await d.get('model_card.md');
    expect(r.source).toBe('bundled');
    expect(r.degraded).toBe(false);
  });

  it('de-duplicates concurrent refreshes', async () => {
    const remote = vi.fn(async () => good);
    const d = new DriveArtifacts({ remote });
    await Promise.all([d.get(entry.file), d.get(entry.file), d.get(entry.file)]);
    expect(remote).toHaveBeenCalledTimes(1);
  });
});

describe('base_chronosleep.xlsx <-> product constants', () => {
  const xlsx = readBundled('base_chronosleep.xlsx');

  it('Parametros match model_params.json', () => {
    const p = readParametros(xlsx);
    const params = JSON.parse(new TextDecoder().decode(readBundled('model_params.json')));
    expect(p.planner_max_free_shift_min).toBe(params.planner_max_free_shift_min);
    expect(p.input_time_uncertainty_min).toBe(params.input_time_uncertainty_min);
    expect(p.adult_sleep_min_hours).toBe(7);
  });

  it('NHANES reference values match reference.ts', () => {
    const p = readParametros(xlsx);
    expect(p.us_mean_sjl_hours).toBe(POPULATION_REFERENCE.mean_sjl_hours);
    expect(p.us_prevalence_sjl_ge_1h).toBe(POPULATION_REFERENCE.prevalence_ge_1h);
    expect(p.us_prevalence_sjl_ge_2h).toBe(POPULATION_REFERENCE.prevalence_ge_2h);
    const rows = readSheet(xlsx, 'Tablas_Referencia_SJL');
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });
});
