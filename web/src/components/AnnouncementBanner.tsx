/**
 * The owner's announcement as a banner in the middle of the screen: a new
 * feature shown off, with its picture. Its button opens its link — here, where
 * it is a link into tradoor itself, so `?script=…` and the like take effect;
 * elsewhere, apart. Closed with the button, the ✕, Escape or a click beside it.
 */
import { Show } from 'solid-js';
import { announcement, closeAnnouncement } from '../lib/announcement';
import { Icon } from '../lib/icons';
import { tl } from '../lib/i18n';

const ours = (href: string): boolean => {
  try {
    return new URL(href, location.href).origin === location.origin;
  } catch {
    return false;
  }
};

export default function AnnouncementBanner() {
  return (
    <Show when={announcement()} keyed>
      {(a) => (
        <div class="backdrop announce-backdrop" onPointerDown={closeAnnouncement}>
          <div
            class="announce-banner"
            classList={{ warn: a.tone === 'warn' }}
            role="dialog"
            aria-modal="true"
            aria-label={a.title}
            tabIndex={-1}
            ref={(el) => queueMicrotask(() => el.focus())}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), closeAnnouncement())}
          >
            <button class="x" aria-label={tl('Close the announcement')} onClick={closeAnnouncement}>
              <Icon name="close" size={11} stroke={2.4} />
            </button>
            <Show when={a.image}>{(src) => <img src={src()} alt="" />}</Show>
            <div class="announce-text">
              <span class="eyebrow">{a.tone === 'warn' ? tl('Notice') : tl('New in tradoor')}</span>
              <h2>{tl(a.title)}</h2>
              <Show when={a.body}>
                <p>{a.body}</p>
              </Show>
              <div class="announce-acts">
                <button class="later" onClick={closeAnnouncement}>
                  {tl('Close')}
                </button>
                <Show when={a.link}>
                  {(href) => (
                    <a class="go" href={href()} target={ours(href()) ? undefined : '_blank'} rel="noopener noreferrer" onClick={closeAnnouncement}>
                      {ours(href()) ? tl('Try it') : tl('Read more')} <Icon name="external" size={10} stroke={2} />
                    </a>
                  )}
                </Show>
              </div>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
