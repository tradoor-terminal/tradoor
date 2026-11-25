/// <reference lib="deno.ns" />
/**
 * The formula module reads its bars as seven columns, the buyers last
 * (crates/frost-script-wasm `fx_run`): what formula.ts writes. Run here on the
 * module as built, as `delta()` and `cvd()` read the seventh; and another
 * market's bars after them, six columns each, as engine/others gives them.
 */
import { assertEquals } from 'jsr:@std/assert@1';
import { labelOf, othersOf } from './formula-meta.ts';

interface Exports {
  memory: WebAssembly.Memory;
  fx_alloc(len: number): number;
  fx_free(ptr: number, len: number): void;
  fx_run(src: number, srcLen: number, inputs: number, inputsLen: number, bars: number, n: number, decimals: number, names: number, namesLen: number, others: number): number;
  fx_text_ptr(): number;
  fx_text_len(): number;
  fx_values_ptr(): number;
  fx_values_len(): number;
}

const { instance } = await WebAssembly.instantiate(await Deno.readFile(new URL('../wasm/frost-script/frost-script.wasm', import.meta.url)), {});
const x = instance.exports as unknown as Exports;

function run(src: string, columns: number[][], names = '', others: number[][] = []): { ok: boolean; text: string; values: number[] } {
  const n = columns[0]!.length;
  const bytes = new TextEncoder().encode(src);
  const named = new TextEncoder().encode(names);
  const sp = x.fx_alloc(bytes.length);
  const bp = x.fx_alloc(n * columns.length * 8);
  const np = x.fx_alloc(named.length);
  const op = x.fx_alloc(n * others.length * 8);
  new Uint8Array(x.memory.buffer, sp, bytes.length).set(bytes);
  new Float64Array(x.memory.buffer, bp, n * columns.length).set(columns.flat());
  new Uint8Array(x.memory.buffer, np, named.length).set(named);
  new Float64Array(x.memory.buffer, op, n * others.length).set(others.flat());
  const ok = x.fx_run(sp, bytes.length, 0, 0, bp, n, 2, np, named.length, op) === 1;
  const text = new TextDecoder().decode(new Uint8Array(x.memory.buffer, x.fx_text_ptr(), x.fx_text_len()));
  const values = [...new Float64Array(x.memory.buffer, x.fx_values_ptr(), x.fx_values_len())];
  x.fx_free(sp, bytes.length);
  x.fx_free(bp, n * columns.length * 8);
  x.fx_free(np, named.length);
  x.fx_free(op, n * others.length * 8);
  return { ok, text, values };
}

Deno.test('a script reads the buyers from the seventh column, and estimates where it says -1', () => {
  const time = [0, 1, 2, 3].map((i) => 1_700_000_000_000 + i * 3_600_000);
  const bars = [time, [100, 100, 100, 100], [110, 110, 110, 110], [90, 90, 90, 90], [100, 100, 100, 110], [10, 10, 10, 10], [7, 2, 8, -1]];
  const out = run('pane own\nplot(cvd(), "CVD")\nplot(delta(), "Delta")', bars);
  assertEquals(out.ok, true, out.text);
  // The last bar's buyers are not known: it closed at the top of its range, all bought.
  assertEquals(out.values.slice(0, 8), [4, -2, 4, 14, 4, -6, 6, 10]);
});

Deno.test('another market is asked for by name, then read from six columns after the bars', () => {
  const time = [0, 1, 2, 3].map((i) => 1_700_000_000_000 + i * 3_600_000);
  const bars = [time, [100, 100, 100, 100], [110, 110, 110, 110], [90, 90, 90, 90], [100, 100, 100, 100], [10, 10, 10, 10], [-1, -1, -1, -1]];
  const src = 'pane own\nplot(cvd("bybit-perp"), "C")\nplot(close("okx-spot:ETH"), "P")';
  const first = run(src, bars);
  const [wanted, read] = [new Set<string>(), new Set<string>()];
  othersOf(first.text, wanted, read);
  assertEquals([[...wanted], [...read]], [['bybit-perp', 'okx-spot:ETH'], []]);

  const nan = Number.NaN;
  // Bybit's bars, NaN where it had none; OKX's ETH not listed, all NaN.
  const bybit = [[50, 50, 50, nan], [60, 60, 60, nan], [40, 40, 40, nan], [50, 55, 45, nan], [2, 4, 6, nan], [2, -1, 1, nan]];
  const okx = Array.from({ length: 6 }, () => [nan, nan, nan, nan]);
  const second = run(src, bars, 'bybit-perp\nokx-spot:ETH', [...bybit, ...okx]);
  assertEquals(second.ok, true, second.text);
  wanted.clear();
  othersOf(second.text, wanted, read);
  assertEquals([[...wanted], [...read]], [[], ['bybit-perp', 'okx-spot:ETH']]);
  assertEquals(second.values.slice(0, 4), [2, 4, 0, 0]);
  assertEquals(second.values.slice(4, 8).every(Number.isNaN), true);
});

Deno.test('a script that names itself is named so in the legend, its author kept', () => {
  const src = 'input kind = "Perp" from "Perp", "Spot" "Markets"\ntitle("CVD · " + kind)\nplot(close, "C")';
  const time = [0, 1].map((i) => 1_700_000_000_000 + i * 3_600_000);
  const out = run(src, [time, [1, 1], [2, 2], [0, 0], [1, 1], [5, 5], [-1, -1]]);
  assertEquals(labelOf(out.text, 'Mine 14 · @tradoor'), 'CVD · Perp · @tradoor');
  assertEquals(labelOf('pane\t0\n', 'Mine 14'), 'Mine 14', 'one with no title keeps its name and settings');
});
