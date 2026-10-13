import type { MetadataRoute } from 'next';
import { LOCALES } from '@/i18n/routing';
import { absoluteUrl, indexingEnabled } from '@/lib/site';
import { publicPaths } from '@/lib/seo-routes';

/** Only public, indexable pages. Funnel, report, checkout and admin never appear here (NT-10). */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!indexingEnabled()) return [];
  const now = new Date();
  const out: MetadataRoute.Sitemap = [];
  for (const locale of LOCALES) {
    for (const path of publicPaths(locale)) {
      const isShared = !/^\/(mx|es|br|us|gb|ca|au)\//.test(path);
      const languages = isShared ? Object.fromEntries(LOCALES.map((l) => [l, absoluteUrl(l, path)])) : undefined;
      out.push({
        url: absoluteUrl(locale, path),
        lastModified: now,
        changeFrequency: path === '/' ? 'weekly' : 'monthly',
        priority: path === '/' ? 1 : 0.6,
        alternates: languages ? { languages } : undefined,
      });
    }
  }
  return out;
}
