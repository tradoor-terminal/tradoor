/** Number and time formatting. Prices span 0.00000285 to 100,000 in one list,
 *  so precision comes from the value or the instrument, never a constant. */

export const MAX_PRICE_DECIMALS = 8;

/** Decimals a number actually carries, including below 1e-6 where JavaScript
 *  switches to exponent notation. */
export function decimalsOf(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const s = String(Math.abs(v));
  const e = s.indexOf('e');
  const mantissa = e === -1 ? s : s.slice(0, e);
  const dot = mantissa.indexOf('.');
  const inMantissa = dot === -1 ? 0 : mantissa.length - dot - 1;
  return e === -1 ? inMantissa : Math.max(0, inMantissa - Number(s.slice(e + 1)));
}

function bucket(abs: number): number {
  if (abs === 0 || abs >= 1000) return 2;
  if (abs >= 1) return 4;
  if (abs >= 0.01) return 5;
  if (abs >= 0.0001) return 6;
  return MAX_PRICE_DECIMALS;
}

/** Decimals for one quoted price when the instrument's precision is not known.
 *  Only for traded prices: computed values carry float noise. */
export function priceDecimals(v: number | null | undefined): number {
  if (v === null || v === undefined || !Number.isFinite(v)) return 2;
  return Math.min(MAX_PRICE_DECIMALS, Math.max(bucket(Math.abs(v)), decimalsOf(v)));
}

/** Decimals for a price worked out or dragged rather than quoted, where the
 *  instrument's precision is not known: by its size alone, its own digits being
 *  an average's float tail (80311.69999999998) or where a pointer let go. */
export const roughDecimals = (v: number): number => (Number.isFinite(v) ? bucket(Math.abs(v)) : 2);

const formatters = new Map<number, Intl.NumberFormat>();

export function formatPrice(v: number | null | undefined, digits?: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const d = digits ?? priceDecimals(v);
  let f = formatters.get(d);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    formatters.set(d, f);
  }
  return f.format(v);
}

/** A band a short figure is written in: the least size it holds, the unit it
 *  counts in, its decimals and the unit's letter. */
export type Band = readonly [least: number, unit: number, decimals: number, letter: string];

/** `v` in the first band, largest first, its size reaches as it reads once
 *  rounded: 999,960 to the thousand is `1000K`, so it goes in the band above, `1.0M`.
 *  The last band holds every size below the others. */
export function banded(v: number, bands: readonly Band[]): string {
  const abs = Math.abs(v);
  let k = bands.findIndex(([least]) => abs >= least);
  while (k > 0 && Number((abs / bands[k]![1]).toFixed(bands[k]![2])) * bands[k]![1] >= bands[k - 1]![0]) k--;
  const [, unit, decimals, letter] = bands[k]!;
  return `${(v / unit).toFixed(decimals)}${letter}`;
}

const TURNOVER: readonly Band[] = [[1e12, 1e12, 1, 'T'], [1e9, 1e9, 1, 'B'], [1e6, 1e6, 1, 'M'], [1e3, 1e3, 0, 'K'], [0, 1, 0, '']];

export function formatTurnover(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return banded(v, TURNOVER);
}

const VOLUME: readonly Band[] = [[1e12, 1e12, 2, 'T'], [1e9, 1e9, 2, 'B'], [1e6, 1e6, 2, 'M'], [1e3, 1e3, 2, 'K'], [100, 1, 1, ''], [0, 1, 2, '']];

/** A volume as TradingView's watchlist writes it: 112.35K, 1.20M, 845.3. */
export function formatVolume(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return banded(v, VOLUME);
}

export function formatPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatAge(ms: number, now: number = Date.now()): string {
  const delta = now - ms;
  if (delta < 0) return 'upcoming';
  if (delta < MINUTE) return 'just now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  const days = Math.floor(delta / DAY);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}
