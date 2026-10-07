# ChronoSleep — Especificación UX/UI de Etapa 3

## 1. Posicionamiento y voz

### Promesa

**Cuantifica en menos de 90 segundos la diferencia entre tu horario de sueño en días con obligaciones y días libres, y explora un plan semanal que respeta la flexibilidad que tú declares.**

La promesa evita afirmar que la app mide la fase circadiana real, “corrige” el reloj biológico o predice adaptación fisiológica.

### Nombre y tagline

| Idioma | Nombre | Tagline |
|---|---|---|
| ES | ChronoSleep | **Entiende tu desfase. Alinea tu semana.** |
| EN | ChronoSleep | **See your schedule gap. Align your week.** |
| PT | ChronoSleep | **Entenda seu descompasso. Alinhe sua semana.** |

> Gate de lanzamiento: el nombre se conserva por continuidad, pero la titularidad/clearance de marca y dominio debe resolverse antes de publicar.

### Tono

Calmo, preciso, no clínico, concreto y útil. Explica límites sin alarmismo. Usa horas/minutos antes que scores abstractos. Evita lenguaje culpabilizador (“mal sueño”, “fracaso”) y afirmaciones médicas.

### Tres mensajes clave

1. **Una cifra comprensible:** diferencia entre el punto medio de sueño laboral y libre, en horas y minutos.
2. **Un plan condicionado por tu realidad:** la simulación solo mueve horarios dentro de la flexibilidad declarada y conserva la duración observada.
3. **Transparencia:** muestra metodología, sensibilidad y límites; no requiere wearable ni datos clínicos.

## 2. Principios de experiencia

1. **Valor antes del gate.** El usuario ve su SJL y una explicación antes de pedir email/pago.
2. **Un trabajo mental por pantalla.** En 360 px se presenta un único input principal por paso; en desktop se conserva la misma secuencia para evitar bifurcar analítica.
3. **No inventar precisión.** Horas/minutos, bandas descriptivas y rango de sensibilidad; nunca probabilidad clínica.
4. **Una sola acción primaria.** Cada pantalla tiene un único CTA visualmente dominante.
5. **Privacidad por defecto.** No nombre, DOB, sexo, clínica ni wearable. Consentimientos separados; copia al propietario desactivada.
6. **Progreso reversible.** Barra de progreso, “Atrás” secundario y datos preservados localmente durante la sesión.
7. **Confianza visible.** Fuentes/metodología y disclaimer cerca del resultado, no enterrados solo en Legal.

## 3. Flujo de cálculo: ocho pasos

Objetivo de producto: mediana `landing → preview <= 90 s`.

| Paso | Input | UI recomendada | Default | Validación |
|---|---|---|---|---|
| 1/8 | Hora de acostarte en días con obligaciones | time input + acceso teclado | ninguno | HH:MM válido |
| 2/8 | Hora de despertarte en días con obligaciones | time input | ninguno | HH:MM válido |
| 3/8 | Hora de acostarte en días libres | time input | valor del paso 1 | HH:MM válido |
| 4/8 | Hora de despertarte en días libres | time input | valor del paso 2 + 60 min, editable | HH:MM válido |
| 5/8 | Latencia de sueño | segmented presets 0/10/15/30 + “otro” | 15 min | entero 0–120 |
| 6/8 | Días con obligaciones/semana | stepper 1–6 | 5 | entero 1–6 |
| 7/8 | ¿Usas alarma en días libres? | Sí/No | No, sin preselección silenciosa para el consentimiento factual | booleano |
| 8/8 | Flexibilidad para mover horario laboral | slider + input numérico | 0 min | entero 0–120 |

### Validación temporal adicional

Al completar el paso 4, calcular duraciones implícitas usando latencia. Si alguna queda fuera de 3–14 h, bloquear avance con explicación específica: “Con estos horarios, el episodio calculado sería de X h. ChronoSleep solo calcula patrones entre 3 y 14 h. Revisa las horas o la latencia.”

## 4. Pantallas

### 4.1 Landing `/`

**Objetivo:** convertir visita en inicio de cálculo sin exagerar beneficios.

