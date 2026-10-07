# BUILD_PROMPT — ChronoSleep
Actúa como Staff Engineer + Product Engineer. Tu objetivo es convertir este paquete en un MVP desplegado, probado y listo para validar tracción. **No hagas preguntas.** Si falta una decisión no bloqueante, toma la opción más conservadora que respete el PRD y regístrala en `DECISIONS.md`.

## Reglas
- Lee `README_START_HERE.md` y luego el orden indicado.
- No inventes outputs, inputs, claims médicos ni requisitos.
- TypeScript `strict`; Next.js App Router; Tailwind + shadcn/ui; Route Handlers.
- Porta el motor desde `model/engine_reference.py` a TypeScript. Antes de UI, demuestra 21/21 con `spec/test_vectors.json` a `1e-6`.
- `MONETIZATION_MODE=validation` por defecto; Stripe debe quedar totalmente detrás de `stripe`.
- Supabase + RLS; browser no accede directamente a PII.
- Google Drive: service account, checksum, cache 24 h, last-known-good; implementa `npm run drive:sync`.
- Resend, next-intl, PostHog, Sentry, Turnstile + rate limit, Vitest, Playwright, GitHub Actions.
- No envíes email/HH:MM exactos a PostHog ni PII a Sentry.
- No copies el cuestionario MCTQ oficial.
- Mantén el producto en wellness/educativo; no diagnóstico/tratamiento.
- Cada decisión nueva: `DECISIONS.md`.
- Cada bug de contrato: test regresivo.
- Si detectas contradicción entre prose y spec estructurado, prioriza `spec/` y documenta.

## Orden de trabajo
1. M0: bootstrap repo, env, CI, i18n, lint/typecheck/test.
2. M1: motor TypeScript + schemas + 21/21 vectors.
3. M2: landing/wizard/preview + UX/a11y/analytics.
4. M3: Supabase/RLS, report request validation, PDF/email/admin, Drive.
5. M4: Stripe feature flag + webhook idempotente + privacy + hardening.
6. M5: Playwright, Lighthouse, observabilidad, deploy Vercel y checklist.

## Entregables de código
- App Next.js funcional con rutas del sitemap.
- `src/domain/chronosleep` con motor puro.
- Migraciones Supabase derivadas de `spec/db_schema.sql`.
- API acorde a `spec/openapi.yaml`.
- `scripts/drive-sync.ts` y `npm run drive:sync`.
- PDF con `@react-pdf/renderer`.
- `/admin` autenticado y noindex.
- Tests Vitest/Playwright/vector/Lighthouse.
- `.github/workflows/ci.yml`.
- README de desarrollo y deploy actualizado sin borrar este paquete.

## Definition of Done
Usa literalmente la sección 28 de `docs/PRD.md` y `docs/ACCEPTANCE_TESTS.md`. El build no está terminado si falla un vector, falta un locale, Lighthouse <90, RLS está desactivado, Drive no tiene fallback, Stripe se filtra en validation o aparece PII en analytics/logs.
