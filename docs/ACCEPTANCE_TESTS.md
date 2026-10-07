# ACCEPTANCE_TESTS — ChronoSleep v4
Todos los tests deben ser reproducibles en CI salvo los marcados “staging real”.

| ID | FR/NFR | Prueba | Resultado esperado |
|---|---|---|---|
| AT-01 | FR-01 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Landing pública con propuesta, confianza, CTA único y disclaimer wellness. |
| AT-02 | FR-02 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Wizard de 8 pasos, un input principal por pantalla, con persistencia de sesión y navegación atrás. |
| AT-03 | FR-03 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Validar inputs contra `spec/inputs.schema.json` y reglas 3–14 h antes de invocar el motor. |
| AT-04 | FR-04 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Portar `model/engine_reference.py` a TypeScript sin cambiar semántica y pasar 21/21 vectores. |
| AT-05 | FR-05 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Renderizar vista previa con `social_jetlag_hours`, `weekly_timing_chart` y `one_insight`. |
| AT-06 | FR-06 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Mostrar sensibilidad, referencia poblacional y disclaimers sin lenguaje diagnóstico. |
| AT-07 | FR-07 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Formulario de solicitud con email, consentimiento de envío requerido y copia al equipo opcional OFF. |
| AT-08 | FR-08 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Crear cálculo/lead en Supabase por API server-side; no enviar email ni HH:MM exactos a analytics. |
| AT-09 | FR-09 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Generar PDF completo al crear solicitud en modo validation. |
| AT-10 | FR-10 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Enviar confirmación al usuario y email a OWNER_EMAIL con asunto `[ChronoSleep] Solicitud de informe <id>`. |
| AT-11 | FR-11 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Adjuntar o enlazar de forma privada el PDF al owner y solo incluir inputs/resultados en copia al equipo cuando exista opt-in específico. |
| AT-12 | FR-12 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Proteger `/informe/:id` con token opaco/expirable y evitar PII en URL. |
| AT-13 | FR-13 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | El informe web/PDF debe contener todos los outputs de `spec/outputs_spec.json` para INFORME_COMPLETO. |
| AT-14 | FR-14 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Permitir exportación ICS del plan de 7 días desde el informe completo. |
| AT-15 | FR-15 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Localizar interfaz, emails y SEO en es/en/pt con next-intl y `spec/copy_i18n.json`. |
| AT-16 | FR-16 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Exponer flujo de solicitud de derechos y borrado; ejecutar borrado de payload/email y registrar auditoría mínima no reversible. |
| AT-17 | FR-17 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | `/admin` autenticado para listar leads, estados, funnel y acciones approve/resend. |
| AT-18 | FR-18 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | `/admin` debe estar noindex y autorizado solo para ADMIN_EMAILS. |
| AT-19 | FR-19 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Leer Drive desde GOOGLE_DRIVE_FOLDER_ID por ruta/nombre, verificar SHA-256 contra `spec/drive_manifest.json`. |
| AT-20 | FR-20 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Cachear artefactos Drive 24 h y usar última versión válida si Drive falla o checksum no coincide. |
| AT-21 | FR-21 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Implementar `npm run drive:sync` para subir `drive/` preservando subcarpetas. |
| AT-22 | FR-22 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Con MONETIZATION_MODE=stripe crear Checkout Session con precio permitido y metadata mínima. |
| AT-23 | FR-23 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Verificar firma Stripe, manejar webhook idempotente y entregar PDF automáticamente solo tras pago confirmado. |
| AT-24 | FR-24 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Mantener Stripe inaccesible cuando MONETIZATION_MODE=validation. |
| AT-25 | FR-25 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Implementar rutas públicas y noindex según `ux/sitemap_flows.md`, canonical y hreflang es/en/pt. |
| AT-26 | FR-26 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Emitir WebApplication y FAQPage solo en páginas visibles compatibles; nunca indexar resultados/admin/checkout. |
| AT-27 | FR-27 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Cumplir teclado, foco, labels, errores, targets >=44px y prefers-reduced-motion según `ux/ux_spec.md`. |
| AT-28 | FR-28 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | PDF debe ser semánticamente equivalente al informe web y comprensible sin depender del color. |
| AT-29 | FR-29 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Instrumentar PostHog según `spec/analytics_events.json` con propiedades categorizadas y consentimiento aplicable. |
| AT-30 | FR-30 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Instrumentar Sentry con redacción de PII y request IDs; no capturar inputs crudos ni emails. |
| AT-31 | FR-31 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Aplicar Turnstile y rate limit en solicitud de informe; rate limit también en cálculo y endpoints de auth/admin. |
| AT-32 | FR-32 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Generar PDF con @react-pdf/renderer siguiendo `ux/report_layout.md` y versión/ID en footer. |
| AT-33 | FR-33 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Aplicar retención configurable: cálculos anónimos 30 días, leads/reportes 90 días por defecto, pedidos 7 años solo si obligación fiscal aplicable; política final debe validarse por mercado. |
| AT-34 | FR-34 | Verificar automatizadamente el requisito mediante Vitest/Playwright/integración según capa. | Ofrecer waitlist de suscripción sin activar cobro recurrente en MVP. |

