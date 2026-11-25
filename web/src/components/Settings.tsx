import { setSettingsSection, settingsSection, setSmoothZoom, smoothZoom } from '../app/ui';
import { createSignal, For, type JSX, lazy, onCleanup, Show } from 'solid-js';
import { api, errorText, type TelegramStatus } from '../lib/api';
import { OWNER_PATTERN, ownerId, session, switchOwner } from '../lib/owner';
import { ALL_EXCHANGES, ExchangeLogo } from '../lib/exchanges';
import { Icon, type IconName } from '../lib/icons';
import { deviceZone, LOCAL_ZONE, offsetLabel, offsetMinutes, TIME_ZONE_KEY, timeZone } from '../lib/timezone';
import { CANDLE_PARTS, CHART_THEME, FONT_BOLD, FONT_PX, TEXT_SCALE, UI_THEME } from '../lib/theme';
import { THEMES, themeOf, withTheme, type ThemePreset } from '../lib/themes';
import { LayoutsMenu } from './LayoutsMenu';
import { formatDateTime } from '../lib/timezone';
import { doc, resetWorkspace, setThemeValue, update } from '../workspace/store';
import { AccountCard, clock } from './Account';
import { forgetRecorded, KEEP_DAYS, recorderSettings, setRecorderSettings } from '../lib/fp-recorder';
import { usage } from '../lib/fp-store';
import { symbolOf, venueLabel } from '../lib/markets';
import { tl, tlf } from '../lib/i18n';
import { LANGS, useLang } from '../lib/i18n-load';

function Swatch(props: { name: string; label: string; fallback: string }) {
  const value = () => doc.theme[props.name] ?? props.fallback;
  return (
    <label class="swatch" classList={{ changed: !!doc.theme[props.name] }}>
      <input type="color" value={value()} onInput={(e) => setThemeValue(props.name, e.currentTarget.value)} />
      <span class="name">{tl(props.label)}</span>
      <span class="num dim">{value()}</span>
      <Show when={doc.theme[props.name]}>
        <button
          class="dim"
          data-tip="Back to the default"
          aria-label={tl('Back to the default')}
          onClick={(e) => {
            e.preventDefault();
            setThemeValue(props.name, null);
          }}
        >
          ↺
        </button>
      </Show>
    </label>
  );
}

/** What a chart colour colours: Settings sets them out by it. */
type ChartGroup = 'canvas' | 'candles' | 'layers' | 'tpo' | 'drawings' | 'studies';

/** Each chart colour's name in Settings, and the group it is set out in: kept here, out of the page's first load. */
const CHART_LABELS: Record<string, [string, ChartGroup]> = {
  background: ['Background', 'canvas'],
  border: ['Grid and borders', 'canvas'],
  text: ['Axis text', 'canvas'],
  labelBackground: ['Axis labels', 'canvas'],
  crosshair: ['Crosshair', 'canvas'],
  bull: ['Up candles', 'candles'],
  bear: ['Down candles', 'candles'],
  line: ['Line chart', 'candles'],
  ribbonFast: ['Ribbon, bullish', 'layers'],
  ribbonSlow: ['Ribbon, bearish', 'layers'],
  ema200: ['EMA 200', 'layers'],
  tpo: ['Value area', 'tpo'],
  tpoOutside: ['Outside value', 'tpo'],
  tpoPoc: ['Point of control', 'tpo'],
  drawing: ['Drawings', 'drawings'],
  drawingSelected: ['Selected drawing', 'drawings'],
  study0: ['Indicator 1', 'studies'],
  study1: ['Indicator 2', 'studies'],
  study2: ['Indicator 3', 'studies'],
  study3: ['Indicator 4', 'studies'],
  study4: ['Indicator 5', 'studies'],
  study5: ['Indicator 6', 'studies'],
};
const chartColours = (group: ChartGroup) => CHART_THEME.filter((t) => CHART_LABELS[t.name]?.[1] === group).map((t) => ({ ...t, label: CHART_LABELS[t.name]![0] }));

