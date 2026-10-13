import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PaymentPending, ReportReady, RequestReceived } from '@/components/funnel/SuccessViews';
import { isLocale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/site';
import { env } from '@/server/env';

export async function generateMetadata({ params }: PageProps<'/[locale]/informe/listo'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'success' });
  return buildMetadata({ locale, path: '/informe/listo', title: t('title'), indexable: false });
}

/**
 * Validation mode: "request received" (client, from the wizard session).
 * Stripe mode: Checkout returns with ?session_id=… — a secret only the buyer knows — and, once the
 * signed webhook has marked the order paid, we open the report with a freshly minted token.
 */
export default async function SuccessPage({ params, searchParams }: PageProps<'/[locale]/informe/listo'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const sessionId = typeof sp.session_id === 'string' ? sp.session_id : null;
  if (sessionId && env.monetizationMode() === 'stripe') {
    const { leadForPaidSession } = await import('@/server/services/stripe');
    const { mintAccessToken } = await import('@/server/services/artifacts');
    const found = await leadForPaidSession(sessionId);
    if (!found) notFound();
    if (!found.paid) return <PaymentPending />;
    const { token } = await mintAccessToken(found.leadId);
    const prefix = locale === 'es' ? '' : `/${locale}`;
    return <ReportReady href={`${prefix}/informe/${found.leadId}?token=${token}`} />;
  }
  return <RequestReceived />;
}
