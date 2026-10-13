import 'server-only';
import { randomUUID } from 'node:crypto';
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

interface MemoryState {
  calculations: Map<string, CalculationRow>;
  leads: Map<string, LeadRow>;
  artifacts: Map<string, ArtifactRow>; // by lead_id
  deliveries: Map<string, DeliveryRow>;
  orders: Map<string, OrderRow>;
  webhooks: Map<string, WebhookEventRow>;
  privacy: Map<string, PrivacyRequestRow>;
  audit: Array<AuditEntry & { id: number; created_at: string }>;
  blobs: Map<string, { bytes: Uint8Array; contentType: string }>;
}

const g = globalThis as unknown as { __csMemoryStore?: MemoryState };

function state(): MemoryState {
  g.__csMemoryStore ??= {
    calculations: new Map(),
    leads: new Map(),
    artifacts: new Map(),
    deliveries: new Map(),
    orders: new Map(),
    webhooks: new Map(),
    privacy: new Map(),
    audit: [],
    blobs: new Map(),
  };
  return g.__csMemoryStore;
}

const clone = <T>(v: T): T => structuredClone(v);

export class MemoryStore implements Store {
  readonly driver = 'memory' as const;

  async ping() {}

  async insertCalculation(row: CalculationRow) {
    state().calculations.set(row.id, clone(row));
  }
  async getCalculation(id: string) {
    const r = state().calculations.get(id);
    return r ? clone(r) : null;
  }
  async updateCalculation(id: string, patch: Partial<CalculationRow>) {
    const r = state().calculations.get(id);
    if (r) Object.assign(r, patch);
  }

