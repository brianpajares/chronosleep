import type { APIRequestContext, Page } from '@playwright/test';

export const EMAIL = 'e2e.persona@example.test';

/** Fills the 8-step wizard with the TV01 profile (SJL 1 h 53 min), waiting for each client-side navigation. */
export async function fillWizard(page: Page, opts: { startPath?: string } = {}) {
  await page.goto(opts.startPath ?? '/calcular/1');
  const next = page.getByRole('button', { name: /continuar|continue|ver mi resultado|see my result|ver meu resultado/i });
  const go = async (n: number) => {
    await next.click();
    await page.waitForURL(n === 9 ? /\/(procesando|resultado)/ : new RegExp(`/calcular/${n}$`));
  };
  const time = async (v: string, n: number) => {
    await page.locator('input[type=time]').fill(v);
    await go(n);
  };
  await time('23:30', 2); // work bedtime
  await time('06:45', 3); // work wake
  await time('01:00', 4); // free bedtime (default = step 1)
  await time('09:00', 5); // free wake (default = step 2 + 60)
  await page.getByText(/^15 min$/).click(); // latency preset
  await go(6);
  await go(7); // workdays default 5
  await page.getByText(/^(No|Não)$/).click(); // free-day alarm: no
  await go(8);
  await page.locator('#flex-number').fill('30');
  await go(9);
}

export async function outbox(request: APIRequestContext) {
  const res = await request.get('/api/dev/outbox');
  return (await res.json()).items as Array<{ to: string; subject: string; html: string; text: string; attachments: { filename: string; contentType: string }[] }>;
}
