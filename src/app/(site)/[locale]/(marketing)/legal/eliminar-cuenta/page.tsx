import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { notFound } from 'next/navigation';

/** ChronoSleep has no user accounts: "delete my data" is the data-rights flow (access/deletion/...). */
export default async function DeleteAccountAlias({ params }: PageProps<'/[locale]/legal/eliminar-cuenta'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  redirect({ href: '/legal/derechos', locale });
}
