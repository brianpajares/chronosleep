import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, Input, Label } from '@/components/ui/primitives';
import { MODEL_VERSION } from '@/domain/chronosleep';
import { adminAuthConfigured, getAdminSession } from '@/server/auth/admin';
import { driveHealth } from '@/server/drive';
import { env } from '@/server/env';
import { toAdminLead } from '@/server/services/admin-actions';
import { getStore } from '@/server/store';
import { sendLoginLink } from './actions';
import { LeadActions, PrivacyActions } from './AdminActions';

export const dynamic = 'force-dynamic';

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations({ locale: 'es', namespace: 'admin' });
  const sp = await searchParams;
  const session = await getAdminSession();

  if (!session) {
    return (
      <main className="container-form py-20">
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold">{t('login_title')}</h1>
          {!adminAuthConfigured() ? (
            <p className="mt-3 text-muted">{t('not_configured')}</p>
          ) : (
            <>
              <p className="mt-3 text-muted">{t('login_body')}</p>
              {sp.sent ? <p role="status" className="mt-4 rounded-md bg-subtle p-3">{t('login_sent')}</p> : null}
              {sp.denied ? <p role="alert" className="mt-4 text-danger">{t('forbidden')}</p> : null}
              <form action={sendLoginLink} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('login_email')}</Label>
                  <Input id="email" name="email" type="email" required autoComplete="email" />
                </div>
                <Button type="submit" block>
                  {t('login_cta')}
                </Button>
              </form>
            </>
          )}
        </Card>
      </main>
    );
  }

  const store = getStore();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [stats, page, privacy, drive] = await Promise.all([store.stats(since), store.listLeads({ limit: 25 }), store.listPrivacyRequests(25), driveHealth()]);
  const leads = await Promise.all(page.items.map(toAdminLead));
  const rate = stats.calculations ? Math.round((stats.leads / stats.calculations) * 1000) / 10 : 0;
  const labels = {
    approve: t('approve'),
    resend: t('resend'),
    done: t('done'),
    error: t('action_error'),
    verify: t('privacy_verify'),
    complete: t('privacy_execute'),
  };
  const dt = new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' });

  return (
    <main className="container-page space-y-10 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t('title')}</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">{session.email}</span>
          <form action="/admin/logout" method="post">
            <Button type="submit" variant="secondary" size="sm">
              {t('logout')}
            </Button>
          </form>
        </div>
      </header>

      <section aria-labelledby="funnel" className="space-y-3">
        <h2 id="funnel" className="text-xl font-bold">{t('funnel_title')}</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [t('funnel_calculations'), stats.calculations],
            [t('funnel_leads'), stats.leads],
            [t('funnel_rate'), `${rate}%`],
            [t('funnel_delivered'), stats.delivered],
            [t('funnel_failed'), stats.failedDeliveries],
          ].map(([k, v]) => (
            <Card key={String(k)} className="p-4">
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="text-3xl font-extrabold tabular-nums" data-testid={`stat-${String(k)}`}>{v}</dd>
            </Card>
          ))}
        </dl>
      </section>

      <section aria-labelledby="engine" className="space-y-3">
        <h2 id="engine" className="text-xl font-bold">{t('engine_title')}</h2>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          <li>{t('engine_model')}: <strong>{MODEL_VERSION}</strong></li>
          <li>{t('engine_mode')}: <strong>{env.monetizationMode()}</strong></li>
          <li>{t('engine_store')}: <strong>{store.driver}</strong></li>
          <li>{t('engine_drive')}: <strong>{drive.status} ({drive.source})</strong></li>
        </ul>
      </section>

      <section aria-labelledby="leads" className="space-y-3">
        <h2 id="leads" className="text-xl font-bold">{t('leads_title')}</h2>
        {leads.length === 0 ? (
          <p className="text-muted">{t('leads_empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-line bg-surface">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-subtle">
                <tr>
                  {[t('col_id'), t('col_created'), t('col_status'), t('col_locale'), t('col_email'), t('col_band'), t('col_copy'), t('col_actions')].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-t border-line align-top" data-testid={`lead-${l.id}`}>
                    <td className="px-3 py-2 font-mono text-xs">{l.id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{dt.format(new Date(l.created_at))}</td>
                    <td className="px-3 py-2">{l.status}</td>
                    <td className="px-3 py-2">{l.locale}</td>
                    <td className="px-3 py-2">{l.email_masked}</td>
                    <td className="px-3 py-2">{l.sjl_band}</td>
                    <td className="px-3 py-2">{l.consent_owner_copy ? '✔' : '—'}</td>
                    <td className="px-3 py-2">
                      <LeadActions id={l.id} status={l.status} approved={Boolean(l.owner_approved_at)} labels={labels} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="privacy" className="space-y-3">
        <h2 id="privacy" className="text-xl font-bold">{t('privacy_title')}</h2>
        {privacy.length === 0 ? (
          <p className="text-muted">{t('privacy_empty')}</p>
        ) : (
          <ul className="space-y-2">
            {privacy.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-3 text-sm">
                <span>
                  <span className="font-mono text-xs">{r.id.slice(0, 8)}</span> · {t('privacy_type')}: <strong>{r.request_type}</strong> · {t('privacy_status')}: {r.status} · {dt.format(new Date(r.created_at))}
                </span>
                <PrivacyActions id={r.id} type={r.request_type} verified={Boolean(r.verified_at)} completed={r.status === 'completed'} labels={labels} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
