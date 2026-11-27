/// <reference lib="deno.ns" />
import { assertEquals } from 'jsr:@std/assert@1';
import { formatTurnover, formatVolume } from './format.ts';

Deno.test('a figure rounding up to a thousand of its unit is written in the next', () => {
  assertEquals(formatTurnover(999_960), '1.0M');
  assertEquals(formatTurnover(999_960_000), '1.0B');
  assertEquals(formatTurnover(-999_960), '-1.0M');
  assertEquals(formatTurnover(999.6), '1K');
  assertEquals(formatVolume(999_999), '1.00M');
  assertEquals(formatVolume(999.996), '1.00K');
});

Deno.test('one rounding up into a band of fewer decimals is written in that band', () => {
  assertEquals(formatVolume(99.996), '100.0');
  assertEquals(formatVolume(99_999.996), '100.00K', 'a unit with one band keeps its decimals');
});

Deno.test('figures inside a band are written as before', () => {
  assertEquals(formatTurnover(27_400_000), '27.4M');
  assertEquals(formatTurnover(999_400), '999K');
  assertEquals(formatTurnover(1_234), '1K');
  assertEquals(formatTurnover(412), '412');
  assertEquals(formatVolume(112_350), '112.35K');
  assertEquals(formatVolume(1_200_000), '1.20M');
  assertEquals(formatVolume(845.3), '845.3');
});
