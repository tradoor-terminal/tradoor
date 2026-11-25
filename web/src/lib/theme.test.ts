/// <reference lib="deno.ns" />
import { assertEquals } from 'jsr:@std/assert@1';
import { candleStyles } from './theme.ts';

Deno.test('the candles as they always were send nothing; each part changed sends its own entry', () => {
  assertEquals(candleStyles({}), '');
  assertEquals(candleStyles({ candleBody: '0' }), 'price/body=,1,1');
  assertEquals(candleStyles({ candleWick: '0', wickUp: '#00ff00' }), 'price/wickUp=,1,1', 'wicks off, whatever their colour');
  assertEquals(candleStyles({ wickDown: '#ff0000' }), 'price/wickUp=,1;price/wickDown=#ff0000,1', 'an up wick in the body’s colour');
  assertEquals(candleStyles({ candleBorder: '1' }), 'price/borderUp=,1;price/borderDown=,1', 'borders in the body’s colours');
  assertEquals(candleStyles({ candleBorder: '1', borderUp: '#0000ff', candlePrev: '1' }), 'price/borderUp=#0000ff,1;price/borderDown=,1;price/prev=1');
});

Deno.test('the grid is off unless switched on, in the grid and borders’ colour unless given one', () => {
  assertEquals(candleStyles({ gridColor: '#ff0000' }), '');
  assertEquals(candleStyles({ grid: '1' }), 'chart/grid=,1');
  assertEquals(candleStyles({ grid: '1', gridColor: '#334433' }), 'chart/grid=#334433,1');
});
