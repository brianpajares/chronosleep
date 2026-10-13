import 'server-only';
import { randomUUID } from 'node:crypto';
import { buildReport, type ReportModel } from '@/domain/chronosleep';
import { ApiError } from '../api';
import { hashToken, randomToken, safeEqualHex } from '../crypto';
import { getEngineParams } from '../drive';
import { env } from '../env';
import { renderReportPdf } from '../pdf/render';
import { getStore, type ArtifactRow, type LeadRow } from '../store';
import { loadCalculation } from './calculations';

const DAY_MS = 86_400_000;
export const PDF_CONTENT_TYPE = 'application/pdf';

export const pdfPath = (leadId: string): string => `${leadId}/chronosleep-report.pdf`;

export async function buildReportForLead(lead: LeadRow): Promise<{ report: ReportModel; locale: LeadRow['locale'] }> {
  const calc = await loadCalculation(lead.calculation_id);
  if (!calc) throw new ApiError(410, 'calculation_expired', 'The calculation behind this request no longer exists');
  const { params } = await getEngineParams();
  return { report: buildReport(calc.inputs, params, calc.result), locale: lead.locale };
}

/**
 * FR-09: renders the PDF once per lead and stores it privately. The row starts with an already
 * expired, unknowable token hash: nobody can open the report until a delivery mints a real token.
 */
export async function ensureArtifact(lead: LeadRow): Promise<ArtifactRow> {
  const store = getStore();
  const existing = await store.getArtifact(lead.id);
  if (existing && !existing.deleted_at && (await store.getBlob(existing.storage_path))) return existing;

  const { report, locale } = await buildReportForLead(lead);
  const pdf = await renderReportPdf({ report, locale, entityId: lead.id });
  const path = pdfPath(lead.id);
  await store.putBlob(path, pdf.bytes, PDF_CONTENT_TYPE);

  const now = Date.now();
  const row: ArtifactRow = {
    id: existing?.id ?? randomUUID(),
    lead_id: lead.id,
    created_at: new Date(now).toISOString(),
    expires_at: lead.expires_at,
    report_version: report.report_version,
    storage_path: path,
    sha256: pdf.sha256,
    access_token_hash: hashToken(randomToken()),
    access_token_expires_at: new Date(now - 1000).toISOString(),
    bytes: pdf.bytes.length,
    deleted_at: null,
  };
  await store.upsertArtifact(row);
  return row;
}

/** Mints a fresh opaque token (only its hash is stored). Previous links stop working. */
export async function mintAccessToken(leadId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + env.retention().reportTokenDays * DAY_MS);
  await getStore().updateArtifact(leadId, {
    access_token_hash: hashToken(token),
    access_token_expires_at: expiresAt.toISOString(),
  });
  return { token, expiresAt };
}

export interface ReportAccess {
  lead: LeadRow;
  artifact: ArtifactRow;
  report: ReportModel;
}

/** FR-12: opaque, expiring token. Errors never reveal whether the id exists. */
export async function resolveReportAccess(id: string, token: string | null | undefined): Promise<ReportAccess> {
  const store = getStore();
  const lead = await store.getLead(id);
  const artifact = lead ? await store.getArtifact(id) : null;
  const unauthorized = new ApiError(401, 'unauthorized', 'Invalid or expired link');
  if (!lead || !artifact || lead.deleted_at || lead.status === 'deleted' || artifact.deleted_at || !token) throw unauthorized;
  if (new Date(artifact.access_token_expires_at).getTime() < Date.now()) throw unauthorized;
  if (!safeEqualHex(hashToken(token), artifact.access_token_hash)) throw unauthorized;
  const { report } = await buildReportForLead(lead);
  return { lead, artifact, report };
}
