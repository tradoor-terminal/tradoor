/**
 * The indicators as a reader meets them: what each is called, where the picker
 * files it, and how its settings ask for its inputs and styles. Loaded with the
 * picker and the settings dialog; the engine's own list (tradoor-core studies)
 * holds only what it computes with.
 */
import { OI_VENUES } from '../engine/open-interest';
import type { StudyDefinition, StudyLine, StudyParam } from '../engine/protocol';
import { readStyles, type StudyStyles } from './study-style';

export const CATEGORIES = ['Frost Script', 'Trend and averages', 'VWAP', 'Momentum', 'Volatility', 'Levels and structure', 'Flow and positioning', 'Time and cycles', 'Built in'] as const;
export type Category = (typeof CATEGORIES)[number];

interface Described {
  name: string;
  about: string;
  category: Category;
  /** What else a reader might type to find it. */
  keywords: string;
}

const STUDIES: Record<string, Described> = {
  ema: { name: 'Exponential Moving Average', category: 'Trend and averages', keywords: 'ma moving', about: 'Average close, weighted towards recent bars.' },
  sma: { name: 'Simple Moving Average', category: 'Trend and averages', keywords: 'ma moving', about: 'Plain average of the last N closes: every bar in the window counts the same.' },
  ichimoku: { name: 'Ichimoku Cloud', category: 'Trend and averages', keywords: 'kumo tenkan kijun senkou chikou', about: 'Conversion and base lines at the bar, a cloud between two spans carried ahead of it, and price carried behind it.' },
  vwap: { name: 'Volume Weighted Average Price', category: 'VWAP', keywords: 'session bands deviation value area vah val anchored monthly', about: 'Average price paid since the session, week, month, quarter or year opened, each trade weighted by its size. The first band is the value area, about two thirds of the volume, and last period’s VWAP and value area are labelled at the right. Sessions are UTC days.' },
  vwaplevels: { name: 'VWAP Levels', category: 'VWAP', keywords: 'levels only labels vah val value area weekly monthly quarterly yearly previous pwvah pmval', about: 'The VWAP and value area of the week, month, quarter and year, and of the last of each, as labels at the right edge with no lines: pmVAH is last month’s value area high. Worked out from hourly bars for the day, week and month and daily bars for the quarter and year, so a minute chart has the year’s too.' },
  avwap: { name: 'Anchored VWAP (S/W/M/Y)', category: 'VWAP', keywords: 'multi session weekly monthly yearly', about: 'Volume-weighted average price since the session, week, month and year opened. The session line is drawn on intraday charts only.' },
  rsi: { name: 'Relative Strength Index', category: 'Momentum', keywords: 'oscillator overbought oversold', about: 'Momentum bounded 0–100. Wilder smoothing, so the values match TradingView exactly.' },
  stochrsi: { name: 'Stochastic RSI', category: 'Momentum', keywords: 'oscillator overbought oversold', about: 'Where RSI sits inside its own recent range. Turns earlier than RSI, and whipsaws more.' },
  macd: { name: 'MACD', category: 'Momentum', keywords: 'moving average convergence divergence histogram oscillator', about: 'The gap between two EMAs, and an EMA of that gap. The histogram is the difference between them.' },
  bb: { name: 'Bollinger Bands', category: 'Volatility', keywords: 'deviation squeeze', about: 'An SMA with a band at N standard deviations, shaded between them. Narrow bands mark the quiet before an expansion.' },
  keltner: { name: 'Keltner Channels', category: 'Volatility', keywords: 'kc atr bands channel squeeze', about: 'An EMA with a band at a multiple of ATR, shaded between them. Smoother than Bollinger Bands, as it follows range rather than closes.' },
  atr: { name: 'Average True Range', category: 'Volatility', keywords: 'stop distance', about: 'Average range of a bar, in the instrument’s own price units. A stop distance, not a direction.' },
  keylevels: { name: 'Historical Key Levels', category: 'Levels and structure', keywords: 'weekly monthly yearly open monday high low', about: 'Weekly, monthly and yearly opens plus Monday’s high and low: the prices the week is measured against.' },
  vpvr: { name: 'Volume Profile, Visible Range', category: 'Levels and structure', keywords: 'vp vrvp vpvr poc value area vah val', about: 'Volume by price over the bars on screen, split by whether each bar closed up or down, with its point of control and value area. It redraws as you scroll. Each bar’s volume is spread evenly over its range, so the levels are zones.' },
  swingmap: { name: 'Range Swing Structure Map', category: 'Levels and structure', keywords: 'pivot zigzag hh hl lh ll market structure', about: 'Zigzag of confirmed pivots tagged HH/HL/LH/LL, with each leg’s move and duration, and the averages across the window.' },
  flow: { name: 'Net Taker Flow Marks', category: 'Flow and positioning', keywords: 'delta orderflow buyers sellers', about: 'Minutes whose net taker flow ran hard one way, marked where they traded, the dot larger the harder it ran. What counts as hard is the size set per market in the Flow panel, and the server keeps two days of them.' },
  volumedelta: { name: 'Volume Delta', category: 'Flow and positioning', keywords: 'cvd cumulative taker buyers sellers orderflow', about: 'What market buyers took less what market sellers did, in coins, bar by bar or added up. Exact where the exchange reports its buyers, as Binance does. Any other bar is estimated from where it closed in its range, and the legend says how many are.' },
  cvd: { name: 'Cumulative Volume Delta', category: 'Flow and positioning', keywords: 'cvd delta cumulative taker buyers sellers orderflow divergence', about: 'What market buyers took less what market sellers did, added up bar by bar in a pane of its own, as a line or as candles of each bar’s move. It can start again from zero each session, week, month, quarter or year, and carry an EMA of itself. Exact where the exchange reports its buyers, as Binance does; elsewhere, and on the forming bar until it closes, each bar is estimated from where it closed in its range, and the legend says which.' },
  oi: { name: 'Aggregated Open Interest', category: 'Flow and positioning', keywords: 'oi positioning derivatives perpetuals', about: 'Open interest summed across Binance, Bybit, OKX, Deribit and Hyperliquid perpetuals, stablecoin- and coin-margined. Recorded by the tradoor server.' },
  sessions: { name: 'Trading Sessions', category: 'Time and cycles', keywords: 'asia london new york ny killzone range', about: 'Each day’s Asia, London and New York sessions boxed from high to low, with London and New York following their summer time. Needs bars of an hour or less.' },
  moon: { name: 'Moon Phases', category: 'Time and cycles', keywords: 'full new lunar', about: 'A disc over the bar a full moon falls in, a ring under the bar a new moon does.' },
};

