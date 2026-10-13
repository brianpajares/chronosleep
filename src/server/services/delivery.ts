import 'server-only';
import { randomUUID } from 'node:crypto';
import { sjlBand, verificationIdFromUuid } from '@/domain/chronosleep';
import { formatClock, formatHoursMinutes } from '@/domain/chronosleep';
import { openJson } from '../crypto';
import { appOrigin, env } from '../env';
import { sendEmail, type OutgoingEmail } from '../email/send';
import { deliveryEmail, ownerRequestEmail, userConfirmationEmail } from '../email/templates';
import { log } from '../logger';
import { reportError } from '../observability';
import { getStore, type DeliveryRow, type LeadRow } from '../store';
import { ensureArtifact, mintAccessToken, PDF_CONTENT_TYPE } from './artifacts';
import { loadCalculation } from './calculations';

const MAX_ATTEMPTS = 3;

export function decryptLeadEmail(lead: LeadRow): string {
  return openJson<string>({ ciphertext: lead.email_ciphertext, iv: lead.email_iv, tag: lead.email_tag }, lead.id);
}

const prefix = (locale: string) => (locale === 'es' ? '' : `/${locale}`);
export const privacyUrl = (locale: string) => `${appOrigin()}${prefix(locale)}/legal/privacidad`;
export const reportUrl = (locale: string, leadId: string, token: string) =>
  `${appOrigin()}${prefix(locale)}/informe/${leadId}?token=${token}`;

/** Creates the queue row, sends, and records the outcome. Error categories only — never contents. */
async function deliver(
  lead: LeadRow,
  channel: DeliveryRow['channel'],
  build: () => Promise<OutgoingEmail | null>,
  existing?: DeliveryRow,
): Promise<DeliveryRow> {
  const store = getStore();
  const row: DeliveryRow =
    existing ?? {
      id: randomUUID(),
      lead_id: lead.id,
      created_at: new Date().toISOString(),
      channel,
      status: 'queued',
      provider_message_id: null,
      attempt_count: 0,
      last_error_category: null,
      sent_at: null,
    };
  if (!existing) await store.insertDelivery(row);

  const attempt = row.attempt_count + 1;
  let outcome: { ok: true; id: string } | { ok: false; category: string };
  try {
    const email = await build();
    if (!email) {
      outcome = { ok: false, category: channel === 'owner_email' ? 'owner_email_not_configured' : 'email_unavailable' };
    } else {
      outcome = await sendEmail({ ...email, idempotencyKey: `delivery-${row.id}-a${attempt}` });
    }
  } catch (err) {
    reportError(err, { channel, source: 'delivery' });
    outcome = { ok: false, category: 'build_error' };
  }

  const patch: Partial<DeliveryRow> = outcome.ok
    ? { status: 'sent', attempt_count: attempt, provider_message_id: outcome.id, sent_at: new Date().toISOString(), last_error_category: null }
    : { status: 'failed', attempt_count: attempt, last_error_category: outcome.category };
  await store.updateDelivery(row.id, patch);
  log.info('delivery', { delivery_id: row.id, lead_id: lead.id, channel, status: outcome.ok ? 200 : 502, error_category: outcome.ok ? undefined : outcome.category, attempt });
  return { ...row, ...patch };
}

/** FR-10: confirmation to the user — ID only, no schedules. */
export function sendUserConfirmation(lead: LeadRow, existing?: DeliveryRow) {
  return deliver(
    lead,
    'user_email',
    async () => {
      const mail = userConfirmationEmail({
        locale: lead.locale,
        verificationId: verificationIdFromUuid(lead.id),
        privacyUrl: privacyUrl(lead.locale),
      });
      return { to: decryptLeadEmail(lead), ...mail };
    },
    existing,
  );
}

/** FR-10/FR-11: owner notification with the PDF; raw inputs only with the separate opt-in. */
export function sendOwnerNotification(lead: LeadRow, existing?: DeliveryRow) {
  return deliver(
    lead,
    'owner_email',
    async () => {
      const to = env.ownerEmail();
      if (!to) return null;
      const calc = await loadCalculation(lead.calculation_id);
      const artifact = await ensureArtifact(lead);
      const pdf = await getStore().getBlob(artifact.storage_path);
      const shared =
        lead.consent_owner_copy && calc
          ? {
              sjl: formatHoursMinutes(calc.result.current.social_jetlag_hours),
              midWork: formatClock(calc.result.current.mid_sleep_work, 'es'),
              midFree: formatClock(calc.result.current.mid_sleep_free, 'es'),
              inputs: calc.inputs as unknown as Record<string, string | number | boolean>,
            }
          : undefined;
      const mail = ownerRequestEmail({
        leadId: lead.id,
        requestLocale: lead.locale,
        createdAt: new Date(lead.created_at),
        band: calc ? sjlBand(calc.result.current.social_jetlag_hours) : 'n/a',
        consentOwnerCopy: lead.consent_owner_copy,
        waitlist: lead.waitlist_subscription,
        mode: env.monetizationMode(),
        adminUrl: `${appOrigin()}/admin`,
        shared,
      });
      return {
        to,
        ...mail,
        attachments: pdf
          ? [{ filename: `chronosleep-${verificationIdFromUuid(lead.id)}.pdf`, content: pdf, contentType: PDF_CONTENT_TYPE }]
          : undefined,
      };
    },
    existing,
  );
}

/** Report delivery (owner approval or paid order): fresh expiring link + PDF attached. */
export function sendReportReady(lead: LeadRow, existing?: DeliveryRow) {
  return deliver(
    lead,
    'user_email',
    async () => {
      const artifact = await ensureArtifact(lead);
      const { token, expiresAt } = await mintAccessToken(lead.id);
      const pdf = await getStore().getBlob(artifact.storage_path);
      const mail = deliveryEmail({
        locale: lead.locale,
        reportUrl: reportUrl(lead.locale, lead.id, token),
        expiresAt,
        verificationId: verificationIdFromUuid(lead.id),
        privacyUrl: privacyUrl(lead.locale),
      });
      return {
        to: decryptLeadEmail(lead),
        ...mail,
        attachments: pdf
          ? [{ filename: `chronosleep-${verificationIdFromUuid(lead.id)}.pdf`, content: pdf, contentType: PDF_CONTENT_TYPE }]
          : undefined,
      };
    },
    existing,
  );
}

/** Daily cron: retry failed deliveries that still have attempts left (never the report-ready link twice per run). */
export async function retryFailedDeliveries(limit = 20): Promise<{ retried: number; recovered: number }> {
  const store = getStore();
  const failed = (await store.listDeliveries({ status: 'failed' })).filter((d) => d.attempt_count < MAX_ATTEMPTS).slice(0, limit);
  let recovered = 0;
  for (const d of failed) {
    const lead = await store.getLead(d.lead_id);
    if (!lead || lead.status === 'deleted') continue;
    const approved = Boolean(lead.owner_approved_at);
    const res =
      d.channel === 'owner_email'
        ? await sendOwnerNotification(lead, d)
        : approved
          ? await sendReportReady(lead, d)
          : await sendUserConfirmation(lead, d);
    if (res.status === 'sent') {
      recovered++;
      if (d.channel === 'user_email' && approved && lead.status !== 'delivered') {
        await store.updateLead(lead.id, { status: 'delivered', delivered_at: new Date().toISOString() });
      }
    }
  }
  return { retried: failed.length, recovered };
}
