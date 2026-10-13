import 'server-only';
import { getStore } from '../store';
import { eraseLead } from './privacy';

export interface RetentionReport {
  leadsDeleted: number;
  leadsScrubbed: number;
  calculationsDeleted: number;
}

/**
 * FR-33 / AT-33 — daily job (cron). Defaults: anonymous calculations 30 d, leads/reports 90 d
 * (configurable via RETENTION_* env), orders kept up to 7 y only where a tax duty applies —
 * leads that own an order are scrubbed in place instead of deleted.
 * Blobs (PDFs) are removed before their rows.
 */
export async function runRetention(now = new Date(), batch = 200): Promise<RetentionReport> {
  const store = getStore();
  const nowIso = now.toISOString();
  const report: RetentionReport = { leadsDeleted: 0, leadsScrubbed: 0, calculationsDeleted: 0 };

  for (const lead of await store.findExpiredLeads(nowIso, batch)) {
    const r = await eraseLead(lead);
    if (r === 'deleted') report.leadsDeleted++;
    else report.leadsScrubbed++;
  }
  for (const calc of await store.findExpiredCalculations(nowIso, batch)) {
    await store.deleteCalculation(calc.id);
    report.calculationsDeleted++;
  }

  await store.appendAudit({
    actor_type: 'system',
    action: 'retention_run',
    entity_type: 'system',
    metadata: { ...report },
  });
  return report;
}