/** One number an owner takes, kept in its styles rather than in its id. */
export interface NumberInput {
  /** Whose it is, where not the study's or layer's own: RSI's guides are the pane's. */
  owner?: string;
  key: string;
  label: string;
  default: number;
  min: number;
  max: number;
  step?: number;
  hint?: string;
}

/** One row of the Style tab. */
export interface StylePlot {
  owner?: string;
  key: string;
  label: string;
  /** The colour it draws in unless changed: a theme entry's and an opacity, or its own. */
  theme?: string;
  alpha?: string;
  color?: string;
  width?: number;
  /** Shows or hides, and has nothing else to set. */
  onlyToggle?: boolean;
  noToggle?: boolean;
  noWidth?: boolean;
  /** Under a row with a box to tick, and lined up with it. */
  indent?: boolean;
  /** Has a width but no choice of pattern: drawn one way only. */
  noPattern?: boolean;
  /** Its pattern unless changed: `0` solid, `1` dashed, `2` dotted. */
  pattern?: string;
}

export interface LayerDef extends Described {
  id: string;
  short: string;
  /** Drawn with the candles, so not on a chart of TPO profiles. */
  candles: boolean;
  inputs: readonly NumberInput[];
  plots: readonly StylePlot[];
}

export const LAYER_DEFS: readonly LayerDef[] = [
  {
    id: 'ribbon',
    name: 'EMA ribbon',
    short: 'EMA 12/25',
    category: 'Built in',
    keywords: 'cloud moving average ma cross bull bear trend',
    about: 'The band between a fast and a slow EMA, coloured by which is on top, with a mark where they cross.',
    candles: true,
    inputs: [
      { key: 'fast', label: 'Fast length', default: 12, min: 2, max: 1000 },
      { key: 'slow', label: 'Slow length', default: 25, min: 2, max: 1000 },
    ],
    plots: [
      { key: 'bull', label: 'Fast above slow', theme: 'ribbonFast', alpha: '33', noWidth: true },
      { key: 'bear', label: 'Fast below slow', theme: 'ribbonSlow', alpha: '33', noWidth: true },
      { key: 'marks', label: 'Cross marks', onlyToggle: true },
    ],
  },
  {
    id: 'volume',
    name: 'Volume',
    short: 'Vol',
    category: 'Built in',
    keywords: 'bars',
    about: 'Each bar’s volume along the foot of the price pane, against the busiest bar on screen.',
    candles: true,
    inputs: [{ key: 'height', label: 'Height, % of pane', default: 18, min: 5, max: 60 }],
    plots: [
      { key: 'up', label: 'Up bars', theme: 'bull', alpha: '40', noToggle: true, noWidth: true },
      { key: 'down', label: 'Down bars', theme: 'bear', alpha: '40', noToggle: true, noWidth: true },
    ],
  },
  {
    id: 'liquidations',
    name: 'Liquidations',
    short: 'Liqs',
    category: 'Built in',
    keywords: 'feed long short forced',
    about: 'Positions force-closed in this market, as they happen, stacked in the corner of the price pane.',
    candles: false,
    inputs: [{ key: 'min', label: 'Smallest shown, USD', default: 0, min: 0, max: 1_000_000_000, step: 1000 }],
    plots: [
      { key: 'long', label: 'Longs closed out', theme: 'bear', noToggle: true, noWidth: true },
      { key: 'short', label: 'Shorts closed out', theme: 'bull', noToggle: true, noWidth: true },
    ],
  },
];

