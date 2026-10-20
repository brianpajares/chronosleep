'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { LOCALES } from '@/i18n/routing';
import { cn } from '@/lib/utils';

function Links({ query, className }: { query: Record<string, string>; className?: string }) {
  const t = useTranslations('site');
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('language_current', { language: t(`language_${locale}` as 'language_es') })}
      className={className}
    >
      <ul className="flex items-center gap-1">
        {LOCALES.map((l) => {
          const active = l === locale;
          return (
            <li key={l}>
              <Link prefetch={false}
                href={{ pathname, query }}
                locale={l}
                hrefLang={l}
                lang={l}
                aria-current={active ? 'true' : undefined}
                aria-label={t(`language_${l}` as 'language_es')}
                scroll={false}
                className={cn(
                  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-sm font-semibold uppercase no-underline transition-colors',
                  active ? 'bg-primary text-on-primary' : 'text-fg hover:bg-subtle',
                )}
              >
                {l}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function WithQuery({ className }: { className?: string }) {
  const search = useSearchParams();
  return <Links query={Object.fromEntries(search.entries())} className={className} />;
}

/** ES / EN / PT switch: same route and query (inputs live in sessionStorage, so they survive). */
export function LanguageSwitcher({ className }: { className?: string }) {
  return (
    <Suspense fallback={<Links query={{}} className={className} />}>
      <WithQuery className={className} />
    </Suspense>
  );
}
