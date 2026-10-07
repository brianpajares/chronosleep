# ChronoSleep — Informe de QA de Etapa 3

**Fecha:** 2026-10-04  
**Paquete auditado:** `APP-chronosleep_v2_etapa2.zip`  
**Versión de salida:** 3.0  
**Veredicto:** **PASS_WITH_FIXES**  
**Bloqueadores críticos abiertos:** 0  
**Criterio numérico:** tolerancia relativa y absoluta `1e-6` salvo outputs de texto/booleanos, que deben coincidir exactamente.

## 1. Resumen ejecutivo

El paquete de Etapa 2 es técnicamente apto para avanzar a PRD después de las correcciones aplicadas en esta etapa. La reimplementación independiente reproduce el comportamiento esperado y, tras alinear el contrato de flexibilidad y endurecer las validaciones, coincide con el motor de referencia en los **21/21 vectores**. No fue necesario rediseñar el modelo.

Los hallazgos más relevantes fueron: (1) contradicción entre `wake_flexibility_min` en schema/model_spec y dos casos oficiales que usaban 45 min; (2) validación permisiva en el motor de referencia que truncaba decimales mediante `int()`; (3) brief con promesas/outputs y precios rezagados respecto de la Etapa 2; y (4) licencia de `Arcascope/circadian` mal catalogada como Apache-2.0 cuando el repositorio actual declara MIT. Todo ello fue corregido. Queda como **gate de lanzamiento**, no de arquitectura, demostrar titularidad/clearance del nombre ChronoSleep y del dominio asociado.

## 2. Control de entrada

- `handoff.json` al ingreso: `stage_completed = 2`.
- Los archivos esperados estaban presentes: `brief.json`, `model_spec.json`, `engine_reference.py`, `test_vectors.json`, `inputs.schema.json`, `outputs_spec.json`, `monetizacion.json`, `model_card.md`, `fuentes_datos.csv` y el Excel base.
- El inventario inicial coincidió con `drive_manifest.json` para los artefactos declarados.
- El Excel contiene las hojas: `LEEME`, `Diccionario`, `Parametros`, `Tablas_Referencia_SJL`, `Tablas_PPP`, `Fuentes`, `Changelog`, `Motor`, `Casos_Prueba`.
- Se revisaron encabezados, celdas críticas y fórmulas: no quedaron errores `#REF!`, `#DIV/0!`, `#VALUE!`, `#N/A` ni `#NAME?`.

## 3. A1 — Doble verificación independiente

### Procedimiento

`03_qa_ux/qa_engine.py` se implementó usando únicamente `model_spec.json` y `base_chronosleep.xlsx`. **No se inspeccionó `engine_reference.py` hasta tener resultados independientes**. Después se compararon:

1. QA independiente vs outputs esperados.
2. Motor de referencia vs outputs esperados.
3. QA independiente vs motor de referencia.

### Resultado

| Comparación | Resultado |
|---|---:|
| QA independiente vs esperado | **21/21** |
| Referencia vs esperado | **21/21** |
| QA vs referencia | **21/21** |
| Tolerancia numérica | `1e-6` |
| Diferencias pendientes | **0** |

### Hallazgo MAYOR: contrato de flexibilidad

`TV08` y `TV09` usaban `wake_flexibility_min = 45`, mientras `model_spec.json` e `inputs.schema.json` enumeraban únicamente `0/30/60/90/120`. El motor de referencia, en cambio, aceptaba cualquier entero de 0 a 120 y el brief describía valores intermedios. La interpretación más coherente era que la enumeración del contrato estaba demasiado restringida.

**Corrección:** `model_spec.json`, `inputs.schema.json`, el diccionario del Excel y sus copias de Drive ahora declaran **entero 0–120 min**.

## 4. A2 — Robustez

Se verificaron horas inválidas, bordes, fuera de rango, ceros, NaN/infinito, decimales en campos enteros, booleanos en campos numéricos, duraciones de sueño extremas, aritmética circular y monotonicidad.

| Caso | Resultado |
|---|---|
| `24:00` | Rechazado por ambos motores |
| Latencia `<0` o `>120` | Rechazada |
| Latencia decimal / NaN / infinito | Rechazada |
| Días laborales `0`, `7`, decimal o booleano | Rechazados |
| Flexibilidad `<0`, `>120`, decimal, NaN o infinito | Rechazada |
| Duración implícita `<3 h` o `>14 h` | Rechazada |
| Límite exacto 3 h | Válido (`TV18`) |
| Límite exacto 14 h | Válido (`TV19`) |
| Distancia circular exacta 12 h | Determinista (`TV17`) |
| Monotonicidad 0→120 min de flexibilidad | SJL planificado 2.5→0.5 h (`TV20`→`TV21`) |
| Métrico vs imperial | No aplica: solo HH:MM, minutos, días/semana y booleanos |

**Hallazgo MAYOR corregido:** el motor de referencia convertía campos enteros con `int()`, por lo que, por ejemplo, `5.9` días podía convertirse silenciosamente en `5`. Ahora exige números finitos e integrales y rechaza `bool`.

Los cinco vectores nuevos `TV17–TV21` quedaron incorporados tanto al JSON como al Excel.

## 5. A3 — Fuentes y licencias

Se verificaron 17 elementos críticos. Los valores y licencias se usan solo en el alcance que permite la evidencia; las referencias poblacionales no se presentan como diagnóstico individual.

