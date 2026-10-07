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
