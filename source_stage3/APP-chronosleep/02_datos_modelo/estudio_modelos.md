# ChronoSleep — Estudio de modelos

**Versión:** 2.0  
**Fecha:** 2026-10-04  
**Objetivo:** elegir un motor reproducible y auditable para calcular desfase de horario y simular un plan semanal sin depender de LLM ni API cerrada.

## Criterios

Se priorizó: (1) correspondencia directa con el target de social jetlag, (2) evidencia publicada, (3) licencia apta para uso comercial o fórmula pública implementable sin copiar instrumentos protegidos, (4) inputs ≤8 que el usuario conozca, (5) ejecución local de bajo costo y (6) explicabilidad.

## Matriz comparativa

| Candidato | Tipo | Precisión/evidencia reportada | Licencia comercial | Costo/consulta | Latencia | Explicabilidad | Dependencia externa | Veredicto |
|---|---|---|---|---|---|---|---|---|
| MCTQ-derived MSW/MSF + SJL circular + MSFsc | Fórmula publicada | MSFsc vs actigrafía r=0,73; límites 95% aprox. -1h37 a +2h15 en Santisteban 2018. La fórmula SJL es diferencia de mid-sleep. | Implementación `mctq` MIT; no se copia el cuestionario MCTQ | 0 por cálculo | Local; despreciable frente a UI | Muy alta | Ninguna | **PRINCIPAL** |
| Jankowski sleep-corrected SJL | Fórmula publicada | Propuesta metodológica para separar efecto de deuda; no hay una métrica única de “accuracy” que demuestre superioridad universal | Fórmula implementable; funciones disponibles en `mctq` MIT | 0 | Local | Alta | Ninguna | **RESPALDO / sensibilidad**, no cifra principal |
| NHANES 2017–2020 distribución SJL | Tabla oficial/estudio poblacional | Media 1,10 h; 46,5% ≥1 h; 19,3% ≥2 h (n=9.004 ponderado nacional) | Artículo JAMA CC-BY | 0 | Local | Muy alta | Ninguna tras cargar tabla | Contexto poblacional, no predictor individual |
| Sleep Regularity Index (SRI) | Fórmula estadística | Métrica reproducible de similitud sueño-vigilia 24 h; usada a gran escala, pero requiere varios días de datos binarios | Implementaciones abiertas; licencia de repositorio revisada, pero no necesaria para MVP | 0 | Local | Alta | Diario/wearable | V2; demasiada fricción para MVP |
| Forger/Jewett/Hannay en `circadian` | Modelo dinámico ODE open source | Modelos de fase circadiana ampliamente usados; la librería calcula DLMO/CBTmin, pero exige serie de luz y condiciones iniciales | Apache-2.0 (`Arcascope/circadian`) | 0 | Local, más costoso que fórmula | Media | Lux/time-series | Descartado para MVP por inputs y riesgo de falsa precisión |
| ML sobre dataset BIDSleep PhysioNet | ML entrenable con datos abiertos | Dataset multinoches con IHR/acelerometría + etiquetas EEG; no existe accuracy de SJL sin entrenar un modelo específico | ODC-By; licencia permite explícitamente uso comercial | Entrenamiento + inferencia local | Local | Media-baja | Sensor/acelerómetro | V2 experimental; no responde al target con 8 inputs |
| Oura API | API cerrada/wearable | Métricas de sueño propietarias; no hay cálculo SJL reproducible solo con los 8 inputs | Términos propietarios/API; dependencia contractual | No se usa en MVP | Red dependiente | Baja-media | Oura + cuenta + consentimiento | Descartado como motor; posible fuente auxiliar V2 |

## Elección

### Principal: SJL circular basado en MSW/MSF + MSFsc como proxy secundario

La cifra principal será:

`SJL = |shortest_circular_interval(MSF - MSW)|`

La documentación de rOpenSci señala que la diferencia lineal falla al cruzar medianoche y recomienda el intervalo más corto para datos MCTQ. Esto evita el error clásico de interpretar 23:00→03:00 como 20 horas en lugar de 4.

