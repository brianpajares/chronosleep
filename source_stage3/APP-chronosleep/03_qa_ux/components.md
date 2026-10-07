# ChronoSleep — Componentes UI y reglas de visualización

Todos los componentes usan tokens de `design_tokens.json`, estados accesibles y copy desde `copy_i18n.json`.

## Button

**Variantes:** primary, secondary, text, danger (solo acciones destructivas en admin).  
**Tamaños:** 44 px mínimo; primary del funnel 48–52 px.  
**Estados:** default, hover, focus-visible, active, disabled, loading.  
**Reglas:** una sola acción `primary` por pantalla; loading conserva el ancho y anuncia estado con texto, no solo spinner.

## Progress

Barra + texto “Paso X de 8”. `aria-valuemin=1`, `aria-valuemax=8`, `aria-valuenow=X`. No usa porcentajes como única señal.

## TimeInput

Label visible, input nativo `type=time` cuando sea fiable y alternativa de texto/selector accesible. Almacena minutos desde medianoche. Permite 00:00–23:59; no acepta 24:00. Helper con ejemplo local. Error debajo, enlazado por `aria-describedby`.

## NumericInput

Para latencia/flexibilidad. `inputmode=numeric`, `step=1`, límites explícitos. Nunca trunca decimales; devuelve error.

## SegmentedControl

Útil para presets de latencia. Cada opción es botón/radio real con foco y selected state no dependiente solo del color. “Otro” abre NumericInput sin perder selección.

## Stepper

Días de obligación 1–6. Botones ± con target ≥44 px, valor editable por teclado y etiqueta “días por semana”.

## BooleanChoice

Dos radios Sí/No para alarma. No usar toggle ambiguo para una pregunta factual. Debe exigir selección consciente.

## SliderWithNumber

Flexibilidad 0–120 min. Slider y NumericInput sincronizados; el número es fuente de verdad. Marcas 0, 30, 60, 90, 120 solo como guía visual, **no** como enum del contrato.

## ResultHero

Incluye label, valor humano `h/min`, dirección textual y explicación de una línea. No usa score 0–100. Para `1.875 h`, mostrar `1 h 53 min` por redondeo al minuto.

## ScheduleTimeline24h

Eje de 24 h con dos tracks: obligación y libre. Marca inicio/fin de sueño y `mid-sleep`. Debe soportar intervalos que cruzan medianoche. En 360 px se apilan los tracks. Alternativa textual obligatoria.

## SensitivityRange

Barra horizontal con mínimo, central y máximo. Label fija: “Sensibilidad por ±15 min en tus horas”. Tooltip: “No es un intervalo de confianza estadístico.”

## ReferenceBand

Chip/texto descriptivo, nunca semáforo clínico. Ejemplo: “Referencia poblacional: ≥1 h (EE. UU., NHANES 2017–2020)”. Link “Ver fuente”.

## LockedReportCard

Muestra título, beneficio y 1 fragmento real. El resto se oculta con una capa legible “Incluido en el informe completo”; evitar blur total o scroll-trap. No bloquear el resultado principal.

## Paywall / ReportGate

Fase 1: email gate con beneficio claro; fase 2: precio localizado. Máximo un CTA. Lista de “incluye” de 3–5 elementos. No countdown ni falsa escasez.

## EmailField

`autocomplete=email`, validación sintáctica ligera, mensaje “Revisa el formato del email”. No comprobar existencia con mensajes que revelen cuentas. No pedir nombre.

## ConsentCheckbox

Texto específico y separado. El consentimiento opcional para copia al equipo siempre `false` por defecto. No combinar consentimiento del servicio con marketing.

## Toast

Solo para confirmaciones no bloqueantes, 4–6 s, no roba foco. Errores del formulario van inline. Para lector de pantalla `aria-live=polite`.

## ErrorSummary

Cuando hay múltiples errores (admin/informe), lista con links a campos. En calculadora de un input, basta error inline + foco.

## WarningCallout

Icono + título + texto + acción si existe. Variantes info/warning. “Menos de 7 h” se presenta como información educativa, no diagnóstico. Riesgo de seguridad exige texto explícito, no solo color.

## LanguageSwitcher

ES / EN / PT; conserva inputs y ruta equivalente. `aria-label` localizado. No usar banderas para idiomas.

## Price

Usa `Intl.NumberFormat(locale,{style:'currency',currency})`. Añade “pago único” si procede. Moneda/código visibles cuando un símbolo pueda ser ambiguo.

## ReportTable

Tabla de plan 7 días: Día, acostarse, dormir aprox., despertar, cambio vs actual. En móvil cada fila puede convertirse en card, pero mantiene encabezados accesibles.

## SourceDisclosure

Componente expandible con nombre de fuente, año, propósito y URL. Debe distinguir: fórmula/metodología, referencia poblacional, precio. No mezclar “fuente científica” con tracking.

## VerificationId

ID opaco en informe/PDF más versión de modelo y timestamp. No contiene email ni inputs. Ejemplo visual: `CS-7F4K-2M9Q`.

# Reglas de gráficos

1. **Comparar horarios:** timeline/reloj lineal de 24 h, no pie chart.
2. **Comparar escenarios:** barras horizontales con cero común y etiqueta directa.
3. **Plan de 7 días:** timeline por día o tabla; no línea suavizada que implique medición continua.
4. **Sensibilidad:** intervalo con punto central; no banda probabilística.
5. **Referencia poblacional:** marker sobre bandas descriptivas; no “riesgo bajo/alto”.
6. **Color:** redundante con posición/texto. Trabajo/libre usan label + patrón/marker además de tono.
7. **Escala:** siempre visible; no truncar barras para exagerar diferencias.
8. **Precisión:** cálculo puede guardar decimales, UI redondea a minuto o 0.1 h según contexto; no mostrar más de dos decimales.
9. **Cruce de medianoche:** visual debe envolver o dividir la barra, nunca representar duración negativa.
10. **Incertidumbre:** siempre acompañada de la frase “sensibilidad al autorreporte; no intervalo de confianza”.
