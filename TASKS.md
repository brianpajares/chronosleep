# TASKS — Backlog M0–M5

## M0 — Bootstrap y contratos
- Inicializar Next.js App Router + TypeScript strict + Tailwind + shadcn/ui.
- Instalar next-intl, Supabase, Resend, PostHog, Sentry, Turnstile client, Upstash, React PDF, Vitest, Playwright y Stripe.
- Configurar ESLint, Prettier, path aliases, `.env.example`, GitHub Actions.
- Validar `spec/openapi.yaml` y preparar migraciones desde `spec/db_schema.sql`.
**Aceptación:** `npm ci`, lint, typecheck y test vacío pasan; no hay secretos; locale routing existe.

## M1 — Dominio
- Portar `engine_reference.py` a módulo TypeScript puro.
- Validar inputs; implementar aritmética circular y planner.
- Cargar `test_vectors.json` en Vitest.
- Comparador deep numérico `1e-6`.
**Aceptación:** 21/21; no hay I/O en el motor; outputs conservan shape y rounding.

## M2 — Funnel
- Landing, wizard 8 pasos, procesando y preview.
- Tokens/componentes/copy desde `ux/` y `spec/`.
- PostHog según catálogo, sin PII.
- axe y navegación por teclado.
**Aceptación:** Playwright de happy/error path; mediana técnica local rápida; Lighthouse >=90 en landing.

## M3 — Lead/report/admin/Drive
- Aplicar DB + RLS.
- Cifrado de PII.
- Solicitud validation, PDF, Resend usuario/owner.
- `/admin` auth + leads/funnel/approve/resend.
- Drive client checksum/cache/LKG y `drive:sync`.
**Aceptación:** test E2E validation real/staging; Drive falla sin tumbar app; owner copy respeta opt-in.

## M4 — Stripe, privacy y hardening
- Checkout solo con `MONETIZATION_MODE=stripe`.
- Webhook firmado + idempotency.
- Privacy request flow.
- CSP/headers, Turnstile/rate limit, Sentry redaction, retención jobs.
**Aceptación:** webhook duplicado no duplica entrega; validation no expone checkout; borrado elimina artifacts/payload.

## M5 — Release
- CI completa: lint/typecheck/unit/vectors/Playwright/Lighthouse.
- Deploy Vercel preview/prod.
- Configurar dominio, email auth, PostHog/Sentry.
- Ejecutar `docs/LAUNCH_CHECKLIST.md`.
**Aceptación:** DoD de PRD completo; smoke real punta a punta y rollback documentado.