## Tests NFR
| ID | Requisito | Prueba | Gate |
|---|---|---|---|
| NT-01 | NFR-01 | k6/Artillery o harness concurrente contra `/api/calculate` y `/api/report-requests` en preview. | p95 <2 s. |
| NT-02 | NFR-02 | Lighthouse CI móvil landing, cómo-funciona y FAQ. | >=90 en 4 categorías. |
| NT-03 | NFR-03 | Simular 5xx/timeout Drive y checksum malo. | Usa LKG, health `degraded`, cálculo sigue. |
| NT-04 | NFR-04/05 | Test RLS con anon/auth no-admin/admin; grep bundle/logs; test cifrado. | PII no accesible y sin secretos. |
| NT-05 | NFR-06 | `npm run test:vectors`. | 21/21 a 1e-6. |
| NT-06 | NFR-07 | axe + keyboard-only + reduced motion. | 0 violaciones críticas/serias en flujo. |
| NT-07 | NFR-08 | test de catálogo y screenshots es/en/pt. | 100% keys críticas. |
| NT-08 | NFR-09 | instrumentar costo de Resend/compute/storage por reporte. | objetivo <=$0.15 mediana, <=$0.25 p95. |
| NT-09 | NFR-10 | provocar error sintético. | Sentry recibe evento sin PII. |
| NT-10 | NFR-11 | inspeccionar sitemap/robots/metas. | rutas privadas no indexables. |
| NT-11 | NFR-12 | build Vercel y build Netlify de compatibilidad. | ambos compilan; Vercel es target release. |

## Casos de regresión de dominio
- Ejecutar los 21 casos de `spec/test_vectors.json`.
- Rechazar `24:00`, NaN, infinito, booleanos en enteros, decimales en enteros, latencia/flex fuera de 0–120, `workdays_per_week` fuera de 1–6.
- Aceptar límites exactos de duración 3 h y 14 h.
- Mantener convención determinista del empate circular de 12 h.
- Verificar monotonicidad documentada TV20→TV21.

## E2E validation
1. Landing → 8 pasos → preview.
2. Email gate con Turnstile de test.
3. Persistencia lead cifrado.
4. Generación PDF.
5. Confirmación usuario.
6. Email owner; con `consent_owner_copy=false` no incluye horarios crudos.
7. `/admin` permite approve/resend.
8. Link de informe válido; token vencido falla.

## E2E stripe
1. Cambiar `MONETIZATION_MODE=stripe`.
2. Crear checkout con Stripe test.
3. Enviar webhook firmado `checkout.session.completed`.
4. Repetir mismo evento.
5. Debe existir un único pedido pagado y una única entrega automática.
6. Volver a validation: checkout responde 404/feature-disabled.

## Comandos gate
`npm run lint && npm run typecheck && npm test && npm run test:vectors && npm run test:e2e && npm run lighthouse:ci && npm run drive:verify`
