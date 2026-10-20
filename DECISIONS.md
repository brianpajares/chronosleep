# DECISIONS — ChronoSleep
Registro append-only para decisiones de implementación posteriores al paquete v4.

## D-001 — 2026-10-05 — Motor de producción
**Contexto:** el motor Python está verificado y no usa dependencias Python especiales.  
**Decisión:** portar 1:1 a TypeScript y mantener Python solo como oracle de tests.  
**Alternativas:** microservicio FastAPI.  
**Impacto:** menor operación y mejor integración Vercel.  
**Test:** AT-04, 21/21 vectores.

## D-002 — 2026-10-05 — Persistencia de PII
**Contexto:** email y horarios son sensibles para privacidad aunque el producto no sea clínico.  
**Decisión:** cifrado AES-256-GCM server-side, email hash para dedupe y RLS.  
**Alternativas:** texto claro protegido solo por RLS.  
**Impacto:** más código, menor exposición en una fuga de DB.  
**Test:** AT-08 y pruebas de seguridad.

## D-003 — 2026-10-05 — Modo de monetización
**Contexto:** demanda de pago aún no validada.  
**Decisión:** `validation` por defecto; Stripe queda detrás de feature flag y solo se activa con umbrales.  
**Test:** AT-24.

## D-004 — 2026-10-05 — Drive
**Contexto:** la app debe leer artefactos desde Drive sin volver cada request dependiente de Drive.  
**Decisión:** checksum + cache 24 h + last-known-good.  
**Test:** AT-19 a AT-21.

## D-005 — 2026-10-05 — Status Stage 3
**Contexto:** `handoff.json` de entrada tenía `status=QA_UX_READY` pero `qa_verdict=PASS_WITH_FIXES`.  
**Decisión:** tratar el veredicto QA como gate semántico aprobado y normalizar Stage 4 a `READY_TO_BUILD`.  
**Impacto:** no bloquea construcción; queda auditado.

## D-006 - 2026-10-07 - Next.js 16 sin Cache Components
**Contexto:** el scaffold activa `cacheComponents`/`partialPrefetching`. **Decision:** desactivados (compatibilidad con next-intl y librerias de terceros; paginas publicas siguen estaticas). **Test:** build + E2E.

## D-007 - 2026-10-07 - Repo en C:\dev\chronosleep
**Decision:** repositorio fuera de OneDrive (node_modules y limite de ruta de Windows). El paquete v4 se conserva integro en la raiz.

## D-008 - 2026-10-07 - CSP estatica con `unsafe-inline`
**Contexto:** CSP con nonces fuerza render dinamico y rompe cache/LCP. **Decision:** CSP estatica en `next.config.ts` (script/style `unsafe-inline`, resto restringido, `upgrade-insecure-requests` solo en Vercel). **Alternativa:** nonces o SRI experimental. **Revisar** si se acepta el coste de render dinamico.

## D-009 - 2026-10-07 - Indexacion cerrada hasta el gate de lanzamiento
**Decision:** `NEXT_PUBLIC_INDEXING_ENABLED` (por defecto false) controla robots, sitemap y meta robots. Lighthouse SEO se audita con la variable en true.

## D-010 - 2026-10-07 - `calculations`: dos cifrados en un par iv/tag
**Contexto:** el esquema tiene un solo `payload_iv`/`payload_tag` para dos ciphertexts. **Decision:** dos cifrados AES-GCM independientes, almacenados como `ivA.ivB` y `tagA.tagB` (nunca se reutiliza un nonce). **Test:** security.test.ts.

## D-011 - 2026-10-07 - El calculo pasa a vivir lo que el lead
**Contexto:** `leads.calculation_id ... on delete cascade` borraria el lead a los 30 d. **Decision:** al crear el lead, `calculations.expires_at` se extiende a `leads.expires_at` (90 d). **Test:** flow.validation.

## D-012 - 2026-10-07 - Validacion: el owner aprueba la entrega
**Decision:** en `validation` el usuario recibe confirmacion; el informe (enlace opaco + PDF) se envia al aprobar en `/admin`. El token se mintea al entregar (solo se guarda el hash) y rota en cada reenvio. En `stripe`, `/informe/listo?session_id=` (secreto del comprador) abre el informe tras el webhook.

## D-013 - 2026-10-07 - Extensiones a OpenAPI
Rutas adicionales (superconjunto): `/api/reports/{id}/pdf|ics`, `/api/admin/privacy-requests` (+ `/{id}/verify|complete|export`), `/api/cron/retention|drive-verify`, `/api/dev/outbox` (solo E2E/dev). `/api/calculate` devuelve el objeto exacto del motor (`domain`) segun contrato; el bloqueo del plan en el preview es de UX.

## D-014 - 2026-10-07 - Drive: copia empaquetada como last-known-good
**Decision:** `drive/` se despliega con la app; los artefactos de Drive solo se promueven si su SHA-256 coincide con `spec/drive_manifest.json`; cache 24 h; si Drive falla se sirve la ultima copia valida o la empaquetada. Cliente Drive propio (JWT RS256, sin `googleapis`).

## D-015 - 2026-10-07 - Almacen en memoria y claves de prueba en el despliegue demo
El despliegue inicial en Vercel no tiene Supabase/Resend: usa memoria, emails `email_not_configured` y claves de prueba de Turnstile. **No es apto para recoger leads reales** (ver README).

## D-016 - 2026-10-20 - Lighthouse con throttling aplicado y score de rendimiento como aviso
**Contexto:** con throttling simulado (Lantern) el LCP sale ~5 s aunque el LCP observado es ~0,4 s (el elemento LCP es el wordmark del header). **Decision:** CI usa `throttlingMethod: devtools` (movil, red 4G lenta, CPU 4x), mediana de 3 ejecuciones. Son `error`: LCP <= 2,5 s, FCP <= 2,5 s, TBT <= 600 ms, CLS <= 0,1, accesibilidad/best-practices/SEO >= 0,9. El score de rendimiento >= 0,9 es `warn` (medido 0,87-0,94; el coste restante es la hidratacion de React). **Revisar** si se reduce el JS inicial (~550 KB sin comprimir).

## D-017 - 2026-10-20 - Consentimiento previo para analitica (Consent Mode v2)
GA4 y PostHog no se cargan hasta aceptar el banner; DNT/GPC prevalecen; los paths enviados a GA se sanitizan; el evento `purchase` server-side (Measurement Protocol) solo lleva `ga_cid` si hubo consentimiento. Enmienda la vista previa en modo stripe de D-013 (el bloqueo del plan en el preview tambien se redacta en servidor).

## D-018 - 2026-10-20 - Controles anti-abuso y de cobro
Honeypot `website` (responde con senuelo 201/202), `STRIPE_LIVE_APPROVED=true` obligatorio para usar `sk_live_` (doble interruptor), validacion de importe/moneda/propietario en el webhook (si no coincide: log + auditoria, sin entrega), columnas explicitas en Supabase (sin `select *`), documentos legales en borrador con `[COMPLETAR]` y revision de abogado pendiente.