/** The chart's colours set out by what they colour, each group with a word on where it shows. */
const CHART_GROUPS: readonly { group: ChartGroup; title: string; hint: string }[] = [
  { group: 'canvas', title: 'Chart', hint: 'Behind and around the bars' },
  { group: 'tpo', title: 'TPO', hint: 'Profiles, where the chart draws them' },
  { group: 'drawings', title: 'Drawings', hint: 'New drawings, and the one picked' },
];

/** A colour as a small square to click, `fallback` where none is set. */
function ChipSwatch(props: { name: string; fallback: () => string; tip: string }) {
  return (
    <label class="chip-swatch" classList={{ changed: !!doc.theme[props.name] }} style={{ background: doc.theme[props.name] ?? props.fallback() }} data-tip={tl(props.tip)}>
      <input type="color" value={doc.theme[props.name] ?? props.fallback()} onInput={(e) => setThemeValue(props.name, e.currentTarget.value)} />
    </label>
  );
}

/**
 * The candles: their body, borders and wicks, each on or off with an up and a down colour,
 * the borders and wicks taking the body's until set; and up against the close before, if asked.
 */
function CandleColours() {
  const theme = (name: string) => doc.theme[name] ?? CHART_THEME.find((t) => t.name === name)?.value ?? '#000000';
  const on = (key: string, fallback: string) => (doc.theme[key] ?? fallback) === '1';
  const flip = (key: string, fallback: string) => setThemeValue(key, on(key, fallback) ? '0' : '1');
  const parts = [
    { key: CANDLE_PARTS.body, fallback: '1', label: 'Body', up: 'bull', down: 'bear' },
    { key: CANDLE_PARTS.border, fallback: '0', label: 'Borders', up: 'borderUp', down: 'borderDown' },
    { key: CANDLE_PARTS.wick, fallback: '1', label: 'Wick', up: 'wickUp', down: 'wickDown' },
  ];
  const changed = () => [...parts.flatMap((p) => [p.key, p.up, p.down]), CANDLE_PARTS.previous].some((k) => doc.theme[k] !== undefined);
  return (
    <>
      <label class="check candle-check">
        <input type="checkbox" checked={on(CANDLE_PARTS.previous, '0')} onChange={() => flip(CANDLE_PARTS.previous, '0')} />
        {tl('Colour bars by the close before them')}
      </label>
      <For each={parts}>
        {(p) => (
          <div class="candle-part" classList={{ off: !on(p.key, p.fallback) }}>
            <label class="check">
              <input type="checkbox" checked={on(p.key, p.fallback)} onChange={() => flip(p.key, p.fallback)} />
              {tl(p.label)}
            </label>
            <ChipSwatch name={p.up} fallback={() => theme('bull')} tip="Up" />
            <ChipSwatch name={p.down} fallback={() => theme('bear')} tip="Down" />
          </div>
        )}
      </For>
      <Show when={changed()}>
        <button class="dim candle-reset" onClick={() => [...parts.flatMap((p) => [p.key, p.up, p.down]), CANDLE_PARTS.previous].forEach((k) => setThemeValue(k, null))}>
          ↺ {tl('Back to the defaults')}
        </button>
      </Show>
      <div class="swatches one">
        <Swatch name="line" label="Line chart" fallback={theme('line')} />
      </div>
    </>
  );
}

/** The chart's grid, kept with the theme: on (`1`) or off, the default, and its colour. */
const GRID = { on: 'grid', color: 'gridColor' } as const;

/** The grid behind the chart: off unless ticked, in the grid and borders' colour unless given its own. */
function GridColour() {
  const on = () => doc.theme[GRID.on] === '1';
  return (
    <div class="candle-part" classList={{ off: !on() }}>
      <label class="check">
        <input type="checkbox" checked={on()} onChange={() => setThemeValue(GRID.on, on() ? null : '1')} />
        {tl('Grid lines')}
      </label>
      <ChipSwatch name={GRID.color} fallback={() => doc.theme.border ?? CHART_THEME.find((t) => t.name === 'border')!.value} tip="Grid colour" />
    </div>
  );
}

