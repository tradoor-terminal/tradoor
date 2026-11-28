/**
 * Themes: every colour a workspace can override (lib/theme), picked whole in
 * Settings. tradoor dark is the defaults themselves; the rest follow themes
 * TradingView traders share (tradingviewthemes.com), whose chart colours they
 * keep — background, grid, axis text, crosshair, candles — with a page around
 * the chart to match, light or dark.
 */
import { CHART_THEME, SCHEME, UI_THEME } from './theme';

export interface ThemePreset {
  id: string;
  name: string;
  /** What it is, for the card. */
  note: string;
  colors: Record<string, string>;
}

/**
 * The candles' parts, the grid and the background's fade, kept with the theme
 * though not colours of the engine's own: each with the value it has unset.
 */
const EXTRAS: Record<string, string> = {
  candleBody: '1', candleBorder: '0', candleWick: '1', candlePrev: '0', borderUp: '', borderDown: '', wickUp: '', wickDown: '',
  grid: '0', gridColor: '', gridAxes: '0', gradient: '0', gradientColor: '',
};

/** Every key a theme sets: picking one clears what another set and it does not. */
export const THEME_KEYS: readonly string[] = [...CHART_THEME.map((t) => t.name), ...UI_THEME.map((t) => t.name), SCHEME.name, ...Object.keys(EXTRAS)];

/** TradingView's own study colours, for the themes that come from it. */
const TV_STUDIES = { study0: '#2962FF', study1: '#9C27B0', study2: '#FF9800', study3: '#00BCD4', study4: '#E91E63', study5: '#4CAF50' };
const PASTEL_STUDIES = { study0: '#5B7DB1', study1: '#A78BCB', study2: '#E0A458', study3: '#6CB4A8', study4: '#D98BA3', study5: '#8FBF7A' };

