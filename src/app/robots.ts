import type { MetadataRoute } from 'next';
import { indexingEnabled, siteUrl } from '@/lib/site';

/** Closed by default until the launch gate is cleared (NEXT_PUBLIC_INDEXING_ENABLED=true). */
export default function robots(): MetadataRoute.Robots {
  if (!indexingEnabled()) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/calcular/', '/procesando', '/resultado', '/informe/', '/checkout', '/en/calcular/', '/pt/calcular/', '/en/informe/', '/pt/informe/', '/en/checkout', '/pt/checkout', '/en/resultado', '/pt/resultado', '/en/procesando', '/pt/procesando'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