/** The indicators' own colours, taken in turn as they are added: a row of six. */
function Palette() {
  const keys = chartColours('studies');
  return (
    <div class="study-colors">
      <For each={keys}>
        {(t, i) => (
          <label class="chip-swatch" classList={{ changed: !!doc.theme[t.name] }} style={{ background: doc.theme[t.name] ?? t.value }} data-tip={tl(t.label)}>
            <input type="color" value={doc.theme[t.name] ?? t.value} onInput={(e) => setThemeValue(t.name, e.currentTarget.value)} />
            <span>{i() + 1}</span>
          </label>
        )}
      </For>
      <Show when={keys.some((t) => doc.theme[t.name])}>
        <button class="dim" data-tip="Back to the defaults" aria-label={tl('Back to the defaults')} onClick={() => keys.forEach((t) => setThemeValue(t.name, null))}>
          ↺
        </button>
      </Show>
    </div>
  );
}

/** Local first — the default — then UTC, then every named zone with its offset now. */
function zoneChoices(): { value: string; label: string }[] {
  const now = Date.now();
  const named = (typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [])
    .filter((z) => z !== 'UTC')
    .map((z) => ({ zone: z, offset: offsetMinutes(z, now) }))
    .sort((a, b) => a.offset - b.offset || a.zone.localeCompare(b.zone));
  return [
    { value: LOCAL_ZONE, label: `Local — ${deviceZone()} (${offsetLabel(offsetMinutes(LOCAL_ZONE, now))})` },
    { value: 'UTC', label: 'UTC' },
    ...named.map((z) => ({ value: z.zone, label: `${z.zone.replaceAll('_', ' ')} (${offsetLabel(z.offset)})` })),
  ];
}

/** How long a message stays in the chat. Telegram refuses to take back one older than 48 hours. */
const CLEARING = [
  { value: '47', label: '2 days, then cleared' },
  { value: '24', label: '1 day, then cleared' },
  { value: '6', label: '6 hours, then cleared' },
  { value: 'keep', label: 'Keep every message' },
];

/** A labelled line of a card: what it is on the left, its control on the right. */
function Row(props: { label: string; tip?: string; children: JSX.Element }) {
  return (
    <div class="set-row">
      <span class="label" data-tip={props.tip}>
        {tl(props.label)}
      </span>
      <div class="grow">{props.children}</div>
    </div>
  );
}

function AccountSection() {
  return (
    <>
      <h2>{tl('Account')}</h2>
      <p class="lead">
        {tl('Your drawings, journal, layout, watchlists and alerts are kept on the server. Sign in with Telegram and they follow you — after clearing this browser\'s history, or on another device, sign in again to have them back.')}
      </p>
      <AccountCard />
    </>
  );
}

/**
 * Alerts on Telegram. A bot cannot open a conversation, so the reader does:
 * the link carries a one-use code that tells the server which browser the chat
 * belongs to. While it is open the status is read again, so the chat appears
 * here the moment the bot has it.
 */
