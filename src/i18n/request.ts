import { getRequestConfig } from 'next-intl/server';
import { getMessages } from '@/messages';
import { isLocale, routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: getMessages(locale),
    // Missing keys must never crash a public page.
    onError: () => undefined,
    getMessageFallback: ({ namespace, key }) => `${namespace ?? ''}.${key}`,
  };
});