**Jerarquía:**
1. Eyebrow: “Calculadora de social jetlag”.
2. H1: “¿Cuánto cambia tu horario de sueño entre semana y días libres?”
3. Subhead: “Mídelo en <90 s y prueba una semana más alineada con tu agenda. Sin wearable.”
4. CTA único: “Calcular mi desfase”.
5. Microconfianza: “8 preguntas · no pedimos nombre · resultado inicial gratis”.
6. Mini visual: dos líneas de sueño y la distancia entre sus puntos medios.
7. Sección “Qué obtienes”: SJL actual / simulación / metodología.
8. Nota de salud: “Información educativa, no diagnóstico médico.”

**Estados:** carga instantánea; si JS no está disponible, CTA sigue como enlace a una ruta server-rendered.

**Eventos:** `landing_view`, `calculator_start`.

**Confianza:** “Basado en metodología MCTQ publicada; ChronoSleep usa preguntas propias y no copia el cuestionario oficial.”

### 4.2 Calculadora `/calcular/:step`

**Objetivo:** conseguir un input válido por pantalla.

**Componentes:** Progress, QuestionHeader, Input, helper text, CTA “Continuar”, back link.

**Estados:** vacío, válido, error inline, restaurado de sesión.

**Reglas:** CTA disabled solo antes de interacción; tras error mantiene foco en el control; Enter avanza si válido.

**Eventos:** `step_view`, `input_changed` con valores categorizados/no sensibles cuando sea posible, `step_complete`, `validation_error`, `calculator_back`.

**Trust:** no aparece paywall ni email durante los 8 pasos.

### 4.3 Procesando `/procesando`

**Objetivo:** explicar qué se calcula durante una espera perceptiva corta.

**Contenido:** “Estamos comparando los puntos medios de tus dos horarios y probando una semana dentro de tu flexibilidad.”

**Reglas:** si el cálculo local tarda <300 ms, mostrar al menos un cambio de estado accesible pero no retrasar artificialmente más de ~500 ms. `aria-live=polite`. Con `prefers-reduced-motion`, sin animación de barras.

**Error:** “No pudimos calcular con estos datos. Revisa tus horarios.” CTA: “Revisar respuestas.”

**Eventos:** `calculation_started`, `calculation_succeeded`, `calculation_failed`.

### 4.4 Vista previa `/resultado`

**Objetivo:** entregar valor, generar comprensión y curiosidad por el informe.

**Jerarquía:**
1. Resultado principal: “Tu desfase de horarios: **1 h 53 min**”.
2. Descriptor: “Tus días libres quedan más tarde que tus días con obligaciones.”
3. Gráfico recomendado: reloj/track horizontal de 24 h con `mid_sleep_work`, `mid_sleep_free` y distancia. No usar gauge de riesgo.
4. Rango de sensibilidad visible: “Con ±15 min de error en tus horas: aprox. 1 h 23 min–2 h 23 min.”
5. Referencia descriptiva: banda poblacional, etiquetada “EE. UU., NHANES 2017–2020”.
6. Teaser del informe: tres tarjetas parcialmente visibles:
   - “Plan de 7 días” (muestra día 1, bloquea días 2–7).
   - “Escenario con +30 min de flexibilidad” (muestra título y delta bloqueado).
   - “Supuestos y metodología” (lista 1/4 visible).
7. CTA único fase 1: “Recibir mi informe completo”.
8. Disclaimer y links “Cómo funciona” / “Privacidad”.

**No usar:** “Tu cronotipo es…”, “riesgo alto”, “tu reloj biológico está desalineado”.

**Eventos:** `preview_view`, `preview_report_cta`, `methodology_opened`.

### 4.5 Solicitar informe — Fase 1 `/informe/solicitar`

**Objetivo:** capturar email con beneficio explícito y consentimiento mínimo.

**Contenido:** “Te enviamos el plan completo, los escenarios y la metodología para que puedas revisarlos con calma.”

**Campos:** email; checkbox requerido “Acepto recibir este informe en este email”; checkbox opcional y desmarcado “Permito enviar una copia de mis horarios y resultados al equipo de ChronoSleep para mejorar el producto.”

**CTA único:** “Enviar mi informe”.

