import 'server-only';
import { MemoryStore } from './memory';
import { createSupabaseStoreFromEnv } from './supabase';
import type { Store } from './types';

export type * from './types';

let instance: Store | undefined;

/** Supabase when configured, otherwise the in-memory store (local, e2e, demo). */
export function getStore(): Store {
  if (!instance) instance = createSupabaseStoreFromEnv() ?? new MemoryStore();
  return instance;
}

export function resetStoreForTests(): void {
  instance = undefined;
  MemoryStore.reset();
}

export { MemoryStore };
