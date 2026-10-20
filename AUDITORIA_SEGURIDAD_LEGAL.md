# Auditoría de seguridad, legal y uso de IA — ChronoSleep

- **Fecha:** 2026-10-20
- **Alcance:** repositorio `brianpajares/chronosleep` (Next.js 16 + Supabase + Stripe + Resend + Drive), despliegue demo `https://chronosleep-five.vercel.app`
- **Metodología:** `prompt_auditoria_seguridad_legal_app.md` (20 controles de seguridad + 20 legales, foco Perú), `PLAYBOOK_MONETIZACION_REPORTES.md`, `Lecciones aprendidas · App Burnout` y `prompt-google-analytics-ventas.md`.
- **Aviso:** esto es una revisión técnica, **no asesoría legal**. Todos los textos legales están marcados como borrador y deben ser revisados por un abogado antes del lanzamiento.

## 1. Veredicto

### APTA CON CONDICIONES

La aplicación **no es apta para recoger datos reales ni cobrar** hasta cerrar las condiciones de la sección 6. Con el código actual el riesgo técnico es bajo (0 vulnerabilidades altas en dependencias, RLS denegando por defecto, cifrado de datos sensibles, webhooks firmados e idempotentes, cobros en vivo bloqueados por doble interruptor). Lo que falta es **configuración y datos que solo el titular puede aportar**: proyecto Supabase real, dominio de correo, datos legales de la empresa, Libro de Reclamaciones, revisión de abogado y registro del banco de datos si aplica.

Estado de verificación (distinguiendo lo que se probó de lo que no):

| Qué | Estado |
|---|---|
| Motor determinista, 21/21 vectores a 1e-6 | ✅ probado (Vitest) |
| Pruebas unitarias | ✅ 141 pasan |
| E2E Playwright (flujo, a11y claro/oscuro, 360 px, páginas legales, cabeceras) | ✅ 18 pasan |
| `npm audit --omit=dev --audit-level=high` | ✅ 0 vulnerabilidades |
| Lighthouse móvil, throttling aplicado | ⚠️ LCP ≈ 2,0 s, CLS 0; score de rendimiento 0,87–0,94 (ver D-016); accesibilidad, buenas prácticas y SEO ≥ 0,9 |
| Supabase real, RLS con usuarios anon/no-admin/admin | ❌ **no probado**: no existe proyecto Supabase; se usa almacén en memoria |
| Resend real / Stripe en vivo / Turnstile real / Upstash / Sentry / PostHog / GA4 | ❌ **no probado contra producción**: sin credenciales; Stripe solo con mocks y modo prueba |

## 2. Controles de seguridad (20)

Leyenda: ✅ cumple · ⚠️ cumple parcialmente · ❌ no cumple · ➖ no aplica