function TelegramSection() {
  const [status, setStatus] = createSignal<TelegramStatus | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [note, setNote] = createSignal<string | null>(null);
  const [waiting, setWaiting] = createSignal(false);

  const load = async () => {
    try {
      const next = await api.telegram();
      // A code is good for fifteen minutes and spent once, so keep a fresh one
      // in hand: one when this opens, another after a chat takes the last.
      const linked = status()?.chats.length ?? 0;
      if (next.enabled && next.bot && (!invite() || next.chats.length !== linked)) void mint();
      setStatus(next);
      setError(null);
      // Their zone changed, or summer time moved it: the chats follow.
      const now = clock();
      if (next.chats.some((c) => c.offsetMinutes !== now.offsetMinutes || c.zone !== now.zone)) {
        await api.telegramClock(now);
        setStatus(await api.telegram());
      }
    } catch (e) {
      setError(errorText(e));
    }
  };
  void load();
  // While a link is out, watch for the chat to arrive; otherwise keep it fresh.
  const timer = setInterval(() => void load().then(() => setWaiting((w) => w && (status()?.chats.length ?? 0) === 0)), 3_000);
  onCleanup(() => clearInterval(timer));

  const [invite, setInvite] = createSignal<{ url: string; code: string } | null>(null);
  const mint = async () => {
    try {
      const { url, code } = await api.telegramLink(clock());
      setInvite({ url, code });
    } catch {
      setInvite(null); // The bot may not have answered yet; the status line says so.
    }
  };

  const act = async (what: () => Promise<unknown>, done: string) => {
    setError(null);
    try {
      await what();
      setNote(done);
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <>
      <h2>{tl('Telegram alerts')}</h2>
      <p class="lead">{tl('Price alerts and the signals you turn on fire on the server, so they reach these chats whether or not a tab is open.')}</p>
      <Show when={status()} fallback={<div class="dim">{error() ?? tl('Reading…')}</div>}>
        {(s) => (
          <Show when={s().enabled} fallback={<div class="set-card dim">{tl('This server has no Telegram bot set up. Give it one with TRADOOR_TELEGRAM_TOKEN.')}</div>}>
            <div class="set-card">
              <h3>{tl('Chats')}</h3>
              <For each={s().chats} fallback={<div class="dim">{tl('No chat yet. Signing in with Telegram links yours, or connect one here.')}</div>}>
                {(chat) => (
                  <div class="set-row">
                    <Icon name="send" size={13} />
                    <span class="grow">{chat.name ?? tlf('Chat {0}', chat.chatId)}</span>
                    <span class="num dim">{tl('linked')} {formatDateTime(chat.linkedAt).slice(0, 16)}</span>
                    <button class="btn" onClick={() => void act(() => api.telegramUnlink(chat.chatId), 'Disconnected.')}>
                      {tl('Disconnect')}
                    </button>
                  </div>
                )}
              </For>
              <div class="set-actions">
                <Show when={invite()} fallback={<span class="dim">{s().bot ? tl('Making a link…') : tl('The bot has not answered yet.')}</span>}>
                  {(link) => (
                    <>
                      <a class="btn" href={link().url} target="_blank" rel="noopener" onClick={() => setWaiting(true)}>
                        {s().chats.length > 0 ? tl('Connect another chat') : tl('Connect Telegram')}
                      </a>
                      <span class="dim num" data-tip="Or send the bot /start with this code">
                        /start {link().code}
                      </span>
                    </>
                  )}
                </Show>
                <Show when={s().chats.length > 0}>
                  <button class="btn" onClick={() => void act(() => api.telegramTest(), 'Test message sent.')}>
                    {tl('Send a test')}
                  </button>
                </Show>
                <Show when={waiting()}>
                  <span class="warn">{tl('waiting for Telegram…')}</span>
                </Show>
              </div>
            </div>
            <Show when={s().chats.length > 0}>
              <div class="set-card">
                <h3>{tl('Messages')}</h3>
                <Row label="Messages stay" tip="The bot takes its own messages back when their time is up, so the chat does not fill with old alerts. Telegram only allows this within 48 hours of sending.">
                  <select class="box wide" onChange={(e) => void act(() => api.telegramClearing(e.currentTarget.value === 'keep' ? null : Number(e.currentTarget.value)), 'Saved.')}>
                    <For each={CLEARING}>
                      {(c) => (
                        <option value={c.value} selected={String(s().chats[0]?.clearAfterHours ?? 'keep') === c.value}>
                          {tl(c.label)}
                        </option>
                      )}
                    </For>
                  </select>
                </Row>
                <div class="dim">{tl('Times in them are written in')} {offsetLabel(clock().offsetMinutes)}{tl(', the zone set under General.')}</div>
              </div>
            </Show>
          </Show>
        )}
      </Show>
      <Show when={error()}>{(e) => <div class="warn">▲ {e()}</div>}</Show>
      <Show when={note() && !error()}>{(n) => <div class="dim">{n()}</div>}</Show>
    </>
  );
}

/** The page's text sizes to pick from, as a share of the usual. */
const TEXT_SCALES: readonly { value: string; label: string }[] = [
  { value: '0.9', label: 'Smaller (90%)' },
  { value: '1', label: 'Normal' },
  { value: '1.1', label: 'Larger (110%)' },
  { value: '1.2', label: 'Large (120%)' },
  { value: '1.35', label: 'Largest (135%)' },
];

/** Text: how big the page's and the charts' are, and bold. Kept with the workspace, apart from the theme: picking a theme leaves it. */
function TextCard() {
  const scale = () => doc.theme[TEXT_SCALE.name] ?? TEXT_SCALE.value;
  return (
    <>
      <h3 class="set-sub">{tl('Text')}</h3>
      <p class="lead">{tl('How big the writing is on the page and on the charts, and whether it is bold. It follows the workspace; a theme picked later leaves it as it is.')}</p>
      <div class="set-card">
        <Row label="Page text" tip="Every panel's writing — legends, tables, menus — larger or smaller, the layout around it unchanged">
          <select class="box wide" onChange={(e) => setThemeValue(TEXT_SCALE.name, e.currentTarget.value === TEXT_SCALE.value ? null : e.currentTarget.value)}>
            <For each={TEXT_SCALES}>
              {(s) => (
                <option value={s.value} selected={scale() === s.value}>
                  {tl(s.label)}
                </option>
              )}
            </For>
          </select>
        </Row>
        <Row label="Chart text (px)" tip="The charts' own writing: the price and time axes, their labels, footprint numbers">
          <input
            class="box num"
            type="number"
            min={8}
            max={20}
            value={doc.theme[FONT_PX.name] ?? FONT_PX.value}
            onChange={(e) => {
              const px = Number(e.currentTarget.value);
              setThemeValue(FONT_PX.name, px >= 8 && px <= 20 && String(px) !== FONT_PX.value ? String(px) : null);
            }}
          />
        </Row>
        <Row label="Bold" tip="Heavier writing on the page and on the charts, easier to read on a bright or distant screen">
          <label class="set-check">
            <input type="checkbox" checked={doc.theme[FONT_BOLD.name] === '1'} onChange={(e) => setThemeValue(FONT_BOLD.name, e.currentTarget.checked ? '1' : null)} />
            <span>{doc.theme[FONT_BOLD.name] === '1' ? tl('Bold text on the page and the charts') : tl('Regular text')}</span>
          </label>
        </Row>
      </div>
    </>
  );
}

/** The page's language: English, or one of the translations, kept in this browser. */
function LanguageRow() {
  const [code, setCode] = createSignal(document.documentElement.lang.slice(0, 2) || 'en');
  return (
    <Row label="Language" tip="The page's language. Prices and numbers keep their usual form; a phrase not translated yet shows in English">
      <select
        class="box wide"
        onChange={(e) => {
          const next = e.currentTarget.value;
          setCode(next);
          void useLang(next, true);
        }}
      >
        <For each={LANGS}>
          {(l) => (
            <option value={l.code} selected={code() === l.code}>
              {l.name}
            </option>
          )}
        </For>
      </select>
    </Row>
  );
}

function GeneralSection() {
  return (
    <>
      <h2>{tl('General')}</h2>
      <p class="lead">{tl('The workspace\'s name, the clock every time on the page is written in, and the size of its text.')}</p>
      <div class="set-card">
        <LanguageRow />
        <Row label="Workspace name">
          <input
            class="box wide"
            value={doc.name}
            maxLength={120}
            onChange={(e) => {
              const name = e.currentTarget.value.trim();
              if (name) update((d) => void (d.name = name));
            }}
          />
        </Row>
        <Row label="Time zone" tip="Every time on the page — axis, crosshair, tape, clock — and in Telegram messages. Daily and longer candles keep their exchange (UTC) dates.">
          <select class="box wide" onChange={(e) => setThemeValue(TIME_ZONE_KEY, e.currentTarget.value === LOCAL_ZONE ? null : e.currentTarget.value)}>
            <For each={zoneChoices()}>
              {(z) => (
                <option value={z.value} selected={timeZone() === z.value}>
                  {tl(z.label)}
                </option>
              )}
            </For>
          </select>
        </Row>
        <Row label="Mouse wheel zoom" tip="How a notch of a mouse wheel zooms a chart: at once, a step a notch, or eased out over a fifth of a second. A trackpad and a pinch are smooth either way.">
          <select class="box wide" onChange={(e) => setSmoothZoom(e.currentTarget.value === 'smooth')}>
            <option value="step" selected={!smoothZoom()}>
              {tl('In steps (default)')}
            </option>
            <option value="smooth" selected={smoothZoom()}>
              {tl('Smooth')}
            </option>
          </select>
        </Row>
      </div>
      <TextCard />
      <BrowserFootprints />
    </>
  );
}

const megabytes = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : bytes > 0 ? `${Math.max(1, Math.round(bytes / 1e3))} KB` : 'nothing');