  async insertLead(row: LeadRow) {
    state().leads.set(row.id, clone(row));
  }
  async getLead(id: string) {
    const r = state().leads.get(id);
    return r ? clone(r) : null;
  }
  async updateLead(id: string, patch: Partial<LeadRow>) {
    const r = state().leads.get(id);
    if (r) Object.assign(r, patch);
  }
  async listLeads({ status, limit = 25, cursor }: ListLeadsParams): Promise<ListLeadsResult> {
    let items = [...state().leads.values()].filter((l) => !l.deleted_at || l.status === 'deleted');
    if (status) items = items.filter((l) => l.status === status);
    items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (cursor) items = items.filter((l) => l.created_at < cursor);
    const page = items.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map(clone),
      next_cursor: items.length > limit && last ? last.created_at : null,
    };
  }
  async leadsByEmailHash(hash: string) {
    return [...state().leads.values()].filter((l) => l.email_hash === hash).map(clone);
  }

  async upsertArtifact(row: ArtifactRow) {
    state().artifacts.set(row.lead_id, clone(row));
  }
  async getArtifact(leadId: string) {
    const r = state().artifacts.get(leadId);
    return r ? clone(r) : null;
  }
  async updateArtifact(leadId: string, patch: Partial<ArtifactRow>) {
    const r = state().artifacts.get(leadId);
    if (r) Object.assign(r, patch);
  }

  async putBlob(path: string, bytes: Uint8Array, contentType: string) {
    state().blobs.set(path, { bytes: new Uint8Array(bytes), contentType });
  }
  async getBlob(path: string) {
    const b = state().blobs.get(path);
    return b ? new Uint8Array(b.bytes) : null;
  }
  async deleteBlob(path: string) {
    state().blobs.delete(path);
  }

  async insertDelivery(row: DeliveryRow) {
    state().deliveries.set(row.id, clone(row));
  }
  async updateDelivery(id: string, patch: Partial<DeliveryRow>) {
    const r = state().deliveries.get(id);
    if (r) Object.assign(r, patch);
  }
  async listDeliveries({ leadId, status }: { leadId?: string; status?: DeliveryRow['status'] }) {
    return [...state().deliveries.values()]
      .filter((d) => (!leadId || d.lead_id === leadId) && (!status || d.status === status))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map(clone);
  }

  async insertOrder(row: OrderRow) {
    state().orders.set(row.id, clone(row));
  }
  async getOrder(id: string) {
    const r = state().orders.get(id);
    return r ? clone(r) : null;
  }
  async getOrderBySession(sessionId: string) {
    const r = [...state().orders.values()].find((o) => o.stripe_checkout_session_id === sessionId);
    return r ? clone(r) : null;
  }
  async getOrderByPaymentIntent(paymentIntentId: string) {
    const r = [...state().orders.values()].find((o) => o.stripe_payment_intent_id === paymentIntentId);
    return r ? clone(r) : null;
  }
  async ordersByLead(leadId: string) {
    return [...state().orders.values()].filter((o) => o.lead_id === leadId).map(clone);
  }
  async updateOrder(id: string, patch: Partial<OrderRow>) {
    const r = state().orders.get(id);
    if (r) Object.assign(r, patch);
  }

  async recordWebhookEvent(row: Omit<WebhookEventRow, 'created_at' | 'processed_at'>) {
    const key = `${row.provider}:${row.event_id}`;
    if (state().webhooks.has(key)) return false;
    state().webhooks.set(key, { ...row, created_at: new Date().toISOString(), processed_at: null });
    return true;
  }
  async webhookProcessed(provider: string, eventId: string) {
    return Boolean(state().webhooks.get(provider + ":" + eventId)?.processed_at);
  }
  async markWebhookProcessed(provider: string, eventId: string) {
    const r = state().webhooks.get(`${provider}:${eventId}`);
    if (r) r.processed_at = new Date().toISOString();
  }

  async insertPrivacyRequest(row: PrivacyRequestRow) {
    state().privacy.set(row.id, clone(row));
  }
  async getPrivacyRequest(id: string) {
    const r = state().privacy.get(id);
    return r ? clone(r) : null;
  }
  async listPrivacyRequests(limit = 50) {
    return [...state().privacy.values()]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit)
      .map(clone);
  }
  async updatePrivacyRequest(id: string, patch: Partial<PrivacyRequestRow>) {
    const r = state().privacy.get(id);
    if (r) Object.assign(r, patch);
  }

  async appendAudit(entry: AuditEntry) {
    const s = state();
    s.audit.push({ ...clone(entry), id: s.audit.length + 1, created_at: new Date().toISOString() });
  }

  async stats(sinceIso: string): Promise<FunnelStats> {
    const s = state();
    const leads = [...s.leads.values()].filter((l) => l.created_at >= sinceIso);
    return {
      calculations: [...s.calculations.values()].filter((c) => c.created_at >= sinceIso).length,
      leads: leads.length,
      delivered: leads.filter((l) => l.status === 'delivered').length,
      failedDeliveries: [...s.deliveries.values()].filter((d) => d.status === 'failed' && d.created_at >= sinceIso).length,
      awaitingOwner: leads.filter((l) => l.status === 'awaiting_owner').length,
      paidOrders: [...s.orders.values()].filter((o) => o.status === 'paid' && o.created_at >= sinceIso).length,
    };
  }

  async findExpiredLeads(nowIso: string, limit: number) {
    return [...state().leads.values()]
      .filter((l) => l.expires_at < nowIso && l.status !== 'deleted')
      .slice(0, limit)
      .map(clone);
  }
  async findExpiredCalculations(nowIso: string, limit: number) {
    const s = state();
    const referenced = new Set([...s.leads.values()].map((l) => l.calculation_id));
    return [...s.calculations.values()]
      .filter((c) => c.expires_at < nowIso && !c.deleted_at && !referenced.has(c.id))
      .slice(0, limit)
      .map(clone);
  }
  async deleteLeadCascade(leadId: string) {
    const s = state();
    const lead = s.leads.get(leadId);
    if (!lead) return;
    const art = s.artifacts.get(leadId);
    if (art) s.blobs.delete(art.storage_path);
    s.artifacts.delete(leadId);
    for (const [id, d] of s.deliveries) if (d.lead_id === leadId) s.deliveries.delete(id);
    s.leads.delete(leadId);
    const stillReferenced = [...s.leads.values()].some((l) => l.calculation_id === lead.calculation_id);
    if (!stillReferenced) s.calculations.delete(lead.calculation_id);
  }
  async deleteCalculation(id: string) {
    state().calculations.delete(id);
  }

  /* ---- test / dev helpers (not part of Store) ---- */
  static reset() {
    g.__csMemoryStore = undefined;
  }
  static auditLog() {
    return [...state().audit];
  }
  static newId() {
    return randomUUID();
  }
}
