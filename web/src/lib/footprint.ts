/**
 * Volume by price, as the server recorded it, folded into the bars on screen.
 *
 * The server keeps one minute at a time at the finest level it can — a dollar
 * on BTC, a tenth on ETH. A chart showing five-minute bars wants five of those
 * minutes added together, and a chart zoomed out wants the levels added too:
 * forty rows in a bar three pixels wide is a smudge, not a reading. Both are
 * sums, which is why the fine grain is what is stored — and why the rows are
 * sent fine and the chart joins them as it zooms out.
 */
import { api } from './api';
import { foldMinutes, type Minute } from './fp-fold';
import { authHeaders } from './owner';

export { foldMinutes, type Minute };

/** A bar's levels — price, coins bought, coins sold, lowest price first — and
 *  the most and least its delta reached from the open, at each minute's close. */
export interface Levels {
  time: number;
  levels: [number, number, number][];
  maxDelta: number;
  minDelta: number;
}

/** The bars in a range, and the price one row of them covers. */
export interface Footprint {
  bars: Levels[];
  /** The same for every bar: a row must read straight across the screen. */
  grid: number;
  /** Whether the chart may join rows as it zooms out: the reader set no row size. */
  fitted: boolean;
}

/** What the reader chose: how many ticks a row covers, and in what unit. */
export interface Settings {
  /** Ticks a row covers, or 0 to fit the rows to the bar. */
  ticks: number;
  /** `coins` as the exchange counts them, or `usd` at the level's own price. */
  unit: 'coins' | 'usd';
}

/** The markets this server records, asked for once. */
let recorded: Promise<Map<string, number>> | null = null;
export function recordedMarkets(): Promise<Map<string, number>> {
  recorded ??= api
    .footprintMarkets()
    .then((r) => new Map(r.markets.map((m) => [m.market, m.tick])))
    .catch(() => new Map<string, number>());
  return recorded;
}

/** Bars of an hour or more that divide a day are added up by the server from
 *  the hours it keeps for good — months of them, where minutes go after one. */
export const fromHours = (barMs: number): boolean => barMs >= 3_600_000 && barMs % 3_600_000 === 0 && 86_400_000 % barMs === 0;

/** Minutes one request may carry; a longer range is asked for in pages. */
const PAGE_MINUTES = 1_440;
/** Pages one fetch will ask for: a week of minutes, which is plenty of screen. */
const MAX_PAGES = 7;

/**
 * The minutes between `from` and `to`, folded into bars of `barMs` and grouped
 * onto one price grid — the same for every bar, so a level reads straight
 * across the screen rather than each bar keeping a grid of its own.
 *
 * The server hands out a day of minutes at a time, so a longer range is asked
 * for in pages: a chart of fifteen-minute bars covers a day in a screenful.
 */
export async function fetchFootprint(market: string, barMs: number, from: number, to: number, settings: Settings = { ticks: 0, unit: 'coins' }, maxPages = MAX_PAGES): Promise<Footprint> {
  // The server's answer is the footprint as the chart takes it.
  if (fromHours(barMs)) return api.footprintHistory(market, from, to, barMs, settings.unit, settings.ticks);
  const spans: [number, number][] = [];
  const page = PAGE_MINUTES * 60_000;
  for (let start = Math.max(from, to - maxPages * page); start < to; start += page) spans.push([start, Math.min(start + page - 1, to)]);
  // Read and folded in a worker of its own, so the page does not stop for it; here only where none can start.
  const paths = spans.map(([a, b]) => `/api/footprint?market=${encodeURIComponent(market)}&from=${Math.round(a)}&to=${Math.round(b)}`);
  const off = foldAway({ paths }, barMs, settings);
  if (off) {
    try {
      return await off;
    } catch (e) {
      if (e !== WORKER_DOWN) throw e;
    }
  }
  const answers = await Promise.all(spans.map(([a, b]) => api.footprint(market, a, b)));
  const tick = answers.find((a) => a.tick > 0)?.tick ?? 1;
  return foldMinutes(answers.flatMap((a) => a.bars), tick, barMs, settings);
}

/** The folding worker, started with the first chart of minutes; null where it cannot run. */
let folder: Worker | null | undefined;
let asked = 0;
const waiting = new Map<number, { done: (fp: Footprint) => void; failed: (e: unknown) => void }>();
const WORKER_DOWN = new Error('the footprint worker did not start');

