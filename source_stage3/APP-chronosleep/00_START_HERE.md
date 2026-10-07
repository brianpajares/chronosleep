# START HERE — ChronoSleep

**App:** ChronoSleep  
**Slug:** chronosleep  
**Versión:** v3  
**Etapa completada:** 3 · QA y UX/UI  
**Estado:** QA_UX_READY · PASS_WITH_FIXES  
**Siguiente agente:** 4 · Arquitecto de PRD y Paquete

## Veredicto

El motor determinista de social jetlag quedó doblemente verificado: **21/21 vectores** coinciden entre outputs esperados, `03_qa_ux/qa_engine.py` independiente y `02_datos_modelo/engine_reference.py`, con tolerancia numérica `1e-6`. No se requiere rediseño del modelo.

## Correcciones principales de Etapa 3

- `wake_flexibility_min` quedó alineado a **entero 0–120 min** en model spec, schema, Excel y UX; los 45 min de TV08/TV09 dejan de contradecir el contrato.
- El motor de referencia ya no trunca silenciosamente decimales: rechaza tipos no integrales, booleanos, NaN, infinito y fuera de rango.
- Se añadieron `TV17–TV21`: empate circular 12 h, límites de 3 h/14 h y monotonicidad de flexibilidad.
- El brief quedó alineado con lo que el modelo realmente hace: **simulación de calendario bajo adherencia**, no score 0–100 ni predicción fisiológica.
- Pricing de brief alineado a monetización: MX$89 y €4.90; los precios siguen siendo hipótesis hasta test de elasticidad.
- Licencia de `Arcascope/circadian` corregida a MIT y salvaguarda legal MCTQ documentada.
- Excel, fuentes, Changelog, model card y duplicados de Drive actualizados.

## UX/UI entregada

`03_qa_ux/` contiene:
- `qa_report.md`
- `qa_checks.json`
- `qa_engine.py`
- `ux_spec.md`
- `sitemap_flows.md`
- `design_tokens.json`
- `components.md`
- `copy_i18n.json` (ES/EN/PT)
- `report_layout.md`
- `analytics_events.json`
- `prototype.html`

La experiencia entrega el valor principal antes del gate, usa 8 pasos con un input por pantalla móvil, muestra incertidumbre como sensibilidad —no como intervalo estadístico— y reserva para el informe el plan de 7 días, escenarios y metodología. El prototipo es autocontenido, sin dependencias externas, y parte del caso verificado TV01.

## Guardrails obligatorios para PRD

- Producto de bienestar educativo 18+, no diagnóstico ni tratamiento.
- No prometer DLMO, adaptación fisiológica ni “corrección del reloj biológico”.
- No copiar el cuestionario MCTQ oficial sin permiso.
- Consentimiento opcional de copia al equipo siempre **OFF** por defecto.
- Referencias NHANES se rotulan como descriptivas de EE. UU., no riesgo individual.
- No pedir nombre, DOB, sexo ni datos clínicos para el cálculo.
- No usar scores 0–100 ni semáforos “bajo/medio/alto” clínicos.
- Resolver clearance legal de ChronoSleep/chronosleep.app antes de go-live.

## Open issues para Agente 4 / implementación

- Mantener como supuestos preliminares `input_time_uncertainty_min=15` y `planner_max_free_shift_min=90`.
- Validar en piloto la precisión del autorreporte, utilidad del planner y tiempo real a preview.
- Revalidar precios, fees e impuestos antes de habilitar checkout.
- Definir retención/borrado de informes y base legal por mercado.
- Si se integra Oura/wearables, revisar de nuevo términos vigentes y consentimiento.
- Evolucionar a calendario real si el patrón consecutivo trabajo→libre resulta insuficiente.
- Clearance de marca/dominio antes de lanzamiento público.

## Siguiente paso

**Sube este ZIP al Agente 4 · Arquitecto de PRD y Paquete.**
