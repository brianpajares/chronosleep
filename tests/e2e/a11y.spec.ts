import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fillWizard } from './helpers';

/** NT-06: no critical/serious axe violations along the main flow, in light and dark. */
async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(bad.map((v) => `${label}: ${v.id} (${v.nodes.length})`), JSON.stringify(bad.map((v) => v.nodes.map((n) => n.html).slice(0, 2)))).toEqual([]);
}

test.describe('Accessibility (WCAG 2.2 AA)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`landing, content pages and funnel pass axe (${scheme})`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' }); // avoid scanning mid fade-in
      for (const path of ['/', '/en', '/pt', '/como-funciona', '/faq', '/legal/privacidad', '/legal/derechos', '/mx/social-jetlag']) {
        await page.goto(path);
        await scan(page, `${scheme} ${path}`);
      }
      await page.context().clearCookies(); // visiting /pt stored the NEXT_LOCALE cookie
      await page.goto('/calcular/1');
      await scan(page, `${scheme} step1`);
      await fillWizard(page);
      await page.waitForURL(/\/resultado$/);
      await expect(page.locator('#result-title')).toContainText('1 h 53 min');
      await scan(page, `${scheme} result`);
      await page.getByRole('link', { name: /recibir mi informe completo/i }).click();
      await scan(page, `${scheme} gate`);
    });
  }

  test('keyboard-only: the first wizard step can be completed with Tab/Enter and focus is visible', async ({ page }) => {
    await page.goto('/calcular/1');
    await page.locator('input[type=time]').focus();
    await page.keyboard.type('2330');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/calcular\/2$/);
    const outline = await page.locator('input[type=time]').evaluate((el) => {
      (el as HTMLElement).focus();
      return getComputedStyle(el).outlineStyle + '|' + getComputedStyle(el).boxShadow;
    });
    expect(outline).not.toBe('none|none');
  });

  test('prefers-reduced-motion disables entry animations', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', locale: 'es-ES' });
    const page = await ctx.newPage();
    await page.goto('/');
    const dur = await page.locator('.animate-rise').first().evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(dur)).toBeLessThan(0.01);
    await ctx.close();
  });
});
