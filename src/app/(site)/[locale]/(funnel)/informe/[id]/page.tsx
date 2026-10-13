import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ReportView } from '@/components/report/ReportView';
import { TrackOnMount } from '@/components/funnel/SuccessViews';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/site';
import { ApiError } from '@/server/api';
import { getEngineParams } from '@/server/drive';
import { resolveReportAccess } from '@/server/services/artifacts';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[locale]/informe/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'report' });
  return buildMetadata({ locale, path: '/informe', title: t('page_title'), indexable: false });
}

/** FR-12: protected by an opaque, expiring token in the query string; noindex; no-referrer (next.config headers). */
export default async function ReportPage({ params, searchParams }: PageProps<'/[locale]/informe/[id]'>) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token : null;

  let access: Awaited<ReturnType<typeof resolveReportAccess>> | null = null;
  try {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(401, 'unauthorized');
    access = await resolveReportAccess(id, token);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }

  if (!access) {
    const t = await getTranslations({ locale, namespace: 'report' });
    return (
      <div className="container-form py-20 text-center">
        <h1 className="text-3xl font-extrabold">{t('link_invalid_title')}</h1>
        <p className="mt-3 text-lg text-muted">{t('link_invalid_body')}</p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/calcular/1">{t('link_invalid_cta')}</Link>
        </Button>
      </div>
    );
  }

  const { report, lead } = access;
  const { params: engineParams } = await getEngineParams();
  return (
    <>
      <TrackOnMount event="report_view" props={{ model_version: report.model_version, report_version: report.report_version }} />
      <TrackOnMount event="report_opened" props={{ model_version: report.model_version, report_version: report.report_version }} />
      <ReportView report={report} leadId={lead.id} locale={locale} token={token as string} params={engineParams} generatedAt={new Date()} />
    </>
  );
}