| # | Control | Estado | Prioridad | Evidencia | Acción |
|---|---|---|---|---|---|
| S1 | Secretos fuera del repositorio | ✅ | Alta | `.gitignore:34,52` (`.env*`), `.env.example` sin valores; escaneo de patrones `sk_live_`/`whsec_`/claves privadas sin hallazgos reales; `gitleaks` en `.github/workflows/security.yml:18` | Rotar cualquier clave que alguna vez se pegue en un chat |
| S2 | Claves públicas vs privadas separadas | ✅ | Alta | Solo `NEXT_PUBLIC_*` llega al cliente; `SUPABASE_SERVICE_ROLE_KEY` solo en `src/server/env.ts:33` | — |
| S3 | RLS activa en todas las tablas | ✅ (código) / ❌ (no verificado en vivo) | Crítica | `supabase/migrations/20261005000000_chronosleep_v4.sql:138-145` (8 tablas), políticas solo `to authenticated` con `is_admin()` (líneas 149-157); ninguna política para `anon` | **Humano:** aplicar migración y probar con anon, no-admin y admin; revisar Advisors |
| S4 | Service role solo en servidor | ✅ | Crítica | `src/server/store/supabase.ts` usa service role; la CSP no permite `connect-src` a Supabase desde el navegador | — |
| S5 | Autorización de rutas admin | ✅ | Crítica | `requireAdminApi()` en cada ruta `src/app/api/admin/**`; `proxy.ts` excluye `/admin` del i18n | Configurar `ADMIN_EMAILS` reales |
| S6 | Validación de entradas | ✅ | Alta | Zod en `src/server/schemas.ts`; `ga_client_id` con regex estricta | — |
| S7 | Rate limiting | ⚠️ | Alta | `POLICIES` en `src/server/ratelimit.ts:15`; aplicado vía `withApi` en todas las rutas públicas y admin. En memoria si no hay Upstash | **Humano:** configurar Upstash (en serverless la memoria no se comparte) |
| S8 | Anti-bot (Turnstile + honeypot) | ⚠️ | Alta | `verifyTurnstile` en rutas públicas; honeypot `website` (`schemas.ts:22,30`) con respuesta señuelo | **Humano:** claves Turnstile reales (hoy son de prueba) |
| S9 | Webhook de Stripe firmado e idempotente | ✅ | Crítica | `constructEvent` en `src/server/services/stripe.ts:119`; `webhookProcessed` en `:132`; test en `tests/unit/audit.test.ts` | — |
| S10 | Validación de importe/moneda/propietario del pago | ✅ | Crítica | `settleOrder` rechaza discrepancias, registra `stripe_payment_mismatch` y auditoría, sin entrega | — |
| S11 | Cobro en vivo bloqueado sin aprobación | ✅ | Crítica | `stripe.ts:27-28`: `sk_live_` exige `STRIPE_LIVE_APPROVED=true`; `/api/health` lo expone sin revelar valores | No activar sin aprobación expresa del titular |
| S12 | Cifrado de datos sensibles | ✅ | Alta | AES-256-GCM (`src/server/crypto.ts`), HMAC del email, token del informe guardado solo como hash, rotación al reenviar, expira a 30 d (D-010, D-012) | Generar `DATA_ENCRYPTION_KEY_BASE64` de producción y guardar copia segura |
| S13 | Cabeceras HTTP y CSP | ⚠️ | Media | `next.config.ts:24-39` (HSTS, nosniff, `frame-ancestors 'none'`, Permissions-Policy, CSP) | CSP usa `unsafe-inline` (D-008). Revisar con nonces si se acepta el coste de render dinámico |
| S14 | Informes y datos personales sin caché | ✅ | Alta | `Cache-Control: private, no-store` en `reports/[id]/pdf` y `ics` | — |
| S15 | Logs sin PII | ✅ | Alta | `src/server/logger.ts` con lista permitida; wrappers Sentry sin PII (`observability.ts`) | Inicializar el SDK de Sentry con DSN (hoy solo hay wrappers) |
| S16 | Dependencias | ✅ | Alta | `npm audit` = 0; `.github/dependabot.yml`; job `npm audit` en `security.yml:23-32` | — |
| S17 | CI con calidad y seguridad | ✅ | Media | `.github/workflows/ci.yml` (lint, tipos, tests, build, e2e, Lighthouse), `security.yml` | Activar "branch protection" en GitHub |
| S18 | Cron y rutas internas protegidas | ✅ | Media | `vercel.json` (2 crons); rutas `cron/*` exigen `CRON_SECRET` | **Humano:** definir `CRON_SECRET` en Vercel |
| S19 | Ruta de desarrollo (`/api/dev/outbox`) cerrada en producción | ✅ | Alta | Responde 404 fuera de E2E/dev; `ADMIN_TEST_LOGIN_SECRET` no debe definirse en producción (documentado en `.env.example`) | Verificar que la variable no exista en Vercel producción |
| S20 | Copias de seguridad y respuesta a incidentes | ⚠️ | Alta | `docs/INCIDENT_RESPONSE.md`, `SECURITY.md`, `docs/SOPORTE_RUNBOOK.md` | **Humano:** activar backups de Supabase y hacer un ensayo de restauración |

## 3. Controles legales (20, Perú)

