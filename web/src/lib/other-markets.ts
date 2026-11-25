/**
 * The markets a Frost Script reads besides the chart's own — `cvd("bybit-perp")`,
 * `close("okx-spot:ETH")` — as the script names them, found in the catalogue.
 * A venue alone is the chart's coin there; with a symbol after it, that market
 * if it is listed, else that coin. The coin decides, as liquidations' do: Binance's
 * `1000PEPE` and Bybit's `PEPE1000` are one coin. Of its listings the one in the
 * chart's quote is taken, then USDT, USD and USDC.
 */
import type { Product } from './api';
import { coinOf } from './liquidation-venues';
import { parseMarket, ratioLegs, VENUES } from './markets';

const NAME = /^([a-z]+-(?:spot|perp))(?::([A-Z0-9_]+))?$/;
const QUOTES = ['USDT', 'USD', 'USDC'];

/** A script's name for a market: its venue, and the symbol or coin after it, if any. */
export function readName(name: string): { venue: string; symbol: string | null } | null {
  const m = NAME.exec(name);
  return m && m[1] !== 'index' && (VENUES as readonly string[]).includes(m[1]!) ? { venue: m[1]!, symbol: m[2] ?? null } : null;
}

/**
 * The market `name` reads on a chart of `chart`, or null where its venue does
 * not list it.
 */
export function resolveOther(name: string, chart: string, products: readonly Product[]): string | null {
  const read = readName(name);
  if (!read) return null;
  const own = parseMarket(ratioLegs(chart)?.[0] ?? chart);
  if (read.symbol && products.some((p) => p.market === `${read.venue}:${read.symbol}`)) return `${read.venue}:${read.symbol}`;
  const mine = own && products.find((p) => p.market === `${own.venue}:${own.symbol}`);
  // A coin named is taken with or without a multiplier: PEPE finds 1000PEPE.
  const bare = (base: string) => coinOf(base).replace(/x10{2,}$/, '');
  const coin = read.symbol ? bare(read.symbol) : mine ? coinOf(mine.base) : null;
  const of = read.symbol ? bare : coinOf;
  if (!coin) return null;
  // The chart's quote first, then the dollars in order, then anything.
  const rank = (p: Product) => (p.quote === mine?.quote ? 0 : QUOTES.indexOf(p.quote) + 1 || QUOTES.length + 1);
  let pick: Product | undefined;
  for (const p of products) {
    if (p.venue !== read.venue || of(p.base) !== coin) continue;
    if (!pick || rank(p) < rank(pick) || (rank(p) === rank(pick) && p.symbol === own?.symbol)) pick = p;
  }
  return pick?.market ?? null;
}
