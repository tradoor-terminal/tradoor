/**
 * The tradoor owl over a live chart, bottom left of its price pane, where the
 * engine leaves it to the page (`set_page_mark`). It perches as the logo
 * (mark.svg), and now and then, 10 to 60 seconds apart at random, takes off: the flight sprite takes its
 * place for three wingbeats through the four frames of public/owl-fly.svg (one
 * picture, its frames side by side, set on the logo's face), a lift and a glide
 * back down, and the logo again, with nothing running between. A click opens the
 * partners' rewards. A picture of the chart gets the owl stamped in the same
 * corner (lib/capture-title).
 */
import { onCleanup, onMount } from 'solid-js';
import { setOverlay } from '../app/ui';
import { tl } from '../lib/i18n';

/** How long it perches between flights: somewhere in this span, drawn afresh each time. */
const [SOONEST_MS, LATEST_MS] = [10_000, 60_000];
const PLAY_MS = 1_500;
/** The frame it lands on, wings level, before the logo is back. */
const REST = 1;
/** Up, level, down, level: three beats from the perch and back to it. */
const BEATS = [2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1];
const at = (frame: number) => `${(frame * 100) / 3}% 0`;
/** Every mark on the page plays at once, from one clock. */
const marks = new Set<() => void>();
let clock: ReturnType<typeof setTimeout> | undefined;
/** The next flight for every mark, at a time drawn anew after each. */
const next = () => {
  clock = setTimeout(() => {
    marks.forEach((p) => p());
    next();
  }, SOONEST_MS + Math.random() * (LATEST_MS - SOONEST_MS));
};
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ChartMark(props: { x: number; y: number; paused: boolean }) {
  let fly: HTMLSpanElement | undefined;
  let owl: HTMLSpanElement | undefined;
  let perch: HTMLImageElement | undefined;
  const play = () => {
    if (props.paused || document.hidden || still() || !fly || !owl || !perch) return;
    for (const el of [fly, owl, perch]) for (const a of el.getAnimations()) a.cancel();
    const flying = PLAY_MS * 0.8;
    // The sprite in the logo's place for the wingbeats, the logo back once it has landed.
    const swap = (from: number, to: number): Keyframe[] => [
      { opacity: from, offset: 0, easing: 'step-end' },
      { opacity: to, offset: 0.001, easing: 'step-end' },
      { opacity: to, offset: 0.999, easing: 'step-end' },
      { opacity: from, offset: 1 },
    ];
    perch.animate(swap(1, 0), { duration: flying });
    owl.animate(swap(0, 1), { duration: flying });
    // The wings: four frames a beat, held each for an equal step.
    owl.animate(
      BEATS.map((f, i) => ({ backgroundPosition: at(f), offset: i / BEATS.length, easing: 'step-end' })).concat({ backgroundPosition: at(REST), offset: 1, easing: 'step-end' }),
      { duration: flying },
    );
    // Up off the perch and a little forward while it beats, then a glide back down.
    fly.animate(
      [
        { transform: 'translate(0, 0)', offset: 0 },
        { transform: 'translate(3px, -7px)', offset: 0.45 },
        { transform: 'translate(2px, -6px)', offset: 0.7 },
        { transform: 'translate(0, 0)', offset: 1 },
      ],
      { duration: PLAY_MS, easing: 'ease-in-out' },
    );
  };
  onMount(() => {
    marks.add(play);
    if (clock === undefined) next();
    onCleanup(() => {
      marks.delete(play);
      if (marks.size === 0) {
        clearTimeout(clock);
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
      <span ref={fly} class="fly">
        <img ref={perch} class="perch" src="/mark.svg" alt="" draggable={false} />
        <span ref={owl} class="owl" style={{ 'background-position': at(REST) }} />
      </span>
    </button>
  );
}
