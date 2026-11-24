/// <reference lib="deno.ns" />
/**
 * The formula module reads its bars as seven columns, the buyers last
 * (crates/frost-script-wasm `fx_run`): what formula.ts writes. Run here on the
 * module as built, as `delta()` and `cvd()` read the seventh.
 */
import { assertEquals } from 'jsr:@std/assert@1';

interface Exports {
  memory: WebAssembly.Memory;
  fx_alloc(len: number): number;
  fx_free(ptr: number, len: number): void;
  fx_run(src: number, srcLen: number, inputs: number, inputsLen: number, bars: number, n: number, decimals: number): number;
  fx_text_ptr(): number;
  fx_text_len(): number;
  fx_values_ptr(): number;
  fx_values_len(): number;
}

const { instance } = await WebAssembly.instantiate(await Deno.readFile(new URL('../wasm/frost-script/frost-script.wasm', import.meta.url)), {});
const x = instance.exports as unknown as Exports;

function run(src: string, columns: number[][]): { ok: boolean; text: string; values: number[] } {
  const n = columns[0]!.length;
  const bytes = new TextEncoder().encode(src);
  const sp = x.fx_alloc(bytes.length);
  const bp = x.fx_alloc(n * columns.length * 8);
  new Uint8Array(x.memory.buffer, sp, bytes.length).set(bytes);
  new Float64Array(x.memory.buffer, bp, n * columns.length).set(columns.flat());
  const ok = x.fx_run(sp, bytes.length, 0, 0, bp, n, 2) === 1;
  const text = new TextDecoder().decode(new Uint8Array(x.memory.buffer, x.fx_text_ptr(), x.fx_text_len()));
  const values = [...new Float64Array(x.memory.buffer, x.fx_values_ptr(), x.fx_values_len())];
  x.fx_free(sp, bytes.length);
  x.fx_free(bp, n * columns.length * 8);
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
