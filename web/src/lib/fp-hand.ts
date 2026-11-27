/**
 * Footprint filled by hand: a bar the reader right-clicked, asked of Binance
 * and kept in this browser; and, for a market the server records, those bars
 * laid where the server has none. In the footprint's chunk with the recorder.
 */
import { createSignal, onCleanup } from 'solid-js';
import type { Levels, Settings } from './footprint';
import { fillBar, onRecorded, recordedFootprint } from './fp-recorder';
import { recorderSettings } from './fp-settings';
import { formatClock } from './timezone';
import { tl } from './i18n';

/** One chart's fills. Made inside the chart, whose end stops them. */
export function handFills() {
  const [filling, setFilling] = createSignal<{ market: string; time: number; calls: number } | null>(null);
  const [error, setError] = createSignal<{ text: string } | null>(null);
  /** Bars a fill brought only part of, by market and time: offered again. */
  const partial = new Set<string>();
  const stop = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    stop.abort();
    clearTimeout(timer);
  });
  /** Said small over the chart for three seconds, then faded. */
  const fail = (text: string) => {
    clearTimeout(timer);
    setError({ text: tl(text) });
    timer = setTimeout(() => setError(null), 3_400);
  };
  return {
    error,
    /** Whether a bar may be filled: it has no cells among `bars`, or a fill brought only part of it. */
    offers(market: string, time: number, bars: readonly Levels[]): boolean {
      const i = lowerBound(bars, time);
      return !(bars[i]?.time === time && bars[i]!.levels.length > 0) || partial.has(`${market}|${time}`);
    },
    /** What the legend says while `market`'s bar is being filled. */
    note(market: string) {
      const now = filling();
      if (now?.market !== market) return null;
      return { text: `filling the ${formatClock(now.time).slice(0, 5)} bar from Binance…${now.calls > 1 ? ` ${now.calls} calls` : ''}`, tip: "The bar's trades from Binance's trade history, kept in this browser", progress: 'busy' as const };
    },
    async fill(market: string, time: number, barMs: number, tick: number): Promise<void> {
      if (filling()) return fail('A bar is being filled already');
      setError(null);
      setFilling({ market, time, calls: 0 });
      const failed = await fillBar(market, time, time + barMs, tick, stop.signal, (calls) => setFilling({ market, time, calls }));
      if (stop.signal.aborted) return;
      setFilling(null);
      if (failed?.more) partial.add(`${market}|${time}`);
      else partial.delete(`${market}|${time}`);
      if (failed) fail(failed.why);
    },
  };
}

/** The first of `bars` (sorted by time) at or after `time`. */
function lowerBound(bars: readonly Levels[], time: number): number {
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid]!.time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * A server market's bars filled by hand, laid where the server has nothing.
 * `tick` is the server's price step; `changed` hears when there are more to lay.
 */
export function filledOver(market: string, barMs: number, settings: Settings, tick: number, changed: () => void) {
  let own: Levels[] = [];
  /** The rows' grid `own` is folded onto: another one folds them again. */
  let grid = 0;
  let stopped = false;
  const load = async () => {
    const on = grid;
    if (!(tick > 0) || !(on > 0)) return;
    const fp = await recordedFootprint(market, barMs, Date.now() - recorderSettings().days * 86_400_000, settings, Math.max(1, Math.round(on / tick))).catch(() => null);
    if (stopped || on !== grid || !fp || Math.abs(fp.grid - on) > on * 1e-6) return;
    own = fp.bars;
    changed();
  };
  const off = onRecorded(market, () => void load());
  return {
    over(bars: Levels[], on: number): Levels[] {
      if (on !== grid) {
        grid = on;
        own = [];
        void load();
      }
      // A few bars filled by hand among days of them: each looked up, the lot copied only when one goes in.
      let out: Levels[] | null = null;
      for (const mine of own) {
        const list = out ?? bars;
        const i = lowerBound(list, mine.time);
        const there = list[i]?.time === mine.time ? list[i]! : null;
        if (there && there.levels.length > 0) continue;
        out ??= bars.slice();
        out.splice(i, there ? 1 : 0, mine);
      }
      return out ?? bars;
    },
    stop() {
      stopped = true;
      off();
    },
  };
}
