/** Colours a workspace can override. Chart keys go to the engine; `ui.*` keys
 *  set the page's CSS tokens. Defaults mirror tradoor-render's Theme and styles.css. */

export interface ThemeKey {
  name: string;
  label: string;
  value: string;
}

/** The chart's colours, by the name the engine knows each by: Settings (CHART_LABELS) says what each colours. */
export const CHART_THEME: readonly { name: string; value: string }[] = [
  { name: 'background', value: '#0f0f0f' },
  { name: 'border', value: '#232823' },
  { name: 'text', value: '#7c847d' },
  { name: 'labelBackground', value: '#2a2f2a' },
  { name: 'crosshair', value: '#7c847d' },
  { name: 'bull', value: '#a4c588' },
  { name: 'bear', value: '#d97161' },
  // The page's alone: sent with the line chart's style (ChartPanel), as the engine's theme has no slot for it.
  { name: 'line', value: '#2962ff' },
  { name: 'ribbonFast', value: '#aafd35' },
  { name: 'ribbonSlow', value: '#ff293a' },
  { name: 'ema200', value: '#ffb03a' },
  { name: 'tpo', value: '#5f9f3a' },
  { name: 'tpoOutside', value: '#858c86' },
  { name: 'tpoPoc', value: '#e6f5d3' },
  { name: 'drawing', value: '#ff5fd2' },
  { name: 'drawingSelected', value: '#ffa8e6' },
  { name: 'study0', value: '#7fb2ff' },
  { name: 'study1', value: '#c58fff' },
  { name: 'study2', value: '#ffd166' },
  { name: 'study3', value: '#4ecdc4' },
  { name: 'study4', value: '#ff8fab' },
  { name: 'study5', value: '#9ae66e' },
];

/**
 * The candles' parts, kept with the theme: each part on or off (`1`, `0`), and the
 * borders' and wicks' own colours, the body's where none is set. The page sends them
 * with the chart's styles (ChartPanel), as the engine's theme has no slots for them.
 */
export const CANDLE_PARTS = { body: 'candleBody', border: 'candleBorder', wick: 'candleWick', previous: 'candlePrev' } as const;

/** The style entries the engine draws the candles' parts and the grid from (`price/…`, `chart/grid`): none where all are as they always were. */
export function candleStyles(theme: Record<string, string | undefined>): string {
  const on = (key: string, fallback: string) => (theme[key] ?? fallback) === '1';
  const out: string[] = [];
  if (!on(CANDLE_PARTS.body, '1')) out.push('price/body=,1,1');
  if (!on(CANDLE_PARTS.wick, '1')) out.push('price/wickUp=,1,1');
  else if (theme.wickUp || theme.wickDown) out.push(`price/wickUp=${theme.wickUp ?? ''},1`, `price/wickDown=${theme.wickDown ?? ''},1`);
  if (on(CANDLE_PARTS.border, '0')) out.push(`price/borderUp=${theme.borderUp ?? ''},1`, `price/borderDown=${theme.borderDown ?? ''},1`);
  if (on(CANDLE_PARTS.previous, '0')) out.push('price/prev=1');
  // The grid: off unless `grid` is 1, in `gridColor` or the grid and borders' own.
  if (theme.grid === '1') out.push(`chart/grid=${theme.gridColor ?? ''},1`);
  return out.join(';');
}

export const FONT_PX = { name: 'fontPx', value: '11' };

/** The page's text, as a share of its usual size: every size in the CSS is in rem, so one root size moves them all. */
export const TEXT_SCALE = { name: 'ui.textScale', value: '1' };

/** Bold text on the page and on the charts: `1`, or left out. */
export const FONT_BOLD = { name: 'fontBold', value: '0' };

/** Whether the page is light or dark, for the browser's own controls and scrollbars: a theme's, not a swatch. */
export const SCHEME = { name: 'ui.scheme', css: '--scheme' };

export const UI_THEME: readonly (ThemeKey & { css: string })[] = [
  { name: 'ui.primary', css: '--primary', label: 'Accent', value: '#aafd35' },
  { name: 'ui.bg', css: '--bg', label: 'Page', value: '#070907' },
  { name: 'ui.surface', css: '--surface', label: 'Panels', value: '#0d100e' },
  { name: 'ui.border', css: '--border', label: 'Borders', value: '#232823' },
  { name: 'ui.text', css: '--text', label: 'Text', value: '#dfe6e0' },
  { name: 'ui.bull', css: '--bull', label: 'Up', value: '#aafd35' },
  { name: 'ui.bear', css: '--bear', label: 'Down', value: '#ff4d5f' },
];
