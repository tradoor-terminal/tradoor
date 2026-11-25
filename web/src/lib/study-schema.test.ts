/// <reference lib="deno.ns" />
import { assertEquals } from 'jsr:@std/assert@1';
import type { StudyDefinition } from '../engine/protocol.ts';
import { anotherId, CATEGORIES, currentDefault, defaultId, entries, instanceLabel, LAYER_DEFS, paramOrder, paramUi, searchEntries, startingStyles, startingValues, studyId, studyPlots, toHex } from './study-schema.ts';

const param = (name: string, value: number, min = 1, max = 1000, step = 1) => ({ name, default: value, min, max, step });
const defs: StudyDefinition[] = [
  { kind: 'ema', short: 'EMA', group: 'price', params: [param('length', 50)] },
  { kind: 'vwap', short: 'VWAP', group: 'price', params: [param('anchor', 0, 0, 4), param('band1', 1, 0, 10, 0.1), param('band2', 0, 0, 10, 0.1), param('band3', 0, 0, 10, 0.1), param('source', 0, 0, 8), param('offset', 0, -500, 500), param('mode', 0, 0, 1), param('hide', 0, 0, 1), param('timeframe', 0, 0, 12), param('wait', 1, 0, 1)] },
  { kind: 'avwap', short: 'Multi-VWAP', group: 'price', params: [] },
  { kind: 'rsi', short: 'RSI', group: 'pct', params: [param('length', 14)] },
  { kind: 'macd', short: 'MACD', group: 'macd', params: [param('fast', 12), param('slow', 26), param('signal', 9)] },
];
const list = entries(defs);
const found = (q: string) => searchEntries(list, q).map((e) => e.id);

Deno.test('the list files every study and the layers built in', () => {
  assertEquals(list.map((e) => e.id), ['ema', 'vwap', 'avwap', 'rsi', 'macd', ...LAYER_DEFS.map((l) => l.id)]);
  assertEquals(list.every((e) => CATEGORIES.includes(e.category)), true);
  assertEquals(list.find((e) => e.id === 'rsi')?.where, 'own pane');
});

Deno.test('a search puts the closest match first', () => {
  assertEquals(found('rsi')[0], 'rsi');
  assertEquals(found('vwap').slice(0, 2), ['vwap', 'avwap'], 'the exact name before the one that holds it');
  assertEquals(found('VOLUME')[0], 'volume', 'the layer named that, before what only mentions it');
  assertEquals(found('volume').includes('vwap'), true, 'volume weighted');
  assertEquals(found('moving average').includes('ema'), true, 'by words in any order');
  assertEquals(found('ma').includes('ema'), true, 'by what a reader types');
  assertEquals(found('nothing like this'), []);
  assertEquals(found('').length, list.length);
});

Deno.test('a study’s first id is its defaults, and another takes a value not yet there', () => {
  assertEquals(defaultId(defs[0]!), 'ema:50');
  assertEquals(defaultId(defs[1]!), 'vwap:0:1:0:0');
  assertEquals(anotherId(defs[0]!, ['ema:50']), 'ema:200');
  assertEquals(anotherId(defs[0]!, ['ema:50', 'ema:200']), 'ema:20');
  assertEquals(anotherId(defs[1]!, ['vwap:0:1:0:0']), 'vwap:1:1:0:0', 'the next anchor');
  assertEquals(anotherId(defs[3]!, ['rsi:14']), 'rsi:28');
  assertEquals(anotherId(defs[2]!, ['avwap']), null, 'nothing to tell a second one apart by');
});

