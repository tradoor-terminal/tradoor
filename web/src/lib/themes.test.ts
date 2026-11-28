import { assert, assertEquals } from 'jsr:@std/assert';
import { THEME_KEYS, THEMES, themeOf, withTheme } from './themes.ts';

const SWITCHES = ['candleBody', 'candleBorder', 'candleWick', 'candlePrev', 'grid', 'gridAxes', 'gradient'];

/** WCAG's contrast of two colours, 1 to 21. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

Deno.test('every theme keeps its axis text, page text and TPO readable on its background', () => {
  for (const t of THEMES.slice(1)) {
    const c = t.colors;
    assert(contrast(c.text!, c.background!) >= 3, `${t.id}: axis text ${contrast(c.text!, c.background!).toFixed(2)}`);
    assert(contrast(c['ui.text']!, c['ui.surface']!) >= 7, `${t.id}: page text ${contrast(c['ui.text']!, c['ui.surface']!).toFixed(2)}`);
    assert(contrast(c.tpoPoc!, c.background!) >= 3, `${t.id}: point of control ${contrast(c.tpoPoc!, c.background!).toFixed(2)}`);
    assert(contrast(c.tpo!, c.background!) >= 1.8, `${t.id}: value area ${contrast(c.tpo!, c.background!).toFixed(2)}`);
    assert(contrast(c.tpoOutside!, c.background!) >= 1.3, `${t.id}: outside value ${contrast(c.tpoOutside!, c.background!).toFixed(2)}`);
  }
});

Deno.test('every theme sets only colours a workspace has, as colours', () => {
  for (const t of THEMES) {
    for (const [k, v] of Object.entries(t.colors)) {
      assert(THEME_KEYS.includes(k), `${t.id}: ${k} is no theme key`);
      const ok = k === 'ui.scheme' ? v === 'light' || v === 'dark' : SWITCHES.includes(k) ? v === '0' || v === '1' || /^[012]$/.test(v) : /^#[0-9a-f]{6}$/i.test(v);
      assert(ok, `${t.id}: ${k} = ${v}`);
    }
  }
  assertEquals(THEMES[0]!.colors, {}, 'tradoor dark is the defaults themselves');
});

Deno.test('a light theme says so, for the browser’s own controls', () => {
  for (const t of THEMES) {
    const light = (t.colors['ui.bg'] ?? '#000000').replace('#', '');
    const bright = parseInt(light.slice(0, 2), 16) > 128;
    assertEquals(t.colors['ui.scheme'] === 'light', bright, t.id);
  }
});

Deno.test('a theme picked is that theme, until a colour of it changes', () => {
  for (const t of THEMES) assertEquals(themeOf(withTheme({}, t)), t.id);
  const tweaked = { ...withTheme({}, THEMES[1]!), bull: '#123456' };
  assertEquals(themeOf(tweaked), null, 'one colour changed by hand is a theme of your own');
  assertEquals(themeOf({ ...withTheme({}, THEMES[0]!), grid: '0', candleBorder: '0' }), THEMES[0]!.id, 'a switch set back to its default by hand');
  assertEquals(themeOf({ ...withTheme({}, THEMES[0]!), grid: '1' }), null, 'the grid is part of the theme');
});

Deno.test('picking a theme keeps the font and the time zone', () => {
  const before = { fontPx: '13', 'ui.timeZone': 'Asia/Jakarta', bull: '#111111', 'ui.scheme': 'light' };
  const after = withTheme(before, THEMES[1]!);
  assertEquals(after.fontPx, '13');
  assertEquals(after['ui.timeZone'], 'Asia/Jakarta');
  assertEquals(after.bull, THEMES[1]!.colors.bull);
  assertEquals(after['ui.scheme'], undefined, 'a dark theme leaves no light scheme behind');
});
