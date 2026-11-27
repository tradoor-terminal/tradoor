/**
 * The gaps in a browser's footprint recording filled from Binance's trade
 * history: the hours no tab had a market open, newest first, a capped number
 * of calls a recording, paced to keep within what Binance allows an address.
 * Loaded with the first fill, so a page that never fills never carries it.
 */
import { digitsFor } from './alerts';
import { listen, quietUntil, throttled } from './binance-quiet';
import { cover, gaps, levelFor, MINUTE, MinuteBook, readAggTrades, type AggTrade, type Span } from './fp-minutes';
import { addMinutes, alone, readMarket, readMinutes, writeMarket, type MarketRecord } from './fp-store';
import { parseMarket } from './markets';

const HOUR = 3_600_000;
// A chart Binance throttled stops the fill too.
listen();
/** How far back a gap is filled from the exchange's history, and how many calls that may take. */
const BACKFILL_MS = 24 * HOUR;
const BACKFILL_CALLS = 120;
/** A fill Binance refused, or that did not reach it, is tried again this much later: a VPN may be off by then. */
const RETRY_MS = 120_000;
/**
 * Time between those calls, one at a time across every tab and market: a
 * futures call weighs 20 of the 2,400 a minute Binance allows an address, a
 * spot one 4 of 6,000. A third of the minute's allowance at most, so the
 * charts' own calls keep room — at 600 ms, two markets filling at once spent
 * it, and charts changing timeframe answered 429.
 */
const BACKFILL_PACE: Record<'binance-spot' | 'binance-perp', number> = { 'binance-spot': 300, 'binance-perp': 1500 };

/**
 * A fill Binance stopped: it `refused` this network (a region it turns away,
 * often a VPN's), `throttled` it (too many calls from one address, often a
 * shared VPN's), or it was `unreachable` from it. Tried again at `retry`.
 */
export interface Stopped {
  why: 'refused' | 'throttled' | 'unreachable';
  retry: number;
}

/** How much of the gaps is filled (ms) of how much, the oldest time reached, and the share of the calls used. */
export interface Filling {
  done: number;
  of: number;
  back: number;
  calls: number;
}

/**
 * Binance's trades for the gaps of the last day, newest first, as far as the
 * calls allow; `progress` hears how far. What stopped it, when Binance did.
 */
export async function backfill(
  market: string,
  venue: 'binance-spot' | 'binance-perp',
  until: number,
  kept: number,
  get: () => MarketRecord,
  set: (m: MarketRecord) => void,
  progress: (filling: Filling | null) => void,
  wrote: () => void,
  signal: AbortSignal,
): Promise<Stopped | null> {
  const holes = gaps(get().spans, Math.max(until - BACKFILL_MS, kept), until).reverse();
  const of = holes.reduce((sum, [a, b]) => sum + (b - a), 0);
  if (of < MINUTE) return null;
  let done = 0;
  progress({ done, of, back: until, calls: 0 });
  try {
    return await fill(
      market,
      venue,
      holes,
      signal,
      async (from, to, trades) => {
        const meta = await keep(market, from, to, trades, get().level, false);
        // The recorder's own spans stay: it may have covered more since.
        set({ ...get(), level: meta.level, spans: cover(get().spans, from, to) });
        wrote();
      },
      (ms, back, calls) => progress({ done: (done += ms), of, back, calls }),
    );
  } finally {
    progress(null);
  }
}

/** What filling one bar came to: whether the bar is whole now, how many trades arrived, and what stopped it. */
export interface BarFill {
  whole: boolean;
  trades: number;
  stopped: Stopped | null;
}

/**
 * Binance's trades for one bar the reader asked for, `from..to`, however old:
 * what no span covers, or all of it where not a minute of it is kept — a span
 * can say a stretch was recorded that a sleeping laptop never heard. `level` is
 * the price step to keep it at where the market has none yet, 0 to pick one.
 */
export async function fillRange(market: string, venue: 'binance-spot' | 'binance-perp', from: number, to: number, level: number, signal: AbortSignal, progress: (share: number) => void): Promise<BarFill> {
  const meta = await readMarket(market);
  const empty = (await readMinutes(market, Math.floor(from / MINUTE) * MINUTE, to - 1)).length === 0;
  const holes: Span[] = empty ? [[from, to]] : gaps(meta?.spans ?? [], from, to).reverse();
  let trades = 0;
  let left = 0;
  for (const [a, b] of holes) left += b - a;
  const of = left;
  const share = (more = 0) => progress(of > 0 ? Math.min(1, (of - left + more) / of) : 1);
  share();
  const stopped = await fill(
    market,
    venue,
    holes,
    signal,
    async (start, end, got) => {
      // A window with nothing in it is not marked recorded: Binance may only be without it today.
      if (got.length === 0) return;
      trades += got.length;
      await keep(market, start, end, got, level, true);
    },
    (ms) => {
      left -= ms;
      share();
    },
    // Within a window the pages go forward from its start: as far as the last trade reached.
    (start, at) => share(at - start),
  );
  return { whole: left <= 0, trades, stopped };
}