**Privacidad visible:** “No pedimos tu nombre. La copia para el equipo es opcional y está desactivada.”

**Eventos:** `report_gate_view`, `email_submitted`, `owner_copy_opt_in_changed`.

### 4.6 Pago — Fase 2 `/checkout`

Activar solo cuando `checkout_enabled=true`.

**Objetivo:** convertir demanda validada.

**Contenido:** resumen del informe, precio localizado y “pago único”. Mostrar moneda/código y precio final antes del CTA. No countdown, descuentos falsos ni dark patterns.

**CTA:** “Comprar informe por US$7.90” (o precio localizado).

**Estados:** ready, processing, payment_failed, success. Nunca registrar datos de tarjeta en analytics propios.

**Eventos:** `checkout_view`, `checkout_started`, `payment_succeeded`, `payment_failed`.

### 4.7 Éxito `/informe/listo`

**Objetivo:** confirmar entrega y reducir incertidumbre.

**Contenido:** “Tu informe está listo.” Acciones: CTA principal “Ver informe”; enlace secundario “Reenviar por email” si aplica.

**Eventos:** `report_ready_view`, `report_opened`.

### 4.8 Informe web `/informe/:id`

**Objetivo:** convertir el resultado en un plan entendible y exportable.

**Jerarquía:** resumen → plan 7d → escenarios → sensibilidad → supuestos → metodología → disclaimer → ID verificación.

**CTA principal:** “Descargar PDF” cuando la función exista. Exportación `.ics` puede ser secundaria dentro de acciones del informe, no CTA competidor en el hero.

**Eventos:** `report_view`, `report_pdf_download`, `calendar_export`.

### 4.9 Cómo funciona `/como-funciona`

**Objetivo:** explicar cálculo y límites.

Secciones: qué es SJL; cómo se calcula mid-sleep; aritmética circular; MSFsc; planner; sensibilidad; qué no calcula; fuentes. Incluye versión del modelo.

### 4.10 FAQ `/faq`

Temas mínimos: ¿es diagnóstico?, ¿necesito wearable?, ¿qué pasa si hago turnos?, ¿por qué pregunta por alarma?, ¿qué significa la referencia de EE. UU.?, ¿qué datos guardan?, ¿puedo borrar mi informe?

### 4.11 Legal `/legal/*`

Rutas separadas: privacidad, términos, disclaimer salud, cookies si existen. Lenguaje equivalente ES/EN/PT; país aplicable según despliegue jurídico definido posteriormente.

### 4.12 Admin `/admin`

No indexable, autenticado y separado del producto público. Mínimo viable: métricas agregadas del funnel, errores del motor, estado de entregas, versión de modelo. No exponer horarios individuales salvo necesidad operativa, acceso mínimo y auditoría.

## 5. Conversión

### Valor en <90 s

- No registro antes del resultado.
- Defaults solo donde son razonables y siempre editables.
- Teclado apropiado (`inputmode=numeric`/time picker).
- Progreso “Paso X de 8”.
- Persistencia de sesión para volver atrás sin perder datos.
- Procesamiento inmediato.

### Preview que crea curiosidad sin manipular

El usuario recibe su cifra principal completa. El contenido bloqueado enseña **estructura y una muestra real**, no blur total. El beneficio del gate se formula como “guardar y recibir plan + escenarios + metodología”, no “desbloquear la verdad”.

### Prueba social

No inventar testimonios, conteos ni logos. Hasta tener evidencia, usar prueba de proceso: “Método documentado”, “fuentes enlazadas”, “sin wearable”, “versión del modelo visible”. Cuando existan testimonios reales, registrar consentimiento y fecha.

## 6. Visualización

| Output | Visual | Regla |
|---|---|---|
| SJL actual | número grande + línea temporal de 24 h | siempre mostrar h/min |
| Dirección | texto + flecha discreta | nunca depender solo de color |
| Mid-sleep work/free | dos puntos etiquetados en timeline | HH:MM local |
| Sensibilidad | intervalo horizontal con punto central | etiquetar “sensibilidad”, no “IC” |
| Plan 7 días | tabla/timeline por día | conservar duración de sueño |
| Escenarios | barras horizontales de SJL planificado | misma escala, incluir base |
| Referencia poblacional | texto + marker en distribución simplificada | “descriptivo, EE. UU.” |
| Warnings | callout con icono + texto | no rojo salvo riesgo/invalidación |

