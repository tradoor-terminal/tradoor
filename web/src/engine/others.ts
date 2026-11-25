/**
 * The other markets a chart's Frost Scripts read — `cvd("bybit-perp")` and the
 * like — loaded the first time a script asks for one: found in the catalogue
 * (lib/other-markets), its history read as any chart's is and folded to the
 * chart's bars, its forming bar streamed. A script is given each market's bars
 * at the chart's times, NaN where that market had none; one the exchange does
 * not list stays NaN throughout, and draws nothing.
 */
import { listing } from '../lib/catalog-wire';
import { parseMarket } from '../lib/markets';
import { nativeOf } from '../lib/native';
import { resolveOther } from '../lib/other-markets';
import { emptyCols, openSeries, type CandleSeries, type Cols, type Series } from './history';
import { lacksUtcOf, marketInterval } from './intervals';
import type { OtherBars } from './formula';
import type { KlineMsg, StreamHub } from './streams';

/** What the chart's worker lends. */
export interface OtherHost {
  hub: StreamHub;
  base: string;
  interval: string;
  /** The stream the chart's forming bar is built from, and whether its bar groups several. */
  live: string;
  group: number;
  /** A series' bars folded to the chart's. */
  fold(c: Cols): Cols;
  /** Base bars a series needs for this many of the chart's. */
  need(series: CandleSeries, bars: number): number;
  /** Shorter klines combined into the chart's forming bar. */
  combiner(history: Cols): (k: KlineMsg) => KlineMsg | null;
  /** A market's bars came in or moved: run the scripts again when they can afford it. */
  due(): void;
}

interface Held {
  series?: Series;
  cols: Cols;
  /** Streamed bars newer than the history, by open time. */
  live: Map<number, KlineMsg>;
  /** Chart bars its history was asked to cover. */
  asked: number;
  off: (() => void)[];
}

export class OtherMarkets {
  /** By the name the script gives. */
  readonly held = new Map<string, Held>();

  constructor(
    private readonly chart: string,
    private readonly host: OtherHost,
  ) {}

  /** Markets scripts asked for, each loaded deep enough for `bars` of the chart's. */
  want(names: Iterable<string>, bars: number): void {
    for (const name of names) {
      if (this.held.has(name)) continue;
      const h: Held = { cols: emptyCols(), live: new Map(), asked: bars, off: [] };
      this.held.set(name, h);
      void this.load(name, h).catch(() => undefined);
    }
  }

  /** Only these are still read: the rest let go. */
  keep(names: ReadonlySet<string>): void {
    for (const [name, h] of this.held) {
      if (names.has(name)) continue;
      for (const off of h.off) off();
      this.held.delete(name);
    }
  }

  /** Every market held, its bars at `time`: six columns each, NaN where it had no bar. */
  columns(time: Float64Array): OtherBars {
    const n = time.length;
    const cols = new Float64Array(this.held.size * 6 * n).fill(Number.NaN);
    let at = 0;
    for (const h of this.held.values()) {
      // The chart widened: so does the history behind it.
      if (h.series && n > h.asked) void h.series.ensure(this.host.need(h.series, (h.asked = n))).catch(() => undefined);
      const c = h.cols;
      // Folded bars always carry their buyers, -1 where unknown.
      const from = [c.open, c.high, c.low, c.close, c.volume, c.buy];
      for (let i = 0, j = 0; i < n; i += 1) {
        const t = time[i]!;
        while (c.time[j]! < t) j += 1;
        if (c.time[j] === t) {
          for (let f = 0; f < 6; f += 1) cols[at + f * n + i] = from[f]![j]!;
          continue;
        }
        // Only the newest bar or two are streamed past the history.
        const k = h.live.get(t);
        if (k) [k.open, k.high, k.low, k.close, k.volume, k.closed ? (k.buy ?? -1) : -1].forEach((v, f) => (cols[at + f * n + i] = v));
      }
      at += 6 * n;
    }
    return { names: [...this.held.keys()].join('\n'), cols };
  }

  private async load(name: string, h: Held): Promise<void> {
    const market = resolveOther(name, this.chart, (await listing()).products);
    const ref = market && parseMarket(market);
    if (!ref) return;
    const host = this.host;
    const series = await openSeries(market, host.base, host.interval);
    const mine = () => this.held.get(name) === h;
    const refold = () => {
      h.cols = host.fold(series.cols);
      const last = h.cols.time[h.cols.time.length - 1]!;
      for (const t of h.live.keys()) if (t <= last) h.live.delete(t);
      host.due();
    };
    if (!mine()) return;
    h.series = series;
    h.off.push(series.subscribe(refold));
    await series.ensure(host.need(series, h.asked));
    const symbol = await nativeOf(market);
    if (!mine()) return;
    refold();
    const streamed = marketInterval(market, ref.venue, host.live);
    const combine = streamed !== host.live || host.group > 1 ? host.combiner(h.cols) : null;
    h.off.push(
      host.hub.subscribe(ref.venue, { kind: 'kline', symbol, interval: streamed, quiet: lacksUtcOf(market) }, {
        message: (msg) => {
          const k = msg.kind === 'kline' && (combine ? combine(msg) : msg);
          if (!k) return;
          h.live.set(k.openTime, k);
          // A bar closed: the exchange's own copy of it is asked for, as the chart's is.
          if (k.closed) void series.refreshTail().catch(() => undefined);
          host.due();
        },
        state: () => undefined,
      }),
    );
  }
}
