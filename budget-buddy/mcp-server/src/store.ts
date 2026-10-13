/** Minimal persistence boundary. Updates must atomically re-run on contention. */
export interface Store {
  read<T>(path: string): Promise<T | null>;
  transaction<T, R>(path: string, change: (current: T | null) => { value: T; result: R }): Promise<R>;
}