/**
 * A browser's own recorded minutes folded in the same worker: `minutes` as its numbers say
 * (fp-fold-worker.ts), handed over, not copied. Null where no worker can run: the page folds them.
 */
export function foldRecorded(minutes: Float64Array<ArrayBuffer>, tick: number, barMs: number, settings: Settings, by?: number): Promise<Footprint & { by: number }> | null {
  return foldAway({ minutes, tick, by }, barMs, settings, [minutes.buffer]) as Promise<Footprint & { by: number }> | null;
}

function foldAway(what: { paths: string[]; headers?: never } | { minutes: Float64Array; tick: number; by?: number }, barMs: number, settings: Settings, transfer: Transferable[] = []): Promise<Footprint> | null {
  if (folder === undefined) {
    try {
      folder = new Worker(new URL('./fp-fold-worker.ts', import.meta.url), { type: 'module', name: 'tradoor-footprint' });
      folder.onmessage = (e: MessageEvent<{ id: number; fp?: Footprint; error?: string }>) => {
        const w = waiting.get(e.data.id);
        waiting.delete(e.data.id);
        if (e.data.fp) w?.done(e.data.fp);
        else w?.failed(new Error(e.data.error ?? 'no footprint'));
      };
      // A worker that cannot load leaves the page to do it, as it did before.
      folder.onerror = () => {
        folder?.terminate();
        folder = null;
        for (const w of waiting.values()) w.failed(WORKER_DOWN);
        waiting.clear();
      };
    } catch {
      folder = null;
    }
  }
  if (!folder) return null;
  const id = ++asked;
  const worker = folder;
  return new Promise((done, failed) => {
    waiting.set(id, { done, failed });
    worker.postMessage({ id, ...what, ...('paths' in what ? { headers: authHeaders() } : {}), barMs, settings }, transfer);
  });
}

/** How late past its last minute the server has a bar: it writes finished minutes down this often. */
const WRITTEN_WITHIN_MS = 10_000;

/**
 * Bars seen trade by trade, laid over the server's. The bar under way is the
 * browser's own, and so is one that has just closed until the server has all of
 * it: it writes a finished minute down every few seconds and is asked now and
 * then, and a chart of minutes would lose each bar for that long as it closed.
 */
export class SeenBars {
  private forming: Levels | null = null;
  private closed = new Map<number, Levels>();

  constructor(private readonly barMs: number) {}

  /** `shown` with these over it, `bar` being the one forming at `start`, if there is any of it yet. */
  over(shown: readonly Levels[], bar: Levels | undefined, start: number): Levels[] {
    if (this.forming && this.forming.time < start) {
      this.closed.set(this.forming.time, this.forming);
      this.forming = null;
    }
    if (bar) this.forming = bar;
    const own = new Map(this.closed);
    if (this.forming) own.set(this.forming.time, this.forming);
    return [...shown.filter((b) => !own.has(b.time)), ...own.values()].sort((a, b) => a.time - b.time);
  }

  /** The server's bars, in an answer asked for at `asked`: those it had all of are its own from now on. */
  answered(bars: readonly Levels[], asked: number): void {
    for (const { time } of bars) {
      if (asked >= time + this.barMs + WRITTEN_WITHIN_MS) this.closed.delete(time);
    }
  }
}

/** The flat array the engine reads: per bar, its time, its row count, the most
 *  and least its delta reached, its rows. */
export function flatten(bars: Levels[]): Float64Array {
  // A bar unchanged since the last time is the same object: its part is kept, and only the bar
  // under way is written afresh. Days of bars twice a second held the page up otherwise.
  const parts = bars.map((bar) => {
    let part = flatParts.get(bar);
    if (!part) {
      part = new Float64Array(4 + 3 * bar.levels.length);
      part.set([bar.time, bar.levels.length, bar.maxDelta, bar.minDelta]);
      let i = 4;
      for (const [price, buy, sell] of bar.levels) {
        part[i++] = price;
        part[i++] = buy;
        part[i++] = sell;
      }
      flatParts.set(bar, part);
    }
    return part;
  });
  const flat = new Float64Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    flat.set(part, at);
    at += part.length;
  }
  return flat;
}

/** Each bar's part of `flatten`, for as long as the bar is held. */
const flatParts = new WeakMap<Levels, Float64Array>();
