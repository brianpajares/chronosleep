'use client';

import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, FieldError, Helper, Input, Label } from '@/components/ui/primitives';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { useHydrated } from '@/lib/hooks';
import { useWizard, wizard } from '@/lib/wizard-store';
import { TurnstileField, turnstileEnabled } from './Turnstile';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Check_({ id, checked, onChange, children, describedBy }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; describedBy?: string }) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={describedBy}
        className="mt-0.5 size-6 shrink-0 rounded border-2 border-line-strong accent-[var(--primary)]"
      />
      <label htmlFor={id} className="min-h-6 cursor-pointer text-base leading-snug">
        {children}
      </label>
    </div>
  );
}

/** Phase-1 email gate (ux_spec 4.5): email + required delivery consent + optional (OFF) team copy + waitlist. */
export function ReportGate() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const hydrated = useHydrated();
  const state = useWizard();
  const id = useId();

  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [ownerCopy, setOwnerCopy] = useState(false);
  const [waitlist, setWaitlist] = useState(false);
  const [token, setToken] = useState('');
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; consent?: string; form?: string }>({});

  useEffect(() => {
    track('report_gate_view', { phase: 'validation', locale });
  }, [locale]);

  if (!hydrated) return <div className="container-form min-h-[60vh]" aria-busy="true" />;

  const calc = state.calculation;
  if (!calc) {
    return (
      <div className="container-form py-20 text-center">
        <p className="text-lg text-muted">{t('gate.error_calc')}</p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/calcular/1">{t('result.no_state_cta')}</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = t('gate.email_required');
    else if (!EMAIL_RE.test(email.trim())) next.email = t('gate.invalid_email');
    if (!consent) next.consent = t('gate.consent_required');
    setErrors(next);
    if (next.email) {
      document.getElementById(`${id}-email`)?.focus();
      return;
    }
    if (next.consent) {
      document.getElementById(`${id}-consent`)?.focus();
      return;
    }
    if (turnstileEnabled && !token) {
      setErrors({ form: t('gate.error_bot') });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/report-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          calculation_id: calc.calculation_id,
          email: email.trim(),
          consent_report: true,
          consent_owner_copy: ownerCopy,
          waitlist_subscription: waitlist,
          locale,
          turnstile_token: token,
          website: trap,
        }),
      });
      const body = (await res.json()) as { id?: string; status?: string; mode?: string; code?: string };
      if (!res.ok) {
        const code = body.code ?? '';
        const msg =
          res.status === 429
            ? t('gate.error_rate')
            : code.startsWith('botcheck')
              ? t('gate.error_bot')
              : code === 'calculation_expired'
                ? t('gate.error_expired')
                : code === 'consent_required'
                  ? t('gate.consent_required')
                  : t('gate.error_generic');
        setErrors({ form: msg });
        return;
      }
      wizard.setLead({
        id: body.id as string,
        status: body.status as 'awaiting_owner',
        mode: body.mode as 'validation' | 'stripe',
      });
      track('email_submitted', { phase: body.mode === 'stripe' ? 'payment' : 'validation', locale });
      router.push(body.mode === 'stripe' ? '/checkout' : '/informe/listo');
    } catch {
      setErrors({ form: t('errors.network') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-form py-10 sm:py-14">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('gate.title')}</h1>
      <p className="mt-3 text-lg text-muted">{t('gate.body')}</p>

      <section aria-labelledby={`${id}-what`} className="mt-6">
        <h2 id={`${id}-what`} className="text-sm font-semibold tracking-wide text-muted uppercase">
          {t('gate.what_title')}
        </h2>
        <ul className="mt-3 space-y-2">
          {(t.raw('gate.what_items') as string[]).map((item) => (
            <li key={item} className="flex items-start gap-3">
              <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <Card className="mt-8 p-5 sm:p-8">
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor={`${id}-email`}>{t('gate.email_label')}</Label>
            <Input
              id={`${id}-email`}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t('gate.email_placeholder')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((s) => ({ ...s, email: undefined }));
              }}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? `${id}-email-error` : `${id}-privacy`}
            />
            <FieldError id={`${id}-email-error`}>{errors.email}</FieldError>
            <Helper id={`${id}-privacy`}>{t('gate.privacy')}</Helper>
          </div>

          <div className="space-y-4">
            <Check_
              id={`${id}-consent`}
              checked={consent}
              onChange={(v) => {
                setConsent(v);
                setErrors((s) => ({ ...s, consent: undefined }));
              }}
              describedBy={errors.consent ? `${id}-consent-error` : undefined}
            >
              {t('gate.delivery_consent')}
            </Check_>
            <FieldError id={`${id}-consent-error`}>{errors.consent}</FieldError>

            <div>
              <Check_
                id={`${id}-owner`}
                checked={ownerCopy}
                onChange={(v) => {
                  setOwnerCopy(v);
                  track('owner_copy_opt_in_changed', { enabled: v });
                }}
                describedBy={`${id}-owner-note`}
              >
                {t('gate.owner_copy')}
              </Check_>
              <Helper id={`${id}-owner-note`} className="mt-1 ml-9">
                {t('gate.owner_copy_note')}
              </Helper>
            </div>

            <div>
              <Check_ id={`${id}-wait`} checked={waitlist} onChange={setWaitlist} describedBy={`${id}-wait-note`}>
                {t('gate.waitlist')}
              </Check_>
              <Helper id={`${id}-wait-note`} className="mt-1 ml-9">
                {t('gate.waitlist_note')}
              </Helper>
            </div>
          </div>

          <input type="text" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          <TurnstileField onToken={setToken} />
          <FieldError id={`${id}-form-error`}>{errors.form}</FieldError>

          <div className="space-y-3">
            <Button type="submit" size="lg" block loading={busy}>
              {busy ? t('gate.sending') : t('gate.cta')}
            </Button>
            <p className="text-center text-sm">
              <Link href="/legal/privacidad" className="inline-flex min-h-11 items-center">
                {t('gate.privacy_link')}
              </Link>
            </p>
          </div>
        </form>
      </Card>

      <p className="mt-6 text-center">
        <Link href="/resultado" className="inline-flex min-h-11 items-center text-sm">
          {t('gate.back_to_result')}
        </Link>
      </p>
    </div>
  );
}
