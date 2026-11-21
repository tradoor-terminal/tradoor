/**
 * The tradoor owl over a live chart, bottom left of its price pane, where the
 * engine leaves it to the page (`set_page_mark`): every ten seconds it gives a
 * short hop and a turn of the head, a moment's play with nothing running
 * between, and a click opens the partners' rewards. A picture of the chart
 * gets the owl stamped in the same corner (lib/capture-title).
 */
import { onCleanup, onMount } from 'solid-js';
import { setOverlay } from '../app/ui';
import { tl } from '../lib/i18n';

const EVERY_MS = 10_000;
const PLAY_MS = 1_400;
/** Every mark on the page plays at once, from one clock. */
const marks = new Set<() => void>();
let clock: ReturnType<typeof setInterval> | undefined;
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ChartMark(props: { x: number; y: number; paused: boolean }) {
  let owl: HTMLImageElement | undefined;
  const play = () => {
    if (props.paused || document.hidden || still() || !owl) return;
    for (const a of owl.getAnimations()) a.cancel();
    // Up off its perch, a look one way and the other, and down again.
    owl.animate(
      [
        { transform: 'translateY(0) rotate(0)', offset: 0 },
        { transform: 'translateY(-4px) rotate(-8deg)', offset: 0.25 },
        { transform: 'translateY(-4px) rotate(8deg)', offset: 0.55 },
        { transform: 'translateY(0) rotate(0)', offset: 0.8 },
        { transform: 'translateY(0) rotate(0)', offset: 1 },
      ],
      { duration: PLAY_MS, easing: 'ease-in-out' },
    );
  };
  onMount(() => {
    marks.add(play);
    clock ??= setInterval(() => marks.forEach((p) => p()), EVERY_MS);
    onCleanup(() => {
      marks.delete(play);
      if (marks.size === 0) {
        clearInterval(clock);
        clock = undefined;
      }
    });
  });
  return (
    <button
      class="chart-mark"
      style={{ left: `${props.x}px`, top: `${props.y}px` }}
      aria-label={tl('Support tradoor')}
      data-tip="Support tradoor"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => setOverlay({ kind: 'referrals' })}
    >
      <img ref={owl} src="/logo.svg" width="34" height="34" alt="" draggable={false} />
    </button>
  );
}
