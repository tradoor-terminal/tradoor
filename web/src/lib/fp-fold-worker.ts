/**
 * A footprint chart's days of minutes, read and folded away from the page: the
 * download's JSON, megabytes of it, and the adding up held the page still for
 * a quarter to three quarters of a second as a chart of minutes opened, and
 * every time it read them again. The page hands over the requests and gets
 * back the bars (footprint.ts, `fetchFootprint`).
 */
import { foldMinutes, type Minute } from './fp-fold';
import type { Settings } from './footprint';
import { read } from './read';

export interface FoldAsk {
  id: number;
  paths: string[];
  headers: Record<string, string>;
  barMs: number;
  settings: Settings;
}

self.onmessage = async (e: MessageEvent<FoldAsk>) => {
  const { id, paths, headers, barMs, settings } = e.data;
  try {
    const answers = await Promise.all(
      paths.map(async (path) => {
        const res = await read(path, headers);
        const body = res.status < 400 ? ((await res.json().catch(() => null)) as { tick: number; bars: Minute[] } | null) : null;
        if (!body) throw new Error(`no footprint (${res.status})`);
        return body;
      }),
    );
    const tick = answers.find((a) => a.tick > 0)?.tick ?? 1;
    self.postMessage({ id, fp: foldMinutes(answers.flatMap((a) => a.bars), tick, barMs, settings) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
