import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Markdown } from '@/components/marketing/Markdown';
import { TrackedCta } from '@/components/marketing/TrackedCta';
import { Card, Eyebrow } from '@/components/ui/primitives';
import { MODEL_VERSION, SOURCES } from '@/domain/chronosleep';
import { isLocale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/site';
import { getModelCard } from '@/server/drive';

export async function generateMetadata({ params }: PageProps<'/[locale]/como-funciona'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return buildMetadata({ locale, path: '/como-funciona', title: t('how_title'), description: t('how_description'), indexable: true });
}

export default async function HowPage({ params }: PageProps<'/[locale]/como-funciona'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('how');
  const sections = t.raw('sections') as { id: string; title: string; body: string[] }[];
  const card = await getModelCard();
  const sourceLabel =
    card.degraded ? t('card_source_degraded') : card.source === 'drive' || card.source === 'cache' ? t('card_source_drive') : t('card_source_bundled');

  return (
    <div className="container-report py-12 sm:py-16">
      <Eyebrow>{t('eyebrow')}</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{t('title')}</h1>
      <p className="mt-4 text-lg text-muted">{t('intro')}</p>
      <p className="mt-2 text-sm font-semibold">{t('model_version', { version: MODEL_VERSION })}</p>

      <div className="mt-10 space-y-10">
        {sections.map((s) => (
          <section key={s.id} aria-labelledby={`s-${s.id}`} className="space-y-3">
            <h2 id={`s-${s.id}`} className="text-2xl font-bold">
              {s.title}
            </h2>
            {s.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}

        <section aria-labelledby="s-ref" className="space-y-3">
          <h2 id="s-ref" className="text-2xl font-bold">
            {t('reference_title')}
          </h2>
          <p>{t('reference_body')}</p>
        </section>

        <section aria-labelledby="s-sources" className="space-y-3">
          <h2 id="s-sources" className="text-2xl font-bold">
            {t('sources_title')}
          </h2>
          <ul className="space-y-1 text-sm">
            {Object.values(SOURCES).map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noopener noreferrer" className="break-all">
                  {u}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">{t('sources_license')}</p>
        </section>

        <section aria-labelledby="s-card">
          <Card className="p-5 sm:p-6">
            <details>
              <summary className="min-h-11 cursor-pointer text-xl font-bold">
                <span id="s-card">{t('card_title')}</span>
              </summary>
              <p className="mt-2 text-xs text-muted">
                {sourceLabel} · {t('card_updated', { version: card.version })}
              </p>
              <div className="mt-4">
                <Markdown source={card.markdown} />
              </div>
            </details>
          </Card>
        </section>
      </div>

      <div className="mt-12 flex justify-center">
        <TrackedCta source="how_it_works">{t('cta')}</TrackedCta>
      </div>
    </div>
  );
}
