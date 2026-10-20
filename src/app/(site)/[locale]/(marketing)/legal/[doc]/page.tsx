import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Callout, Eyebrow } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { isLocale, LOCALES } from '@/i18n/routing';
import { buildMetadata, legalAddress, legalEntity, legalRuc, privacyContact } from '@/lib/site';

const DOCS = {
  privacidad: 'privacy',
  terminos: 'terms',
  salud: 'health',
  reembolsos: 'refunds',
  cookies: 'cookies',
  'libro-de-reclamaciones': 'claims',
  creditos: 'credits',
} as const;
type Doc = keyof typeof DOCS;
const LEGAL_UPDATED = '2026-10-20';

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.flatMap((locale) => (Object.keys(DOCS) as Doc[]).map((doc) => ({ locale, doc })));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/legal/[doc]'>): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isLocale(locale) || !(doc in DOCS)) return {};
  const t = await getTranslations({ locale, namespace: 'legal' });
  const key = DOCS[doc as Doc];
  return buildMetadata({ locale, path: `/legal/${doc}`, title: t(`${key}.title`), indexable: true });
}

export default async function LegalPage({ params }: PageProps<'/[locale]/legal/[doc]'>) {
  const { locale, doc } = await params;
  if (!isLocale(locale) || !(doc in DOCS)) notFound();
  setRequestLocale(locale);
  const key = DOCS[doc as Doc];
  const t = await getTranslations('legal');
  const sections = t.raw(`${key}.sections`) as { h: string; p: string[] }[];
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(LEGAL_UPDATED));
  const pending = t('pending');

  return (
    <div className="container-report py-12 sm:py-16">
      <Eyebrow>{t('updated', { date })}</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{t(`${key}.title`)}</h1>
      <p className="mt-4 text-lg text-muted">{t(`${key}.intro`)}</p>
      <Callout title="DRAFT / BORRADOR" className="mt-6">
        {t('draft_notice')}
      </Callout>

      {/* Identity of the data controller / provider — visible on every legal page (audit B-16). */}
      <dl className="mt-6 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
        <dt className="font-semibold">{t('controller_label')}</dt>
        <dd>{t('controller_value', { entity: legalEntity() })}</dd>
        <dt className="font-semibold">{t('entity_ruc_label')}</dt>
        <dd>{legalRuc() ?? pending}</dd>
        <dt className="font-semibold">{t('entity_address_label')}</dt>
        <dd>{legalAddress() ?? pending}</dd>
        <dt className="font-semibold">{t('contact_label')}</dt>
        <dd>
          <a href={`mailto:${privacyContact()}`}>{privacyContact()}</a>
        </dd>
      </dl>

      <div className="mt-10 space-y-8">
        {sections.map((s) => (
          <section key={s.h} className="space-y-3">
            <h2 className="text-2xl font-bold">{s.h}</h2>
            {s.p.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-10">
        <Link href="/legal/derechos" className="font-semibold">
          {(await getTranslations('site'))('footer_rights')}
        </Link>
      </p>
    </div>
  );
}
