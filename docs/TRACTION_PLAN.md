# TRACTION_PLAN — Primeros 14 días
Objetivo: validar activación y demanda del informe antes de activar cobro.

## Metas
- Visita→inicio >=35%.
- Inicio→preview >=70%.
- Preview→email >=30%.
- Mediana inicio→preview <=90 s.
- >=50 solicitudes de informe en 14 días es señal fuerte adicional.
- Capturar señal de pago >=8% entre solicitantes mediante fake-door/encuesta de intención o checkout test controlado; no cobrar en modo validation.
- 0 claims médicos y 0 incidentes de privacidad.

## Días 1–2: instrumentación y baseline
Publicar a tráfico controlado. Verificar eventos, tasas de error, emails y PDF. Conseguir primeras 10–20 sesiones cualitativas de conocidos/comunidad permitida sin usar datos reales en demos públicas.

## Días 3–5: SEO y comunidades
Publicar/optimizar tres piezas: “social jetlag calculator”, “sleep schedule gap” y equivalente PT/ES. Participar en comunidades donde el problema ya se discute, respondiendo primero con valor y compartiendo la herramienta solo cuando las reglas lo permiten. No promocionar en comunidades clínicas.

## Días 6–9: creadores y outreach
Contactar microcreadores de productividad, quantified-self y bienestar laboral con un mensaje breve: “Calcula en 2 min cuánto cambia tu horario entre semana y días libres; sin wearable; metodología visible.” Objetivo: 10 contactos/día, no spam masivo.

## Días 10–12: iteración
Revisar drop-off por paso, errores de validación y copy del CTA. Cambiar solo una variable por experimento. Prioridad: mejorar inicio→preview sin reducir comprensión/consentimiento.

## Días 13–14: decisión
**Activar experimento de cobro** si se cumple: 2 semanas o >=200 previews, preview→email >=30%, señal de pago >=8%, inicio→preview >=70% y sin regresión de privacidad/QA. >=50 solicitudes en 14 días refuerza la decisión. Si preview→email <20%, revisar propuesta/teaser antes de precio. Si inicio→preview <60%, arreglar funnel antes de monetizar.

## Mensajes base
- ES: “¿Tu horario cambia el fin de semana? Mide tu desfase en menos de 2 minutos y explora una semana más alineada con tu agenda.”
- EN: “Does your sleep schedule shift on weekends? Measure the gap in under 2 minutes and explore a schedule that fits your constraints.”
- PT: “Seu horário de sono muda no fim de semana? Meça o descompasso em menos de 2 minutos e explore uma semana compatível com sua rotina.”

## Reporte diario
PostHog: visitas, starts, previews, emails, tiempo a preview, errores por campo. Operación: fallos de cálculo/entrega, costo por informe, tickets. No exportar PII a dashboards.
