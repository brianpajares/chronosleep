import { beforeEach, describe, expect, it } from 'vitest';
import { POST as calculatePOST } from '@/app/api/calculate/route';
import { POST as privacyPOST } from '@/app/api/privacy/requests/route';
import { POST as reportRequestPOST } from '@/app/api/report-requests/route';
import { GET as retentionGET } from '@/app/api/cron/retention/route';
import { GET as driveCronGET } from '@/app/api/cron/drive-verify/route';
import { devOutbox } from '@/server/email/send';
import { approveLead } from '@/server/services/admin-actions';
import { completePrivacyRequest, exportPrivacyData, markVerified } from '@/server/services/privacy';
import { runRetention } from '@/server/services/retention';
import { retryFailedDeliveries } from '@/server/services/delivery';
import { getStore, MemoryStore } from '@/server/store';
import { get, post, setupEnv, TV01 } from './helpers';

const EMAIL = 'derechos@example.test';

async function makeLead(email = EMAIL) {
  const calc = (await (await calculatePOST(post('/api/calculate', { inputs: TV01, locale: 'es' }), undefined)).json()) as { calculation_id: string };
  const rr = await reportRequestPOST(
    post('/api/report-requests', { calculation_id: calc.calculation_id, email, consent_report: true, locale: 'es', turnstile_token: 't' }),
    undefined,
  );
  const body = (await rr.json()) as { id: string };
  return { leadId: body.id, calcId: calc.calculation_id };
}

describe('data rights (FR-16, AT-16)', () => {
  beforeEach(() => setupEnv());

  it('intake is a uniform 202 and never confirms whether data exists', async () => {
    await makeLead();
    const known = await privacyPOST(post('/api/privacy/requests', { email: EMAIL, request_type: 'deletion', locale: 'es', turnstile_token: 't' }), undefined);
    const unknown = await privacyPOST(post('/api/privacy/requests', { email: 'nadie@example.test', request_type: 'deletion', locale: 'es', turnstile_token: 't' }), undefined);
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    const a = (await known.json()) as Record<string, unknown>;
    const b = (await unknown.json()) as Record<string, unknown>;
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    // the acknowledgement does not reveal existence either
    const ack = devOutbox.all().filter((m) => m.to === EMAIL && m.subject.includes('privacidad'));
    expect(ack[0]!.text).toContain('no confirmamos si existen datos');
  });

  it('refuses to execute before identity verification, then erases payload, email and PDF', async () => {
    const { leadId, calcId } = await makeLead();
    await approveLead(leadId, 'admin');
    const store = getStore();
    const art = await store.getArtifact(leadId);
    expect(await store.getBlob(art!.storage_path)).toBeTruthy();

    await privacyPOST(post('/api/privacy/requests', { email: EMAIL, request_type: 'deletion', locale: 'es', turnstile_token: 't' }), undefined);
    const req = (await store.listPrivacyRequests())[0]!;
    await expect(completePrivacyRequest(req.id, 'admin')).rejects.toMatchObject({ code: 'not_verified' });

    await markVerified(req.id, 'admin');
    const result = await completePrivacyRequest(req.id, 'admin');
    expect(result).toEqual({ deleted: 1, scrubbed: 0 });

    expect(await store.getLead(leadId)).toBeNull();
    expect(await store.getCalculation(calcId)).toBeNull();
    expect(await store.getBlob(art!.storage_path)).toBeNull();

    const done = (await store.getPrivacyRequest(req.id))!;
    expect(done.status).toBe('completed');
    expect(done.email_ciphertext).toBe('');
    // minimal, non-reversible audit: counts only, never an email or hash of it
    const audit = MemoryStore.auditLog().filter((a) => a.action === 'privacy_deletion_completed');
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0])).not.toContain('example.test');
    expect(audit[0]!.metadata).toEqual({ deleted: 1, scrubbed: 0 });
  });

  it('access/portability export is gated by verification and audited', async () => {
    await makeLead();
    await privacyPOST(post('/api/privacy/requests', { email: EMAIL, request_type: 'access', locale: 'es', turnstile_token: 't' }), undefined);
    const req = (await getStore().listPrivacyRequests())[0]!;
    await expect(exportPrivacyData(req.id, 'admin')).rejects.toMatchObject({ code: 'not_verified' });
    await markVerified(req.id, 'admin');
    const data = await exportPrivacyData(req.id, 'admin');
    expect(data.items).toHaveLength(1);
    expect(data.items[0]!.inputs).toMatchObject({ work_bedtime: '23:30' });
    expect(data.requester_email).toBe(EMAIL);
  });

  it('orders under fiscal retention are scrubbed in place instead of deleted', async () => {
    const { leadId, calcId } = await makeLead();
    const store = getStore();
    await store.insertOrder({
      id: 'f2d8c1a0-0000-4000-8000-000000000001',
      lead_id: leadId,
      created_at: new Date().toISOString(),
      status: 'paid',
      stripe_checkout_session_id: 'cs_1',
      stripe_payment_intent_id: 'pi_1',
      currency: 'usd',
      amount_minor: 790,
      country_code: 'US',
      offer_id: 'report_single',
      paid_at: new Date().toISOString(),
      refunded_at: null,
    });
    await privacyPOST(post('/api/privacy/requests', { email: EMAIL, request_type: 'deletion', locale: 'es', turnstile_token: 't' }), undefined);
    const req = (await store.listPrivacyRequests())[0]!;
    await markVerified(req.id, 'admin');
    expect(await completePrivacyRequest(req.id, 'admin')).toEqual({ deleted: 0, scrubbed: 1 });
    const lead = (await store.getLead(leadId))!;
    expect(lead).toMatchObject({ status: 'deleted', email_ciphertext: '' });
    const calc = (await store.getCalculation(calcId))!;
    expect(calc.inputs_ciphertext).toBe('');
    expect((await store.ordersByLead(leadId))).toHaveLength(1);
  });
});

