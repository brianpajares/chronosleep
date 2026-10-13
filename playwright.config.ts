import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3600);
const BASE = `http://localhost:${PORT}`;
export const ADMIN_SECRET = 'e2e-admin-secret';

/**
 * E2E runs against the production build (`next start`) with the in-memory store and email outbox
 * (no external services): E2E=1 exposes /api/dev/outbox and keeps Turnstile open outside prod.
 * Run `npm run build` first (CI does).
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: BASE, locale: 'es-ES', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${BASE}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      E2E: '1',
      NEXT_PUBLIC_APP_URL: BASE,
      OWNER_EMAIL: 'owner@example.test',
      ADMIN_EMAILS: 'admin@example.test',
      ADMIN_TEST_LOGIN_SECRET: ADMIN_SECRET,
      MONETIZATION_MODE: 'validation',
      SWC_NATIVE_BINDING_CACHE: process.env.SWC_NATIVE_BINDING_CACHE ?? '',
    },
  },
});
