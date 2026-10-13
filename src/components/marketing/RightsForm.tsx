'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import { TurnstileField, turnstileEnabled } from '@/components/funnel/Turnstile';
import { Button } from '@/components/ui/button';
import { Card, FieldError, Input, Label } from '@/components/ui/primitives';

const TYPES = ['access', 'correction', 'deletion', 'portability', 'objection'] as const;

/** FR-16 intake: email + request type + Turnstile. The response is identical whether or not data exists. */
export function RightsForm() {
  const t = useTranslations('rights');
  const g = useTranslations('gate');
  const locale = useLocale();
  const id = useId();
  const [email, setEmail] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]>('access');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError(g('invalid_email'));
    if (turnstileEnabled && !token) return setError(t('error_bot'));
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/privacy/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), request_type: type, locale, turnstile_token: token }),
      });
      if (res.status === 202) setDone(true);
      else setError(res.status === 429 ? t('error_rate') : res.status === 400 ? t('error_bot') : t('error_generic'));
    } catch {
      setError(t('error_generic'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Card className="p-6 sm:p-8" role="status">
        <h2 className="text-2xl font-bold">{t('done_title')}</h2>
        <p className="mt-3 text-muted">{t('done_body')}</p>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-8">
      <form onSubmit={submit} noValidate className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor={`${id}-email`}>{t('email_label')}</Label>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-type`}>{t('type_label')}</Label>
          <select
            id={`${id}-type`}
            value={type}
            onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
            className="block min-h-12 w-full rounded-md border border-line-strong bg-surface px-3 text-base"
          >
            {TYPES.map((k) => (
              <option key={k} value={k}>
                {t(`types.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <TurnstileField onToken={setToken} />
        <FieldError id={`${id}-err`}>{error}</FieldError>
        <Button type="submit" size="lg" block loading={busy}>
          {busy ? t('sending') : t('cta')}
        </Button>
      </form>
    </Card>
  );
}
