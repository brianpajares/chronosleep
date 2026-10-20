'use client';

import { CheckCircle2, MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { verificationIdFromUuid } from '@/domain/chronosleep';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { supportEmail } from '@/lib/site';
import { useHydrated } from '@/lib/hooks';
import { useWizard } from '@/lib/wizard-store';

/** Fires an approved analytics event once on mount (props are sanitised by the catalog). */
export function TrackOnMount({ event, props }: { event: string; props?: Record<string, unknown> }) {
  const locale = useLocale();
  useEffect(() => {
    track(event, { locale, ...props });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once
  }, []);
  return null;
}

/** /informe/listo in validation mode: request received, what happens next. No report access yet. */
export function RequestReceived() {
  const t = useTranslations('success');
  const s = useTranslations('site');
  const hydrated = useHydrated();
  const lead = useWizard().lead;
  if (!hydrated) return <div className="container-form min-h-[50vh]" aria-busy="true" />;

  if (!lead) {
    return (
      <div className="container-form py-20 text-center">
        <h1 className="text-3xl font-extrabold">{t('missing_title')}</h1>
        <p className="mt-3 text-lg text-muted">{t('missing_body')}</p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/calcular/1">{t('back_home')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container-form py-12 sm:py-16">
      <TrackOnMount event="report_ready_view" props={{ delivery_channel: 'email' }} />
      <Card className="p-6 text-center sm:p-10">
        <MailCheck aria-hidden="true" className="mx-auto size-14 text-primary" />
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">{t('received_title')}</h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-muted">{t('received_body')}</p>

        <p className="mt-6 inline-flex flex-col rounded-md bg-subtle px-5 py-3">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">{t('id_label')}</span>
          <span className="text-xl font-bold tabular-nums">{verificationIdFromUuid(lead.id)}</span>
        </p>

        <h2 className="mt-8 text-left text-sm font-semibold tracking-wide text-muted uppercase">{t('received_next')}</h2>
        <ol className="mt-3 space-y-3 text-left">
          {(t.raw('received_steps') as string[]).map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary"
              >
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>

        <Button asChild variant="secondary" size="lg" className="mt-8">
          <Link href="/">{t('back_home')}</Link>
        </Button>
        <p className="mt-4 text-sm">
          <a href={`mailto:${supportEmail()}?subject=${encodeURIComponent(`ChronoSleep ${verificationIdFromUuid(lead.id)}`)}`}>{s('help_contact')}</a>
        </p>
        <p className="mt-6 text-xs text-muted">{t('edu_note')}</p>
      </Card>
    </div>
  );
}

/** Paid (stripe) success: the report is open now. Server decides; this only renders. */
export function ReportReady({ href }: { href: string }) {
  const t = useTranslations('success');
  return (
    <div className="container-form py-12 sm:py-16">
      <TrackOnMount event="report_ready_view" props={{ delivery_channel: 'web' }} />
      <Card className="p-6 text-center sm:p-10">
        <CheckCircle2 aria-hidden="true" className="mx-auto size-14 text-success" />
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-muted">{t('body')}</p>
        <Button asChild size="lg" className="mt-8">
          <a href={href} onClick={() => track('report_opened', { model_version: 'chronosleep-sjl-2.0', report_version: 'chronosleep-report-1.0' })}>
            {t('cta')}
          </a>
        </Button>
        <p className="mt-6 text-xs text-muted">{t('edu_note')}</p>
      </Card>
    </div>
  );
}

/** Paid session not yet confirmed by the webhook: ask the page to re-check shortly. */
export function PaymentPending() {
  const t = useTranslations('success');
  useEffect(() => {
    const id = setTimeout(() => window.location.reload(), 4000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="container-form py-20 text-center" role="status" aria-live="polite">
      <h1 className="text-3xl font-extrabold">{t('paid_title')}</h1>
      <p className="mt-3 text-lg text-muted">{t('paid_body')}</p>
    </div>
  );
}
