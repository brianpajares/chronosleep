import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';
import type {
  ArtifactRow,
  AuditEntry,
  CalculationRow,
  DeliveryRow,
  FunnelStats,
  LeadRow,
  ListLeadsParams,
  ListLeadsResult,
  OrderRow,
  PrivacyRequestRow,
  Store,
  WebhookEventRow,
} from './types';

const BUCKET = 'reports';

type PgError = { code?: string; message: string } | null;

/** Errors carry only the PostgREST code/message (never row contents). */
function must<T>(res: { data: T | null; error: PgError }, what: string): T {
  if (res.error) throw new Error(`supabase ${what} failed: ${res.error.code ?? ''} ${res.error.message}`.trim());
  return res.data as T;
}

function mustOk(res: { error: PgError }, what: string): void {
  if (res.error) throw new Error(`supabase ${what} failed: ${res.error.code ?? ''} ${res.error.message}`.trim());
}

export class SupabaseStore implements Store {
  readonly driver = 'supabase' as const;
  private readonly db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-client-info': 'chronosleep-server' } },
    });
  }

  async ping() {
    const res = await this.db.from('calculations').select('id', { head: true, count: 'exact' }).limit(1);
    mustOk(res, 'ping');
  }

  async insertCalculation(row: CalculationRow) {
    mustOk(await this.db.from('calculations').insert(row), 'insertCalculation');
  }
  async getCalculation(id: string) {
    const res = await this.db.from('calculations').select('*').eq('id', id).maybeSingle();
    return must<CalculationRow | null>(res as never, 'getCalculation');
  }
  async updateCalculation(id: string, patch: Partial<CalculationRow>) {
    mustOk(await this.db.from('calculations').update(patch).eq('id', id), 'updateCalculation');
  }

  async insertLead(row: LeadRow) {
    mustOk(await this.db.from('leads').insert(row), 'insertLead');
  }
  async getLead(id: string) {
    const res = await this.db.from('leads').select('*').eq('id', id).maybeSingle();
    return must<LeadRow | null>(res as never, 'getLead');
  }
  async updateLead(id: string, patch: Partial<LeadRow>) {
    mustOk(await this.db.from('leads').update(patch).eq('id', id), 'updateLead');
  }
  async listLeads({ status, limit = 25, cursor }: ListLeadsParams): Promise<ListLeadsResult> {
    let q = this.db.from('leads').select('*').order('created_at', { ascending: false }).limit(limit + 1);
    if (status) q = q.eq('status', status);
    if (cursor) q = q.lt('created_at', cursor);
    const rows = must<LeadRow[]>((await q) as never, 'listLeads');
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return { items: page, next_cursor: rows.length > limit && last ? last.created_at : null };
  }
  async leadsByEmailHash(hash: string) {
    const res = await this.db.from('leads').select('*').eq('email_hash', hash);
    return must<LeadRow[]>(res as never, 'leadsByEmailHash');
  }

  async upsertArtifact(row: ArtifactRow) {
    mustOk(await this.db.from('report_artifacts').upsert(row, { onConflict: 'lead_id' }), 'upsertArtifact');
  }
  async getArtifact(leadId: string) {
    const res = await this.db.from('report_artifacts').select('*').eq('lead_id', leadId).maybeSingle();
    return must<ArtifactRow | null>(res as never, 'getArtifact');
  }
  async updateArtifact(leadId: string, patch: Partial<ArtifactRow>) {
    mustOk(await this.db.from('report_artifacts').update(patch).eq('lead_id', leadId), 'updateArtifact');
  }

  async putBlob(path: string, bytes: Uint8Array, contentType: string) {
    const res = await this.db.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (res.error) throw new Error(`supabase storage upload failed: ${res.error.message}`);
  }
  async getBlob(path: string) {
    const res = await this.db.storage.from(BUCKET).download(path);
    if (res.error || !res.data) return null;
    return new Uint8Array(await res.data.arrayBuffer());
  }
  async deleteBlob(path: string) {
    await this.db.storage.from(BUCKET).remove([path]);
  }

  async insertDelivery(row: DeliveryRow) {
    mustOk(await this.db.from('deliveries').insert(row), 'insertDelivery');
  }
  async updateDelivery(id: string, patch: Partial<DeliveryRow>) {
    mustOk(await this.db.from('deliveries').update(patch).eq('id', id), 'updateDelivery');
  }
  async listDeliveries({ leadId, status }: { leadId?: string; status?: DeliveryRow['status'] }) {
    let q = this.db.from('deliveries').select('*').order('created_at', { ascending: false });
    if (leadId) q = q.eq('lead_id', leadId);
    if (status) q = q.eq('status', status);
    return must<DeliveryRow[]>((await q) as never, 'listDeliveries');
  }

  async insertOrder(row: OrderRow) {
    mustOk(await this.db.from('orders').insert(row), 'insertOrder');
  }
  async getOrder(id: string) {
    const res = await this.db.from('orders').select('*').eq('id', id).maybeSingle();
    return must<OrderRow | null>(res as never, 'getOrder');
  }
  async getOrderBySession(sessionId: string) {
    const res = await this.db.from('orders').select('*').eq('stripe_checkout_session_id', sessionId).maybeSingle();
    return must<OrderRow | null>(res as never, 'getOrderBySession');
  }
  async getOrderByPaymentIntent(paymentIntentId: string) {
    const res = await this.db.from('orders').select('*').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle();
    return must<OrderRow | null>(res as never, 'getOrderByPaymentIntent');
  }
  async ordersByLead(leadId: string) {
    const res = await this.db.from('orders').select('*').eq('lead_id', leadId);
    return must<OrderRow[]>(res as never, 'ordersByLead');
  }
  async updateOrder(id: string, patch: Partial<OrderRow>) {
    mustOk(await this.db.from('orders').update(patch).eq('id', id), 'updateOrder');
  }

  async recordWebhookEvent(row: Omit<WebhookEventRow, 'created_at' | 'processed_at'>) {
    const res = await this.db.from('webhook_events').insert(row);
    if (res.error) {
      // 23505 = unique_violation on (provider, event_id): already recorded.
      if (res.error.code === '23505') return false;
      throw new Error(`supabase recordWebhookEvent failed: ${res.error.code ?? ''} ${res.error.message}`);
    }
    return true;
  }
  async webhookProcessed(provider: string, eventId: string) {
    const res = await this.db
      .from("webhook_events")
      .select("processed_at")
      .eq("provider", provider)
      .eq("event_id", eventId)
      .maybeSingle();
    return Boolean(must<{ processed_at: string | null } | null>(res as never, "webhookProcessed")?.processed_at);
  }
  async markWebhookProcessed(provider: string, eventId: string) {
    mustOk(
      await this.db
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('provider', provider)
        .eq('event_id', eventId),
      'markWebhookProcessed',
    );
  }

  async insertPrivacyRequest(row: PrivacyRequestRow) {
    mustOk(await this.db.from('privacy_requests').insert(row), 'insertPrivacyRequest');
  }
  async getPrivacyRequest(id: string) {
    const res = await this.db.from('privacy_requests').select('*').eq('id', id).maybeSingle();
    return must<PrivacyRequestRow | null>(res as never, 'getPrivacyRequest');
  }
  async listPrivacyRequests(limit = 50) {
    const res = await this.db.from('privacy_requests').select('*').order('created_at', { ascending: false }).limit(limit);
    return must<PrivacyRequestRow[]>(res as never, 'listPrivacyRequests');
  }
  async updatePrivacyRequest(id: string, patch: Partial<PrivacyRequestRow>) {
    mustOk(await this.db.from('privacy_requests').update(patch).eq('id', id), 'updatePrivacyRequest');
  }

  async appendAudit(entry: AuditEntry) {
    mustOk(
      await this.db.from('audit_log').insert({
        actor_user_id: entry.actor_user_id ?? null,
        actor_type: entry.actor_type,
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id ?? null,
        metadata: entry.metadata ?? {},
      }),
      'appendAudit',
    );
  }

  async stats(sinceIso: string): Promise<FunnelStats> {
    const head = (table: string) =>
      this.db.from(table).select('id', { count: 'exact', head: true }).gte('created_at', sinceIso);
    const results = await Promise.all([
      head('calculations'),
      head('leads'),
      head('leads').eq('status', 'delivered'),
      head('deliveries').eq('status', 'failed'),
      head('leads').eq('status', 'awaiting_owner'),
      head('orders').eq('status', 'paid'),
    ]);
    for (const r of results) mustOk(r, 'stats');
    const [calculations, leads, delivered, failedDeliveries, awaitingOwner, paidOrders] = results.map(
      (r) => r.count ?? 0,
    ) as [number, number, number, number, number, number];
    return { calculations, leads, delivered, failedDeliveries, awaitingOwner, paidOrders };
  }

  async findExpiredLeads(nowIso: string, limit: number) {
    const res = await this.db.from('leads').select('*').lt('expires_at', nowIso).neq('status', 'deleted').limit(limit);
    return must<LeadRow[]>(res as never, 'findExpiredLeads');
  }
  async findExpiredCalculations(nowIso: string, limit: number) {
    const res = await this.db.from('calculations').select('*').lt('expires_at', nowIso).is('deleted_at', null).limit(limit);
    const rows = must<CalculationRow[]>(res as never, 'findExpiredCalculations');
    const out: CalculationRow[] = [];
    for (const c of rows) {
      const refs = await this.db.from('leads').select('id', { count: 'exact', head: true }).eq('calculation_id', c.id);
      if ((refs.count ?? 0) === 0) out.push(c);
    }
    return out;
  }
  async deleteLeadCascade(leadId: string) {
    const lead = await this.getLead(leadId);
    if (!lead) return;
    const art = await this.getArtifact(leadId);
    if (art) await this.deleteBlob(art.storage_path);
    // Deleting the calculation cascades to the lead, its artifact and its deliveries.
    mustOk(await this.db.from('calculations').delete().eq('id', lead.calculation_id), 'deleteLeadCascade');
  }
  async deleteCalculation(id: string) {
    mustOk(await this.db.from('calculations').delete().eq('id', id), 'deleteCalculation');
  }
}

export function createSupabaseStoreFromEnv(): SupabaseStore | null {
  const url = env.supabaseUrl();
  const key = env.supabaseServiceKey();
  return url && key ? new SupabaseStore(url, key) : null;
}
