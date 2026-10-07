# LAUNCH_CHECKLIST — ChronoSleep

## Producto y QA
- [ ] 21/21 vectores pasan en CI.
- [ ] Playwright validation y stripe test pasan.
- [ ] Lighthouse móvil >=90 en Performance/Accessibility/Best Practices/SEO.
- [ ] ES/EN/PT revisados.
- [ ] PDF y web report equivalentes.
- [ ] Drive checksum/cache/LKG probado.

## Dominio, marca y legal
- [ ] Clearance de **ChronoSleep** y dominio confirmado por titular/counsel.
- [ ] Privacidad, términos y aviso de salud publicados.
- [ ] DPA/subencargados revisados: Vercel/Netlify, Supabase, Google, Resend, PostHog, Sentry, Upstash, Stripe si aplica.
- [ ] Retención y base legal aprobadas por mercado.
- [ ] UE/UK: cookies/analytics, transferencias y DPIA/assessment evaluados.
- [ ] California: ámbito CCPA y obligaciones 2026 evaluadas.
- [ ] Brasil: LGPD/ANPD evaluados.
- [ ] Perú: si aplica, banco de datos y registro bajo Ley 29733/DS 016-2024-JUS evaluados/realizados.

## Email
- [ ] Dominio Resend verificado.
- [ ] SPF.
- [ ] DKIM.
- [ ] DMARC.
- [ ] Reply-to/soporte funcional.
- [ ] Bounce/complaint handling.

## Seguridad/privacidad
- [ ] RLS verificado con anon/no-admin/admin.
- [ ] PII cifrada con clave de producción.
- [ ] No PII en PostHog/Sentry/logs.
- [ ] Turnstile y rate limit activos.
- [ ] CSP/security headers.
- [ ] Tokens de informe expiran.
- [ ] Job de retención probado.

## Operación
- [ ] Sentry y alertas.
- [ ] PostHog funnels.
- [ ] Health check.
- [ ] Backup/restore Supabase probado.
- [ ] Rollback Vercel probado/documentado.
- [ ] `MONETIZATION_MODE=validation` confirmado para lanzamiento inicial.

## Prueba real punta a punta
- [ ] Desde móvil real: landing→preview→email gate.
- [ ] Lead aparece en admin.
- [ ] Usuario recibe confirmación.
- [ ] Owner recibe notificación correcta.
- [ ] PDF abre y no contiene email en metadata.
- [ ] Approve/resend funciona.
- [ ] Informe/ICS descargan con autorización.