export interface Entry extends Described {
  id: string;
  short: string;
  /** Where it draws, as the picker says it. */
  where: string;
  def?: StudyDefinition;
  layer?: LayerDef;
}

/** The picker's list: what the engine computes, then what every chart has built in. */
export function entries(defs: readonly StudyDefinition[]): Entry[] {
  return [
    ...defs.map((def): Entry => {
      const own = STUDIES[def.kind] ?? { name: def.short, about: '', category: 'Built in' as const, keywords: '' };
      return { ...own, id: def.kind, short: def.short, where: def.group === 'price' ? 'on price' : 'own pane', def };
    }),
    ...LAYER_DEFS.map((layer): Entry => ({ ...layer, where: 'on price', layer })),
  ];
}

/** The search: everything typed must appear, the closest matches first. */
export function searchEntries<T extends Pick<Entry, 'id' | 'name' | 'short' | 'keywords' | 'category'>>(list: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...list];
  const words = q.split(/\s+/);
  const rank = (e: T): number => {
    const [short, name] = [e.short.toLowerCase(), e.name.toLowerCase()];
    const text = `${name} ${short} ${e.id} ${e.keywords} ${e.category.toLowerCase()}`;
    if (!words.every((w) => text.includes(w))) return -1;
    if (short === q || e.id === q) return 0;
    if (short.startsWith(q) || name.startsWith(q)) return 1;
    return text.split(/[\s/()-]+/).some((w) => w.startsWith(q)) ? 2 : 3;
  };
  return list
    .map((e) => ({ e, r: rank(e) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r)
    .map((x) => x.e);
}

/** The inputs a study gained after its first ones are written only where set, so the ids charts already hold still name it (`StudySpec::id` in tradoor-core). */
const WRITTEN: Record<string, number> = { vwap: 4 };

/** A study's id with these inputs. */
export function studyId(def: Pick<StudyDefinition, 'kind' | 'params'>, values: readonly number[]): string {
  let n = values.length;
  const kept = WRITTEN[def.kind] ?? n;
  while (n > kept && values[n - 1] === def.params[n - 1]?.default) n -= 1;
  return [def.kind, ...values.slice(0, n)].join(':');
}

export const defaultId = (def: StudyDefinition): string => studyId(def, def.params.map((p) => p.default));

const ANOTHER_AVERAGE = [50, 200, 20, 100, 9, 21, 34, 55, 89, 144, 233];

/** One more of a study already on the chart: a study's identity is its parameters, so its first takes a value not yet there. Null where there is none to pick. */
export function anotherId(def: StudyDefinition, active: readonly string[], start = def.params.map((p) => p.default)): string | null {
  // A Frost Script: its first setting that can be otherwise is — a choice's next option, a tick box the other way, a number doubled.
  if (def.kind.startsWith('fx-')) {
    for (const [i, p] of def.params.entries()) {
      const v = start[i] ?? p.default;
      const tries = p.kind === 'choice' ? (p.options ?? []).map((_, k) => k) : p.kind === 'bool' ? [1 - v] : !p.kind || p.kind === 'number' ? [2, 3, 4, 5].map((k) => v * k) : [];
      for (const t of tries) {
        const id = studyId(def, start.map((x, j) => (j === i ? t : x)));
        if (t !== v && t >= p.min && t <= p.max && !active.includes(id)) return id;
      }
    }
    return null;
  }
  const first = def.params[0];
  if (!first || def.kind === 'oi' || def.kind === 'vpvr') return null;
  const rest = start.slice(1);
  const values = def.kind === 'vwap' ? [1, 2, 3] : def.kind === 'volumedelta' ? [0, 1] : def.kind === 'cvd' ? [0, 1, 2, 3, 5, 4] : def.kind === 'ema' || def.kind === 'sma' ? ANOTHER_AVERAGE : [2, 3, 4, 5, 6, 7, 8].map((k) => first.default * k);
  for (const v of values) {
    const id = studyId(def, [v, ...rest]);
    if (v <= first.max && !active.includes(id)) return id;
  }
  return null;
}

/** What the picker writes for one on the chart: its parameters, or nothing where they would not say which. */
export function instanceLabel(id: string): string {
  const [kind, ...params] = id.split(':');
  // A script's settings run to a score of numbers that say nothing read in a row.
  return params.length === 0 || kind!.startsWith('fx-') || ['vwap', 'vwaplevels', 'oi', 'vpvr', 'volumedelta', 'cvd'].includes(kind!) ? 'On chart' : params.join(' ');
}

// ---------------------------------------------------------------- inputs

export interface ParamUi {
  label: string;
  hint?: string;
  options?: readonly string[];
  /** The order to list `options` in, where their values cannot follow it. */
  order?: readonly number[];
  /** A band: on with this multiple, off at 0. */
  band?: number;
  /** One checkbox per bit, with these names. */
  bits?: readonly string[];
  /** A box to tick: 1 on, 0 off. */
  toggle?: boolean;
}

const OI_LABELS: Record<(typeof OI_VENUES)[number], string> = {
  'binance-usdt': 'Binance USDT Perp',
  'bybit-usdt': 'Bybit USDT Perp',
  'okx-usdt': 'OKX USDT Swap',
  'deribit-usd': 'Deribit USD Perp',
  'hyperliquid-usd': 'Hyperliquid USD Perp',
  'binance-usd': 'Binance USD Perp',
  'bybit-usd': 'Bybit USD Perp',
  'okx-usd': 'OKX USD Perp',
};

const PARAMS: Record<string, Record<string, ParamUi>> = {
  bb: { mult: { label: 'Multiplier', hint: 'Standard deviations from the average to each band' } },
  keltner: { mult: { label: 'Multiplier', hint: 'ATRs from the average to each band' }, atr: { label: 'ATR length' } },
  ichimoku: { conversion: { label: 'Conversion length' }, base: { label: 'Base length' }, span: { label: 'Leading span B length' }, shift: { label: 'Displacement', hint: 'How far the spans run ahead and price runs behind, counted as TradingView counts it: 26 moves them 25 bars' } },
  vpvr: { rows: { label: 'Rows' }, va: { label: 'Value area, %' }, width: { label: 'Width, % of pane' }, side: { label: 'Side', options: ['Right', 'Left'] } },
  volumedelta: { view: { label: 'View', options: ['Each bar', 'Cumulative'] } },
  cvd: {
    reset: { label: 'Reset', options: ['None', 'Session', 'Week', 'Month', 'Year', 'Quarter'], order: [0, 1, 2, 3, 5, 4], hint: 'Where the sum starts again from zero, as the VWAP’s anchor does. A session is a UTC day' },
    view: { label: 'Display', options: ['Line', 'Candles'], hint: 'A line through each bar’s sum, or a candle from the sum before the bar to the sum after it' },
    smooth: { label: 'EMA length', hint: 'An exponential average of the CVD drawn over it; 0 draws none' },
  },
  stochrsi: { rsi: { label: 'RSI length' }, stoch: { label: 'Stochastic length' }, k: { label: '%K smoothing' }, d: { label: '%D smoothing' } },
  macd: { fast: { label: 'Fast length' }, slow: { label: 'Slow length' }, signal: { label: 'Signal length' } },
  swingmap: { left: { label: 'Left bars', hint: 'Bars a pivot must stand above on its left' }, right: { label: 'Right bars', hint: 'Bars to its right before it is confirmed' } },
  vwap: {
    hide: { label: 'Hide on 1D and above', toggle: true, hint: 'Draws nothing on daily bars and longer' },
    anchor: { label: 'Anchor', options: ['Session', 'Week', 'Month', 'Year', 'Quarter'], order: [0, 1, 2, 4, 3], hint: 'Where the average starts again. A session is a UTC day, and needs bars shorter than a day' },
    source: { label: 'Average of', options: ['(H+L+C)/3', 'Open', 'High', 'Low', 'Close', '(H+L)/2', '(O+H+L+C)/4', '(H+L+C+C)/4', 'Volume'], order: [1, 2, 3, 4, 5, 0, 6, 7, 8], hint: 'What of each bar is averaged, weighted by its volume. Volume, being no price, draws in a pane of its own' },
    offset: { label: 'Offset', hint: 'Bars the lines are moved by: to the right above 0, to the left below' },
    mode: { label: 'Bands calculation', options: ['Standard deviation', 'Percentage'], hint: 'Bands at standard deviations of price around the VWAP, or at a percent of it' },
    band1: { label: 'Value area', band: 1, hint: 'The first band. At one standard deviation it holds about two thirds of the volume' },
    band2: { label: 'Bands 2', band: 2 },
    band3: { label: 'Bands 3', band: 3 },
    timeframe: { label: 'Timeframe', options: ['Chart', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1D', '1W'], hint: 'Worked out on these bars, made from the chart’s own. One no longer than the chart’s bar is the chart’s' },
    wait: { label: 'Wait for timeframe closes', toggle: true, hint: 'Moves only as a bar of that timeframe closes, so what is drawn does not change afterwards' },
  },
  vwaplevels: {
    periods: { label: 'Periods', bits: ['Day', 'Week', 'Month', 'Quarter', 'Year'] },
    previous: { label: 'Previous periods', options: ['Off', 'On'], hint: 'Each period’s last VWAP and value area too, as pwVWAP' },
    band: { label: 'Value area', hint: 'Standard deviations of price around the VWAP to its VAH and VAL. One holds about two thirds of the volume' },
  },
  oi: {
    venues: { label: 'Venues', bits: OI_VENUES.map((v) => OI_LABELS[v]) },
    measure: { label: 'Measure', options: ['Coins', 'USD'] },
    view: { label: 'View', options: ['Candles', 'Line'] },
  },
};

/** The order a study's inputs are asked for in, where not their own. */
const PARAM_ORDER: Record<string, readonly number[]> = { vwap: [7, 0, 4, 5, 6, 1, 2, 3, 8, 9] };
export const paramOrder = (kind: string, count: number): readonly number[] => PARAM_ORDER[kind]?.filter((i) => i < count) ?? [...Array(count).keys()];

const titled = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
export const paramUi = (kind: string, param: StudyParam): ParamUi => PARAMS[kind]?.[param.name] ?? { label: titled(param.name) };

/** RSI and Stochastic RSI share a pane, and it one pair of guides. */
const PANE_GUIDES: readonly NumberInput[] = [
  { owner: 'pct', key: 'upper', label: 'Upper guide', default: 80, min: 0, max: 100, hint: 'Shared by every study in this pane' },
  { owner: 'pct', key: 'lower', label: 'Lower guide', default: 20, min: 0, max: 100, hint: 'Shared by every study in this pane' },
];
const GUIDES_PLOT: StylePlot = { owner: 'pct', key: 'guides', label: 'Guides', theme: 'border', width: 1, noPattern: true };

const KEY_LEVEL_NUMBERS: readonly NumberInput[] = [
  { key: 'ahead', label: 'Line past the last bar', default: 8, min: 0, max: 500, hint: 'How many bars a level still in force runs on into the space ahead; 0 stops it at the last bar' },
];

export const studyNumbers = (kind: string): readonly NumberInput[] => (kind === 'rsi' || kind === 'stochrsi' ? PANE_GUIDES : kind === 'keylevels' ? KEY_LEVEL_NUMBERS : []);
/** The owners besides a study's own that its settings change. */
export const otherOwners = (kind: string): readonly string[] => (kind === 'rsi' || kind === 'stochrsi' ? ['pct'] : []);

/** Written under the inputs, where the description does not say it. */
export const NOTES: Record<string, string> = {
  oi: 'Recorded by the tradoor server every 15 seconds. Binance and Bybit are backfilled for the last month and OKX for five days. Before a venue’s own record begins, it is estimated at the share it held when it began.',
};

// ---------------------------------------------------------------- styles

const LABELS: Record<string, Record<string, string>> = {
  keylevels: { wo: 'Weekly open', mo: 'Monthly open', yo: 'Yearly open', monH: 'Monday high', monL: 'Monday low' },
  macd: { histogram: 'Histogram, above zero' },
  vwap: { upper1: 'Value Area High', lower1: 'Value Area Low', prevVwap: 'Previous VWAP', prevVah: 'Previous VAH', prevVal: 'Previous VAL', upper2: 'Upper band 2', lower2: 'Lower band 2', upper3: 'Upper band 3', lower3: 'Lower band 3' },
  swingmap: { zigzag: 'Zigzag' },
  volumedelta: { histogram: 'Delta, above zero', cvd: 'Cumulative delta' },
  cvd: { cvd: 'CVD', ema: 'EMA of CVD' },
  ichimoku: { conversion: 'Conversion line', base: 'Base line', lagging: 'Lagging span', leadA: 'Leading span A', leadB: 'Leading span B' },
};

const LINE_STYLE: Record<string, Record<string, Partial<StylePlot>>> = {
  macd: { histogram: { theme: 'bull', alpha: '80', noWidth: true } },
  volumedelta: { histogram: { theme: 'bull', alpha: '80', noWidth: true } },
  vwap: { vwap: { pattern: '2' }, prevVwap: { noWidth: true }, prevVah: { noWidth: true }, prevVal: { noWidth: true } },
};

/** `rgba(r,g,b,a)`, as the engine writes a colour, in the spelling the colour field takes. */
export function toHex(css: string): string {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(css);
  if (!m) return css;
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const alpha = Math.round(Number(m[4] ?? 1) * 255);
  return `#${hex(Number(m[1]))}${hex(Number(m[2]))}${hex(Number(m[3]))}${alpha === 255 ? '' : hex(alpha)}`;
}

/** A study's rows on the Style tab: the lines it draws, and what else it paints. */
export function studyPlots(id: string, lines: readonly StudyLine[]): StylePlot[] {
  const kind = id.split(':')[0]!;
  const out: StylePlot[] = lines
    // A width of 0 only carries values for the legend; key levels draw theirs as segments.
    .filter((l) => l.width > 0 || kind === 'keylevels')
    .map((l) => {
      const key = l.id.slice(id.length + 1);
      // A VWAP level is a label and its stub, in a colour alone.
      const tag = kind === 'vwaplevels';
      return { key, label: LABELS[kind]?.[key] ?? l.label, color: toHex(l.color), width: l.width || 1, noPattern: kind === 'keylevels' || tag, noWidth: tag, ...LINE_STYLE[kind]?.[key] };
    });
  if (kind === 'macd') out.splice(1, 0, { key: 'histogramDown', label: 'Histogram, below zero', theme: 'bear', alpha: '80', noToggle: true, noWidth: true, indent: true });
  if (kind === 'volumedelta' && out.some((p) => p.key === 'histogram')) out.push({ key: 'histogramDown', label: 'Delta, below zero', theme: 'bear', alpha: '80', noToggle: true, noWidth: true, indent: true });
  if (kind === 'vwap') {
    const fills = [['1', 'Value area shading', '#2962ff12'], ['2', 'Bands 2 shading', '#2962ff0c'], ['3', 'Bands 3 shading', '#2962ff08']] as const;
    const at = out.findIndex((p) => p.key.startsWith('prev'));
    out.splice(at < 0 ? out.length : at, 0, ...fills.filter(([n]) => out.some((p) => p.key === `upper${n}`)).map(([n, label, color]): StylePlot => ({ key: `fill${n}`, label, color, noWidth: true })));
  }
  if (kind === 'bb' || kind === 'keltner') out.push({ key: 'fill', label: 'Background', color: '#2196f31a', noWidth: true });
  if (kind === 'ichimoku') out.push({ key: 'cloudUp', label: 'Cloud, A above B', color: '#43a04733', noWidth: true }, { key: 'cloudDown', label: 'Cloud, A below B', color: '#f4433633', noWidth: true });
  if (kind === 'sessions') out.push({ key: 'asia', label: 'Asia', color: '#e3cd2a', noWidth: true }, { key: 'london', label: 'London', color: '#c8202e', noWidth: true }, { key: 'ny', label: 'New York', color: '#2f5bd8', noWidth: true });
  if (kind === 'moon') out.push({ key: 'full', label: 'Full moon', color: '#f5efc8', noWidth: true }, { key: 'new', label: 'New moon', color: '#9aa0a6', noWidth: true });
  if (kind === 'vpvr') out.push({ key: 'up', label: 'Bars that closed up', theme: 'bull', noWidth: true }, { key: 'down', label: 'Bars that closed down', theme: 'bear', noWidth: true }, { key: 'poc', label: 'Point of control', theme: 'tpoPoc', width: 1, noPattern: true }, { key: 'va', label: 'Value area edges', theme: 'text', width: 1, noPattern: true });
  if (kind === 'swingmap') out.push({ key: 'labels', label: 'Swing labels', onlyToggle: true }, { key: 'stats', label: 'Averages in the legend', onlyToggle: true });
  if (kind === 'flow') out.push({ key: 'bought', label: 'Bought', theme: 'bull', noWidth: true }, { key: 'sold', label: 'Sold', theme: 'bear', noWidth: true });
  if (kind === 'cvd') {
    // As candles, the candles are drawn: the CVD line only carries their closes, unstroked.
    if (id.split(':')[2] === '1') out.push({ key: 'up', label: 'Rising', theme: 'bull', noToggle: true, noWidth: true }, { key: 'down', label: 'Falling', theme: 'bear', noToggle: true, noWidth: true });
    out.push({ key: 'zero', label: 'Zero line', theme: 'text', alpha: '66', width: 1, pattern: '1' });
  }
  if (kind === 'oi' && id.split(':')[3] !== '1') out.push({ key: 'up', label: 'Rising', theme: 'bull', noToggle: true, noWidth: true }, { key: 'down', label: 'Falling', theme: 'bear', noToggle: true, noWidth: true });
  if (kind === 'rsi' || kind === 'stochrsi') out.push(GUIDES_PLOT);
  return out;
}

// ---------------------------------------------------------------- saved defaults

/*
 * What an indicator starts with when it is added: the inputs and styles saved
 * from its settings with Save as default, kept in the workspace (`studyDefaults`),
 * so they go where it is synced and stay when another layout is opened. Styles
 * are by `kind/plot` for its own and `owner/plot` for what it shares, as RSI's guides.
 */

export interface StudyDefault {
  params: number[];
  styles: StudyStyles;
}

const KIND = /^[a-z][a-z0-9-]{0,60}$/;
const ownerOf = (key: string): string => key.slice(0, key.indexOf('/'));
/** The one saved for `kind` in a workspace's `studyDefaults`, where it reads as one. */
export function savedDefault(all: Record<string, unknown> | undefined, kind: string): StudyDefault | null {
  const raw = all?.[kind];
  if (!KIND.test(kind) || typeof raw !== 'object' || raw === null) return null;
  const { params, styles } = raw as { params?: unknown; styles?: unknown };
  if (!Array.isArray(params) || params.length > 64 || !params.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  return { params, styles: readStyles(styles) };
}

/** The workspace's `studyDefaults` with `saved` for `kind`, or with it forgotten at null. */
export function withDefault(all: Record<string, unknown> | undefined, kind: string, saved: StudyDefault | null): Record<string, unknown> {
  const next = { ...all };
  if (saved) next[kind] = saved;
  else delete next[kind];
  return next;
}

/** Its inputs as saved, each where the study still takes it: a script changed since has its own default for the rest. */
export function startingValues(def: Pick<StudyDefinition, 'params'>, saved: StudyDefault | null): number[] {
  return def.params.map((p, i) => {
    const v = saved?.params[i];
    return v !== undefined && v >= p.min && v <= p.max ? v : p.default;
  });
}

/** The saved styles on a study of `kind` that is `id` on the chart: its own, and a shared owner's where the chart has none yet. */
export function startingStyles(styles: StudyStyles | undefined, kind: string, id: string, saved: StudyDefault | null): StudyStyles {
  const next = { ...styles };
  for (const [key, value] of Object.entries(saved?.styles ?? {})) {
    const owner = ownerOf(key);
    if (owner === kind) next[`${id}${key.slice(owner.length)}`] = value;
    else next[key] ??= value;
  }
  return next;
}

/** What a study's settings show, to save: its inputs, its own styles and those of the owners it shares. */
export function currentDefault(kind: string, id: string, params: number[], styles: StudyStyles | undefined, shared: readonly string[]): StudyDefault {
  const own: StudyStyles = {};
  for (const [key, value] of Object.entries(styles ?? {})) {
    const owner = ownerOf(key);
    if (owner === id) own[`${kind}${key.slice(owner.length)}`] = value;
    else if (shared.includes(owner)) own[key] = value;
  }
  return { params, styles: own };
}
