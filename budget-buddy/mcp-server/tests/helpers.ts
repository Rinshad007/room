import type { Store } from '../src/store.js';

/** Serial, atomic test double for the external Firebase persistence boundary. */
export class MemoryStore implements Store {
  data: Record<string, any>;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(seed: Record<string, any> = {}) { this.data = structuredClone(seed); }
  async read<T>(path: string): Promise<T | null> {
    const value = path.split('/').filter(Boolean).reduce((node, key) => node?.[key], this.data);
    return structuredClone(value ?? null) as T | null;
  }
  async transaction<T, R>(path: string, change: (current: T | null) => { value: T; result: R }): Promise<R> {
    const task = this.queue.then(async () => {
      const { value, result } = change(await this.read<T>(path));
      const keys = path.split('/').filter(Boolean);
      if (!keys.length) this.data = structuredClone(value) as Record<string, any>;
      else {
        let node = this.data;
        for (const key of keys.slice(0, -1)) node = node[key] ??= {};
        node[keys.at(-1)!] = structuredClone(value);
      }
      return structuredClone(result);
    });
    this.queue = task.catch(() => {});
    return task;
  }
}

export const seed = () => ({
  users: {
    alice: { id: 'alice', name: 'Alice', email: 'alice@example.test', created_at: '2026-01-01', upi_id: 'private@bank' },
    bob: { id: 'bob', name: 'Bob', email: 'bob@example.test', created_at: '2026-01-01' },
    eve: { id: 'eve', name: 'Eve', email: 'eve@example.test', created_at: '2026-01-01' },
  },
  friendships: { ab: { id: 'ab', sender_id: 'alice', receiver_id: 'bob', status: 'accepted', created_at: '2026-01-01' } },
  groups: { trip: { id: 'trip', name: 'Trip', created_by: 'alice', members: { alice: true, bob: true }, created_at: '2026-01-01' } },
});
