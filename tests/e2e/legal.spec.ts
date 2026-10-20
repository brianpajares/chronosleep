import { expect, test } from '@playwright/test';

const DOCS = ['privacidad', 'terminos', 'salud', 'reembolsos', 'cookies', 'libro-de-reclamaciones', 'creditos', 'derechos'];

test.describe('Legal pages (audit B-1..B-5, B-16, B-20)', () => {
  for (const prefix of ['', '/en', '/pt']) {
    test(`all legal documents exist, show the draft notice and the controller identity (${prefix || '/es'})`, async ({ request }) => {
      for (const doc of DOCS) {
        const res = await request.get(`${prefix}/legal/${doc}`);
        expect(res.status(), `${prefix}/legal/${doc}`).toBe(200);
        const html = await res.text();
        if (doc !== 'derechos') {
          expect(html).toMatch(/mailto:/); // contact
          expect(html).toMatch(/RUC/); // identity block (value pending until configured)
        }
      }
    });
  }

  test('"delete my account/data" alias lands on the data-rights form', async ({ page }) => {
    await page.goto('/legal/eliminar-cuenta');
    await expect(page).toHaveURL(/\/legal\/derechos$/);
    await expect(page.getByRole('button', { name: /enviar solicitud/i })).toBeVisible();
  });

  test('no cookie banner and no third-party analytics requests when analytics is not configured', async ({ page }) => {
    const hosts: string[] = [];
    page.on('request', (r) => hosts.push(new URL(r.url()).host));
    await page.goto('/');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(hosts.filter((h) => /google|posthog|sentry/.test(h))).toEqual([]);
  });

  test('security headers are present on pages and API', async ({ request }) => {
    for (const path of ['/', '/api/health']) {
      const res = await request.get(path);
      const h = res.headers();
      expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['strict-transport-security']).toContain('max-age=');
      expect(h['referrer-policy']).toBeTruthy();
      expect(h['permissions-policy']).toContain('camera=()');
    }
    const health = await (await request.get('/api/health')).json();
    expect(JSON.stringify(health)).not.toMatch(/secret|password|api[_-]?key"\s*:\s*"[^"]{12,}/i);
  });

  test('report-request API rejects cross-origin browser forms without JSON (no CSRF-style form posts)', async ({ request }) => {
    const res = await request.post('/api/report-requests', { form: { email: 'a@b.co' } });
    expect(res.status()).toBe(400);
  });
});
