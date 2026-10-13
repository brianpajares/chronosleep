import { expect, test } from '@playwright/test';
import { ADMIN_SECRET } from '../../playwright.config';
import { EMAIL, fillWizard, outbox } from './helpers';

test.describe('E2E validation (docs/ACCEPTANCE_TESTS.md)', () => {
  test('landing → 8 steps → preview → email gate → admin approve → report, PDF and ICS', async ({ page, request }) => {
    await request.delete('/api/dev/outbox');

    // 1. Landing
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('horario de sueño');
    await page.getByRole('link', { name: /calcular mi desfase/i }).first().click();
    await expect(page).toHaveURL(/\/calcular\/1$/);

    // 2. Wizard → preview (no email/account/payment before value)
    await fillWizard(page);
    await expect(page).toHaveURL(/\/resultado$/, { timeout: 20_000 });
    await expect(page.locator('#result-title')).toContainText('1 h 53 min');
    await expect(page.getByText('1 h 23 min').first()).toBeVisible(); // sensitivity low
    await expect(page.getByText(/no un intervalo de confianza/i).first()).toBeVisible();

    // 3. Email gate
    await page.getByRole('link', { name: /recibir mi informe completo/i }).click();
    await expect(page.getByLabel(/acepto recibir este informe/i)).not.toBeChecked();
    await expect(page.getByLabel(/permito enviar una copia/i)).not.toBeChecked(); // OFF by default
    await page.getByLabel(/tu email/i).fill(EMAIL);
    await page.getByRole('button', { name: /enviar mi informe/i }).click();
    await expect(page.getByText(/consentimiento/i).first()).toBeVisible(); // required consent
    await page.getByLabel(/acepto recibir este informe/i).check();
    await page.getByRole('button', { name: /enviar mi informe/i }).click();
    await expect(page).toHaveURL(/\/informe\/listo$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Recibimos tu solicitud');

    // 4. Emails: user confirmation + owner notification (with PDF, no raw schedules)
    const mails = await outbox(request);
    const user = mails.find((m) => m.to === EMAIL)!;
    const owner = mails.find((m) => m.to === 'owner@example.test')!;
    expect(user.subject).toBe('Recibimos tu solicitud de informe ChronoSleep');
    expect(owner.subject).toMatch(/^\[ChronoSleep\] Solicitud de informe [0-9a-f-]{36}$/);
    expect(owner.attachments[0]?.contentType).toBe('application/pdf');
    expect(owner.text).not.toContain('23:30');

    // 5. Admin: only with a session; approve → delivery
    expect((await request.get('/api/admin/leads')).status()).toBe(401);
    await page.goto(`/admin/test-login?secret=${ADMIN_SECRET}`);
    await expect(page.getByRole('heading', { name: 'Solicitudes', exact: true })).toBeVisible();
    await expect(page.getByText('e***@example.test')).toBeVisible();
    await page.getByRole('button', { name: /aprobar y enviar/i }).click();
    await expect(page.getByRole('button', { name: /reenviar/i })).toBeVisible({ timeout: 30_000 });

    // 6. Report via the emailed opaque link
    const delivery = (await outbox(request)).find((m) => m.subject === 'Tu informe ChronoSleep está listo')!;
    const link = delivery.html.match(/href="([^"]*\/informe\/[0-9a-f-]{36}\?token=[^"]+)"/)![1]!;
    const url = new URL(link.replace(/&amp;/g, '&'));
    await page.goto(url.pathname + url.search);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('1 h 53 min');
    for (const h of ['Plan de 7 días', 'Escenarios', 'Sensibilidad', 'Supuestos', 'Metodología']) {
      await expect(page.getByRole('heading', { name: new RegExp(h, 'i') }).first()).toBeVisible();
    }
    await expect(page.getByText(/no es un intervalo de confianza/i).first()).toBeVisible();

    const token = url.searchParams.get('token')!;
    const id = url.pathname.split('/').pop()!;
    const pdf = await request.get(`/api/reports/${id}/pdf?token=${token}`);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    const ics = await request.get(`/api/reports/${id}/ics?token=${token}`);
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain('BEGIN:VCALENDAR');

    // 7. Bad / expired token
    await page.goto(`${url.pathname}?token=nope`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/enlace no válido/i);
  });

  test('step 4 blocks an implausible sleep duration with a specific message (error path)', async ({ page }) => {
    await page.goto('/calcular/1');
    await page.locator('input[type=time]').fill('23:00');
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.waitForURL(/\/calcular\/2$/);
    await page.locator('input[type=time]').fill('23:30'); // 15 min of sleep
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(page.locator('#work_wake_time-error')).toContainText(/entre 3 y 14 h/);
    await expect(page).toHaveURL(/\/calcular\/2$/);
  });

  test('wizard keeps one primary input per step and restores answers after a language switch', async ({ page }) => {
    await page.goto('/calcular/1');
    await page.locator('input[type=time]').fill('22:45');
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(page.locator('input[type=time]')).toHaveCount(1);
    await page.getByRole('link', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/calcular\/2$/);
    await page.goBack();
    await page.goto('/en/calcular/1');
    await expect(page.locator('input[type=time]')).toHaveValue('22:45');
  });

  test('stripe stays unreachable in validation mode', async ({ request, page }) => {
    expect((await request.post('/api/checkout/session', { data: { report_request_id: '3f2b8c1e-5a4d-4e8f-9a7b-1c2d3e4f5a6b' } })).status()).toBe(404);
    const res = await page.goto('/checkout');
    expect(res?.status()).toBe(404);
  });

  test('admin and private routes are noindex; test login is closed without the secret', async ({ page, request }) => {
    expect((await request.get('/admin/test-login?secret=wrong')).status()).toBe(404);
    await page.goto('/admin');
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
    await page.goto('/resultado');
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  });
});
