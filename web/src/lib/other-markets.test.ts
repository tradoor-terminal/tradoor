/// <reference lib="deno.ns" />
import { assertEquals } from 'jsr:@std/assert@1';
import type { Product } from './api.ts';
import { readName, resolveOther } from './other-markets.ts';

const p = (market: string, base: string, quote: string): Product => {
  const [venue, symbol] = market.split(':') as [string, string];
  return { market, venue, symbol, base, quote, kind: venue.endsWith('perp') ? 'perp' : 'spot', priceDecimals: null, quoteVolume24h: null, lastPrice: null, changePct: null };
};

const LIST = [
  p('binance-perp:BTCUSDT', 'BTC', 'USDT'),
  p('binance-perp:1000PEPEUSDT', '1000PEPE', 'USDT'),
  p('bybit-perp:BTCUSDT', 'BTC', 'USDT'),
  p('bybit-perp:PEPE1000USDT', 'PEPE1000', 'USDT'),
  p('bybit-perp:ETHUSDT', 'ETH', 'USDT'),
  p('coinbase-spot:BTCUSD', 'BTC', 'USD'),
  p('coinbase-spot:BTCUSDC', 'BTC', 'USDC'),
  p('kraken-spot:BTCEUR', 'BTC', 'EUR'),
  p('hyperliquid-perp:BTCUSD', 'BTC', 'USD'),
  p('okx-spot:ETHUSDC', 'ETH', 'USDC'),
  p('okx-spot:ETHUSDT', 'ETH', 'USDT'),
];

Deno.test('a script names a market by its venue, and a symbol or coin after it', () => {
  assertEquals(readName('bybit-perp'), { venue: 'bybit-perp', symbol: null });
  assertEquals(readName('okx-spot:ETH'), { venue: 'okx-spot', symbol: 'ETH' });
  for (const bad of ['coinbase', 'index:BTC_D', 'nowhere-perp', 'bybit-perp:eth', '']) assertEquals(readName(bad), null, bad);
});

Deno.test('the chart’s coin on another exchange, in the chart’s quote first, then in dollars', () => {
  const chart = 'binance-perp:BTCUSDT';
  assertEquals(resolveOther('bybit-perp', chart, LIST), 'bybit-perp:BTCUSDT');
  assertEquals(resolveOther('coinbase-spot', chart, LIST), 'coinbase-spot:BTCUSD', 'USD before USDC');
  assertEquals(resolveOther('hyperliquid-perp', chart, LIST), 'hyperliquid-perp:BTCUSD');
  assertEquals(resolveOther('kraken-spot', chart, LIST), 'kraken-spot:BTCEUR', 'any quote rather than none');
  assertEquals(resolveOther('okx-perp', chart, LIST), null, 'not listed there');
  assertEquals(resolveOther('bybit-perp', 'binance-perp:1000PEPEUSDT', LIST), 'bybit-perp:PEPE1000USDT', 'the multiplier on either side');
  assertEquals(resolveOther('bybit-perp', 'binance-perp:BTCUSDT/bybit-perp:ETHUSDT', LIST), 'bybit-perp:BTCUSDT', 'a ratio reads its first market');
});

Deno.test('a coin named, or a market named in full', () => {
  const chart = 'binance-perp:BTCUSDT';
  assertEquals(resolveOther('okx-spot:ETH', chart, LIST), 'okx-spot:ETHUSDT', 'the chart quotes in USDT');
  assertEquals(resolveOther('okx-spot:ETH', 'coinbase-spot:BTCUSDC', LIST), 'okx-spot:ETHUSDC', 'and this one in USDC');
  assertEquals(resolveOther('okx-spot:ETHUSDC', chart, LIST), 'okx-spot:ETHUSDC');
  assertEquals(resolveOther('bybit-perp:PEPE', chart, LIST), 'bybit-perp:PEPE1000USDT');
});
