import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as calculatePOST } from '@/app/api/calculate/route';
import { POST as checkoutPOST } from '@/app/api/checkout/session/route';
import { GET as healthGET } from '@/app/api/health/route';
import { POST as privacyPOST } from '@/app/api/privacy/requests/route';
import { POST as reportRequestPOST } from '@/app/api/report-requests/route';
import { POST as webhookPOST } from '@/app/api/stripe/webhook/route';
import { mapToGa, sanitizePath } from '@/lib/ga';
import { devOutbox } from '@/server/email/send';
import { getStore } from '@/server/store';
import { get, post, setupEnv, TV01 } from './helpers';

const SECRET = 'whsec_audit_secret_for_unit_tests';
const signer = new Stripe('sk_test_dummy');
const sign = (event: object) => {
  const payload = JSON.stringify(event);
  return post('/api/stripe/webhook', payload, { 'stripe-signature': signer.webhooks.generateTestHeaderString({ payload, secret: SECRET }) });
};

vi.mock('stripe', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown> & { default: typeof Stripe }>();
  const Real = actual.default;
  class Fake extends Real {
    constructor(key: string) {
      super(key);
      Object.assign(this, { checkout: { sessions: { create: async () => ({ id: 'cs_audit_1', url: 'https://checkout.stripe.test/x' }) } } });
    }
  }
  return { ...actual, default: Fake };
});

async function lead(locale: 'es' | 'en' = 'en') {
  const calc = (await (await calculatePOST(post('/api/calculate', { inputs: TV01, locale }), undefined)).json()) as { calculation_id: string };
  const rr = await reportRequestPOST(
    post('/api/report-requests', { calculation_id: calc.calculation_id, email: 'audit@example.test', consent_report: true, locale, turnstile_token: 't' }),
    undefined,
  );
  return (await rr.json()) as { id: string };
}

describe('payments hardening (playbook §3/§9)', () => {
  beforeEach(() => setupEnv({ MONETIZATION_MODE: 'stripe', STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: SECRET }));

  it('does not deliver when the paid amount, currency or owner differ from the order', async () => {
    for (const [i, bad] of [{ amount_total: 1 }, { currency: 'eur' }, { metadata: { lead_id: '00000000-0000-4000-8000-000000000000' } }].entries()) {
      setupEnv({ MONETIZATION_MODE: 'stripe', STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: SECRET });
      const l = await lead();
      await checkoutPOST(post('/api/checkout/session', { report_request_id: l.id, locale: 'en', country_code: 'US' }), undefined);
      const order = (await getStore().ordersByLead(l.id))[0]!;
      const session = { id: 'cs_audit_1', payment_status: 'paid', payment_intent: 'pi_1', amount_total: order.amount_minor, currency: order.currency, metadata: { order_id: order.id, lead_id: l.id }, ...bad };
      const res = await webhookPOST(sign({ id: `evt_bad_${i}`, object: 'event', type: 'checkout.session.completed', data: { object: session } }), undefined);
      expect(res.status).toBe(200);
      expect((await getStore().getOrder(order.id))!.status).toBe('pending');
      expect(devOutbox.all().filter((m) => /listo|ready/i.test(m.subject))).toHaveLength(0);
    }
  });

  it('delivers when amount and currency match exactly', async () => {
    const l = await lead();
    await checkoutPOST(post('/api/checkout/session', { report_request_id: l.id, locale: 'en', country_code: 'US' }), undefined);
    const order = (await getStore().ordersByLead(l.id))[0]!;
    const session = { id: 'cs_audit_1', payment_status: 'paid', payment_intent: 'pi_ok', amount_total: 790, currency: 'usd', metadata: { order_id: order.id, lead_id: l.id } };
    await webhookPOST(sign({ id: 'evt_ok', object: 'event', type: 'checkout.session.completed', data: { object: session } }), undefined);
    expect((await getStore().getOrder(order.id))!.status).toBe('paid');
    expect(devOutbox.all().filter((m) => m.subject === 'Your ChronoSleep report is ready')).toHaveLength(1);
  });

  it('a live Stripe key is blocked without the explicit approval flag (double switch)', async () => {
    setupEnv({ MONETIZATION_MODE: 'stripe', STRIPE_SECRET_KEY: 'sk_live_dummy123', STRIPE_WEBHOOK_SECRET: SECRET });
    const l = await lead();
    const res = await checkoutPOST(post('/api/checkout/session', { report_request_id: l.id, locale: 'en' }), undefined);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { code: string }).code).toBe('payments_live_blocked');
    const h = (await (await healthGET(get('/api/health'), undefined)).json()) as { integrations: Record<string, unknown> };
    expect(h.integrations.stripe_live_blocked).toBe(true);
  });

  it('paid plan days 2–7 never reach the browser before payment (stripe mode)', async () => {
    const body = (await (await calculatePOST(post('/api/calculate', { inputs: TV01, locale: 'en' }), undefined)).json()) as { domain: { plan: { schedule_7d: unknown[] } } };
    expect(body.domain.plan.schedule_7d).toHaveLength(1);
  });

  it('passes the GA client id to Stripe metadata only when provided', async () => {
    const l = await lead();
    const res = await checkoutPOST(post('/api/checkout/session', { report_request_id: l.id, locale: 'en', ga_client_id: '1234567890.1700000000' }), undefined);
    expect(res.status).toBe(201);
    const bad = await checkoutPOST(post('/api/checkout/session', { report_request_id: l.id, locale: 'en', ga_client_id: 'user@example.test' }), undefined);
    expect(bad.status).toBe(400);
  });
});

