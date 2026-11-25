/**
 * What the site's owner tells every reader, set on the status page
 * (bins/server announce): asked for as the page opens and every quarter of an
 * hour, and shown until the reader closes it. A closed one stays closed in this
 * browser; a new one, with its new id, shows again. A banner in the centre a
 * reader signed out closes comes back on their next visit, until it ends.
 */
import { createSignal } from 'solid-js';
import { api, type Announcement } from './api';
import { session } from './owner';
import { readJson, writePref } from './prefs';

const SEEN_KEY = 'announcementsSeen';
const EVERY_MS = 15 * 60_000;

const seen = (): number[] => {
  const raw = readJson(SEEN_KEY);
  return Array.isArray(raw) ? raw.filter((n): n is number => typeof n === 'number') : [];
};

const [announcement, setAnnouncement] = createSignal<Announcement | null>(null);
export { announcement };
/** Closed on this page: not shown again till the next visit, whatever is kept. */
let closed = 0;

async function check(): Promise<void> {
  try {
    const { announcement: a } = await api.announcement();
    setAnnouncement(a && a.id !== closed && !seen().includes(a.id) ? a : null);
  } catch {
    // Out of reach: what is shown stays.
  }
}

let started = false;
export function watchAnnouncements(): void {
  if (started) return;
  started = true;
  void check();
  setInterval(() => void check(), EVERY_MS);
}

export function closeAnnouncement(): void {
  const a = announcement();
  if (!a) return;
  closed = a.id;
  if (a.place !== 'centre' || session()) writePref(SEEN_KEY, JSON.stringify([a.id, ...seen()].slice(0, 20)));
  setAnnouncement(null);
}