export const THEMES: readonly ThemePreset[] = [
  { id: 'tradoor-dark', name: 'tradoor dark', note: 'The terminal as it comes: lime on near-black', colors: {} },
  {
    id: 'canvas',
    name: 'Canvas',
    note: 'Navy, teal and red',
    colors: {
      background: '#131722', border: '#20242F', text: '#B2B5BE', crosshair: '#9598A1', labelBackground: '#2A2E39',
      bull: '#089981', bear: '#F23645', ribbonFast: '#089981', ribbonSlow: '#F23645', ema200: '#F7A21B',
      tpo: '#2962FF', tpoOutside: '#787B86', tpoPoc: '#D1D4DC',
      drawing: '#2962FF', drawingSelected: '#7FA1FF', ...TV_STUDIES,
      'ui.primary': '#2962FF', 'ui.bg': '#0F121A', 'ui.surface': '#131722', 'ui.border': '#2A2E39', 'ui.text': '#D1D4DC', 'ui.bull': '#089981', 'ui.bear': '#F23645',
    },
  },
  {
    id: 'crayons-dark',
    name: 'Crayons Dark',
    note: 'Near-black, white and blue-grey candles',
    colors: {
      background: '#0F0F0F', border: '#1E1E1E', text: '#B2B5BE', crosshair: '#9698A1', labelBackground: '#242424',
      bull: '#F7F7F7', bear: '#8396B1', ribbonFast: '#F7F7F7', ribbonSlow: '#8396B1', ema200: '#E0A458',
      tpo: '#8396B1', tpoOutside: '#55585F', tpoPoc: '#F7F7F7',
      drawing: '#A9BCD9', drawingSelected: '#D6E0EE', ...PASTEL_STUDIES,
      'ui.primary': '#F7F7F7', 'ui.bg': '#080808', 'ui.surface': '#0F0F0F', 'ui.border': '#242424', 'ui.text': '#E6E6E6', 'ui.bull': '#F7F7F7', 'ui.bear': '#8396B1',
    },
  },
  {
    id: 'market-canvas',
    name: 'Market Canvas',
    note: 'Classic white, green and red candles',
    colors: {
      background: '#FFFFFF', border: '#E1E1E1', text: '#6F7089', crosshair: '#8B8BA7', labelBackground: '#E6E8EE',
      bull: '#079981', bear: '#F23645', ribbonFast: '#079981', ribbonSlow: '#F23645', ema200: '#F7A21B',
      tpo: '#079981', tpoOutside: '#B2B5BE', tpoPoc: '#131722',
      drawing: '#2962FF', drawingSelected: '#7FA1FF', ...TV_STUDIES,
      'ui.primary': '#079981', 'ui.bg': '#F1F2F5', 'ui.surface': '#FFFFFF', 'ui.border': '#E1E1E1', 'ui.text': '#131722', 'ui.bull': '#079981', 'ui.bear': '#F23645',
      'ui.scheme': 'light',
    },
  },
  {
    id: 'crayons-light',
    name: 'Crayons Light',
    note: 'Soft grey, black and blue-grey candles',
    colors: {
      background: '#F7F7F7', border: '#ECEEF2', text: '#787C86', crosshair: '#9698A1', labelBackground: '#E6E8EC',
      bull: '#0F0F0F', bear: '#8396B1', ribbonFast: '#3A3A3A', ribbonSlow: '#8396B1', ema200: '#E0A458',
      tpo: '#8396B1', tpoOutside: '#C4C7CF', tpoPoc: '#0F0F0F',
      drawing: '#5B7DB1', drawingSelected: '#93A9CC', ...PASTEL_STUDIES,
      'ui.primary': '#0F0F0F', 'ui.bg': '#EFEFEF', 'ui.surface': '#F7F7F7', 'ui.border': '#E2E4E8', 'ui.text': '#0F0F0F', 'ui.bull': '#0F0F0F', 'ui.bear': '#8396B1',
      'ui.scheme': 'light',
    },
  },
  {
    id: 'ict-lime-green-black',
    name: 'ICT Lime Green Black',
    note: 'White, lime up and black down candles',
    colors: {
      background: '#FFFFFF', border: '#E0FBF7', text: '#40514E', crosshair: '#9598A1', labelBackground: '#E8F6F3',
      bull: '#2FB417', bear: '#000000', ribbonFast: '#2FB417', ribbonSlow: '#000000', ema200: '#30C5B1',
      tpo: '#2FB417', tpoOutside: '#B9C4C2', tpoPoc: '#1C2826',
      drawing: '#14A38F', drawingSelected: '#7FD9CB', ...TV_STUDIES,
      'ui.primary': '#2FB417', 'ui.bg': '#F4F7F6', 'ui.surface': '#FFFFFF', 'ui.border': '#D9E8E5', 'ui.text': '#1C2826', 'ui.bull': '#2FB417', 'ui.bear': '#E53935',
      'ui.scheme': 'light',
    },
  },
  {
    id: 'powell-trades',
    name: 'Powell Trades',
    note: 'Slate grey, grey and black candles outlined in black',
    colors: {
      background: '#4A4A4A', border: '#5A5A5A', text: '#ECF0F1', crosshair: '#1A1A1A', labelBackground: '#3A3A3A',
      bull: '#808080', bear: '#010101', ribbonFast: '#D9D9D9', ribbonSlow: '#1A1A1A', ema200: '#E05C1A',
      tpo: '#9A9A9A', tpoOutside: '#666666', tpoPoc: '#ECF0F1',
      drawing: '#E05C1A', drawingSelected: '#F0A27A', ...TV_STUDIES,
      candleBorder: '1', borderUp: '#000000', borderDown: '#000000', wickUp: '#000000', wickDown: '#000000',
      'ui.primary': '#E05C1A', 'ui.bg': '#3A3A3A', 'ui.surface': '#444444', 'ui.border': '#5A5A5A', 'ui.text': '#ECF0F1', 'ui.bull': '#B8E0C2', 'ui.bear': '#F2A08A',
    },
  },
  {
    id: 'midnight-serenity',
    name: 'Midnight Serenity',
    note: 'Deep indigo, white and amber candles',
    colors: {
      background: '#0A0523', border: '#1E1A40', text: '#9598A1', crosshair: '#9598A1', labelBackground: '#1E1A40',
      bull: '#FFFFFF', bear: '#F57C00', ribbonFast: '#FFFFFF', ribbonSlow: '#F57C00', ema200: '#9C8CFF',
      tpo: '#5B4BC4', tpoOutside: '#423C6B', tpoPoc: '#FFFFFF',
      drawing: '#FFB74D', drawingSelected: '#FFE0B2', ...TV_STUDIES,
      'ui.primary': '#F57C00', 'ui.bg': '#06031A', 'ui.surface': '#0A0523', 'ui.border': '#1E1A40', 'ui.text': '#D8D6E8', 'ui.bull': '#FFFFFF', 'ui.bear': '#F57C00',
    },
  },
  {
    id: 'salmon-paper',
    name: 'Salmon Paper',
    note: 'Newsprint pink, teal and slate candles, a grid',
    colors: {
      background: '#F2DFCE', border: '#E0C9B6', text: '#66605A', crosshair: '#8A8178', labelBackground: '#E6D1BF',
      bull: '#0D7680', bear: '#43444F', ribbonFast: '#0D7680', ribbonSlow: '#990F3D', ema200: '#990F3D',
      tpo: '#0D7680', tpoOutside: '#C2AD9B', tpoPoc: '#33302E',
      drawing: '#0F5499', drawingSelected: '#6E9BD1', ...TV_STUDIES,
      grid: '1', gridColor: '#D1BEAE',
      'ui.primary': '#0D7680', 'ui.bg': '#FFF1E5', 'ui.surface': '#F2DFCE', 'ui.border': '#D9C4B1', 'ui.text': '#33302E', 'ui.bull': '#0D7680', 'ui.bear': '#990F3D',
      'ui.scheme': 'light',
    },
  },
  {
    id: 'ict',
    name: 'ICT',
    note: 'Mint, teal and slate candles, a faint grid',
    colors: {
      background: '#E4F9F5', border: '#C9EDE6', text: '#40514E', crosshair: '#9598A1', labelBackground: '#D3F2EC',
      bull: '#11999E', bear: '#40514E', ribbonFast: '#11999E', ribbonSlow: '#40514E', ema200: '#E8833A',
      tpo: '#11999E', tpoOutside: '#A9C9C3', tpoPoc: '#1F2B29',
      drawing: '#E8833A', drawingSelected: '#F2B98C', ...TV_STUDIES,
      grid: '1', gridColor: '#A6E9DE',
      'ui.primary': '#11999E', 'ui.bg': '#EEFBF8', 'ui.surface': '#E4F9F5', 'ui.border': '#C9E6E0', 'ui.text': '#1F2B29', 'ui.bull': '#11999E', 'ui.bear': '#D9534F',
      'ui.scheme': 'light',
    },
  },
  {
    id: 'midnight-navigator',
    name: 'Midnight Navigator',
    note: 'Charcoal, white and cyan candles, a grid',
    colors: {
      background: '#222831', border: '#393E46', text: '#00ADB5', crosshair: '#9598A1', labelBackground: '#393E46',
      bull: '#EEEEEE', bear: '#00ADB5', ribbonFast: '#EEEEEE', ribbonSlow: '#00ADB5', ema200: '#FFB84C',
      tpo: '#00ADB5', tpoOutside: '#4F5661', tpoPoc: '#EEEEEE',
      drawing: '#FFB84C', drawingSelected: '#FFD99C', ...TV_STUDIES,
      grid: '1', gridColor: '#393E46',
      'ui.primary': '#00ADB5', 'ui.bg': '#1B2027', 'ui.surface': '#222831', 'ui.border': '#393E46', 'ui.text': '#EEEEEE', 'ui.bull': '#EEEEEE', 'ui.bear': '#00ADB5',
    },
  },
  {
    id: 'dark-violet',
    name: 'Dark Violet',
    note: 'Near-black violet, grey and purple candles',
    colors: {
      background: '#070317', border: '#1A1530', text: '#B2B5BE', crosshair: '#9598A1', labelBackground: '#1E1838',
      bull: '#6C6C7A', bear: '#673AB7', ribbonFast: '#D1D4DC', ribbonSlow: '#673AB7', ema200: '#B39DDB',
      tpo: '#673AB7', tpoOutside: '#3B3552', tpoPoc: '#D1D4DC',
      drawing: '#B39DDB', drawingSelected: '#D7C9F0', ...TV_STUDIES,
      'ui.primary': '#9575CD', 'ui.bg': '#04020F', 'ui.surface': '#070317', 'ui.border': '#1E1838', 'ui.text': '#D1D4DC', 'ui.bull': '#D1D4DC', 'ui.bear': '#9575CD',
    },
  },
  {
    id: 'neons-default-dark',
    name: 'Neons Default Dark',
    note: 'Near-black, hollow teal and red candles',
    colors: {
      background: '#0F0F0F', border: '#1E1E1E', text: '#B2B5BE', crosshair: '#9698A1', labelBackground: '#242424',
      bull: '#283B39', bear: '#492823', ribbonFast: '#64A39A', ribbonSlow: '#D06153', ema200: '#E0A458',
      tpo: '#64A39A', tpoOutside: '#55585F', tpoPoc: '#E6E6E6',
      drawing: '#A9BCD9', drawingSelected: '#D6E0EE', ...PASTEL_STUDIES,
      candleBorder: '1', borderUp: '#64A39A', borderDown: '#D06153', wickUp: '#64A39A', wickDown: '#D06153',
      'ui.primary': '#64A39A', 'ui.bg': '#080808', 'ui.surface': '#0F0F0F', 'ui.border': '#242424', 'ui.text': '#E6E6E6', 'ui.bull': '#64A39A', 'ui.bear': '#D06153',
    },
  },
  {
    id: 'neons-dark',
    name: 'Neons Dark',
    note: 'Near-black, hollow white and blue-grey candles',
    colors: {
      background: '#0F0F0F', border: '#1E1E1E', text: '#B2B5BE', crosshair: '#9698A1', labelBackground: '#242424',
      bull: '#555555', bear: '#323840', ribbonFast: '#F7F7F7', ribbonSlow: '#8396B1', ema200: '#E0A458',
      tpo: '#8396B1', tpoOutside: '#55585F', tpoPoc: '#F7F7F7',
      drawing: '#A9BCD9', drawingSelected: '#D6E0EE', ...PASTEL_STUDIES,
      candleBorder: '1', borderUp: '#F7F7F7', borderDown: '#8396B1', wickUp: '#F7F7F7', wickDown: '#8396B1',
      'ui.primary': '#F7F7F7', 'ui.bg': '#080808', 'ui.surface': '#0F0F0F', 'ui.border': '#242424', 'ui.text': '#E6E6E6', 'ui.bull': '#F7F7F7', 'ui.bear': '#8396B1',
    },
  },
  {
    id: 'dusty-desert',
    name: 'Dusty Desert',
    note: 'Sand, grey and charcoal candles outlined in black',
    colors: {
      background: '#C2BAAE', border: '#B0A89C', text: '#000000', crosshair: '#6E7078', labelBackground: '#B3AB9F',
      bull: '#B2B5BE', bear: '#434651', ribbonFast: '#EDEFF3', ribbonSlow: '#434651', ema200: '#8C4A2F',
      tpo: '#5E6270', tpoOutside: '#A0988C', tpoPoc: '#111111',
      drawing: '#8C4A2F', drawingSelected: '#B9785C', ...TV_STUDIES,
      candleBorder: '1', borderUp: '#000000', borderDown: '#000000', wickUp: '#000000', wickDown: '#000000',
      grid: '1', gridColor: '#CEC8C1',
      'ui.primary': '#434651', 'ui.bg': '#D3CCC1', 'ui.surface': '#C2BAAE', 'ui.border': '#A9A093', 'ui.text': '#1A1A1A', 'ui.bull': '#2E6B57', 'ui.bear': '#8C2F2F',
      'ui.scheme': 'light',
    },
  },
  {
    id: 'midnight-calm',
    name: 'Midnight Calm',
    note: 'Deep navy, white and sky-blue candles, a grid',
    colors: {
      background: '#161434', border: '#2A2660', text: '#8B8BA7', crosshair: '#8B8BA7', labelBackground: '#25224F',
      bull: '#FFFFFF', bear: '#5B9CF6', ribbonFast: '#FFFFFF', ribbonSlow: '#5B9CF6', ema200: '#FFB74D',
      tpo: '#5B9CF6', tpoOutside: '#3E3A78', tpoPoc: '#FFFFFF',
      drawing: '#9C8CFF', drawingSelected: '#C9C0FF', ...TV_STUDIES,
      grid: '1', gridColor: '#221F4A',
      'ui.primary': '#5B9CF6', 'ui.bg': '#100E28', 'ui.surface': '#161434', 'ui.border': '#2A2660', 'ui.text': '#E2E2F0', 'ui.bull': '#FFFFFF', 'ui.bear': '#5B9CF6',
    },
  },
  {
    id: 'binance',
    name: 'Binance',
    note: "The exchange's app: slate, green and red, yellow lines",
    colors: {
      background: '#202630', border: '#333B47', text: '#929AA5', crosshair: '#5E6673', labelBackground: '#333B47',
      bull: '#2EBD85', bear: '#F6465D', ribbonFast: '#2EBD85', ribbonSlow: '#F6465D', ema200: '#8B68C4',
      tpo: '#C99400', tpoOutside: '#4A5260', tpoPoc: '#EAECEF',
      drawing: '#F0B90B', drawingSelected: '#FCD535',
      study0: '#F0B90B', study1: '#E840B5', study2: '#8B68C4', study3: '#2DBCD4', study4: '#F6845D', study5: '#6FD08C',
      grid: '1', gridColor: '#333B47',
      'ui.primary': '#F0B90B', 'ui.bg': '#181A20', 'ui.surface': '#202630', 'ui.border': '#333B47', 'ui.text': '#EAECEF', 'ui.bull': '#2EBD85', 'ui.bear': '#F6465D',
    },
  },
  {
    id: 'bybit',
    name: 'Bybit',
    note: "The exchange's app: black, green and red, a faint grid",
    colors: {
      background: '#000000', border: '#1E1E1E', text: '#9E9E9E', crosshair: '#6B6B6B', labelBackground: '#1E1E1E',
      bull: '#06C167', bear: '#F63649', ribbonFast: '#06C167', ribbonSlow: '#F63649', ema200: '#8A63D2',
      tpo: '#C78500', tpoOutside: '#3A3A3A', tpoPoc: '#EFEFEF',
      drawing: '#F7A600', drawingSelected: '#FFCB66',
      study0: '#E4AF27', study1: '#E05BB0', study2: '#8A63D2', study3: '#43AFC4', study4: '#E5534B', study5: '#7BC96F',
      grid: '1', gridColor: '#1E1E1E',
      'ui.primary': '#F7A600', 'ui.bg': '#000000', 'ui.surface': '#0B0B0D', 'ui.border': '#1E1E1E', 'ui.text': '#EAEAEA', 'ui.bull': '#06C167', 'ui.bear': '#F63649',
    },
  },
];

/** The theme `theme` is exactly, or null once a colour of it was changed by hand. */
export function themeOf(theme: Record<string, string>): string | null {
  // A switch set back to its default by hand is as good as unset.
  const value = (colors: Record<string, string>, k: string) => (colors[k] ?? EXTRAS[k] ?? '').toLowerCase();
  const same = (t: ThemePreset) => THEME_KEYS.every((k) => value(theme, k) === value(t.colors, k));
  return THEMES.find(same)?.id ?? null;
}

/** A theme's colours over `theme`, the keys it does not set put back to the defaults; the rest (font, time zone) kept. */
export function withTheme(theme: Record<string, string>, preset: ThemePreset): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme)) if (!THEME_KEYS.includes(k)) out[k] = v;
  return { ...out, ...preset.colors };
}