describe('bot defences and information disclosure (audit A-12/A-17)', () => {
  beforeEach(() => setupEnv());

  it('a filled honeypot looks like success but creates nothing and sends nothing', async () => {
    const calc = (await (await calculatePOST(post('/api/calculate', { inputs: TV01, locale: 'es' }), undefined)).json()) as { calculation_id: string };
    const res = await reportRequestPOST(
      post('/api/report-requests', { calculation_id: calc.calculation_id, email: 'bot@example.test', consent_report: true, locale: 'es', turnstile_token: 't', website: 'http://spam.example' }),
      undefined,
    );
    expect(res.status).toBe(201);
    expect(devOutbox.all()).toHaveLength(0);
    expect((await getStore().listLeads({})).items).toHaveLength(0);
    const p = await privacyPOST(post('/api/privacy/requests', { email: 'bot@example.test', request_type: 'deletion', locale: 'es', turnstile_token: 't', website: 'x' }), undefined);
    expect(p.status).toBe(202);
    expect(await getStore().listPrivacyRequests()).toHaveLength(0);
  });

  it('health exposes configuration state but never secret values', async () => {
    setupEnv({ RESEND_API_KEY: 're_supersecretvalue123456', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA', CRON_SECRET: 'cron-top-secret' });
    const res = await healthGET(get('/api/health'), undefined);
    const text = await res.text();
    expect(text).not.toContain('supersecretvalue');
    expect(text).not.toContain('cron-top-secret');
    expect(text).not.toContain('1x0000000000000000000000000000000AA');
    const body = JSON.parse(text) as { integrations: Record<string, unknown> };
    expect(body.integrations).toMatchObject({ email: true, resend_api_key: 'ok', turnstile: true, cron: true, database_persistent: false });
  });

  it('error responses carry a request id and no stack traces', async () => {
    const res = await calculatePOST(post('/api/calculate', { inputs: { nope: 1 }, locale: 'es' }), undefined);
    const body = (await res.json()) as Record<string, unknown>;
    expect(res.status).toBe(400);
    expect(JSON.stringify(body)).not.toMatch(/at \w+.*\(.*:\d+:\d+\)|node_modules/);
    expect(body.request_id).toBeTruthy();
  });
});

describe('Google Analytics module (consent-gated, PII-free)', () => {
  it('never sends query strings, tokens or ids in page paths', () => {
    expect(sanitizePath('/es/informe/7f4a2c9e-1b3d-4e5f-8a6b-0c1d2e3f4a5b?token=abc')).toBe('/es/informe/:id');
    expect(sanitizePath('/calcular/3#x')).toBe('/calcular/3');
  });

  it('maps the funnel to GA4 recommended events', () => {
    expect(mapToGa('preview_view', { sjl_band: '1h_2h', direction: 'later' })?.[0]).toBe('view_item');
    expect(mapToGa('preview_report_cta', { phase: 'validation' })?.[0]).toBe('add_to_cart');
    expect(mapToGa('email_submitted', { phase: 'validation', locale: 'es' })?.[0]).toBe('generate_lead');
    expect(mapToGa('checkout_started', { currency: 'USD', price_minor: 790 })).toEqual(['begin_checkout', expect.objectContaining({ value: 7.9, currency: 'USD' })]);
    expect(mapToGa('landing_view', {})).toBeNull();
  });

  it('produces no parameter that could carry an email or a clock time', () => {
    const [, params] = mapToGa('validation_error', { step: 4, field: 'free_wake_time', error_code: 'sleep_duration' })!;
    expect(JSON.stringify(params)).not.toMatch(/@|\d{1,2}:\d{2}/);
  });
});
