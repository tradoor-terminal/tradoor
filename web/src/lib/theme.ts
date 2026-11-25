/** Colours a workspace can override. Chart keys go to the engine; `ui.*` keys
 *  set the page's CSS tokens. Defaults mirror tradoor-render's Theme and styles.css. */

export interface ThemeKey {
  name: string;
  label: string;
  value: string;
}

/** What a chart colour colours: Settings sets them out by it. */
export type ChartGroup = 'canvas' | 'candles' | 'layers' | 'tpo' | 'drawings' | 'studies';

export const CHART_THEME: readonly (ThemeKey & { group: ChartGroup })[] = [
  { name: 'background', label: 'Background', value: '#0f0f0f', group: 'canvas' },
  { name: 'border', label: 'Grid and borders', value: '#232823', group: 'canvas' },
  { name: 'text', label: 'Axis text', value: '#7c847d', group: 'canvas' },
  { name: 'labelBackground', label: 'Axis labels', value: '#2a2f2a', group: 'canvas' },
  { name: 'crosshair', label: 'Crosshair', value: '#7c847d', group: 'canvas' },
  { name: 'bull', label: 'Up candles', value: '#a4c588', group: 'candles' },
  { name: 'bear', label: 'Down candles', value: '#d97161', group: 'candles' },
  // The page's alone: sent with the line chart's style (ChartPanel), as the engine's theme has no slot for it.
  { name: 'line', label: 'Line chart', value: '#2962ff', group: 'candles' },
  { name: 'ribbonFast', label: 'Ribbon, bullish', value: '#aafd35', group: 'layers' },
  { name: 'ribbonSlow', label: 'Ribbon, bearish', value: '#ff293a', group: 'layers' },
  { name: 'ema200', label: 'EMA 200', value: '#ffb03a', group: 'layers' },
  { name: 'tpo', label: 'Value area', value: '#5f9f3a', group: 'tpo' },
  { name: 'tpoOutside', label: 'Outside value', value: '#858c86', group: 'tpo' },
  { name: 'tpoPoc', label: 'Point of control', value: '#e6f5d3', group: 'tpo' },
  { name: 'drawing', label: 'Drawings', value: '#ff5fd2', group: 'drawings' },
  { name: 'drawingSelected', label: 'Selected drawing', value: '#ffa8e6', group: 'drawings' },
  { name: 'study0', label: 'Indicator 1', value: '#7fb2ff', group: 'studies' },
  { name: 'study1', label: 'Indicator 2', value: '#c58fff', group: 'studies' },
  { name: 'study2', label: 'Indicator 3', value: '#ffd166', group: 'studies' },
  { name: 'study3', label: 'Indicator 4', value: '#4ecdc4', group: 'studies' },
  { name: 'study4', label: 'Indicator 5', value: '#ff8fab', group: 'studies' },
  { name: 'study5', label: 'Indicator 6', value: '#9ae66e', group: 'studies' },
];

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