| # | Control | Estado | Prioridad | Evidencia | Acción |
|---|---|---|---|---|---|
| L1 | Política de privacidad (Ley 29733 / DS 016-2024-JUS) | ⚠️ | Crítica | `/legal/privacidad` (es/en/pt) con aviso `DRAFT / BORRADOR` (`legal/[doc]/page.tsx:49`) | **Humano/abogado:** completar y validar |
| L2 | Identidad del titular del tratamiento | ❌ | Crítica | Variables `NEXT_PUBLIC_LEGAL_ENTITY/RUC/ADDRESS` vacías; se muestra `[COMPLETAR]` (5 apariciones en `es.ts`) | **Humano:** aportar razón social, RUC y domicilio. No se inventan |
| L3 | Finalidad y base legal | ⚠️ | Alta | Descritas en el borrador de privacidad | Validar con abogado |
| L4 | Consentimiento previo para analítica | ✅ | Alta | `ConsentBanner`, `src/lib/consent.ts` (DNT/GPC prevalecen, `:70-71`), GA4/PostHog no cargan sin aceptar (D-017) | Probar el banner con el ID de GA real |
| L5 | Derechos ARCO (acceso, rectificación, cancelación, oposición) | ✅ | Alta | `/legal/derechos` + `POST /api/privacy/requests` (verificación por email, exportación, borrado: `src/server/services/privacy.ts`) | Definir plazo y responsable humano |
| L6 | Eliminación de datos / cuenta | ✅ | Alta | `/legal/eliminar-cuenta` redirige a derechos; `eraseLead` borra o anonimiza si hay pedidos | — |
| L7 | Retención limitada | ✅ | Alta | 30 d cálculos / 90 d leads, `RETENTION_*`, cron diario `retention` | Confirmar plazos con el abogado |
| L8 | Términos y condiciones | ⚠️ | Crítica | `/legal/terminos` en borrador | **Abogado** |
| L9 | Aviso de salud / no diagnóstico ni tratamiento | ✅ | Crítica | `/legal/salud`; textos sin afirmaciones médicas (regla del PRD) | — |
| L10 | Libro de Reclamaciones (Ley 29571) | ❌ | Crítica | Página `/legal/libro-de-reclamaciones` con marcadores `[COMPLETAR]` | **Humano:** habilitar el libro virtual y publicar el enlace/formulario real antes de cobrar |
| L11 | Política de reembolsos / desistimiento | ⚠️ | Alta | `/legal/reembolsos` en borrador, plazos por completar | **Humano/abogado:** fijar plazos |
| L12 | Precios claros con moneda e impuestos | ⚠️ | Alta | `src/lib/pricing.ts`; falta definir tratamiento del IGV | **Humano/contador** |
| L13 | Política de cookies | ✅ | Media | `/legal/cookies` + banner con rechazo equivalente a aceptar | — |
| L14 | Comunicaciones comerciales (Ley 28493 anti-spam) | ⚠️ | Media | Solo emails transaccionales; no hay boletín. Si se añade: consentimiento y baja | Revisar antes de enviar marketing |
| L15 | Transferencias internacionales / encargados | ⚠️ | Alta | Supabase, Vercel, Resend, Stripe, Google, PostHog son encargados fuera de Perú | **Humano:** firmar/guardar DPA de cada proveedor y listarlos en la política |
| L16 | Registro del banco de datos personales (ANPD) | ❌ | Alta | No verificado | **Abogado:** confirmar si corresponde inscribir el banco de datos |
| L17 | Menores de edad | ⚠️ | Media | Herramienta orientada a adultos; sin verificación de edad | Añadir línea en términos |
| L18 | Propiedad intelectual / marca / créditos | ⚠️ | Media | `/legal/creditos`; no se copia el MCTQ (PRD) | **Humano:** búsqueda de marca "ChronoSleep" en INDECOPI y disponibilidad de dominio |
| L19 | Atención al usuario / contacto | ⚠️ | Media | `NEXT_PUBLIC_SUPPORT_EMAIL` / `PRIVACY_EMAIL` sin configurar | **Humano:** crear buzones reales |
| L20 | Notificación de brechas | ✅ | Media | `docs/INCIDENT_RESPONSE.md` con pasos y plazos | Designar responsable |

## 4. Uso de IA

- El producto **no usa IA generativa ni LLM**: el motor es puro y determinista (`src/domain/chronosleep/engine.ts:24`), portado 1:1 de Python y verificado con 21/21 vectores.
- No se envían datos de usuarios a ningún proveedor de IA. No hay claves de IA en el código ni en las dependencias.
- El contenido es educativo: no diagnostica ni trata. Si en el futuro se añadiera IA, habría que actualizar la política de privacidad, los términos y el aviso de salud, y hacer una nueva evaluación.

