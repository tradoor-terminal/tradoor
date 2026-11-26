/**
 * Minutes folded into footprint bars: pure arithmetic with no page in it, so the
 * footprint's own worker (fp-fold-worker.ts) can run it off the main thread too.
 */
import type { Footprint, Settings } from './footprint';

/** Rows a typical bar is sent at most when the chart fits them to its zoom:
 *  fine enough to split rows zoomed in, few enough to send every few seconds. */
const MAX_FINE_ROWS = 200;

/** A minute of footprint: when it started, and `[price, bought, sold]` at each level. */
export interface Minute {
  at: number;
  levels: [number, number, number][];
}

/**
 * Minutes folded into bars of `barMs` and grouped onto one price grid — the
 * same for every bar, so a level reads straight across the screen rather than
 * each bar keeping a grid of its own. `tick` is the minutes' own level; `by`,
 * how many of them a row joins, is worked out from the bars unless given.
 */
export function foldMinutes(minutes: readonly Minute[], tick: number, barMs: number, settings: Settings = { ticks: 0, unit: 'coins' }, by?: number): Footprint & { by: number } {
  const byBar = new Map<number, Map<number, [number, number]>>();
  // The delta as the bar went, minute by minute, and the most and least it reached.
  const swings = new Map<number, { delta: number; max: number; min: number }>();
  for (const minute of [...minutes].sort((a, b) => a.at - b.at)) {
    const at = Math.floor(minute.at / barMs) * barMs;
    let levels = byBar.get(at);
    if (!levels) {
      levels = new Map();
      byBar.set(at, levels);
    }
    let delta = 0;
    for (const [price, buy, sell] of minute.levels) {
      const step = Math.round(price / tick);
      const held = levels.get(step);
      if (held) {
        held[0] += buy;
        held[1] += sell;
      } else {
        levels.set(step, [buy, sell]);
      }
      delta += (buy - sell) * (settings.unit === 'usd' ? price : 1);
    }
    const swing = swings.get(at) ?? { delta: 0, max: 0, min: 0 };
    swing.delta += delta;
    swing.max = Math.max(swing.max, swing.delta);
    swing.min = Math.min(swing.min, swing.delta);
    swings.set(at, swing);
  }
  // One grouping for the lot, taken from a bar in the middle of the pack
  // rather than the wildest one: a single violent minute in the day would
  // otherwise set a grid so coarse that every quiet bar collapses into one row
  // and says nothing at all.
  const spans = [...byBar.values()]
    .map((levels) => {
      const steps = [...levels.keys()];
      return steps.length > 0 ? Math.max(...steps) - Math.min(...steps) + 1 : 0;
    })
    .sort((a, b) => a - b);
  const typical = spans.length > 0 ? spans[Math.floor(spans.length * 0.8)]! : 0;
  // A row size the reader set is theirs; left to fit, the chart joins these rows as it zooms out.
  const fitted = !(settings.ticks > 0);
  let grouped = by ?? (fitted ? 1 : Math.round(settings.ticks));
  while (by === undefined && fitted && typical / grouped > MAX_FINE_ROWS) grouped = coarser(grouped);
  return {
    grid: grouped * tick,
    fitted,
    by: grouped,
    bars: [...byBar.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([time, levels]) => ({ time, levels: group(levels, tick, grouped, settings), maxDelta: swings.get(time)?.max ?? 0, minDelta: swings.get(time)?.min ?? 0 })),
  };
}

/** Steps to prices, adding neighbouring levels together onto the shared grid. */
function group(levels: Map<number, [number, number]>, tick: number, by: number, settings: Settings): [number, number, number][] {
  const rounded = Math.round(by);
  const out = new Map<number, [number, number]>();
  for (const [step, [buy, sell]] of levels) {
    const key = Math.floor(step / rounded) * rounded;
    const held = out.get(key);
    if (held) {
      held[0] += buy;
      held[1] += sell;
    } else {
      out.set(key, [buy, sell]);
    }
  }
  return [...out.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, [buy, sell]]) => {
      const price = step * tick;
      // In dollars, a coin at this level is worth what it traded at here.
      const worth = settings.unit === 'usd' ? price : 1;
      return [price, buy * worth, sell * worth] as [number, number, number];
    });
}

/** The next grouping up: 1, 2, 5, 10, 20, 50, and so on. */
function coarser(by: number): number {
  const power = 10 ** Math.floor(Math.log10(by));
  const head = by / power;
  return (head < 2 ? 2 : head < 5 ? 5 : 10) * power;
}
