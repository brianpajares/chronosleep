// Dev helper: `node scripts/dev-shot.mjs <url> <out.png> [width] [height] [light|dark] [full=1]`
// Takes a screenshot with Playwright's Chromium for visual review (not used by CI).
import { chromium } from '@playwright/test';

const [url, out = 'shot.png', width = '1280', height = '900', scheme = 'light', full = '1'] =
  process.argv.slice(2);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(width), height: Number(height) },
  colorScheme: scheme === 'dark' ? 'dark' : 'light',
});
const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(900); // let entry animations settle
await page.screenshot({ path: out, fullPage: full === '1' });
await browser.close();
console.log(`saved ${out}`);