describe('retention job (FR-33, AT-33)', () => {
  beforeEach(() => setupEnv());

  it('purges expired anonymous calculations (30 d) and expired leads (90 d) with their PDFs', async () => {
    const store = getStore();
    const anon = (await (await calculatePOST(post('/api/calculate', { inputs: TV01, locale: 'es' }), undefined)).json()) as { calculation_id: string };
    const { leadId, calcId } = await makeLead();
    const art = await store.getArtifact(leadId);

    // nothing is due yet
    expect(await runRetention(new Date())).toEqual({ leadsDeleted: 0, leadsScrubbed: 0, calculationsDeleted: 0 });

    // day 31: the anonymous calculation goes, the lead (and its calculation) stays
    const day31 = new Date(Date.now() + 31 * 86_400_000);
    expect(await runRetention(day31)).toMatchObject({ calculationsDeleted: 1, leadsDeleted: 0 });
    expect(await store.getCalculation(anon.calculation_id)).toBeNull();
    expect(await store.getLead(leadId)).toBeTruthy();
    expect(await store.getCalculation(calcId)).toBeTruthy();

    // day 91: lead, calculation and the private PDF are gone
    const day91 = new Date(Date.now() + 91 * 86_400_000);
    expect(await runRetention(day91)).toMatchObject({ leadsDeleted: 1 });
    expect(await store.getLead(leadId)).toBeNull();
    expect(await store.getCalculation(calcId)).toBeNull();
    expect(await store.getBlob(art!.storage_path)).toBeNull();
  });

  it('retention periods are configurable', async () => {
    setupEnv({ RETENTION_CALCULATION_DAYS: '7', RETENTION_LEAD_DAYS: '14' });
    const calc = (await (await calculatePOST(post('/api/calculate', { inputs: TV01, locale: 'es' }), undefined)).json()) as { calculation_id: string };
    const row = (await getStore().getCalculation(calc.calculation_id))!;
    expect(Math.round((new Date(row.expires_at).getTime() - Date.now()) / 86_400_000)).toBe(7);
  });

  it('failed deliveries are retried by the daily job', async () => {
    setupEnv({ OWNER_EMAIL: undefined });
    const { leadId } = await makeLead();
    const store = getStore();
    const failed = (await store.listDeliveries({ leadId })).find((d) => d.channel === 'owner_email')!;
    expect(failed.status).toBe('failed');
    process.env.OWNER_EMAIL = 'owner@example.test';
    const r = await retryFailedDeliveries();
    expect(r).toEqual({ retried: 1, recovered: 1 });
    expect((await store.listDeliveries({ leadId })).find((d) => d.channel === 'owner_email')!.status).toBe('sent');
  });

  it('cron endpoints are closed without CRON_SECRET and open only with the right bearer', async () => {
    expect((await retentionGET(get('/api/cron/retention'), undefined)).status).toBe(401);
    setupEnv({ CRON_SECRET: 'cron-secret-123' });
    expect((await retentionGET(get('/api/cron/retention', { authorization: 'Bearer nope' }), undefined)).status).toBe(401);
    const ok = await retentionGET(get('/api/cron/retention', { authorization: 'Bearer cron-secret-123' }), undefined);
    expect(ok.status).toBe(200);
    const drive = await driveCronGET(get('/api/cron/drive-verify', { authorization: 'Bearer cron-secret-123' }), undefined);
    expect(drive.status).toBe(200);
    expect(((await drive.json()) as { files: Record<string, string> }).files['model_params.json']).toMatch(/^(bundled|cache|drive)/);
  });
});