**Incertidumbre:** el rango de ±15 min es una prueba de sensibilidad al autorreporte, no un intervalo estadístico; la etiqueta debe decirlo literalmente.

## 7. Accesibilidad WCAG 2.2 AA

- Contraste mínimo 4.5:1 para texto normal; tokens críticos verificados en `design_tokens.json`.
- Objetivos táctiles >=44×44 px.
- Navegación completa por teclado, orden DOM = orden visual.
- `:focus-visible` con anillo persistente; nunca quitar outline sin sustitución.
- Cada input tiene `<label>` visible; helper y error conectados con `aria-describedby`.
- Error incluye qué pasó y cómo corregirlo; no solo borde/color.
- Barra de progreso incluye texto “Paso X de 8”.
- `aria-live=polite` para procesamiento/resultado; `role=alert` para fallo bloqueante.
- Gráficos tienen resumen textual equivalente y etiquetas directas.
- Respeto a `prefers-reduced-motion`.
- No auto-focus que desplace al usuario de forma inesperada en móvil.
- Idioma de documento y cambios de idioma declarados.

## 8. Responsive

### 360 px
- Una columna.
- Un input principal por pantalla.
- CTA ancho completo y sticky solo si no oculta error/teclado.
- Timeline de resultado se simplifica a dos filas con etiquetas.

### 768 px
- Formulario sigue centrado a max 560 px.
- Preview puede usar resultado + mini gráfico en dos columnas solo si mantiene lectura.

### 1280 px
- Landing con hero 6/6 y visual contextual.
- Resultado max 1120 px; texto principal max 640 px.
- Informe max 860 px para legibilidad.

## 9. Rendimiento percibido

- HTML/CSS crítico <= primera carga; sin font externa obligatoria.
- Objetivo LCP <2.5 s, INP <200 ms y CLS <0.1 en p75 cuando exista telemetría.
- JS del calculador pequeño y determinista; cálculo puede ser local.
- Skeleton solo si hay espera real de red; para cálculo local usar estado textual breve.
- Prefetch del siguiente chunk tras interacción si la implementación usa routing por chunks.

## 10. Internacionalización

- Idiomas obligatorios: ES, EN, PT.
- Copy de interfaz en `copy_i18n.json`.
- Horas: aceptar selector local, guardar internamente minutos desde medianoche; mostrar 12/24 h según locale si producto lo decide, sin alterar cálculo.
- Precios: `Intl.NumberFormat` con moneda local; no concatenar símbolos manualmente.
- Decimales: usar locale; outputs humanos preferentemente “1 h 53 min”.
- Unidades: “min”, “h”, “días/semana” traducidas.
- No inferir país clínico por idioma. País solo sirve para moneda/SEO/legales cuando sea necesario.
- Rutas SEO pueden estar localizadas pero deben canonicalizarse.

## 11. Privacidad y retención

En fase 1, el cálculo puede ejecutarse localmente antes del gate. Si los inputs se envían al backend para generar informe, almacenar solo lo necesario, con ID aleatorio. Definir política de retención en PRD antes de producción. El consentimiento de “copia al propietario” no puede estar preactivado ni agruparse con el envío del informe.

## 12. Criterios de aceptación UX prioritarios

1. En 360 px ningún paso pide dos inputs principales.
2. Se puede llegar a preview sin email, cuenta ni pago.
3. Error de duración 3–14 h explica el valor calculado y cómo corregirlo.
4. Preview muestra SJL, dirección, sensibilidad y fuente poblacional si corresponde.
5. No aparece un score 0–100 ni promesa de “fase circadiana exacta”.
6. El gate de informe deja claro qué se recibe y por qué pide email.
7. Todos los consentimientos opcionales están OFF por defecto.
8. La interfaz es operable con teclado y lector de pantalla.
9. El idioma puede cambiarse sin perder inputs.
10. La versión del modelo es visible en “Cómo funciona” e informe.