/** Footprints recorded in this browser: whether, for how long, and what they take — each deletable. */
function BrowserFootprints() {
  const [used, setUsed] = createSignal<{ market: string; minutes: number; bytes: number }[] | null>(null);
  const [site, setSite] = createSignal<{ usage: number; quota: number } | null>(null);
  const refresh = () => {
    void usage()
      .then(setUsed)
      .catch(() => setUsed([]));
    void navigator.storage
      ?.estimate()
      .then((e) => setSite({ usage: e.usage ?? 0, quota: e.quota ?? 0 }))
      .catch(() => {});
  };
  refresh();
  const total = () => (used() ?? []).reduce((sum, m) => sum + m.bytes, 0);
  const remove = (market?: string) => {
    const what = market ? `${symbolOf(market)} (${venueLabel(market)})'s footprint` : 'every footprint';
    if (!confirm(`Delete ${what} recorded in this browser? This cannot be undone; the server's own markets are not touched.`)) return;
    void forgetRecorded(market).then(refresh);
  };
  return (
    <>
      <h3 class="set-sub">{tl('Footprints in this browser')}</h3>
      <p class="lead">{tl('For every market the server does not record, the footprint is recorded here, in this browser alone, while a chart shows it. Nothing is sent to the server, and another device keeps its own.')}</p>
      <div class="set-card">
        <Row label="Record" tip="Off, footprints show only for the markets the server records">
          <label class="set-check">
            <input type="checkbox" checked={recorderSettings().on} onChange={(e) => setRecorderSettings({ on: e.currentTarget.checked })} />
            <span>{recorderSettings().on ? tl('Recording the markets on your charts') : tl('Not recording')}</span>
          </label>
        </Row>
        <Row label="Keep" tip="Older minutes are deleted on their own">
          <select class="box wide" onChange={(e) => setRecorderSettings({ days: Number(e.currentTarget.value) })}>
            <For each={KEEP_DAYS}>
              {(d) => (
                <option value={d} selected={recorderSettings().days === d}>
                  {d === 1 ? tl('The last day') : tlf('The last {0} days', d)}
                </option>
              )}
            </For>
          </select>
        </Row>
        <Row label="Stored here">
          <div class="set-actions">
            <span class="num">{used() === null ? '…' : tlf('{0} · {1} market{2}', megabytes(total()), used()!.length, used()!.length === 1 ? '' : 's')}</span>
            <Show when={site()}>{(s) => <span class="dim">{tl('of')} {megabytes(s().usage)} {tl('this site uses; the browser allows')} {megabytes(s().quota)}</span>}</Show>
            <Show when={(used() ?? []).length > 0}>
              <button class="btn danger" onClick={() => remove()}>
                {tl('Delete all')}
              </button>
            </Show>
          </div>
        </Row>
        <Show when={(used() ?? []).length > 0}>
          <div class="fp-used">
            <For each={used()!}>
              {(m) => (
                <div class="fp-used-row">
                  <span class="sym">
                    {symbolOf(m.market)} <span class="dim">{venueLabel(m.market)}</span>
                  </span>
                  <span class="num dim">{Math.round(m.minutes / 60)} {tl('h')}</span>
                  <span class="num">{megabytes(m.bytes)}</span>
                  <button class="dim" data-tip={tlf('Delete {0}\'s footprint', symbolOf(m.market))} aria-label={tlf('Delete {0}\'s footprint', symbolOf(m.market))} onClick={() => remove(m.market)}>
                    ✕
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </>
  );
}

/** The chart a theme draws, small: its background, a few candles each way, and the page's accent under it. */
function ThemePreview(props: { theme: ThemePreset }) {
  const color = (name: string): string => props.theme.colors[name] ?? [...CHART_THEME, ...UI_THEME].find((t) => t.name === name)?.value ?? '#000000';
  const candles = [6, 10, 7, 13, 9, 15, 12, 18];
  return (
    <span class="theme-preview" style={{ background: color('background'), 'border-color': color('ui.border') }}>
      <For each={candles}>{(h, i) => <i style={{ height: `${h * 3}%`, background: color(i() % 3 === 2 ? 'bear' : 'bull') }} />}</For>
      <b style={{ background: color('ui.primary') }} />
    </span>
  );
}

function ThemesSection() {
  const current = () => themeOf(doc.theme);
  const pick = (t: ThemePreset) => update((d) => void (d.theme = withTheme(d.theme, t)));
  return (
    <>
      <h2>{tl('Themes')}</h2>
      <p class="lead">{tl('A theme colours the chart and the page around it, and is kept with the workspace, so it follows your account too.')}</p>
      <div class="themes">
        <For each={THEMES}>
          {(t) => (
            <button class="theme-card" classList={{ on: current() === t.id }} aria-pressed={current() === t.id} onClick={() => pick(t)}>
              <ThemePreview theme={t} />
              <span class="theme-name">{t.name}</span>
              <span class="theme-note">{tl(t.note)}</span>
            </button>
          )}
        </For>
      </div>
      <h3 class="set-sub">{current() ? tl('Fine-tune it') : tl('Your own colours')}</h3>
      <p class="lead">{tl('Any colour changed here makes the theme your own; ↺ puts one back to the default.')}</p>
      <div class="set-card">
        <div class="color-groups">
          <For each={CHART_GROUPS}>
            {(g) => (
              <section class="color-group">
                <h4>{tl(g.title)}</h4>
                <p>{tl(g.hint)}</p>
                <Show when={g.group === 'canvas'}>
                  <GridColour />
                </Show>
                <div class="swatches one">
                  <For each={chartColours(g.group)}>{(t) => <Swatch name={t.name} label={tl(t.label)} fallback={t.value} />}</For>
                </div>
              </section>
            )}
          </For>
          <section class="color-group">
            <h4>{tl('Candles and line')}</h4>
            <p>{tl('Each part on or off, up and down')}</p>
            <CandleColours />
          </section>
          <section class="color-group">
            <h4>{tl('Indicators')}</h4>
            <p>{tl('Taken in turn as indicators are added; each one\'s own colour is in its settings')}</p>
            <Palette />
          </section>
        </div>
        <p class="lead">{tl('The size of the chart\'s text, and bold, are in General → Text.')}</p>
      </div>
      <div class="set-card">
        <h3>{tl('Page')}</h3>
        <div class="swatches">
          <For each={UI_THEME}>{(t) => <Swatch name={t.name} label={tl(t.label)} fallback={t.value} />}</For>
        </div>
      </div>
      <div class="set-actions">
        <button class="btn" onClick={() => pick(THEMES[0]!)}>
          {tl('Back to tradoor dark')}
        </button>
      </div>
    </>
  );
}

function LayoutsSection() {
  return (
    <>
      <h2>{tl('Layouts')}</h2>
      <p class="lead">{tl('Start from a recommended layout, keep your own by name, or carry one as a file. The same as Layouts in the top bar.')}</p>
      <div class="set-card">
        <LayoutsMenu inSettings />
      </div>
    </>
  );
}

function AdvancedSection(props: { onClose(): void }) {
  return (
    <>
      <h2>{tl('Advanced')}</h2>
      <p class="lead">{tl('What signing in does for you, by hand, and the switches to start over.')}</p>
      <div class="set-card">
        <h3>{tl('Browser id')}</h3>
        <OwnerRows />
      </div>
      <div class="set-card">
        <h3>{tl('Exchanges')}</h3>
        <div class="swatches one">
          <For each={ALL_EXCHANGES}>
            {(x) => (
              <span class="swatch">
                <ExchangeLogo exchange={x} size={16} />
                <span class="name">{x.name}</span>
                <span class={x.live ? 'bull' : 'dim'}>{x.live ? tl('live') : tl('coming later')}</span>
              </span>
            )}
          </For>
        </div>
      </div>
      <div class="set-card danger">
        <h3>{tl('Start over')}</h3>
        <div class="set-row">
          <span class="grow dim">{tl('Replace this workspace\'s panels and layout with the default. Drawings and alerts stay.')}</span>
          <button
            class="btn danger"
            onClick={() => {
              if (!confirm('Replace this workspace with the default layout?')) return;
              resetWorkspace();
              props.onClose();
            }}
          >
            {tl('Reset workspace')}
          </button>
        </div>
      </div>
    </>
  );
}

/** This browser's id, to copy — and another's, to take its drawings and layout over. A
 *  signed-in browser has a session instead, and nothing here to copy. */
function OwnerRows() {
  const [other, setOther] = createSignal('');
  const [copied, setCopied] = createSignal(false);
  if (session()) {
    return <p class="note">{tl('This browser is signed in: it opens the account with a session of its own, which signing out ends. There is no id to copy — sign in with Telegram on the other device instead.')}</p>;
  }
  return (
    <>
      <Row label="This browser's id">
        <div class="set-inline">
          <input class="box wide num" readOnly value={ownerId()} onFocus={(e) => e.currentTarget.select()} />
          <button class="btn" onClick={() => void navigator.clipboard?.writeText(ownerId()).then(() => setCopied(true))}>
            {copied() ? tl('Copied') : tl('Copy')}
          </button>
        </div>
      </Row>
      <Row label="Use another id">
        <div class="set-inline">
          <input class="box wide num" value={other()} placeholder={tl('paste the id from your other device')} onInput={(e) => setOther(e.currentTarget.value)} />
          <button
            class="btn"
            disabled={!OWNER_PATTERN.test(other().trim())}
            onClick={() => {
              if (confirm("Switch to that id's drawings and layout? This browser's stay under its own id.")) switchOwner(other().trim());
            }}
          >
            {tl('Use')}
          </button>
        </div>
      </Row>
      <p class="note">
        {tl('Everything is kept on the server under this id, and only this browser sends it. Keep it to yourself — whoever has it can change your things. An account\'s id does not open the account: sign in with Telegram for that.')}
      </p>
    </>
  );
}

const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'account', label: 'Account', icon: 'user' },
  { id: 'telegram', label: 'Telegram', icon: 'send' },
  // Signed in with Telegram only: an account to keep the trading accounts with.
  { id: 'trading', label: 'Trading accounts', icon: 'layers' },
  { id: 'general', label: 'General', icon: 'settings' },
  { id: 'themes', label: 'Themes', icon: 'droplet' },
  { id: 'layouts', label: 'Layouts', icon: 'layout' },
  { id: 'advanced', label: 'Advanced', icon: 'command' },
];
/** The section open last, for the next time Settings opens. */
const section = settingsSection;
const setSection = setSettingsSection;
/** The trading accounts, loaded with the order system the first time they are opened. */
const TradingSettings = lazy(() => import('../trade/TradingSettings'));
/** Trading accounts are for those signed in with Telegram; a local build, with no bot to sign in through, opens them as is. */
const tradingOpen = () => import.meta.env.DEV || !!session();

