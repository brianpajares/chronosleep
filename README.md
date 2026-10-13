# ChronoSleep

Calculadora de **social jetlag** y planner semanal de 7 días. Herramienta educativa de bienestar para adultos 18+: **no diagnostica ni trata**.
Next.js 16 (App Router) · TypeScript estricto · Tailwind 4 · next-intl (es/en/pt) · Supabase · Resend · @react-pdf/renderer · Stripe (detrás de un flag).

- **Producción / staging:** https://chronosleep-five.vercel.app (noindex hasta cerrar el gate de lanzamiento)
- Este repo conserva íntegro el paquete `BUILD_chronosleep_v4` (`docs/`, `spec/`, `ux/`, `model/`, `drive/`, `source_stage3/`). Precedencia ante contradicciones: `handoff.json` + `docs/PRD.md` → `spec/` → `ux/` → `model/`.

## Arranque

```bash
npm ci
cp .env.example .env.local   # todo es opcional en local: sin claves usa memoria + outbox de emails
npm run dev                  # http://localhost:3000
```

Sin variables de entorno la app funciona de punta a punta: almacén en memoria, emails a un outbox en memoria (`/api/dev/outbox`, solo en dev/E2E), Drive desde la copia empaquetada verificada. **Windows:** si `next build` falla con `ERR_SWC_NATIVE_CACHE`, define `SWC_NATIVE_BINDING_CACHE` a una carpeta de tu perfil (p. ej. `C:\Users\<tú>\.swc-cache`).

## Comandos (CLAUDE.md)

| Comando | Qué hace |
|---|---|
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` (ejecuta antes `npx next typegen`) |
| `npm test` | Vitest: motor, contrato, i18n, Drive, PDF, API (flujo validation y stripe), privacidad, retención, seguridad |
| `npm run test:vectors` | **21/21** vectores oficiales (`spec/test_vectors.json`) contra el motor TypeScript a 1e-6 |
| `npm run test:e2e` | Playwright (requiere `npm run build`): flujo validation completo, axe, 360 px, teclado, reduced motion |
| `npm run lighthouse:ci` | Lighthouse móvil >= 90 en 4 categorías (usar `NEXT_PUBLIC_INDEXING_ENABLED=true` en la auditoría) |
| `npm run drive:verify` | Compara los 7 artefactos de `spec/drive_manifest.json` con `drive/` (y con Drive con `--remote`) |
| `npm run drive:sync` | Sube `drive/` a la carpeta de Drive (no borra nada remoto) — ver `docs/DRIVE_SETUP.md` |

## Arquitectura

```
src/domain/chronosleep   motor puro (port 1:1 de model/engine_reference.py), schema Zod, informe, ICS
src/server               store (Supabase | memoria), crypto AES-256-GCM, Drive, email, PDF, servicios, auth admin
src/app/(site)/[locale]  landing, wizard 8 pasos, resultado, solicitud, informe, legales, SEO por país/caso
src/app/(admin)/admin    panel (noindex, magic link de Supabase para ADMIN_EMAILS)
src/app/api              rutas según spec/openapi.yaml (+ extensiones documentadas en DECISIONS.md)
supabase/migrations      esquema + RLS derivados de spec/db_schema.sql
```

Flujo `MONETIZATION_MODE=validation` (por defecto): preview gratis → email + consentimiento → lead cifrado + PDF → confirmación al usuario + aviso al owner (con PDF) → `/admin` aprueba → email con enlace opaco y vencimiento + PDF. `stripe`: Checkout + webhook firmado e idempotente + entrega automática; en `validation` esas rutas responden 404 y el módulo de Stripe ni se carga.

## Despliegue (Vercel)

1. `vercel link` y `vercel deploy --prod` (o conecta el repo en Vercel: cada push a `main` despliega).
2. Variables mínimas para una demo: `MONETIZATION_MODE=validation`, `DATA_ENCRYPTION_KEY_BASE64` (32 bytes base64), `CRON_SECRET`, claves de **prueba** de Turnstile (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`).
3. Para operar de verdad (ver `.env.example` y `docs/LAUNCH_CHECKLIST.md`): Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; aplicar `supabase/migrations/*.sql`), Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `OWNER_EMAIL`, dominio con SPF/DKIM/DMARC), `ADMIN_EMAILS`, Upstash, PostHog, Sentry, Turnstile real, Google Drive (service account).
4. **Gate de lanzamiento:** el sitio sale con `noindex` y `robots.txt` cerrado. No fijes `NEXT_PUBLIC_INDEXING_ENABLED=true` ni lances paid acquisition hasta resolver marca/dominio, textos legales, deliverability y requisitos regulatorios por mercado.
5. **Rollback:** Vercel → Deployments → "Promote to Production" sobre un despliegue anterior (o `vercel rollback`).

Sin Supabase en producción, el almacén es **memoria** (se pierde entre invocaciones): sirve para demo, no para recoger leads. `GET /api/health` lo indica (`db_driver`).

## Seguridad y privacidad (resumen)

PII (email, horarios, resultados) cifrada con AES-256-GCM en servidor; email con hash HMAC para dedupe; RLS activo en todas las tablas; el navegador nunca toca la base; PostHog solo recibe eventos/propiedades del catálogo `spec/analytics_events.json` (sin emails ni HH:MM); logs con lista blanca; CSP y cabeceras de seguridad; Turnstile + rate limit; enlaces de informe con token opaco que vence y rota al reenviar.
