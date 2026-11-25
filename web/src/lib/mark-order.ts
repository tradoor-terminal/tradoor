/**
 * The order the chart engine numbers exchange marks in: a liquidation names
 * the exchange it came from by index. Kept apart from the artwork so the
 * worker can number marks without carrying their paths — the page sends those.
 */
import type { ExchangeId } from './exchanges';

/** The engine names them in the same order (crates/render chart.rs MARK_NAMES): a script's line named after one wears its mark. */
export const MARK_ORDER: readonly ExchangeId[] = ['binance', 'bybit', 'okx', 'bitget', 'gate', 'htx', 'bitfinex', 'aster', 'lighter', 'kraken', 'deribit', 'hyperliquid', 'coinbase', 'bitstamp', 'bingx'];
/** Those that close positions out: the first twelve. */
export const PERP_MARKS = MARK_ORDER.slice(0, 12);

/** The engine's number for the exchange behind `binance-perp` and the like. */
export const markIndex = (venue: string): number => Math.max(0, MARK_ORDER.indexOf(venue.split('-')[0] as ExchangeId));
