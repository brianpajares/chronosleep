# Analítica (GA4 + PostHog) — ChronoSleep

Un único punto de entrada: `src/lib/analytics.ts` → `track(event, props)`. Ningún componente llama a `gtag()` ni a PostHog directamente.

## Reglas
- **Nada carga ni se envía sin consentimiento** (banner Aceptar/Rechazar con el mismo peso; reabrible desde el pie "Preferencias de cookies"). DNT y Global Privacy Control siempre ganan.
- Solo eventos y propiedades del catálogo `spec/analytics_events.json`, filtrados por `analytics-catalog.ts` (sin emails, sin HH:MM, sin texto libre).
- GA4: Consent Mode v2 (`ad_*` siempre `denied`; `analytics_storage` solo tras aceptar), `send_page_view:false`, paths sin query ni UUID (`/informe/:id`; los tokens nunca salen).
- Sin `user_id`. Sin datos personales en URLs, parámetros ni propiedades.

## Configuración
| Variable | Dónde | Notas |
|---|---|---|
| `NEXT_PUBLIC_GA_ID` | Vercel (Config, no Secret) | `G-XXXXXXXXXX`. Sin ella el módulo es no-op |
| `GA_API_SECRET` | Vercel (Secret, solo servidor) | Measurement Protocol para `purchase` |
| `NEXT_PUBLIC_POSTHOG_KEY/HOST` | Vercel | Opcional; modo sin cookies |

Tras cambiar variables: **Redeploy** (solo aplican a despliegues nuevos).

## Plan de medición
| Evento GA4 | Evento interno | Dónde se dispara | Parámetros |
|---|---|---|---|
| `page_view` | — | `ConsentBanner` (ruta) | `page_path` saneado |
| `cta_click` | `calculator_start` | CTAs de landing/FAQ/países | `cta_location` |
| `view_item` | `preview_view` | `/resultado` | `sjl_band`, `direction` |
| `add_to_cart` | `preview_report_cta` | CTA del preview | — |
| `view_cart` | `report_gate_view` | `/informe/solicitar` | — |
| `generate_lead` | `email_submitted` | tras crear la solicitud | `lead_phase` |
| `view_item_list` | `checkout_view` | `/checkout` (solo `stripe`) | `currency`, `value` |
| `begin_checkout` | `checkout_started` | botón Comprar | `currency`, `value` |
| `purchase` | — | **servidor** (webhook Stripe → Measurement Protocol) | `transaction_id`, `value`, `currency`, `items` |
| `checkout_error` / `payment_failed` | `validation_error` / `payment_failed` | wizard / checkout | `error_type`, `reason_code` |
| custom | `step_view`, `step_complete`, `calculation_*`, `report_*`, `calendar_export` … | ver catálogo | solo categorizadas |

`purchase` se envía una vez por pedido (deduplica GA por `transaction_id`) y solo si el comprador aceptó analítica (se pasa el `client_id` `_ga` en `metadata.ga_cid`). `refund` no se envía todavía (limitación documentada).

## Embudo
`page_view → cta_click → view_item (preview) → add_to_cart → view_cart (gate) → generate_lead` (validation) y `→ begin_checkout → purchase` (stripe).

## Consola GA4 (checklist para el dueño)
1. Crear propiedad GA4 + flujo web; zona horaria y moneda.
2. Medición mejorada ON (scroll, salientes, descargas).
3. Eventos clave: `generate_lead`, `begin_checkout`, `purchase`.
4. Dimensiones personalizadas: `cta_location`, `sjl_band`, `direction`, `lead_phase`, `step`, `error_type`.
5. Audiencias: Alta intención (`view_cart` sin `generate_lead`), Checkout abandonado (`begin_checkout` sin `purchase`), Compradores.
6. Exploración de embudo con los pasos de arriba, por canal y dispositivo.
7. Retención de datos: 14 meses. Desactivar señales de Google y personalización de anuncios (el sitio ya envía `allow_google_signals:false`).
8. Opcional: BigQuery + Looker Studio.

## UTMs (ejemplos)
`?utm_source=linkedin&utm_medium=social&utm_campaign=lanzamiento` · `tiktok/social` · `youtube/video` · `whatsapp/chat` · `newsletter/email`. Las UTM se conservan al navegar porque el sitio no las elimina; el wizard no usa la URL para datos personales.

## Cómo añadir un evento
1. Añadirlo (con sus propiedades permitidas) a `spec/analytics_events.json`.
2. Llamar `track('evento', {...})` desde el componente.
3. Si tiene equivalente GA4 recomendado, añadir el caso en `mapToGa` (`src/lib/ga.ts`) y un test en `tests/unit/audit.test.ts`.

## Verificar en 5 minutos
Con `NEXT_PUBLIC_GA_ID` puesto: abrir el sitio → sin consentimiento, pestaña Network sin `googletagmanager`/`collect` → Aceptar → GA4 **DebugView** muestra `page_view`, `cta_click`, `view_item`… → Rechazar/Preferencias → no hay nuevos hits. Comprobar que ningún payload contiene emails u horas.
