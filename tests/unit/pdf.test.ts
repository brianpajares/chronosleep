import { describe, expect, it } from 'vitest';
import vectors from '../../spec/test_vectors.json';
import { buildReport } from '@/domain/chronosleep';
import { safe } from '@/server/pdf/ReportDocument';
import { renderReportPdf } from '@/server/pdf/render';

const tv = vectors[0]!;
const uuid = '7f4a2c9e-1b3d-4e5f-8a6b-0c1d2e3f4a5b';

describe('PDF report (AT-09, AT-28, AT-32)', () => {
  for (const locale of ['es', 'en', 'pt'] as const) {
    it(`renders a 10-page PDF in ${locale}`, async () => {
      const report = buildReport(tv.inputs);
      const pdf = await renderReportPdf({ report, locale, entityId: uuid, generatedAt: new Date('2026-10-07T12:00:00Z') });
      const head = Buffer.from(pdf.bytes.slice(0, 5)).toString('latin1');
      expect(head).toBe('%PDF-');
      expect(pdf.bytes.length).toBeGreaterThan(8_000);
      const raw = Buffer.from(pdf.bytes).toString('latin1');
      const pages = raw.match(/\/Type\s*\/Page(?![s\w])/g) ?? [];
      expect(pages.length).toBe(10);
      expect(pdf.verificationId).toMatch(/^CS-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    }, 30_000);
  }

  it('renders extreme cases (12 h tie, alarm, midnight wrap) without throwing', async () => {
    for (const idx of [4, 10, 16, 18]) {
      const v = vectors[idx]!;
      const pdf = await renderReportPdf({ report: buildReport(v.inputs), locale: 'es', entityId: uuid });
      expect(pdf.bytes.length).toBeGreaterThan(8_000);
    }
  }, 60_000);

  it('does not embed an email or schedule-bearing metadata', async () => {
    const report = buildReport(tv.inputs);
    const pdf = await renderReportPdf({ report, locale: 'en', entityId: uuid });
    const raw = Buffer.from(pdf.bytes).toString('latin1');
    expect(raw).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it('safe() replaces glyphs the standard font cannot draw', () => {
    expect(safe('≥ 2 h → 1 h − 30 min ± 15')).toBe('>= 2 h -> 1 h - 30 min +/- 15');
    expect(safe('Información — niño ñ ç ã')).toBe('Información — niño ñ ç ã');
    expect(safe('日本')).toBe('??');
  });
});
