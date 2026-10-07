# ChronoSleep — Cómo funciona / How it works / Como funciona

**Versión del modelo:** chronosleep-sjl-2.0  
**Última actualización:** 2026-10-04  
**Uso previsto:** bienestar y planificación educativa para adultos 18+ con horarios relativamente estables.

## Qué calcula

ChronoSleep compara el punto medio de tu sueño en días con obligaciones con el punto medio de tu sueño en días libres. La diferencia circular entre ambos se llama **social jetlag**. Si un horario cruza medianoche, el motor usa aritmética circular para no confundir, por ejemplo, 23:30 con 00:30.

La vista previa muestra esa diferencia en horas y minutos. El informe completo simula un horario de siete días que intenta reducirla respetando la flexibilidad que declaraste y **sin acortar ni alargar automáticamente tu duración de sueño observada**.

## De dónde salen las fórmulas y los datos

El cálculo de mid-sleep, social jetlag y MSFsc sigue la metodología publicada alrededor del Munich ChronoType Questionnaire (MCTQ). Para evitar errores de reloj, la implementación usa el intervalo circular más corto, como recomienda el paquete abierto `mctq` de rOpenSci (licencia MIT). No copiamos el cuestionario MCTQ: ChronoSleep usa preguntas propias de horarios. La página oficial de The Worldwide Experimental Platform indica que el uso del cuestionario MCTQ requiere solicitar permiso; por tanto, cualquier futura incorporación del instrumento oficial queda condicionada a autorización expresa.

Fuentes principales:
- https://docs.ropensci.org/mctq/reference/sjl.html
- https://docs.ropensci.org/mctq/reference/msf_sc.html
- https://docs.ropensci.org/mctq/articles/sjl-computation.html
- https://pmc.ncbi.nlm.nih.gov/articles/PMC5971234/
- https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2798209

Para la comparación poblacional se usa NHANES 2017–2020 de EE. UU.: el estudio reportó una media de 1,10 h de social jetlag; 46,5% tenía al menos 1 h y 19,3% al menos 2 h. Esos cortes son **referencias descriptivas**, no diagnósticos.

## Qué tan confiable es

La fórmula es determinista: con los mismos inputs devuelve el mismo resultado. En un estudio de 115 adultos jóvenes, el MSFsc del MCTQ y el derivado de actigrafía mostraron una correlación de **r=0,73**; aun así, los límites de acuerdo individuales fueron amplios. Por eso ChronoSleep no usa MSFsc para afirmar tu fase circadiana exacta ni para programar tratamientos.

El informe también muestra un escenario de sensibilidad por error de autorreporte. Ese rango **no es un intervalo de confianza estadístico**.

## Límites importantes

- No está diseñado para turnos nocturnos/rotativos, sueño dividido, viajes con cambio de huso o patrones muy irregulares.
- MSFsc no se calcula si usas alarma en días libres.
- El plan supone que puedes seguir el horario desde el primer día; no predice cuánto tardará tu organismo en adaptarse.
- La app no estima DLMO, no diagnostica insomnio, apnea ni trastornos circadianos, y no recomienda melatonina, fármacos o suplementos.
- Si tus horarios, somnolencia o síntomas te preocupan o afectan seguridad, consulta a un profesional de salud.

## English summary

ChronoSleep estimates schedule-based social jetlag from work/study-day and free-day sleep timing. It is deterministic, auditable, and non-diagnostic. The 7-day plan is a calendar simulation under adherence, not a physiological circadian-phase forecast.

## Resumo em português

O ChronoSleep estima o jet lag social baseado nos horários de sono em dias de obrigação e dias livres. O cálculo é determinístico e auditável. O plano de 7 dias é uma simulação de calendário sob adesão, não uma previsão fisiológica da fase circadiana.
