-- ChronoSleep v4 — Supabase/Postgres schema.
-- Aplicar mediante migración. RLS queda habilitado en todas las tablas.
create extension if not exists pgcrypto;

create type public.lead_status as enum ('requested','awaiting_owner','awaiting_payment','ready','delivered','failed','deleted');
create type public.delivery_status as enum ('queued','sent','failed');
create type public.order_status as enum ('pending','paid','refunded','failed');
create type public.privacy_request_type as enum ('access','correction','deletion','portability','objection');
create type public.privacy_request_status as enum ('received','verifying','in_progress','completed','rejected');

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
$$;

create table public.calculations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  locale text not null check (locale in ('es','en','pt')),
  model_version text not null,
  inputs_ciphertext text not null,
  result_ciphertext text not null,
  payload_iv text not null,
  payload_tag text not null,
  sjl_band text not null,
  warning_count int not null default 0 check (warning_count >= 0),
  request_id text not null,
  deleted_at timestamptz
);
create index calculations_expires_idx on public.calculations(expires_at) where deleted_at is null;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  calculation_id uuid not null references public.calculations(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  status public.lead_status not null default 'requested',
  locale text not null check (locale in ('es','en','pt')),
  email_ciphertext text not null,
  email_hash text not null,
  email_iv text not null,
  email_tag text not null,
  consent_report boolean not null check (consent_report = true),
  consent_report_at timestamptz not null default now(),
  consent_owner_copy boolean not null default false,
  consent_owner_copy_at timestamptz,
  waitlist_subscription boolean not null default false,
  owner_approved_at timestamptz,
  delivered_at timestamptz,
  deleted_at timestamptz
);
create index leads_email_hash_idx on public.leads(email_hash);
create index leads_status_created_idx on public.leads(status, created_at desc);

create table public.report_artifacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  report_version text not null,
  storage_path text not null,
  sha256 text not null,
  access_token_hash text not null,
  access_token_expires_at timestamptz not null,
  bytes bigint check (bytes is null or bytes >= 0),
  deleted_at timestamptz
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  channel text not null check (channel in ('user_email','owner_email')),
  status public.delivery_status not null default 'queued',
  provider_message_id text,
  attempt_count int not null default 0,
  last_error_category text,
  sent_at timestamptz
);
create index deliveries_lead_idx on public.deliveries(lead_id, created_at desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  created_at timestamptz not null default now(),
  status public.order_status not null default 'pending',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  currency text not null check (char_length(currency)=3),
  amount_minor int not null check (amount_minor >= 0),
  country_code text check (country_code is null or char_length(country_code)=2),
  offer_id text,
  paid_at timestamptz,
  refunded_at timestamptz
);
create index orders_status_idx on public.orders(status, created_at desc);

create table public.webhook_events (
  provider text not null,
  event_id text not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  event_type text not null,
  payload_sha256 text not null,
  primary key(provider, event_id)
);

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_type public.privacy_request_type not null,
  status public.privacy_request_status not null default 'received',
  email_hash text not null,
  email_ciphertext text not null,
  email_iv text not null,
  email_tag text not null,
  locale text not null check (locale in ('es','en','pt')),
  verified_at timestamptz,
  completed_at timestamptz,
  notes_category text
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_type text not null check (actor_type in ('system','admin','privacy_job')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb
);
create index audit_entity_idx on public.audit_log(entity_type, entity_id, created_at desc);

alter table public.calculations enable row level security;
alter table public.leads enable row level security;
alter table public.report_artifacts enable row level security;
alter table public.deliveries enable row level security;
alter table public.orders enable row level security;
alter table public.webhook_events enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.audit_log enable row level security;

-- El browser no inserta directamente: Route Handlers usan service role server-side.
-- Admin autenticado puede leer/operar lo necesario; nunca se exponen secretos/ciphertext al cliente sin desencriptado selectivo server-side.
create policy admin_read_calculations on public.calculations for select to authenticated using (public.is_admin());
create policy admin_read_leads on public.leads for select to authenticated using (public.is_admin());
create policy admin_update_leads on public.leads for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_read_reports on public.report_artifacts for select to authenticated using (public.is_admin());
create policy admin_read_deliveries on public.deliveries for select to authenticated using (public.is_admin());
create policy admin_read_orders on public.orders for select to authenticated using (public.is_admin());
create policy admin_read_privacy on public.privacy_requests for select to authenticated using (public.is_admin());
create policy admin_update_privacy on public.privacy_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_read_audit on public.audit_log for select to authenticated using (public.is_admin());

-- Retention job example; ejecutar server-side/cron con service role.
-- Delete primero blobs privados asociados y luego filas expiradas.