| ID | Parámetro / fuente | Estado | Evidencia / licencia |
|---|---|---|---|
| SRC01 | Definición SJL e intervalo circular | verificado | rOpenSci `mctq`; MIT |
| SRC02 | MSFsc | verificado | rOpenSci `mctq`; MIT |
| SRC03 | SJLsc Jankowski | verificado | rOpenSci `mctq`; MIT |
| SRC04 | NHANES media SJL = 1.10 h | verificado | JAMA Network Open; CC BY |
| SRC05 | NHANES ≥1 h = 46.5% | verificado | JAMA Network Open; CC BY |
| SRC06 | NHANES ≥2 h = 19.3% | verificado | JAMA Network Open; CC BY |
| SRC07 | Adultos 18–60: ≥7 h | verificado | CDC |
| SRC08 | MSFsc vs actigrafía r=0.73 | verificado | artículo abierto; CC BY |
| SRC09 | Proxy vs DLMO r≈0.68 en evidencia citada | verificado | PubMed/artículo fuente |
| SRC10 | PPP México 2025 = 11.31 aprox. | verificado | World Bank; CC BY 4.0 |
| SRC11 | PPP España 2025 = 0.61 aprox. | verificado | World Bank; CC BY 4.0 |
| SRC12 | PPP BR/GB/CA/AU 2025 | verificado | World Bank; CC BY 4.0 |
| SRC13 | Stripe US 2.9% + US$0.30 | verificado | pricing estándar consultado |
| SRC14 | Arcascope/circadian | **corregido** | repositorio actual: **MIT** |
| SRC15 | PhysioNet BIDSleep | verificado | ODC-By |
| SRC16 | Oura API | verificado | términos propietarios/restrictivos; revisar antes de integrar |
| SRC17 | MCTQ oficial | verificado | TheWeP pide solicitar permiso para usar el cuestionario |

URLs completas y estados están en `qa_checks.json` y `fuentes_datos.csv`.

### Implicación legal de MCTQ

ChronoSleep **no copia el cuestionario oficial**. Usa preguntas originales de horarios y fórmulas públicas. Si en el futuro se incorpora el instrumento MCTQ como tal, se debe solicitar la autorización correspondiente según The Worldwide Experimental Platform.

## 6. A4 — Coherencia de producto

### Promesa ↔ modelo

El modelo no predice adaptación fisiológica ni DLMO. Calcula el desfase de horarios observado y **simula** un plan semanal bajo adherencia. Se corrigió el brief para eliminar rastros de “Alignment Score 0–100” y lenguaje de predicción biológica no respaldado.

### Inputs ↔ UX

Los ocho inputs son comprensibles sin wearable: cuatro horarios, latencia, días laborales, alarma en día libre y flexibilidad. La UX añade ejemplos, defaults y unidades visibles.

### Gratis ↔ pago

La vista previa gratuita entrega valor real —SJL actual, lectura simple y una explicación— pero el informe completo conserva el plan de 7 días, escenarios de flexibilidad, sensibilidad, supuestos, metodología y exportación. No se detecta canibalización material del producto pagado.

### Pricing

Se alineó el brief con `monetizacion.json`: México **MX$89** y España **€4.90**. Todos los precios siguen marcados como **preliminares hasta test de elasticidad**.

## 7. A5 — Legal, ética y privacidad

- **Salud:** producto de wellness/planificación educativa para adultos 18+. No diagnostica, trata ni recomienda melatonina, fármacos o suplementos.
- **Seguridad:** el informe indica consultar a un profesional si el sueño o la somnolencia afectan bienestar o seguridad.
- **Datos personales:** no pedir nombre legal, fecha de nacimiento, sexo, edad exacta ni datos clínicos. El email solo se solicita al pedir el informe.
- **Copia al propietario:** consentimiento específico, separado y **desactivado por defecto**.
- **Sesgo:** las bandas NHANES son una referencia descriptiva de EE. UU.; no se convierten en “riesgo personal”, ni en ranking por país, sexo o edad.
- **Marketing:** prohibido “corrige tu ritmo circadiano”, “predice tu reloj biológico” o “reduce X% tu riesgo”. Permitido: “cuantifica tu desfase de horarios” y “simula una semana con distintos grados de flexibilidad”.
- **Marca:** falta prueba de titularidad/clearance de ChronoSleep/chronosleep.app. Es un **gate antes de publicación**, no un motivo para devolver el paquete a Agente 2.

## 8. Cambios aplicados

1. Alineación de `wake_flexibility_min` a entero 0–120 en contrato, schema, Excel y copias.
2. Validación estricta de enteros/finitud en `engine_reference.py`.
3. `qa_engine.py` independiente, alineado después de completar la comparación.
4. Cinco casos nuevos `TV17–TV21`.
5. Corrección de licencia Arcascope/circadian a MIT.
6. Registro de la necesidad de permiso si se usa el cuestionario MCTQ oficial.
7. Brief JSON/MD alineado con simulación determinista, outputs reales y pricing vigente.
8. `outputs_spec.json` actualizado para escenario `+30 min`, tope 120.
9. Excel actualizado: versión, diccionario, fuentes, casos y Changelog.
10. `model_card.md` reforzado con la salvaguarda de permiso MCTQ.
11. Especificación UX/UI, sistema de diseño, copy i18n, analítica y prototipo navegable añadidos en `03_qa_ux/`.

## 9. Veredicto y open issues

**PASS_WITH_FIXES.** No quedan discrepancias de cálculo conocidas en el contrato probado y no hace falta rediseño del modelo. El Agente 4 puede convertir este paquete en PRD.

Open issues que deben conservarse como gates o supuestos:
- Clearance legal de marca/dominio antes de go-live.
- `input_time_uncertainty_min = 15` y `planner_max_free_shift_min = 90` siguen siendo supuestos de producto, no constantes científicas.
- Validar elasticidad de precios antes de tratarlos como óptimos.
- Validar en piloto las tasas de conversión y el tiempo real a preview.
- Cualquier integración futura con Oura u otro proveedor requiere revisión de términos vigente.
