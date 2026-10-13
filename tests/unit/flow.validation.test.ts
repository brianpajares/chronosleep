import { beforeEach, describe, expect, it } from 'vitest';
import { POST as calculatePOST } from '@/app/api/calculate/route';
import { POST as reportRequestPOST } from '@/app/api/report-requests/route';
import { GET as reportGET } from '@/app/api/reports/[id]/route';
import { GET as pdfGET } from '@/app/api/reports/[id]/pdf/route';
import { GET as icsGET } from '@/app/api/reports/[id]/ics/route';
import { GET as healthGET } from '@/app/api/health/route';
import { POST as checkoutPOST } from '@/app/api/checkout/session/route';
import { POST as webhookPOST } from '@/app/api/stripe/webhook/route';
import { devOutbox } from '@/server/email/send';
import { approveLead, resendLead } from '@/server/services/admin-actions';
import { getStore } from '@/server/store';
import { ctx, get, post, setupEnv, tokenFromEmail, TV01 } from './helpers';

const EMAIL = 'persona.de.prueba@example.test';

async function calculate(locale: 'es' | 'en' | 'pt' = 'es', inputs: unknown = TV01) {
  const res = await calculatePOST(post('/api/calculate', { inputs, locale }), undefined);
  return { res, body: (await res.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function requestReport(calculationId: string, extra: Record<string, unknown> = {}) {
  const res = await reportRequestPOST(
    post('/api/report-requests', {
      calculation_id: calculationId,
      email: EMAIL,
      consent_report: true,
      consent_owner_copy: false,
      locale: 'es',
      turnstile_token: 'XXXX.DUMMY.TOKEN.XXXX',
      ...extra,
    }),
    undefined,
  );
  return { res, body: (await res.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('E2E validation flow at the API layer (AT-05..AT-14, AT-24)', () => {
  beforeEach(() => setupEnv());

  it('/api/calculate returns the exact engine object, a request id, and stores only ciphertext', async () => {
    const { res, body } = await calculate();
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(body.request_id).toBe(res.headers.get('x-request-id'));
    expect(body.model_version).toBe('chronosleep-sjl-2.0');
    expect(body.preview.social_jetlag_hours).toBe(1.875);
    expect(body.preview.direction).toBe('later');
    expect(body.domain.plan.planned_social_jetlag_hours).toBe(0);

    const row = await getStore().getCalculation(body.calculation_id);
    expect(row).toBeTruthy();
    const dump = JSON.stringify(row);
    expect(dump).not.toContain('23:30');
    expect(dump).not.toContain('06:45');
    expect(row!.sjl_band).toBe('1h_2h');
    // 30-day anonymous retention by default
    const days = (new Date(row!.expires_at).getTime() - new Date(row!.created_at).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  it('rejects invalid inputs with contract error codes (400) and never 500', async () => {
    const bad = [
      { ...TV01, work_bedtime: '24:00' },
      { ...TV01, sleep_latency_min: 121 },
      { ...TV01, workdays_per_week: 7 },
      { ...TV01, wake_flexibility_min: 5.5 },
      { ...TV01, extra_field: true },
    ];
    for (const inputs of bad) {
      const { res, body } = await calculate('es', inputs);
      expect(res.status).toBe(400);
      expect(body.request_id).toBeTruthy();
    }
    const dur = await calculate('es', { ...TV01, work_bedtime: '23:00', work_wake_time: '23:30', sleep_latency_min: 15 });
    expect(dur.res.status).toBe(400);
    expect(dur.body.code).toBe('sleep_duration_work');
    expect(dur.body.hours).toBeCloseTo(0.25, 2);
    const malformed = await calculatePOST(post('/api/calculate', '{not json'), undefined);
    expect(malformed.status).toBe(400);
  });

  it('creates the lead, encrypts the email, sends confirmation + owner mail with the PDF', async () => {
    const calc = await calculate();
    const { res, body } = await requestReport(calc.body.calculation_id);
    expect(res.status).toBe(201);
    expect(body).toMatchObject({ status: 'awaiting_owner', mode: 'validation' });

    const lead = await getStore().getLead(body.id);
    expect(lead!.email_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(lead)).not.toContain('persona.de.prueba');
    expect(lead!.consent_owner_copy).toBe(false);
    // the calculation now lives as long as the lead (90 d)
    const calcRow = await getStore().getCalculation(calc.body.calculation_id);
    const leadDays = (new Date(calcRow!.expires_at).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(leadDays)).toBe(90);

    const box = devOutbox.all();
    expect(box).toHaveLength(2);
    const user = box.find((m) => m.to === EMAIL)!;
    const owner = box.find((m) => m.to === 'owner@example.test')!;

    expect(user.subject).toBe('Recibimos tu solicitud de informe ChronoSleep');
    expect(user.html + user.text).not.toMatch(/\b\d{1,2}:\d{2}\b/); // no schedules in the user email
    expect(user.html).toContain('CS-');

    expect(owner.subject).toBe(`[ChronoSleep] Solicitud de informe ${body.id}`);
    expect(owner.attachments[0]).toMatchObject({ contentType: 'application/pdf' });
    expect(owner.attachments[0]!.bytes).toBeGreaterThan(8000);
    // consent_owner_copy=false → no raw schedules in the owner email
    expect(owner.html + owner.text).not.toContain('23:30');
    expect(owner.html + owner.text).not.toContain('work_bedtime');
    expect(owner.text).toContain('1h_2h');
  });

  it('includes raw inputs for the owner only with the separate opt-in (FR-11)', async () => {
    const calc = await calculate();
    await requestReport(calc.body.calculation_id, { consent_owner_copy: true });
    const owner = devOutbox.all().find((m) => m.to === 'owner@example.test')!;
    expect(owner.text).toContain('work_bedtime=23:30');
    expect(owner.text).toContain('1 h 53 min');
  });

  it('is idempotent: the same email + calculation does not duplicate leads or emails', async () => {
    const calc = await calculate();
    const a = await requestReport(calc.body.calculation_id);
    const b = await requestReport(calc.body.calculation_id);
    expect(b.body.id).toBe(a.body.id);
    expect(devOutbox.all()).toHaveLength(2);
  });

  it('requires consent and a valid email; unknown calculation is 410', async () => {
    const calc = await calculate();
    const noConsent = await requestReport(calc.body.calculation_id, { consent_report: false });
    expect(noConsent.res.status).toBe(400);
    const badEmail = await requestReport(calc.body.calculation_id, { email: 'not-an-email' });
    expect(badEmail.res.status).toBe(400);
    const missing = await requestReport('3f2b8c1e-5a4d-4e8f-9a7b-1c2d3e4f5a6b');
    expect(missing.res.status).toBe(410);
  });

  it('approve → delivery mail with an expiring opaque link; token auth, expiry and rotation (AT-12)', async () => {
    const calc = await calculate();
    const { body } = await requestReport(calc.body.calculation_id);
    devOutbox.clear();

    await approveLead(body.id, 'admin-1');
    const delivery = devOutbox.all().find((m) => m.to === EMAIL)!;
    expect(delivery.subject).toBe('Tu informe ChronoSleep está listo');
    expect(delivery.attachments[0]?.contentType).toBe('application/pdf');
    const { id, token } = tokenFromEmail(delivery.html);
    expect(id).toBe(body.id);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(delivery.html + delivery.text).not.toMatch(/persona\.de\.prueba/);

    const lead = await getStore().getLead(body.id);
    expect(lead).toMatchObject({ status: 'delivered' });
    expect(lead!.owner_approved_at).toBeTruthy();
    const art = await getStore().getArtifact(body.id);
    expect(art!.access_token_hash).not.toContain(token); // only the hash is stored

    const ok = await reportGET(get(`/api/reports/${id}?token=${token}`), ctx({ id }));
    expect(ok.status).toBe(200);
    const report = (await ok.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(report.outputs.plan_7d).toHaveLength(7);
    expect(report.outputs.scenario_more_flex.flexibility_min).toBe(60);
    expect(report.pdf_url).toContain(`/api/reports/${id}/pdf`);

    const wrong = await reportGET(get(`/api/reports/${id}?token=${token}x`), ctx({ id }));
    expect(wrong.status).toBe(401);
    const none = await reportGET(get(`/api/reports/${id}`), ctx({ id }));
    expect(none.status).toBe(401);

    // PDF + ICS downloads share the same authorisation
    const pdf = await pdfGET(get(`/api/reports/${id}/pdf?token=${token}`), ctx({ id }));
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
    const ics = await icsGET(get(`/api/reports/${id}/ics?token=${token}&start=2026-10-12`), ctx({ id }));
    expect(ics.status).toBe(200);
    const icsText = await ics.text();
    expect(icsText.match(/BEGIN:VEVENT/g)).toHaveLength(7);
    expect(icsText).toContain('DTSTART:20261012T000000');
    expect((await pdfGET(get(`/api/reports/${id}/pdf?token=bad`), ctx({ id }))).status).toBe(401);

    // resend rotates the token: the previous link stops working
    devOutbox.clear();
    await resendLead(body.id, 'admin-1');
    const second = tokenFromEmail(devOutbox.all().find((m) => m.to === EMAIL)!.html);
    expect(second.token).not.toBe(token);
    expect((await reportGET(get(`/api/reports/${id}?token=${token}`), ctx({ id }))).status).toBe(401);
    expect((await reportGET(get(`/api/reports/${id}?token=${second.token}`), ctx({ id }))).status).toBe(200);

    // an expired token fails
    await getStore().updateArtifact(id, { access_token_expires_at: new Date(Date.now() - 1000).toISOString() });
    expect((await reportGET(get(`/api/reports/${id}?token=${second.token}`), ctx({ id }))).status).toBe(401);
  });

  it('a lead nobody approved has no usable report link', async () => {
    const calc = await calculate();
    const { body } = await requestReport(calc.body.calculation_id);
    const res = await reportGET(get(`/api/reports/${body.id}?token=anything-anything-anything`), ctx({ id: body.id }));
    expect(res.status).toBe(401);
  });

  it('email failures never lose the lead: delivery rows are marked failed with a category only', async () => {
    setupEnv({ OWNER_EMAIL: undefined });
    const calc = await calculate();
    const { res, body } = await requestReport(calc.body.calculation_id);
    expect(res.status).toBe(201);
    const deliveries = await getStore().listDeliveries({ leadId: body.id });
    const owner = deliveries.find((d) => d.channel === 'owner_email')!;
    expect(owner.status).toBe('failed');
    expect(owner.last_error_category).toBe('owner_email_not_configured');
  });

  it('stripe is unreachable in validation mode (FR-24 / AT-24)', async () => {
    const co = await checkoutPOST(post('/api/checkout/session', { report_request_id: '3f2b8c1e-5a4d-4e8f-9a7b-1c2d3e4f5a6b' }), undefined);
    expect(co.status).toBe(404);
    const wh = await webhookPOST(post('/api/stripe/webhook', '{}', { 'stripe-signature': 't=1,v1=x' }), undefined);
    expect(wh.status).toBe(404);
  });

  it('health is ok with the in-memory store and a bundled Drive baseline (AT-20 / NT-03)', async () => {
    const res = await healthGET(get('/api/health'), undefined);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, string | boolean>;
    expect(body).toMatchObject({ status: 'ok', db: 'ok', drive: 'ok', model_version: 'chronosleep-sjl-2.0', mode: 'validation' });
  });
});