Deno.test('the inputs vwap gained are written only where set, as the engine writes its id', () => {
  const vwap = defs[1]!;
  assertEquals(studyId(vwap, [0, 1, 0, 0, 0, 0, 0, 0, 0, 1]), 'vwap:0:1:0:0', 'the id charts already hold');
  assertEquals(studyId(vwap, [1, 1, 2, 0, 4, -3, 1, 0, 6, 1]), 'vwap:1:1:2:0:4:-3:1:0:6');
  assertEquals(studyId(defs[4]!, [12, 26, 9]), 'macd:12:26:9', 'every other study writes them all');
  assertEquals(anotherId(vwap, ['vwap:0:1:0:0'], [0, 1, 0, 0, 4, 0, 0, 0, 0, 1]), 'vwap:1:1:0:0:4', 'another from the inputs it starts with');
  assertEquals(paramOrder('vwap', 10), [7, 0, 4, 5, 6, 1, 2, 3, 8, 9], 'hide on 1D first, then the anchor and source');
  assertEquals(paramOrder('vwap', 4), [0, 1, 2, 3], 'an engine from before has the first four');
  assertEquals(paramOrder('macd', 3), [0, 1, 2]);
});

Deno.test('what a new indicator paints besides lines has a row of its own', () => {
  const keys = (id: string) => studyPlots(id, []).map((p) => p.key);
  assertEquals(keys('sessions'), ['asia', 'london', 'ny']);
  assertEquals(keys('moon'), ['full', 'new']);
  assertEquals(keys('vpvr:24:70:30:0'), ['up', 'down', 'poc', 'va']);
  assertEquals(studyPlots('bb:20:2', [{ id: 'bb:20:2:upper', label: 'Upper', color: '#000', width: 1 }]).map((p) => p.key), ['upper', 'fill']);
  assertEquals(studyPlots('ichimoku:9:26:52:26', [{ id: 'ichimoku:9:26:52:26:leadA', label: 'Lead A', color: '#000', width: 1 }]).map((p) => [p.key, p.label]), [['leadA', 'Leading span A'], ['cloudUp', 'Cloud, A above B'], ['cloudDown', 'Cloud, A below B']]);
  assertEquals(studyPlots('volumedelta:0', [{ id: 'volumedelta:0:histogram', label: 'Delta', color: '#000', width: 1 }]).map((p) => p.key), ['histogram', 'histogramDown']);
  assertEquals(studyPlots('volumedelta:1', [{ id: 'volumedelta:1:cvd', label: 'CVD', color: '#000', width: 1 }]).map((p) => p.key), ['cvd'], 'a line has no second colour');
  // Levels the legend reads are not drawn as lines of their own: a width of 0.
  assertEquals(studyPlots('vpvr:24:70:30:0', [{ id: 'vpvr:24:70:30:0:poc', label: 'POC', color: '#000', width: 0 }]).map((p) => p.key), ['up', 'down', 'poc', 'va']);
});

Deno.test('a vwap lists its value area, shading and last period’s levels', () => {
  const line = (key: string) => ({ id: `vwap:0:1:0:0:${key}`, label: key, color: '#000', width: 1 });
  const plots = studyPlots('vwap:0:1:0:0', ['vwap', 'upper1', 'lower1', 'prevVah', 'prevVwap', 'prevVal'].map(line));
  assertEquals(plots.map((p) => [p.key, p.label]), [['vwap', 'vwap'], ['upper1', 'Value Area High'], ['lower1', 'Value Area Low'], ['fill1', 'Value area shading'], ['prevVah', 'Previous VAH'], ['prevVwap', 'Previous VWAP'], ['prevVal', 'Previous VAL']]);
  assertEquals(plots[0]!.pattern, '2', 'dotted unless changed');
  assertEquals(studyPlots('vwap:0:0:0:0', ['vwap', 'prevVwap'].map(line)).map((p) => p.key), ['vwap', 'prevVwap'], 'no band, no shading');
});

Deno.test('the picker says which one is on the chart', () => {
  assertEquals(instanceLabel('ema:50'), '50');
  assertEquals(instanceLabel('bb:20:2.5'), '20 2.5');
  assertEquals(instanceLabel('keylevels'), 'On chart');
  assertEquals(instanceLabel('fx-tradoor.cvdaggregated:1:0:0:1'), 'On chart', 'a script’s settings, not read in a row');
  assertEquals(instanceLabel('vwap:0:1:0:0'), 'On chart');
  assertEquals(instanceLabel('vpvr:24:70:30:0'), 'On chart');
  assertEquals(instanceLabel('keltner:20:2:10'), '20 2 10');
});

