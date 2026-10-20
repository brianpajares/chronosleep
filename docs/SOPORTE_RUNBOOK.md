# Runbook de soporte (dueño)

Cada informe tiene un **ID de verificación** `CS-XXXX-XXXX` (en emails, PDF y enlaces de soporte). Búscalo en `/admin` o en tu bandeja.

| Asunto / síntoma | Qué significa | Qué hacer |
|---|---|---|
| `[ChronoSleep] Solicitud de informe <id>` | Nuevo lead (PDF adjunto) | Revisar y **Aprobar y enviar** en `/admin` |
| El usuario dice "no me llegó el informe" | Entrega fallida o spam | `/admin` → **Reenviar** (rota el enlace; el anterior deja de funcionar). Pedir revisar spam/promociones |
| Estado `failed` en `/admin` | Falló el envío (ver categoría en logs: `email_not_configured`, `network`...) | Corregir Resend (clave/dominio verificado) → Reenviar. El cron diario reintenta hasta 3 veces |
| "Mi enlace venció" | Los enlaces duran 30 días | Reenviar desde `/admin` |
| Pago hecho pero sin informe (modo `stripe`) | Webhook no entregó | Stripe Dashboard → Developers → Webhooks → reintentar evento. Si no: `/admin` → Aprobar/Reenviar manual |
| Solicitud de privacidad | Derechos ARCO/GDPR | `/admin` → privacidad: **verificar identidad por canal separado** → exportar (acceso/portabilidad) o **completar** (eliminación) |
| Reembolso | Garantía de 7 días | Reembolsar en Stripe; el estado pasa a `refunded` por webhook |

**Plantilla de respuesta:** "Hola, gracias por escribir. Con tu ID {ID} ya reenviamos tu informe a este correo; revisa también spam/promociones. Si no llega en 10 minutos, respóndenos y lo revisamos manualmente."

**Si nada funciona:** el PDF completo de cada solicitud llega a `OWNER_EMAIL` (adjunto en el aviso) — reenvíalo manualmente al usuario.
