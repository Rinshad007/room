import type { Database } from 'firebase-admin/database';
import type { Store } from './store.js';

/** Root domain transactions preserve legacy web writes and private auth state atomically.
 * Designed for small databases: this trades throughput for correct cross-record invariants.
 */
export class FirebaseStore implements Store {
  constructor(private readonly database: Database) {}
  async read<T>(path: string): Promise<T | null> {
    return (await this.database.ref(path || '/').get()).val() as T | null;
  }
  async transaction<T, R>(path: string, change: (current: T | null) => { value: T; result: R }): Promise<R> {
    const ref = this.database.ref(path || '/');
    let result: R | undefined, failure: unknown;
    // Firebase can first invoke the callback with a stale/null local cache. Returning
    // that value on a domain failure lets Firebase compare-and-swap/retry with the
    // actual server snapshot. Throw only after a committed authoritative evaluation.
    const transaction = await ref.transaction(current => {
      try {
        const next = change(structuredClone(current) as T | null);
        result = next.result;
        failure = undefined;
        return next.value;
      } catch (error) {
        failure = error;
        return current;
      }
    }, undefined, false);
    if (!transaction.committed) throw new Error('Transaction aborted.');
    if (failure) throw failure;
    return result as R;
  }
}
