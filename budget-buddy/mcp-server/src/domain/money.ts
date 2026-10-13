import { ensure } from './model.js';

export function cents(value: number): number {
  const result = Math.round(value * 100);
  ensure(Number.isFinite(value) && Math.abs(value) <= 1_000_000_000 && Math.abs(result - value * 100) < 0.00001, 'INVALID_AMOUNT', 'Amounts must be finite and have at most two decimal places.');
  return result;
}
export const amount = (value: number) => Math.round(value) / 100;

/** Largest-remainder allocation: stable participant order breaks ties. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  ensure(sum > 0, 'INVALID_SPLIT', 'Split allocation must have a positive total.');
  const raw = weights.map(w => total * w / sum);
  const shares = raw.map(Math.floor);
  const remaining = total - shares.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, rest: v - shares[i]! })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (let n = 0; n < remaining; n++) shares[order[n]!.i]!++;
  return shares;
}
