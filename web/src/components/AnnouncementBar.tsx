/** The owner's announcement, a strip atop the app: written as text, its link opened apart. A banner in the centre loads its own code. */
import { lazy, Show } from 'solid-js';
import { announcement, closeAnnouncement } from '../lib/announcement';
import { Icon } from '../lib/icons';
import { tl } from '../lib/i18n';

const AnnouncementBanner = lazy(() => import('./AnnouncementBanner'));

export function AnnouncementBar() {
  return (
    <Show when={announcement()?.place !== 'centre'} fallback={<AnnouncementBanner />}>
    <Show when={announcement()} keyed>
      {(a) => (
        <div class="announce" classList={{ warn: a.tone === 'warn' }} role="status">
          <span class="announce-mark" aria-hidden="true">
            ●
          </span>
          <b>{tl(a.title)}</b>
          <Show when={a.body}>
            <span class="announce-body">{a.body}</span>
          </Show>
          <Show when={a.link}>
            {(href) => (
              <a href={href()} target="_blank" rel="noopener noreferrer">
                {tl('Read more')} <Icon name="external" size={10} stroke={2} />
              </a>
            )}
          </Show>
          <span class="spacer" />
          <button class="x" aria-label={tl('Close the announcement')} data-tip="Close" onClick={closeAnnouncement}>
            <Icon name="close" size={10} stroke={2.4} />
          </button>
        </div>
      )}
    </Show>
    </Show>
  );
}