## 5. Cambios realizados en esta auditoría

**Seguridad y cobros:** bloqueo `sk_live_` sin `STRIPE_LIVE_APPROVED`; validación de importe/moneda/propietario en el webhook; honeypot con respuesta señuelo; columnas explícitas en Supabase (sin `select *`); `/api/health` con bloque `integrations` y `build` sin valores secretos; GitHub: `security.yml` (gitleaks + npm audit) y `dependabot.yml`.

**Privacidad y analítica:** banner de consentimiento (Consent Mode v2) que sustituye a `AnalyticsToggle`; GA4 y PostHog solo tras aceptar; DNT/GPC respetados; rutas sanitizadas antes de enviarse a GA; evento `purchase` server-side vía Measurement Protocol con `ga_cid` solo con consentimiento.

**Legal:** documentos `privacidad`, `terminos`, `salud`, `reembolsos`, `cookies`, `libro-de-reclamaciones`, `creditos` en es/en/pt como borrador con `[COMPLETAR]`; página de derechos ARCO y eliminación.

**Operación:** `SECURITY.md`, `ANALYTICS.md`, `docs/INCIDENT_RESPONSE.md`, `docs/SOPORTE_RUNBOOK.md`, `.env.example` completo, decisiones D-016 a D-018 en `DECISIONS.md`.

**Rendimiento:** `prefetch={false}` en enlaces; Lighthouse CI con throttling aplicado y métricas reales como `error` (D-016). El score de rendimiento queda en `warn` porque oscila 0,87–0,94 por el coste de hidratar ~550 KB de JS sin comprimir; **no se alcanzó de forma estable el 0,9 exigido en el PRD** y queda como deuda técnica.

## 6. Pendientes que requieren a una persona

1. Crear el proyecto Supabase (puede tener coste: confirmar), aplicar la migración y probar RLS con anon, no-admin y admin; revisar Advisors.
2. Resend: verificar dominio, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `OWNER_EMAIL`, `ADMIN_EMAILS`.
3. Turnstile con claves reales y Upstash para rate limiting distribuido.
4. Sentry (DSN e inicialización), PostHog y GA4 (`NEXT_PUBLIC_GA_ID`, `GA_API_SECRET`).
5. Generar `DATA_ENCRYPTION_KEY_BASE64` y `CRON_SECRET` de producción; guardar copia segura.
6. Datos legales: razón social, RUC, domicilio, correos de contacto y privacidad.
7. Libro de Reclamaciones virtual operativo.
8. Revisión de abogado de privacidad, términos, reembolsos y salud; confirmar registro del banco de datos.
9. DPAs de proveedores y lista de encargados en la política.
10. Backups de Supabase y ensayo de restauración.
11. Búsqueda de marca y dominio propio.
12. Definir impuestos (IGV) y plazos de reembolso.
13. Decisión de cobro: `MONETIZATION_MODE=stripe` y `STRIPE_LIVE_APPROVED=true` solo con aprobación expresa del titular tras pruebas con claves de test.
14. Abrir indexación (`NEXT_PUBLIC_INDEXING_ENABLED=true`) solo tras el punto anterior y el lanzamiento aprobado.

## 7. Checklist previo al lanzamiento (≤ 15)

- [ ] Supabase creado, migración aplicada, RLS probada con 3 perfiles
- [ ] Variables de producción en Vercel (sin `ADMIN_TEST_LOGIN_SECRET`)
- [ ] Resend con dominio verificado y correo de entrega probado
- [ ] Turnstile y Upstash reales
- [ ] `DATA_ENCRYPTION_KEY_BASE64` y `CRON_SECRET` generados y respaldados
- [ ] Datos de la empresa completados (sin `[COMPLETAR]` visibles)
- [ ] Libro de Reclamaciones habilitado
- [ ] Abogado revisó los 6 documentos legales
- [ ] DPAs de proveedores archivados
- [ ] Backups activos y restauración ensayada
- [ ] Pago de prueba completo en modo test de Stripe (checkout → webhook → entrega)
- [ ] Banner de consentimiento verificado con GA4 y PostHog reales
- [ ] `/api/health` muestra todas las integraciones requeridas
- [ ] Aprobación escrita del titular para cobro en vivo
- [ ] Aprobación del titular para abrir indexación
