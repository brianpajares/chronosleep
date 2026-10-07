import { getTranslations } from 'next-intl/server';
import { Footer } from '@/components/site/Footer';
import { Header } from '@/components/site/Header';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('site');
  const m = await getTranslations('meta');
  return (
    <>
      <Header variant="public" />
      <main id="main" className="container-form flex-1 py-24 text-center">
        <p className="text-5xl font-bold text-primary">404</p>
        <h1 className="mt-4 text-3xl font-bold">{m('not_found_title')}</h1>
        <p className="mt-3 text-muted">{t('not_found_body')}</p>
        <Button asChild className="mt-8" size="lg">
          <Link href="/">{t('not_found_cta')}</Link>
        </Button>
      </main>
      <Footer />
    </>
  );
}
