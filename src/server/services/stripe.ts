import 'server-only';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { priceFor } from '@/lib/pricing';
import { ApiError } from '../api';
import { serverTrack } from '../analytics';
import { sha256Hex } from '../crypto';
import { appOrigin, env } from '../env';
import { log } from '../logger';
import { getStore, type Locale, type OrderRow } from '../store';
import { sendReportReady } from './delivery';

/**
 * Stripe is isolated behind MONETIZATION_MODE=stripe: this module is only ever imported
 * dynamically by the route handlers AFTER the mode check, so `validation` never loads it.
 */
export function assertStripeMode(): void {
  if (env.monetizationMode() !== 'stripe') {
    throw new ApiError(404, 'feature_disabled', 'Not found');
  }
}

async function client(): Promise<Stripe> {
  const key = env.stripeSecret();
  if (!key) throw new ApiError(503, 'stripe_not_configured', 'Payments are not configured');
  const { default: StripeSdk } = await import('stripe');
  return new StripeSdk(key);
}

const prefix = (locale: string) => (locale === 'es' ? '' : `/${locale}`);

export async function createCheckoutSession(args: {
  leadId: string;
  locale: Locale;
  countryCode?: string;
}): Promise<{ checkout_url: string }> {
  assertStripeMode();
  const store = getStore();
  const lead = await store.getLead(args.leadId);
  if (!lead || lead.deleted_at) throw new ApiError(404, 'not_found', 'Not found');

  const orders = await store.ordersByLead(lead.id);
  if (orders.some((o) => o.status === 'paid') || lead.status === 'delivered' || lead.status === 'ready') {
    throw new ApiError(409, 'already_paid', 'This report was already paid');
  }
  if (lead.status !== 'awaiting_payment') throw new ApiError(409, 'not_applicable', 'Checkout does not apply to this request');

  const price = priceFor(args.countryCode);
  const order: OrderRow = {
    id: randomUUID(),
    lead_id: lead.id,
    created_at: new Date().toISOString(),
    status: 'pending',
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    currency: price.currency.toLowerCase(),
    amount_minor: price.amountMinor,
    country_code: price.code,
    offer_id: 'report_single',
    paid_at: null,
    refunded_at: null,
  };
  await store.insertOrder(order);

  const stripe = await client();
  const origin = appOrigin();
  const usdPriceId = env.stripePriceId();
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [
        usdPriceId && price.currency === 'USD'
          ? { price: usdPriceId, quantity: 1 }
          : {
              quantity: 1,
              price_data: {
                currency: order.currency,
                unit_amount: order.amount_minor,
                product_data: { name: 'ChronoSleep — full report' },
              },
            },
      ],
      success_url: `${origin}${prefix(args.locale)}/informe/listo?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${prefix(args.locale)}/checkout?lead=${lead.id}&cancelled=1`,
      locale: args.locale === 'pt' ? 'pt-BR' : args.locale,
      // Minimal metadata: opaque ids only, never email or schedules.
      metadata: { order_id: order.id, lead_id: lead.id },
      payment_intent_data: { metadata: { order_id: order.id } },
    },
    { idempotencyKey: `checkout-${order.id}` },
  );
  if (!session.url) throw new ApiError(502, 'stripe_error', 'Could not create checkout session');
  await store.updateOrder(order.id, { stripe_checkout_session_id: session.id });
  return { checkout_url: session.url };
}

export type WebhookOutcome = 'processed' | 'duplicate' | 'ignored';

/** FR-23 / AT-23: signed, idempotent webhook. Delivery happens exactly once per paid order. */
export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<WebhookOutcome> {
  assertStripeMode();
  const secret = env.stripeWebhookSecret();
  if (!secret) throw new ApiError(503, 'stripe_not_configured', 'Webhook secret missing');
  if (!signature) throw new ApiError(400, 'invalid_signature', 'Missing signature');

  const stripe = await client();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new ApiError(400, 'invalid_signature', 'Invalid signature or payload');
  }

  const store = getStore();
  const inserted = await store.recordWebhookEvent({
    provider: 'stripe',
    event_id: event.id,
    event_type: event.type,
    payload_sha256: sha256Hex(rawBody),
  });
  // Already seen AND fully processed → nothing to do. Seen but unprocessed (earlier crash) → retry.
  if (!inserted && (await store.webhookProcessed('stripe', event.id))) return 'duplicate';

  let outcome: WebhookOutcome = 'ignored';
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') {
        await settleOrder(session);
        outcome = 'processed';
      }
      break;
    }
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      const order = session.id ? await store.getOrderBySession(session.id) : null;
      if (order && order.status === 'pending') {
        await store.updateOrder(order.id, { status: 'failed' });
        await serverTrack('payment_failed', { error_category: event.type.split('.').pop(), payment_provider: 'stripe' });
      }
      outcome = 'processed';
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      const order = pi ? await store.getOrderByPaymentIntent(pi) : null;
      if (order) await store.updateOrder(order.id, { status: 'refunded', refunded_at: new Date().toISOString() });
      outcome = 'processed';
      break;
    }
    default:
      outcome = 'ignored';
  }
  await store.markWebhookProcessed('stripe', event.id);
  log.info('stripe_webhook', { event_type: event.type, status: 200 });
  return outcome;
}

async function settleOrder(session: Stripe.Checkout.Session): Promise<void> {
  const store = getStore();
  const order =
    (await store.getOrderBySession(session.id)) ??
    (session.metadata?.order_id ? await store.getOrder(session.metadata.order_id) : null);
  if (!order) {
    log.warn('stripe_order_not_found', { error_category: 'order_missing' });
    return;
  }
  // Different events can announce the same payment: only the first one settles and delivers.
  if (order.status === 'paid') return;

  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
  await store.updateOrder(order.id, {
    status: 'paid',
    paid_at: new Date().toISOString(),
    stripe_payment_intent_id: paymentIntent,
    stripe_checkout_session_id: session.id,
  });

  const lead = await store.getLead(order.lead_id);
  if (!lead || lead.deleted_at) return;
  await store.updateLead(lead.id, { status: 'ready', owner_approved_at: new Date().toISOString() });
  const delivery = await sendReportReady(lead);
  await store.updateLead(lead.id, delivery.status === 'sent' ? { status: 'delivered', delivered_at: new Date().toISOString() } : { status: 'failed' });
  await serverTrack('payment_succeeded', {
    currency: order.currency.toUpperCase(),
    price_minor: order.amount_minor,
    offer_id: order.offer_id ?? 'report_single',
    payment_provider: 'stripe',
  });
}

/** Success page: resolves a paid Checkout Session id to its lead (the id is only known to the buyer). */
export async function leadForPaidSession(sessionId: string): Promise<{ leadId: string; paid: boolean } | null> {
  const order = await getStore().getOrderBySession(sessionId);
  if (!order) return null;
  return { leadId: order.lead_id, paid: order.status === 'paid' };
}
