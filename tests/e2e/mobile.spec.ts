import { expect, test } from '@playwright/test';
import { fillWizard } from './helpers';

test.describe('360 px layout', () => {
  test('no horizontal scroll on landing, wizard and result; one main input per step; targets >= 44 px', async ({ page }) => {
    const noHScroll = async (label: string) => {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, `${label} overflows horizontally by ${over}px`).toBeLessThanOrEqual(1);
    };
    await page.goto('/');
    await noHScroll('landing');
    await page.goto('/calcular/1');
    await noHScroll('step 1');
    await expect(page.locator('input[type=time]')).toHaveCount(1);

    const small = await page.evaluate(() =>
      [...document.querySelectorAll('main button, main a, main input')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.height < 43.5 || r.width < 43.5) && !el.className.toString().includes('sr-only');
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(small).toEqual([]);

    await fillWizard(page);
    await page.waitForURL(/\/resultado$/);
    await expect(page.locator('#result-title')).toContainText('1 h 53 min');
    await noHScroll('result');
  });
});
