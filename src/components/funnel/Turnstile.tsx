'use client';

import { Turnstile as CfTurnstile } from '@marsidev/react-turnstile';
import { useTranslations } from 'next-intl';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const turnstileEnabled = Boolean(SITE_KEY && !SITE_KEY.includes('REPLACE_ME'));

/** Cloudflare Turnstile widget. Renders nothing when no site key is configured (dev / e2e). */
export function TurnstileField({ onToken }: { onToken: (token: string) => void }) {
  const t = useTranslations('gate');
  if (!turnstileEnabled) return null;
  return (
    <div aria-label={t('turnstile_label')} role="group">
      <CfTurnstile
        siteKey={SITE_KEY as string}
        onSuccess={onToken}
        onExpire={() => onToken('')}
        onError={() => onToken('')}
        options={{ theme: 'auto', size: 'flexible', refreshExpired: 'auto' }}
      />
    </div>
  );
}
