import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as calculatePOST } from '@/app/api/calculate/route';
import { POST as checkoutPOST } from '@/app/api/checkout/session/route';
import { POST as reportRequestPOST } from '@/app/api/report-requests/route';
import { POST as webhookPOST } from '@/app/api/stripe/webhook/route';
import { devOutbox } from '@/server/email/send';
import { getStore } from '@/server/store';
import { post, setupEnv, TV01 } from './helpers';

const created: Array<Record<string, unknown>> = [];

vi.mock('stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('stripe')>();
  const Real = actual.default;
  class FakeStripe extends Real {
    constructor(key: string) {
      super(key);
      Object.assign(this, {
        checkout: {
          sessions: {
            create: async (params: Record<string, unknown>) => {
              created.push(params);
              return { id: 'cs_test_1', url: 'https://checkout.stripe.test/c/pay/cs_test_1' };
            },
          },
        },
      });
    }
  }
  return { ...actual, default: FakeStripe };
});

const SECRET = 'whsec_test_secret_for_unit_tests';
const signer = new Stripe('sk_test_dummy');

function signedEvent(event: object) {
  const payload = JSON.stringify(event);
  const header = signer.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return post('/api/stripe/webhook', payload, { 'stripe-signature': header });
}

async function leadAwaitingPayment() {
  const calc = (await (await calculatePOST(post('/api/calculate', { inputs: TV01, locale: 'en' }), undefined)).json()) as { calculation_id: string };
  const rr = await reportRequestPOST(
    post('/api/report-requests', {
      calculation_id: calc.calculation_id,
      email: 'buyer@example.test',
      consent_report: true,
      locale: 'en',
      turnstile_token: 'XXXX.DUMMY.TOKEN.XXXX',
    }),
    undefined,
  );
  return (await rr.json()) as { id: string; status: string; mode: string };
}

describe('MONETIZATION_MODE=stripe (FR-22, FR-23, AT-22, AT-23)', () => {
  beforeEach(() => {
    created.length = 0;
    setupEnv({ MONETIZATION_MODE: 'stripe', STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: SECRET });
  });

  it('holds the lead for payment: no PDF, no emails yet', async () => {
    const lead = await leadAwaitingPayment();
    expect(lead).toMatchObject({ status: 'awaiting_payment', mode: 'stripe' });
    expect(devOutbox.all()).toHaveLength(0);
    expect(await getStore().getArtifact(lead.id)).toBeNull();
  });

  it('creates a Checkout Session with a server-side allowed price and minimal metadata', async () => {
    const lead = await leadAwaitingPayment();
    const res = await checkoutPOST(post('/api/checkout/session', { report_request_id: lead.id, locale: 'es', country_code: 'MX' }), undefined);
    expect(res.status).toBe(201);
    expect(((await res.json()) as { checkout_url: string }).checkout_url).toMatch(/^https:\/\/checkout\.stripe\.test/);

    const params = created[0] as {
      mode: string;
      metadata: Record<string, string>;
      line_items: Array<{ price_data: { currency: string; unit_amount: number } }>;
    };
    expect(params.mode).toBe('payment');
    expect(params.line_items[0]!.price_data).toMatchObject({ currency: 'mxn', unit_amount: 8900 });
    expect(Object.keys(params.metadata).sort()).toEqual(['lead_id', 'order_id']);
    expect(JSON.stringify(params)).not.toContain('buyer@example.test');
    const orders = await getStore().ordersByLead(lead.id);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ status: 'pending', currency: 'mxn', amount_minor: 8900, stripe_checkout_session_id: 'cs_test_1' });
  });

  it('ignores a client-supplied price: unknown countries fall back to the allow-list', async () => {
    const lead = await leadAwaitingPayment();
    await checkoutPOST(post('/api/checkout/session', { report_request_id: lead.id, locale: 'en', country_code: 'ZZ' }), undefined);
    const params = created[0] as { line_items: Array<{ price_data: { currency: string; unit_amount: number } }> };
    expect(params.line_items[0]!.price_data).toMatchObject({ currency: 'usd', unit_amount: 790 });
  });

  it('rejects an invalid signature', async () => {
    await leadAwaitingPayment();
    const bad = post('/api/stripe/webhook', '{"id":"evt_x"}', { 'stripe-signature': 't=1,v1=deadbeef' });
    expect((await webhookPOST(bad, undefined)).status).toBe(400);
    const missing = post('/api/stripe/webhook', '{"id":"evt_x"}');
    expect((await webhookPOST(missing, undefined)).status).toBe(400);
  });

  it('delivers exactly once even if Stripe repeats the event or announces the payment twice', async () => {
    const lead = await leadAwaitingPayment();
    await checkoutPOST(post('/api/checkout/session', { report_request_id: lead.id, locale: 'en', country_code: 'US' }), undefined);
    const order = (await getStore().ordersByLead(lead.id))[0]!;

    const session = {
      id: 'cs_test_1',
      object: 'checkout.session',
      payment_status: 'paid',
      payment_intent: 'pi_test_1',
      metadata: { order_id: order.id, lead_id: lead.id },
    };
    const completed = { id: 'evt_1', object: 'event', type: 'checkout.session.completed', data: { object: session } };

    const first = await webhookPOST(signedEvent(completed), undefined);
    expect(first.status).toBe(200);
    expect(((await first.json()) as { outcome: string }).outcome).toBe('processed');

    const repeat = await webhookPOST(signedEvent(completed), undefined);
    expect(repeat.status).toBe(200);
    expect(((await repeat.json()) as { outcome: string }).outcome).toBe('duplicate');

    const other = { id: 'evt_2', object: 'event', type: 'checkout.session.async_payment_succeeded', data: { object: session } };
    expect((await webhookPOST(signedEvent(other), undefined)).status).toBe(200);

    const orders = await getStore().ordersByLead(lead.id);
    expect(orders.filter((o) => o.status === 'paid')).toHaveLength(1);
    expect(orders[0]!.stripe_payment_intent_id).toBe('pi_test_1');
    const delivered = devOutbox.all().filter((m) => m.subject === 'Your ChronoSleep report is ready');
    expect(delivered).toHaveLength(1);
    expect(delivered[0]!.to).toBe('buyer@example.test');
    expect(delivered[0]!.attachments[0]?.contentType).toBe('application/pdf');
    expect((await getStore().getLead(lead.id))!.status).toBe('delivered');
    // a paid lead can no longer start another checkout
    const again = await checkoutPOST(post('/api/checkout/session', { report_request_id: lead.id, locale: 'en' }), undefined);
    expect(again.status).toBe(409);
  });

  it('refund events mark the order refunded; unpaid sessions never deliver', async () => {
    const lead = await leadAwaitingPayment();
    await checkoutPOST(post('/api/checkout/session', { report_request_id: lead.id, locale: 'en' }), undefined);
    const order = (await getStore().ordersByLead(lead.id))[0]!;
    const unpaid = {
      id: 'evt_u',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_1', payment_status: 'unpaid', metadata: { order_id: order.id, lead_id: lead.id } } },
    };
    await webhookPOST(signedEvent(unpaid), undefined);
    expect(devOutbox.all()).toHaveLength(0);

    await getStore().updateOrder(order.id, { status: 'paid', stripe_payment_intent_id: 'pi_r' });
    const refund = { id: 'evt_r', object: 'event', type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_r' } } };
    await webhookPOST(signedEvent(refund), undefined);
    expect((await getStore().getOrder(order.id))!.status).toBe('refunded');
  });
});
