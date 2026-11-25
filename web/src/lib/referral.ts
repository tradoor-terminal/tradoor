/**
 * The support card: GitHub Sponsors, then the partner exchanges. Offered a
 * minute into a visit, and again twelve hours after it was last closed or
 * used. The links themselves, and the dialog that keeps them at hand, load
 * only when shown (components/Referrals).
 *
 * The site's owner opens the site once with `?noreferral` on each device and
 * is never offered it there.
 */
import { createSignal } from 'solid-js';
import { readPref, writePref } from './prefs';

const KEY = 'referral';
const DELAY_MS = 60_000;
const AGAIN_MS = 12 * 3_600_000;

export const [referralCard, setReferralCard] = createSignal(false);
let timer: ReturnType<typeof setTimeout> | undefined;

/** Shown in `ms`, or when it is next due: never where it is switched off. */
function offer(ms: number): void {
  clearTimeout(timer);
  const at = readPref(KEY);
  // Never shown, or shown before it kept a time ('seen'): due now.
  if (at !== 'off') timer = setTimeout(() => setReferralCard(true), Math.max(ms, +at! + AGAIN_MS - Date.now() || 0));
}

export function startReferral(): void {
  const url = new URL(location.href);
  if (url.searchParams.has('noreferral')) {
    writePref(KEY, 'off');
    url.searchParams.delete('noreferral');
    history.replaceState(history.state, '', url);
  }
  offer(import.meta.env.DEV && url.searchParams.has('referral') ? 500 : DELAY_MS);
}

/** Closed, or a link in it used: offered again twelve hours on. */
export function dismissReferralCard(): void {
  setReferralCard(false);
  if (readPref(KEY) === 'off') return;
  writePref(KEY, `${Date.now()}`);
  offer(0);
}
