# Plan de respuesta a incidentes (ChronoSleep)

> BORRADOR — completar nombres y teléfonos reales y revisar con asesoría legal.

## Roles
| Rol | Persona | Qué hace |
|---|---|---|
| Responsable del incidente | [COMPLETAR titular] | Decide contención, comunica, firma el cierre |
| Técnico | [COMPLETAR] | Aísla, rota claves, analiza logs, restaura |
| Legal/privacidad | [COMPLETAR asesor] | Evalúa obligación de notificar |

## Pasos (en orden)
1. **Detectar y registrar** (hora, quién, qué se sabe). Fuentes: Sentry, Vercel Logs, `/api/health`, correo de usuarios.
2. **Contener (primeros 60 min):** pausar el despliegue o poner `MONETIZATION_MODE=validation`; revocar la clave comprometida; desactivar enlaces de informe (rotar `DATA_ENCRYPTION_KEY` NO descifra datos antiguos: úsalo solo con plan de migración); cerrar `/admin` quitando `ADMIN_EMAILS`.
3. **Rotar secretos expuestos:** Supabase service role, Resend, Stripe (clave y `whsec_`), Turnstile, Upstash, Google service account, `CRON_SECRET`. Actualizar en Vercel y **redesplegar** (las variables solo aplican a despliegues nuevos).
4. **Evaluar alcance:** qué tablas/registros/archivos (PDF en Storage privado), periodo, personas afectadas. Los datos sensibles están cifrados: confirmar si la clave de cifrado también se expuso.
5. **Notificar:** si hay riesgo para las personas, avisar a la Autoridad Nacional de Protección de Datos Personales (Perú) y a los afectados dentro de los plazos de la normativa aplicable [COMPLETAR plazo con abogado]; GDPR/LGPD si hay usuarios de UE/Brasil (72 h GDPR).
6. **Remediar y restaurar:** corregir causa raíz, test de regresión, restaurar desde backup de Supabase si procede.
7. **Post-mortem (≤ 5 días):** línea de tiempo, causa, qué falló en la detección, acciones con responsable y fecha. Guardar en `docs/incidents/`.

## Respaldos
Supabase: backups automáticos del plan (verificar frecuencia/retención del plan contratado) y **restore drill** antes del lanzamiento (checklist). PDFs: regenerables desde el cálculo mientras éste exista.
