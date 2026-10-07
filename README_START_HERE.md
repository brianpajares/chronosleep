# README_START_HERE — ChronoSleep BUILD v4
Estado: **READY_TO_BUILD**. Este paquete está diseñado para abrirse en un repositorio vacío y entregarse a Codex, Claude Code, Google Antigravity u otro LLM programador.

## Orden de lectura
1. `BUILD_PROMPT.md` — prompt maestro.
2. `docs/PRD.md` — producto, arquitectura y Definition of Done.
3. `spec/inputs.schema.json`, `spec/model_spec.json`, `spec/outputs_spec.json`, `spec/test_vectors.json`.
4. `spec/openapi.yaml` y `spec/db_schema.sql`.
5. `ux/ux_spec.md`, `ux/sitemap_flows.md`, `ux/components.md`, `ux/report_layout.md`.
6. `TASKS.md` + `docs/ACCEPTANCE_TESTS.md`.
7. `docs/DRIVE_SETUP.md`, `.env.example`, `docs/LAUNCH_CHECKLIST.md`.
8. `DECISIONS.md` antes de registrar decisiones nuevas.

## Qué contiene
- PRD en Markdown y DOCX.
- Motor de referencia Python y verificación independiente.
- Contratos JSON, OpenAPI y SQL/RLS.
- UX/UI, prototipo, design tokens e i18n.
- Bundle `drive/` listo para Google Drive.
- Plan de tests, CI, despliegue, seguridad, legal y tracción.
- `source_stage3/` preserva íntegro el paquete recibido.

## Regla de precedencia
1. `handoff.json` y `docs/PRD.md`.
2. Archivos estructurados de `spec/`.
3. `ux/`.
4. `model/`.
5. Documentos históricos en `source_stage3/`.

No inventes requisitos para resolver contradicciones: elige la interpretación que preserve contratos estructurados, registra la decisión en `DECISIONS.md` y agrega test.

## Gate de lanzamiento
Se puede construir y desplegar preview. **No publicar producción ni paid acquisition** hasta resolver clearance del nombre/dominio, textos legales, deliverability y requisitos regulatorios aplicables por mercado.
