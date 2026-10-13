import 'server-only';
import { Resend } from 'resend';
import { env, isProduction } from '../env';
import { log } from '../logger';

export interface Attachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
  replyTo?: string;
  /** Resend idempotency key (one per delivery attempt). */
  idempotencyKey?: string;
}

export type SendResult = { ok: true; id: string } | { ok: false; category: string };

export interface OutboxEntry {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments: { filename: string; bytes: number; contentType: string }[];
  createdAt: string;
}

const g = globalThis as unknown as { __csOutbox?: OutboxEntry[] };
const outbox = (): OutboxEntry[] => (g.__csOutbox ??= []);

export const devOutbox = {
  all: (): OutboxEntry[] => [...outbox()],
  clear: (): void => {
    outbox().length = 0;
  },
};

let client: Resend | undefined;

/**
 * Resend transport. Without RESEND_API_KEY: non-production environments write to an in-memory
 * outbox (visible only with E2E/dev tools); production reports `email_not_configured`.
 * Logs never include recipients, subjects or bodies.
 */
export async function sendEmail(msg: OutgoingEmail): Promise<SendResult> {
  const key = env.resendKey();
  if (!key) {
    if (isProduction()) return { ok: false, category: 'email_not_configured' };
    const id = `outbox-${outbox().length + 1}`;
    outbox().push({
      id,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: (msg.attachments ?? []).map((a) => ({ filename: a.filename, bytes: a.content.length, contentType: a.contentType })),
      createdAt: new Date().toISOString(),
    });
    return { ok: true, id };
  }

  client ??= new Resend(key);
  try {
    const { data, error } = await client.emails.send(
      {
        from: env.resendFrom(),
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo: msg.replyTo,
        attachments: msg.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content),
          contentType: a.contentType,
        })),
      },
      msg.idempotencyKey ? { idempotencyKey: msg.idempotencyKey } : undefined,
    );
    if (error || !data) {
      const category = error?.name ?? 'provider_error';
      log.warn('email_send_failed', { provider: 'resend', error_category: category });
      return { ok: false, category };
    }
    return { ok: true, id: data.id };
  } catch {
    log.warn('email_send_failed', { provider: 'resend', error_category: 'network' });
    return { ok: false, category: 'network' };
  }
}
