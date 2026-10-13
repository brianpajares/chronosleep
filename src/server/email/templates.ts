import { createTranslator, type AbstractIntlMessages } from 'use-intl/core';
import { getMessages, type MessageLocale } from '@/messages';

/** Transactional email builders. All copy comes from the i18n catalog (`email.*`). */

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function translator(locale: MessageLocale) {
  const t = createTranslator({ locale, messages: getMessages(locale) as unknown as AbstractIntlMessages, namespace: 'email' });
  return t as unknown as (key: string, values?: Record<string, string | number>) => string;
}

interface Layout {
  lang: MessageLocale;
  preheader: string;
  heading: string;
  /** Paragraphs (already plain text; escaped here). */
  paragraphs: string[];
  cta?: { label: string; href: string };
  /** Key/value rows (owner emails). */
  rows?: [string, string][];
  footer: string[];
}

function layout(l: Layout): { html: string; text: string } {
  const rows = l.rows
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0;border-collapse:collapse;width:100%">${l.rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 12px 6px 0;color:#4b5563;font-size:14px;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;color:#111827;font-size:14px">${esc(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const cta = l.cta
    ? `<p style="margin:24px 0"><a href="${esc(l.cta.href)}" style="background:#155e75;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:10px;display:inline-block">${esc(l.cta.label)}</a></p><p style="font-size:12px;color:#4b5563;word-break:break-all">${esc(l.cta.href)}</p>`
    : '';
  const html = `<!doctype html><html lang="${l.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(l.heading)}</title></head><body style="margin:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827"><span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(l.preheader)}</span><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #d1d5db;border-radius:16px"><tr><td style="padding:28px"><p style="margin:0 0 4px;font-weight:700;font-size:18px;color:#155e75">ChronoSleep</p><h1 style="margin:12px 0 8px;font-size:22px;line-height:1.25">${esc(l.heading)}</h1>${l.paragraphs.map((p) => `<p style="margin:12px 0;font-size:16px;line-height:1.55">${esc(p)}</p>`).join('')}${rows}${cta}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">${l.footer.map((f) => `<p style="margin:4px 0;font-size:12px;color:#4b5563">${esc(f)}</p>`).join('')}</td></tr></table></td></tr></table></body></html>`;
  const text = [
    l.heading,
    '',
    ...l.paragraphs,
    ...(l.rows ? ['', ...l.rows.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(l.cta ? ['', `${l.cta.label}: ${l.cta.href}`] : []),
    '',
    '--',
    ...l.footer,
  ].join('\n');
  return { html, text };
}

function footer(t: ReturnType<typeof translator>, privacyUrl: string): string[] {
  return [t('footer_edu'), `${t('footer_privacy')}: ${privacyUrl}`, t('footer_why')];
}

/** FR-10: confirmation to the user. No schedules, results or tokens in the body. */
export function userConfirmationEmail(a: { locale: MessageLocale; verificationId: string; privacyUrl: string }): Rendered {
  const t = translator(a.locale);
  const { html, text } = layout({
    lang: a.locale,
    preheader: t('user_preheader'),
    heading: t('user_heading'),
    paragraphs: [t('user_body'), t('user_id', { id: a.verificationId }), t('user_next')],
    footer: footer(t, a.privacyUrl),
  });
  return { subject: t('user_subject'), html, text };
}

/** Stripe/approve delivery: expiring link + PDF attached (attachment added by the caller). */
export function deliveryEmail(a: {
  locale: MessageLocale;
  reportUrl: string;
  expiresAt: Date;
  verificationId: string;
  privacyUrl: string;
}): Rendered {
  const t = translator(a.locale);
  const date = new Intl.DateTimeFormat(a.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(a.expiresAt);
  const { html, text } = layout({
    lang: a.locale,
    preheader: t('delivery_preheader'),
    heading: t('delivery_heading'),
    paragraphs: [t('delivery_body'), t('delivery_expires', { date }), t('delivery_id', { id: a.verificationId })],
    cta: { label: t('delivery_cta'), href: a.reportUrl },
    footer: footer(t, a.privacyUrl),
  });
  return { subject: t('delivery_subject'), html, text };
}

export interface OwnerRequestData {
  leadId: string;
  requestLocale: string;
  createdAt: Date;
  band: string;
  consentOwnerCopy: boolean;
  waitlist: boolean;
  mode: string;
  adminUrl: string;
  /** Present only with the separate `consentimiento_copia_al_propietario`. */
  shared?: { sjl: string; midWork: string; midFree: string; inputs: Record<string, string | number | boolean> };
}

/** FR-10/FR-11: owner notification. Raw schedules only when the user opted in to the team copy. */
export function ownerRequestEmail(a: OwnerRequestData): Rendered {
  const t = translator('es');
  const yn = (v: boolean) => t(v ? 'owner_fields.yes' : 'owner_fields.no');
  const rows: [string, string][] = [
    [t('owner_fields.id'), a.leadId],
    [t('owner_fields.locale'), a.requestLocale],
    [t('owner_fields.created'), a.createdAt.toISOString()],
    [t('owner_fields.band'), a.band],
    [t('owner_fields.consent_owner'), yn(a.consentOwnerCopy)],
    [t('owner_fields.waitlist'), yn(a.waitlist)],
    [t('owner_fields.mode'), a.mode],
  ];
  const paragraphs = [t('owner_intro')];
  if (a.shared) {
    paragraphs.push(t('owner_fields.shared_title'));
    rows.push(
      [t('owner_fields.sjl'), a.shared.sjl],
      [t('owner_fields.mid_work'), a.shared.midWork],
      [t('owner_fields.mid_free'), a.shared.midFree],
      [t('owner_fields.inputs'), Object.entries(a.shared.inputs).map(([k, v]) => `${k}=${v}`).join(', ')],
    );
  } else {
    paragraphs.push(t('owner_fields.hidden'));
  }
  paragraphs.push(t('owner_fields.pdf_note'));
  const { html, text } = layout({
    lang: 'es',
    preheader: `${t('owner_intro')} ${a.leadId}`,
    heading: t('owner_intro'),
    paragraphs,
    rows,
    cta: { label: t('owner_fields.admin_link'), href: a.adminUrl },
    footer: [t('footer_edu')],
  });
  // Subject is intentionally NOT localized (FR-10 / AT-10).
  return { subject: `[ChronoSleep] Solicitud de informe ${a.leadId}`, html, text };
}

export function privacyAckEmail(a: { locale: MessageLocale; reference: string; privacyUrl: string }): Rendered {
  const t = translator(a.locale);
  const { html, text } = layout({
    lang: a.locale,
    preheader: t('privacy_heading'),
    heading: t('privacy_heading'),
    paragraphs: [t('privacy_body'), t('privacy_id', { id: a.reference })],
    footer: footer(t, a.privacyUrl),
  });
  return { subject: t('privacy_subject'), html, text };
}

export function ownerPrivacyEmail(a: { requestId: string; type: string; locale: string; adminUrl: string }): Rendered {
  const t = translator('es');
  const { html, text } = layout({
    lang: 'es',
    preheader: t('owner_privacy_intro'),
    heading: t('owner_privacy_intro'),
    paragraphs: [t('owner_privacy_intro')],
    rows: [
      [t('owner_fields.id'), a.requestId],
      ['Tipo', a.type],
      [t('owner_fields.locale'), a.locale],
    ],
    cta: { label: t('owner_fields.admin_link'), href: a.adminUrl },
    footer: [t('footer_edu')],
  });
  return { subject: t('owner_privacy_subject', { id: a.requestId }), html, text };
}
