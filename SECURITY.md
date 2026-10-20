# Security policy

## Reporting a vulnerability
Write to the privacy/security contact (`NEXT_PUBLIC_PRIVACY_EMAIL`, shown on every legal page) with steps to reproduce. Please do not open public issues for vulnerabilities and do not access data that is not yours. We acknowledge reports within 3 business days.

## Controls in this repository (see `AUDITORIA_SEGURIDAD_LEGAL.md` for evidence)
- PII (email, schedules, results) encrypted with AES-256-GCM server-side; email hashed with HMAC for de-duplication; the browser never talks to the database.
- RLS enabled on every table (`supabase/migrations`); the service-role key lives only in server env vars.
- Zod validation on every API input; uniform JSON errors with request ids; no stack traces.
- Turnstile + honeypot + rate limiting on every public write endpoint; admin behind Supabase magic link + `ADMIN_EMAILS`.
- Report links: opaque 256-bit token, only its hash stored, expiring and rotated on resend; `noindex`, `no-referrer`, `no-store`.
- Stripe: signed + idempotent webhook, amount/currency/owner validated, live key blocked without `STRIPE_LIVE_APPROVED=true`, unreachable in `validation` mode.
- CSP and security headers (`next.config.ts`), HSTS, logs and analytics with allow-lists (no PII).
- CI: lint, types, tests, 21/21 vectors, Playwright + axe, gitleaks on full history, `npm audit`, Dependabot.

## Secrets
Only in Vercel/Supabase/provider dashboards or a local `.env.local` (git-ignored). If a secret ever appears in chat, a commit or a log: rotate it immediately, then update the environment variable and redeploy.
