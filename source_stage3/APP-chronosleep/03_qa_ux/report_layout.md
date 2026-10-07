# ChronoSleep — Layout del informe PDF

Formato recomendado: A4/Letter adaptable, 8–10 páginas, tipografía del sistema, fondo blanco, ID opaco y versión del modelo en footer. El PDF debe ser equivalente semánticamente al informe web y no depender del color para entender resultados.

## Página 1 — Portada y resultado
- Marca + tagline localizado.
- “Tu desfase de horarios” con valor principal en h/min.
- Frase direccional: días libres más tarde/temprano o prácticamente alineados.
- Mini timeline work/free.
- Fecha de generación, versión `chronosleep-sjl-2.0` e ID de verificación.
- Disclaimer breve: “Información educativa de bienestar; no es diagnóstico médico.”

## Página 2 — Qué significa tu resultado
- Mid-sleep días con obligaciones y días libres.
- Explicación en 3–4 frases de social jetlag.
- Banda descriptiva NHANES claramente rotulada “Referencia poblacional de EE. UU.; no umbral diagnóstico”.
- Fuente al pie.

## Página 3 — Tu semana actual
- Tabla: tipo de día, hora de acostarse, inicio estimado de sueño, despertar, duración, punto medio.
- Promedio semanal de duración.
- Warnings educativos, por ejemplo duración media <7 h, sin prescribir tratamiento.

## Página 4 — Plan simulado de 7 días
- Tabla por día: acostarse, dormir aprox., despertar, cambio vs actual.
- Nota: “Simulación de calendario bajo adherencia; conserva la duración de sueño observada y no predice adaptación fisiológica.”
- Visual timeline por día opcional.

## Página 5 — Escenarios
- Base, flexibilidad actual y `+30 min` con tope de 120 min.
- Barras horizontales con misma escala.
- Si el escenario no mejora, decirlo explícitamente; no ocultar resultado desfavorable.

## Página 6 — Sensibilidad
- Resultado central y rango por ±15 min en autorreporte de horarios.
- Texto obligatorio: “Este rango muestra sensibilidad de cálculo; no es un intervalo de confianza ni una predicción de incertidumbre biológica.”
- Si `free_day_alarm=true`, explicar por qué MSFsc no se presenta.

## Página 7 — Supuestos y límites
Tabla con:
- latencia declarada;
- días de obligación;
- alarma en día libre;
- flexibilidad;
- `planner_max_free_shift_min=90` como supuesto de producto;
- `input_time_uncertainty_min=15` como supuesto de sensibilidad;
- rango de validez 3–14 h por episodio;
- exclusiones: turnos rotativos/nocturnos, sueño dividido, cambio de huso, patrones muy irregulares.

## Página 8 — Metodología y fuentes
- Fórmula/definición SJL.
- Aritmética circular.
- MSFsc y SJLsc como secundarios.
- Fuentes principales: rOpenSci MCTQ, JAMA/NHANES, CDC.
- Nota legal: ChronoSleep usa preguntas propias; el cuestionario MCTQ oficial requiere permiso según TheWeP.

## Página 9 — Privacidad y aviso de salud
- Qué datos se usaron en el informe.
- Política/URL de privacidad.
- “No sustituye evaluación, diagnóstico ni tratamiento profesional.”
- “Si tus horarios, somnolencia o síntomas afectan tu seguridad o bienestar, consulta a un profesional de salud.”

## Página 10 — Verificación
- ID de verificación opaco, p. ej. `CS-7F4K-2M9Q`.
- Hash/identificador del payload del informe si el backend lo implementa, sin incluir email.
- Versión del modelo, versión del reporte, timestamp y locale.
- QR solo si apunta a una URL autenticada/expirable; nunca debe codificar inputs personales.

## Reglas de exportación

- Texto seleccionable y etiquetas accesibles cuando el generador PDF lo soporte.
- Gráficos con caption y alternativa textual.
- No incrustar email en metadata del PDF salvo requisito explícito y justificado.
- Números humanos redondeados a minuto; metodología puede mostrar horas decimales con máximo 3 decimales.
- Moneda solo aparece si el informe incluye recibo/oferta; usar locale y código ISO.
- Footer en todas las páginas: “ChronoSleep · modelo chronosleep-sjl-2.0 · ID {id} · página X/Y”.
