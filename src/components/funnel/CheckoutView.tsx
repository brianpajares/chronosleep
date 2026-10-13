'use client';

import { Check, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, FieldError, Helper, Label } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { useHydrated } from '@/lib/hooks';
import { formatPrice, type Price } from '@/lib/pricing';
import { useWizard } from '@/lib/wizard-store';

/** Phase 2 checkout (only rendered when MONETIZATION_MODE=stripe): localized price, single CTA, no dark patterns. */
export function CheckoutView({ prices, defaultCountry, leadParam, cancelled }: { prices: Price[]; defaultCountry: string; leadParam?: string; cancelled: boolean }) {
  const t = useTranslations();
  const locale = useLocale() as 'es' | 'en' | 'pt';
  const hydrated = useHydrated();
  const lead = useWizard().lead;
  const [country, setCountry] = useState(defaultCountry);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = prices.find((p) => p.code === country) ?? (prices[0] as Price);
  const leadId = lead?.id ?? leadParam;

  useEffect(() => {
    track('checkout_view', { currency: price.currency, price_minor: price.amountMinor, country_code: price.code, offer_id: 'report_single' });
  }, [price]);

  if (!hydrated) return <div className="container-form min-h-[50vh]" aria-busy="true" />;
  if (!leadId) {
    return (
      <div className="container-form py-20 text-center">
        <p className="text-lg text-muted">{t('gate.error_calc')}</p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/calcular/1">{t('result.no_state_cta')}</Link>
        </Button>
      </div>
    );
  }

  const pay = async () => {
    setBusy(true);
    setError(null);
    track('checkout_started', { currency: price.currency, price_minor: price.amountMinor, offer_id: 'report_single' });
    try {
      const res = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ report_request_id: leadId, locale, country_code: price.code }),
      });
      const body = (await res.json()) as { checkout_url?: string };
      if (!res.ok || !body.checkout_url) throw new Error('checkout');
      window.location.assign(body.checkout_url);
    } catch {
      track('payment_failed', { error_category: 'checkout_start', payment_provider: 'stripe' });
      setError(t('checkout.error_generic'));
      setBusy(false);
    }
  };

  return (
    <div className="container-form py-10 sm:py-14">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('checkout.title')}</h1>
      <p className="mt-3 text-lg text-muted">{t('checkout.includes')}</p>
      {cancelled ? <p role="status" className="mt-4 rounded-md bg-subtle px-4 py-3 text-sm">{t('checkout.cancelled')}</p> : null}

      <Card className="mt-8 space-y-6 p-5 sm:p-8">
        <ul className="space-y-2">
          {(t.raw('gate.what_items') as string[]).map((item) => (
            <li key={item} className="flex items-start gap-3">
              <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
              {item}
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <Label htmlFor="country">{t('checkout.country_label')}</Label>
          <select
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="block min-h-12 w-full rounded-md border border-line-strong bg-surface px-3 text-base"
          >
            {prices.map((p) => (
              <option key={p.code} value={p.code}>
                {p.country} — {p.currency}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-md bg-subtle p-4 text-center">
          <p className="text-sm text-muted">{t('checkout.price_label')}</p>
          <p className="text-4xl font-extrabold tabular-nums" aria-live="polite">
            {formatPrice(price, locale)} <span className="text-base font-semibold text-muted">{price.currency}</span>
          </p>
          <p className="text-sm text-muted">{t('checkout.one_time')}</p>
        </div>

        <FieldError id="checkout-error">{error}</FieldError>
        <Button size="lg" block loading={busy} onClick={pay}>
          {busy ? t('checkout.processing') : t('checkout.cta', { price: formatPrice(price, locale) })}
        </Button>
        <Helper className="flex items-center justify-center gap-2 text-center">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
          {t('checkout.secure_note')}
        </Helper>
        <Helper className="text-center">{t('checkout.price_note')}</Helper>
      </Card>
    </div>
  );
}