export function Settings(props: { onClose(): void }) {
  return (
    <div class="backdrop" onPointerDown={() => props.onClose()}>
      <div
        class="dialog settings"
        tabIndex={-1}
        ref={(el) => queueMicrotask(() => el.focus())}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.stopPropagation();
          props.onClose();
        }}
      >
        <header>
          <span class="title caps">{tl('Settings')}</span>
          <span class="spacer" />
          <button class="x" onClick={() => props.onClose()}>
            {tl('esc ✕')}
          </button>
        </header>
        <div class="set">
          <nav class="set-nav">
            <For each={SECTIONS.filter((s) => s.id !== 'trading' || tradingOpen())}>
              {(s) => (
                <button classList={{ on: section() === s.id }} onClick={() => setSection(s.id)}>
                  <Icon name={s.icon} size={14} />
                  <span>{tl(s.label)}</span>
                </button>
              )}
            </For>
          </nav>
          <div class="set-body">
            <Show when={section() === 'account'}>
              <AccountSection />
            </Show>
            <Show when={section() === 'telegram'}>
              <TelegramSection />
            </Show>
            <Show when={section() === 'trading'}>
              <Show when={tradingOpen()} fallback={<p class="dim">{tl('Sign in with Telegram (Account, above) to add trading accounts.')}</p>}>
                <TradingSettings />
              </Show>
            </Show>
            <Show when={section() === 'general'}>
              <GeneralSection />
            </Show>
            <Show when={section() === 'themes'}>
              <ThemesSection />
            </Show>
            <Show when={section() === 'layouts'}>
              <LayoutsSection />
            </Show>
            <Show when={section() === 'advanced'}>
              <AdvancedSection onClose={props.onClose} />
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
