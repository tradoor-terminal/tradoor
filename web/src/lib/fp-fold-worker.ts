/**
 * A footprint chart's days of minutes, read and folded away from the page: the
 * download's JSON, megabytes of it, and the adding up held the page still for
 * a quarter to three quarters of a second as a chart of minutes opened, and
 * every time it read them again. The page hands over the requests and gets
 * back the bars (footprint.ts, `fetchFootprint`).
 *
 * The bytes go as they came into a module of Rust (crates/footprint-wasm),
 * which reads and folds them some five times faster than parsing the JSON
 * here and folding it in fp-fold.ts, with the same bars to the last digit;
 * where the module cannot load or fold, fp-fold.ts does it, as it did before.
 */
import foldUrl from '../wasm/footprint/footprint.wasm?url';
import { foldMinutes, type Minute } from './fp-fold';
import type { Footprint, Levels, Settings } from './footprint';
import { read } from './read';

/** The server's minutes, by the requests that read them; or a browser's own recordings, as numbers
 *  (fp-recorder.ts): a minute's time, its count of levels, then price, bought and sold a level. */
export type FoldAsk = { id: number; barMs: number; settings: Settings; by?: number } & ({ paths: string[]; headers: Record<string, string> } | { minutes: Float64Array; tick: number });

interface Fold {
  memory: WebAssembly.Memory;
  fp_clear(): void;
  fp_alloc(len: number): number;
  fp_free(ptr: number, len: number): void;
  fp_add(ptr: number, len: number): number;
  fp_add_minutes(ptr: number, count: number, tick: number): number;
  fp_fold(barMs: number, usd: number, ticks: number, by: number): number;
  fp_out(): number;
}

let module: Promise<Fold | null> | null = null;
const loaded = (): Promise<Fold | null> =>
  (module ??= WebAssembly.instantiateStreaming(fetch(foldUrl), {})
    .catch(async () => WebAssembly.instantiate(await (await fetch(foldUrl)).arrayBuffer(), {}))
    .then((m) => m.instance.exports as unknown as Fold)
    .catch(() => null));

/** The answers folded by the module: null where it cannot. Run whole, with no wait inside, so two asks never mix. */
function folded(x: Fold, given: Uint8Array[] | { minutes: Float64Array; tick: number }, barMs: number, settings: Settings, by = 0): (Footprint & { by: number }) | null {
  x.fp_clear();
  if ('minutes' in given) {
    const bytes = given.minutes.length * 8;
    const p = x.fp_alloc(bytes);
    new Float64Array(x.memory.buffer, p, given.minutes.length).set(given.minutes);
    const ok = x.fp_add_minutes(p, given.minutes.length, given.tick);
    x.fp_free(p, bytes);
    if (!ok) return null;
  }
  for (const bytes of 'minutes' in given ? [] : given) {
    const p = x.fp_alloc(bytes.length);
    new Uint8Array(x.memory.buffer, p, bytes.length).set(bytes);
    const tick = x.fp_add(p, bytes.length);
    x.fp_free(p, bytes.length);
    if (tick < 0) return null;
  }
  const n = x.fp_fold(barMs, settings.unit === 'usd' ? 1 : 0, settings.ticks, by);
  if (n < 0) return null;
  const f = new Float64Array(x.memory.buffer, x.fp_out(), n);
  const bars: Levels[] = [];
  for (let i = 4; i < n; ) {
    const rows = f[i + 1]!;
    const levels: [number, number, number][] = [];
    for (let r = 0, o = i + 4; r < rows; r++, o += 3) levels.push([f[o]!, f[o + 1]!, f[o + 2]!]);
    bars.push({ time: f[i]!, levels, maxDelta: f[i + 2]!, minDelta: f[i + 3]! });
    i += 4 + rows * 3;
  }
  const out = { grid: f[0]!, fitted: f[1] === 1, by: f[2]!, bars };
  x.fp_clear();
  return out;
}

/** Numbers as the minutes fp-fold.ts folds. */
function minutesOf(f: Float64Array): Minute[] {
  const out: Minute[] = [];
  for (let i = 0; i + 1 < f.length; ) {
    const n = f[i + 1]!;
    const levels: [number, number, number][] = [];
    for (let r = 0, o = i + 2; r < n; r++, o += 3) levels.push([f[o]!, f[o + 1]!, f[o + 2]!]);
    out.push({ at: f[i]!, levels });
    i += 2 + n * 3;
  }
  return out;
}

self.onmessage = async (e: MessageEvent<FoldAsk>) => {
  const ask = e.data;
  const { id, barMs, settings, by } = ask;
  try {
    if ('minutes' in ask) {
      const x = await loaded();
      const fp = (x && folded(x, ask, barMs, settings, by)) || foldMinutes(minutesOf(ask.minutes), ask.tick, barMs, settings, by);
      self.postMessage({ id, fp });
      return;
    }
    const answers = await Promise.all(
      ask.paths.map(async (path) => {
        const res = await read(path, ask.headers);
        if (res.status >= 400) throw new Error(`no footprint (${res.status})`);
        return new Uint8Array(await res.arrayBuffer());
      }),
    );
    const x = await loaded();
    let fp = x ? folded(x, answers, barMs, settings, by) : null;
    if (!fp) {
      const decoder = new TextDecoder();
      const parsed = answers.map((b) => JSON.parse(decoder.decode(b)) as { tick: number; bars: Minute[] });
      const tick = parsed.find((a) => a.tick > 0)?.tick ?? 1;
      fp = foldMinutes(parsed.flatMap((a) => a.bars), tick, barMs, settings);
    }
    self.postMessage({ id, fp });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
