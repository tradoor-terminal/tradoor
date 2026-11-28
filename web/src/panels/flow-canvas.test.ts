/// <reference lib="deno.ns" />
/// <reference lib="dom" />
import { assertEquals } from 'jsr:@std/assert@1';
import { compact } from './flow-canvas.ts';

Deno.test('a size rounding up to the next band is written in it', () => {
  assertEquals(compact(999_960), '1.00M');
  assertEquals(compact(999_960_000), '1.00B');
  assertEquals(compact(-999_960), '-1.00M');
  assertEquals(compact(999.6), '1.0K');
  assertEquals(compact(9_999.96), '10K');
  assertEquals(compact(9_999_960), '10.0M');
  assertEquals(compact(99.996), '100');
});

Deno.test('sizes inside a band are written as before', () => {
  assertEquals(compact(0.0042), '0.0042');
  assertEquals(compact(12.5), '12.5');
  assertEquals(compact(3_400), '3.4K');
  assertEquals(compact(48_000), '48K');
  assertEquals(compact(1_250_000), '1.25M');
  assertEquals(compact(23_400_000), '23.4M');
  assertEquals(compact(0), '0');
});
