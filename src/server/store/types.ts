/**
 * Persistence contract. Rows mirror spec/db_schema.sql 1:1 (snake_case, ISO timestamps).
 * Two implementations: Supabase (service role, server-side only) and an in-memory store for
 * local/e2e/demo runs. The browser never touches either directly.
 */

export type LeadStatus =
  | 'requested'
  | 'awaiting_owner'
  | 'awaiting_payment'
  | 'ready'
  | 'delivered'
  | 'failed'
  | 'deleted';
export type DeliveryStatus = 'queued' | 'sent' | 'failed';
export type OrderStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export type PrivacyRequestType = 'access' | 'correction' | 'deletion' | 'portability' | 'objection';
export type PrivacyRequestStatus = 'received' | 'verifying' | 'in_progress' | 'completed' | 'rejected';
export type Locale = 'es' | 'en' | 'pt';

export interface CalculationRow {
  id: string;
  created_at: string;
  expires_at: string;
  locale: Locale;
  model_version: string;
  inputs_ciphertext: string;
  result_ciphertext: string;
  payload_iv: string;
  payload_tag: string;
  sjl_band: string;
  warning_count: number;
  request_id: string;
  deleted_at: string | null;
}

export interface LeadRow {
  id: string;
  calculation_id: string;
  created_at: string;
  expires_at: string;
  status: LeadStatus;
  locale: Locale;
  email_ciphertext: string;
  email_hash: string;
  email_iv: string;
  email_tag: string;
  consent_report: boolean;
  consent_report_at: string;
  consent_owner_copy: boolean;
  consent_owner_copy_at: string | null;
  waitlist_subscription: boolean;
  owner_approved_at: string | null;
  delivered_at: string | null;
  deleted_at: string | null;
}

export interface ArtifactRow {
  id: string;
  lead_id: string;
  created_at: string;
  expires_at: string;
  report_version: string;
  storage_path: string;
  sha256: string;
  access_token_hash: string;
  access_token_expires_at: string;
  bytes: number | null;
  deleted_at: string | null;
}

export interface DeliveryRow {
  id: string;
  lead_id: string;
  created_at: string;
  channel: 'user_email' | 'owner_email';
  status: DeliveryStatus;
  provider_message_id: string | null;
  attempt_count: number;
  last_error_category: string | null;
  sent_at: string | null;
}

export interface OrderRow {
  id: string;
  lead_id: string;
  created_at: string;
  status: OrderStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  currency: string;
  amount_minor: number;
  country_code: string | null;
  offer_id: string | null;
  paid_at: string | null;
  refunded_at: string | null;
}

export interface WebhookEventRow {
  provider: string;
  event_id: string;
  created_at: string;
  processed_at: string | null;
  event_type: string;
  payload_sha256: string;
}

export interface PrivacyRequestRow {
  id: string;
  created_at: string;
  request_type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  email_hash: string;
  email_ciphertext: string;
  email_iv: string;
  email_tag: string;
  locale: Locale;
  verified_at: string | null;
  completed_at: string | null;
  notes_category: string | null;
}

export interface AuditEntry {
  actor_user_id?: string | null;
  actor_type: 'system' | 'admin' | 'privacy_job';
  action: string;
  entity_type: string;
  entity_id?: string | null;
  /** Never PII: counts, categories and request ids only. */
  metadata?: Record<string, unknown>;
}

export interface FunnelStats {
  calculations: number;
  leads: number;
  delivered: number;
  failedDeliveries: number;
  awaitingOwner: number;
  paidOrders: number;
}

export interface ListLeadsParams {
  status?: string;
  limit?: number;
  /** Opaque cursor: created_at of the last item of the previous page. */
  cursor?: string;
}

export interface ListLeadsResult {
  items: LeadRow[];
  next_cursor: string | null;
}

export interface Store {
  readonly driver: 'supabase' | 'memory';
  ping(): Promise<void>;

  insertCalculation(row: CalculationRow): Promise<void>;
  getCalculation(id: string): Promise<CalculationRow | null>;
  updateCalculation(id: string, patch: Partial<CalculationRow>): Promise<void>;

  insertLead(row: LeadRow): Promise<void>;
  getLead(id: string): Promise<LeadRow | null>;
  updateLead(id: string, patch: Partial<LeadRow>): Promise<void>;
  listLeads(params: ListLeadsParams): Promise<ListLeadsResult>;
  leadsByEmailHash(hash: string): Promise<LeadRow[]>;

  upsertArtifact(row: ArtifactRow): Promise<void>;
  getArtifact(leadId: string): Promise<ArtifactRow | null>;
  updateArtifact(leadId: string, patch: Partial<ArtifactRow>): Promise<void>;

  putBlob(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  getBlob(path: string): Promise<Uint8Array | null>;
  deleteBlob(path: string): Promise<void>;

  insertDelivery(row: DeliveryRow): Promise<void>;
  updateDelivery(id: string, patch: Partial<DeliveryRow>): Promise<void>;
  listDeliveries(filter: { leadId?: string; status?: DeliveryStatus }): Promise<DeliveryRow[]>;

  insertOrder(row: OrderRow): Promise<void>;
  getOrder(id: string): Promise<OrderRow | null>;
  getOrderBySession(sessionId: string): Promise<OrderRow | null>;
  getOrderByPaymentIntent(paymentIntentId: string): Promise<OrderRow | null>;
  ordersByLead(leadId: string): Promise<OrderRow[]>;
  updateOrder(id: string, patch: Partial<OrderRow>): Promise<void>;

  /** Returns true when the event was newly recorded, false if it already existed (idempotency). */
  recordWebhookEvent(row: Omit<WebhookEventRow, 'created_at' | 'processed_at'>): Promise<boolean>;
  markWebhookProcessed(provider: string, eventId: string): Promise<void>;
  webhookProcessed(provider: string, eventId: string): Promise<boolean>;

  insertPrivacyRequest(row: PrivacyRequestRow): Promise<void>;
  getPrivacyRequest(id: string): Promise<PrivacyRequestRow | null>;
  listPrivacyRequests(limit?: number): Promise<PrivacyRequestRow[]>;
  updatePrivacyRequest(id: string, patch: Partial<PrivacyRequestRow>): Promise<void>;

  appendAudit(entry: AuditEntry): Promise<void>;
  stats(sinceIso: string): Promise<FunnelStats>;

  /* retention & erasure */
  findExpiredLeads(nowIso: string, limit: number): Promise<LeadRow[]>;
  findExpiredCalculations(nowIso: string, limit: number): Promise<CalculationRow[]>;
  /** Hard-deletes a lead with its artifact/deliveries and (when orphaned) its calculation. */
  deleteLeadCascade(leadId: string): Promise<void>;
  deleteCalculation(id: string): Promise<void>;
}