MSFsc se calcula únicamente como proxy temporal de cronotipo y **no** se usa como la cifra principal de SJL. Si el usuario usa alarma en días libres, MSFsc se marca no disponible, siguiendo la regla documentada.

La evidencia de validación es suficiente para un producto de bienestar basado en horarios, pero no para inferir DLMO individual ni programar luz/melatonina. Un estudio comparando MCTQ con actigrafía encontró r=0,73 para MSFsc y límites de acuerdo individuales amplios; otro trabajo mostró correlación MSFsc–DLMO r=0,68, con variabilidad que desaconseja usar cuestionarios para temporizar tratamientos.

### Respaldo: SJL sleep-corrected de Jankowski

Se conserva como análisis de sensibilidad metodológica. Si QA o un futuro estudio prospectivo demuestra que el SJL bruto se sesga de forma sistemática por oversleep, se puede exponer `sjl_sc` como resultado secundario. No se sustituye el principal en v2 porque el objetivo del producto es describir la discrepancia real de horario vivida por el usuario.

## Planificador determinista

El plan semanal no pretende simular el oscilador circadiano. Solo mueve horarios, preserva las duraciones observadas y vuelve a calcular SJL. Primero usa la flexibilidad laboral que el usuario declaró; si no basta, desplaza el horario libre en sentido contrario con un tope de producto de 90 min. Ese tope está marcado **preliminar** y debe validarse en UX/piloto.

## Incertidumbre

No se publica un intervalo de confianza falso. El motor muestra un **escenario de sensibilidad** con ±15 min de incertidumbre de autorreporte por midpoint, lo que produce un rango de SJL de ±30 min en peor caso. Este parámetro es una hipótesis de producto y se marca preliminar.

## Fuentes clave

1. rOpenSci `mctq` — SJL: https://docs.ropensci.org/mctq/reference/sjl.html  
2. rOpenSci `mctq` — MSFsc: https://docs.ropensci.org/mctq/reference/msf_sc.html  
3. rOpenSci — aritmética circular: https://docs.ropensci.org/mctq/articles/sjl-computation.html  
4. Licencia MIT `mctq`: https://docs.ropensci.org/mctq/LICENSE.html  
5. Santisteban et al. 2018, actigrafía: https://pmc.ncbi.nlm.nih.gov/articles/PMC5971234/  
6. DLMO vs MSFsc: https://pubmed.ncbi.nlm.nih.gov/26243627/  
7. NHANES/JAMA social jetlag: https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2798209  
8. Arcascope `circadian` (Apache-2.0): https://github.com/Arcascope/circadian  
9. PhysioNet BIDSleep, ODC-By: https://www.physionet.org/content/bidsleep-dataset/1.0.1/LICENSE.txt  
10. Oura API agreement: https://cloud.ouraring.com/legal/api-agreement


## Monetización y frontera gratis/pago

La vista previa gratuita entrega la cifra principal de social jetlag, un gráfico de los dos midpoints y un insight descriptivo. **No** entrega el plan de 7 días, escenarios de flexibilidad, sensibilidad por error de autorreporte, MSFsc, comparación con SJLsc, referencia poblacional detallada ni metodología completa: esos elementos convierten una medición aislada en una decisión accionable y constituyen el motivo de compra.

La Fase 1 no cobra: solicita email y consentimientos separados para entregar el informe completo y, si el usuario lo autoriza específicamente, enviar copia al dueño. El checkout se activa solo tras cumplir los umbrales definidos en `monetizacion.json`. La Fase 2 usa US$7,90 como ancla y PPP 2025 del Banco Mundial para localizar precios, con redondeo comercial; los precios finales siguen marcados preliminares hasta test de elasticidad. En EE. UU., usando la tarifa pública consultada de Stripe (2,9% + US$0,30) y una provisión preliminar de US$0,10 para cómputo/email/PDF, el margen de contribución estimado antes de adquisición pagada es ~92%.
