# Build Rules — ChronoSleep
Estas reglas aplican a cualquier agente de código que trabaje en el repositorio.

## Comandos esperados
- `npm ci`
- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:vectors`
- `npm run test:e2e`
- `npm run lighthouse:ci`
- `npm run drive:verify`
- `npm run drive:sync`

## Convenciones
- TypeScript strict, sin `any` salvo frontera externa justificada.
- Dominio puro separado de I/O.
- Validación en frontera con schema compartido.
- No duplicar fórmulas del motor en componentes.
- Todos los timestamps UTC en persistencia; localización solo en presentación.
- IDs UUID/opacos; nunca email/horarios en URL.
- PII cifrada server-side; service role solo en servidor.
- PostHog solo recibe propiedades aprobadas en `spec/analytics_events.json`.
- Sentry con redaction.
- UI y emails usan next-intl/catálogo, no strings críticas ad hoc.

## Pruebas obligatorias
Antes de declarar una tarea completa: lint + typecheck + tests relacionados. Antes de merge: 21/21 vectors. Antes de release: Playwright validation, Playwright stripe, Lighthouse y prueba real de email/PDF.

## Requisitos
No inventes requisitos. Consulta `docs/PRD.md`, `spec/` y `ux/`. Si existe un vacío no bloqueante, toma una decisión conservadora y regístrala en `DECISIONS.md` con fecha, contexto, decisión, alternativas, impacto y test asociado.

## Prohibiciones
- No usar LLM para cálculo.
- No claims diagnósticos/terapéuticos.
- No copiar el instrumento MCTQ.
- No logging de PII, payloads de horarios o secretos.
- No desactivar RLS para “hacer que funcione”.
- No activar Stripe en validation.
- No cambiar expected outputs para hacer pasar tests salvo que exista una decisión explícita de producto/modelo y se revalide el motor de referencia.

## Definition of Done
La fuente es `docs/PRD.md` §28 y `docs/ACCEPTANCE_TESTS.md`. Registra decisiones en `DECISIONS.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