Deno.test('the engine’s colours read back as the colour field’s', () => {
  assertEquals(toHex('rgba(127,178,255,1.000)'), '#7fb2ff');
  assertEquals(toHex('rgba(255,0,0,0.502)'), '#ff000080');
  assertEquals(toHex('#123456'), '#123456');
});

Deno.test('the style tab lists what a study draws, and what only carries values it does not', () => {
  const line = (key: string, width: number) => ({ id: `oi:255:0:0:${key}`, label: key, color: 'rgba(0,0,0,1.000)', width });
  const keys = (id: string, lines: ReturnType<typeof line>[]) => studyPlots(id, lines).map((p) => p.key);
  assertEquals(keys('oi:255:0:0', [line('open', 0), line('close', 0)]), ['up', 'down'], 'candles: their colours');
  assertEquals(studyPlots('oi:255:0:1', [{ id: 'oi:255:0:1:close', label: 'OI', color: '#f0b90b', width: 1.5 }]).map((p) => p.key), ['close'], 'a line: its stroke');
  assertEquals(studyPlots('keylevels', [{ id: 'keylevels:wo', label: 'WO', color: '#fffcbc', width: 0 }]).map((p) => [p.key, p.label, p.width]), [['wo', 'Weekly open', 1]], 'levels draw as segments');
  assertEquals(studyPlots('macd:12:26:9', [{ id: 'macd:12:26:9:histogram', label: 'Histogram', color: '#000', width: 1 }, { id: 'macd:12:26:9:macd', label: 'MACD', color: '#000', width: 1 }]).map((p) => p.key), ['histogram', 'histogramDown', 'macd']);
  assertEquals(studyPlots('rsi:14', [{ id: 'rsi:14:rsi', label: 'RSI 14', color: '#000', width: 1 }]).at(-1)?.owner, 'pct', 'the guides are the pane’s');
});

Deno.test('saved inputs are started with where the study still takes them', () => {
  const def = { params: [param('length', 14), param('smooth', 3, 1, 10)] };
  assertEquals(startingValues(def, null), [14, 3], 'none saved: its usual ones');
  assertEquals(startingValues(def, { params: [21, 5], styles: {} }), [21, 5]);
  assertEquals(startingValues(def, { params: [21, 50], styles: {} }), [21, 3], 'out of range now, as a script changed since might be');
  assertEquals(startingValues({ params: [...def.params, param('signal', 9)] }, { params: [21], styles: {} }), [21, 3, 9], 'an input added since keeps its default');
});

Deno.test('a study saved as the default keeps its own styles by kind and the pane’s by owner', () => {
  const styles = { 'rsi:21/rsi': '#ff0000,2,', 'pct/upper': '70', 'ema:50/ema': '#00ff00,,', 'rsi:14/rsi': '#0000ff,,' };
  const saved = currentDefault('rsi', 'rsi:21', [21], styles, ['pct']);
  assertEquals(saved, { params: [21], styles: { 'rsi/rsi': '#ff0000,2,', 'pct/upper': '70' } }, 'another study’s and another RSI’s are not this one’s');
  // Added as rsi:21 to a chart whose pane has a lower guide of its own and an upper one: the saved upper does not move it.
  const chart = { 'pct/upper': '75', 'ema:50/ema': '#00ff00,,' };
  assertEquals(startingStyles(chart, 'rsi', 'rsi:21', saved), { 'pct/upper': '75', 'ema:50/ema': '#00ff00,,', 'rsi:21/rsi': '#ff0000,2,' });
  assertEquals(startingStyles({}, 'rsi', 'rsi:21', saved), { 'pct/upper': '70', 'rsi:21/rsi': '#ff0000,2,' });
  assertEquals(startingStyles(chart, 'rsi', 'rsi:21', null), chart);
});