/**
 * `trades` of `from..to` kept: those no recording has yet, read afresh as they
 * are written, so two fills and the recorder never count a trade twice. `bare`
 * takes a minute with nothing kept too, whatever the spans say.
 */
function keep(market: string, from: number, to: number, trades: AggTrade[], hint: number, bare: boolean): Promise<MarketRecord> {
  return alone(market, async () => {
    const held = (await readMarket(market)) ?? { market, level: 0, spans: [] };
    const price = trades[0]?.price ?? 1;
    const level = held.level > 0 ? held.level : hint > 0 ? hint : levelFor(price, digitsFor(market, price));
    const open = gaps(held.spans, from, to);
    const kept = bare ? new Set((await readMinutes(market, Math.floor(from / MINUTE) * MINUTE, to - 1)).map(([at]) => at)) : null;
    const book = new MinuteBook(level, from);
    for (const t of trades) {
      if (open.some(([a, b]) => t.time >= a && t.time < b) || (kept && !kept.has(Math.floor(t.time / MINUTE) * MINUTE))) book.add(t.time, t.price, t.qty, t.buy);
    }
    await addMinutes(market, book.take(Number.POSITIVE_INFINITY));
    const next = { market, level, spans: cover(held.spans, from, to) };
    await writeMarket(next);
    return next;
  });
}

async function fill(
  market: string,
  venue: 'binance-spot' | 'binance-perp',
  holes: Span[],
  signal: AbortSignal,
  write: (from: number, to: number, trades: AggTrade[]) => Promise<void>,
  filled: (ms: number, back: number, calls: number) => void,
  step?: (start: number, at: number) => void,
): Promise<Stopped | null> {
  const symbol = parseMarket(market)?.symbol;
  if (!symbol) return null;
  const hosts = venue === 'binance-perp' ? ['https://fapi.binance.com/fapi/v1/aggTrades'] : ['https://api.binance.com/api/v3/aggTrades', 'https://data-api.binance.vision/api/v3/aggTrades'];
  let calls = BACKFILL_CALLS;
  /** Why the last call came back empty-handed, while no call since has answered. */
  let stopped: Stopped | null = null;
  /** One call, its turn taken: the venue's calls go one at a time, paced, from every tab of this browser. */
  const turn = <T>(call: () => Promise<T>): Promise<T> => {
    const run = async () => {
      await new Promise((resolve) => setTimeout(resolve, BACKFILL_PACE[venue]));
      return call();
    };
    return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(`tradoor-fill:${venue}`, { signal }, run) : run();
  };
  const ask = async (query: string): Promise<ReturnType<typeof readAggTrades> | null> => {
    for (const host of hosts) {
      if (calls <= 0 || signal.aborted) return null;
      calls -= 1;
      try {
        const name = new URL(host).host;
        const res = await turn((): Promise<Response | number> => {
          // A chart, or another fill, was told to wait: this one stops rather than spend what the charts need.
          const quiet = quietUntil(name);
          return quiet ? Promise.resolve(quiet) : fetch(`${host}?symbol=${symbol}&${query}&limit=1000`, { signal: AbortSignal.any([signal, AbortSignal.timeout(7_000)]) });
        });
        if (typeof res === 'number') {
          calls = 0;
          stopped = { why: 'throttled', retry: Math.max(res, Date.now() + 300_000) };
          return null;
        }
        if (res.ok) {
          stopped = null;
          return readAggTrades(await res.json());
        }
        // Throttled: no more for five minutes, half an hour once Binance bans the address (418) — asking during a ban lengthens it.
        if (res.status === 418 || res.status === 429) {
          calls = 0;
          stopped = { why: 'throttled', retry: Math.max(throttled(name, res.status), Date.now() + (res.status === 418 ? 1_800_000 : 300_000)) };
        } else stopped = { why: res.status === 403 || res.status === 451 ? 'refused' : 'unreachable', retry: Date.now() + RETRY_MS };
      } catch {
        // Unreachable from this network: the next host, or none.
        if (!signal.aborted) stopped = { why: 'unreachable', retry: Date.now() + RETRY_MS };
      }
    }
    return null;
  };
  for (const [from, to] of holes) {
    // An hour a window, the newest first: a window is as far as one start and end may span.
    for (let end = to; end > from && calls > 0 && !signal.aborted; end -= HOUR) {
      const start = Math.max(from, end - HOUR);
      const trades = [];
      let page = await ask(`startTime=${start}&endTime=${end - 1}`);
      while (page) {
        trades.push(...page.filter((t) => t.time < end));
        if (page.length > 0) step?.(start, Math.min(end, page[page.length - 1]!.time));
        if (page.length < 1000 || page[page.length - 1]!.time >= end) break;
        page = await ask(`fromId=${page[page.length - 1]!.id + 1}`);
      }
      if (trades.length === 0 && page === null) return stopped;
      // As far as the trades reach: a window too busy for the calls left is kept only so far.
      const reached = page === null ? (trades[trades.length - 1]?.time ?? start) + 1 : end;
      await write(start, reached, trades);
      filled(reached - start, start, 1 - calls / BACKFILL_CALLS);
      if (reached < end) return stopped;
    }
  }
  return null;
}