Deno.test('cvd is filed with the flow studies, lists its plots by display, and saves as a default', () => {
  const cvd: StudyDefinition = { kind: 'cvd', short: 'CVD', group: 'cvd', params: [param('reset', 0, 0, 5), param('view', 0, 0, 1), param('smooth', 0, 0, 1000)] };
  const entry = entries([cvd])[0]!;
  assertEquals([entry.name, entry.category, entry.where], ['Cumulative Volume Delta', 'Flow and positioning', 'own pane']);
  assertEquals(searchEntries(entries([...defs, cvd]), 'cvd')[0]?.id, 'cvd');
  assertEquals(defaultId(cvd), 'cvd:0:0:0');
  assertEquals(anotherId(cvd, ['cvd:0:0:0']), 'cvd:1:0:0', 'one that starts again each session');
  assertEquals(instanceLabel('cvd:2:1:20'), 'On chart');
  assertEquals(paramUi('cvd', cvd.params[0]!).options?.[5], 'Quarter');
  assertEquals(paramUi('cvd', cvd.params[1]!).options, ['Line', 'Candles']);

  const line = (id: string, key: string, width: number) => ({ id: `${id}:${key}`, label: key, color: '#2962ff', width });
  const keys = (id: string, lines: ReturnType<typeof line>[]) => studyPlots(id, lines).map((p) => [p.key, p.label]);
  assertEquals(keys('cvd:0:0:20', [line('cvd:0:0:20', 'cvd', 1.5), line('cvd:0:0:20', 'ema', 1)]), [['cvd', 'CVD'], ['ema', 'EMA of CVD'], ['zero', 'Zero line']]);
  const candles = 'cvd:0:1:0';
  assertEquals(keys(candles, ['open', 'high', 'low', 'cvd'].map((k) => line(candles, k, 0))), [['up', 'Rising'], ['down', 'Falling'], ['zero', 'Zero line']], 'candles: their colours, the line unstroked');
  const zero = studyPlots('cvd:0:0:0', [])[0]!;
  assertEquals([zero.theme, zero.pattern, zero.noToggle], ['text', '1', undefined], 'dashed, and can be hidden');

  const styles = { 'cvd:1:1:9/up': '#00ff00,,', 'cvd:1:1:9/zero': ',2,0', 'cvd:0:0:0/cvd': '#ff0000,,' };
  const saved = currentDefault('cvd', 'cvd:1:1:9', [1, 1, 9], styles, []);
  assertEquals(saved, { params: [1, 1, 9], styles: { 'cvd/up': '#00ff00,,', 'cvd/zero': ',2,0' } });
  assertEquals(startingValues(cvd, saved), [1, 1, 9]);
  assertEquals(startingStyles({}, 'cvd', 'cvd:1:1:9', saved), { 'cvd:1:1:9/up': '#00ff00,,', 'cvd:1:1:9/zero': ',2,0' });
});

Deno.test('another of a Frost Script sets its first setting that can be otherwise', () => {
  const fx = {
    kind: 'fx-tradoor.cvdaggregated',
    short: 'CVD Aggregated',
    group: 'formula',
    params: [
      { name: 'kind', default: 0, min: 0, max: 2, step: 1, kind: 'choice' as const, options: ['Perp', 'Spot', 'Both'] },
      { name: 'binance', default: 1, min: 0, max: 1, step: 1, kind: 'bool' as const },
      { name: 'height', default: 30, min: 10, max: 80, step: 1, kind: 'number' as const },
    ],
  };
  assertEquals(anotherId(fx, ['fx-tradoor.cvdaggregated']), 'fx-tradoor.cvdaggregated:1:1:30', 'spot beside the perpetuals');
  assertEquals(anotherId(fx, ['fx-tradoor.cvdaggregated', 'fx-tradoor.cvdaggregated:1:1:30']), 'fx-tradoor.cvdaggregated:2:1:30');
  const colour = { ...fx, params: [{ name: 'c', default: 255, min: 0, max: 4_294_967_295, step: 1, kind: 'colour' as const }] };
  assertEquals(anotherId(colour, ['fx-x']), null, 'a colour alone tells none apart');
});
