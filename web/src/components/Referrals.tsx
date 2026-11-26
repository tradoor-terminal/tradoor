/**
 * The partners to sign up with through tradoor's referral links: a
 * dialog anyone can open from the top bar or the phone's menu, and the card
 * that offers them once (lib/referral). A link opens the exchange's own page in
 * a new tab, carrying the referral code and nothing about the visitor.
 */
import { For, Show, type Component } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { EXCHANGES, ExchangeLogo } from '../lib/exchanges';
import { Icon } from '../lib/icons';
import { dismissReferralCard } from '../lib/referral';
import { SPONSORS } from '../lib/sponsors';
import { tl } from '../lib/i18n';

interface Partner {
  name: string;
  Logo: Component<{ size?: number }>;
  url: string;
  /** What it is, under its name; the exchanges known by name alone have none. */
  offer?: string;
  /** A second line, for the partner the card leads with. */
  more?: string;
  /** Led with, on its own row above the rest. */
  lead?: boolean;
  /** A word on the badge beside its name. */
  badge?: string;
}

/** Nado's mark, from its site, on the black disc every exchange's mark sits on. tradoor does not chart Nado, so it is not among EXCHANGES. */
function NadoLogo(props: { size?: number }) {
  return (
    <svg class="xlogo" width={props.size ?? 14} height={props.size ?? 14} viewBox="0 0 256 256" aria-hidden="true">
      <circle cx="128" cy="128" r="128" fill="#000" />
      <path
        transform="translate(28 28) scale(0.78)"
        fill="#fff"
        d="M94.28 145.77L160.64 219.18L165.81 222H181.58L184.87 218.71V192.35L182.52 186.94L142.29 141.53C132.17 130.23 124.41 119.88 109.58 117.06L111.46 110.7L101.58 111.88L92.63 140.59L94.28 145.76V145.77ZM144.88 65.3L47.94 85.77L42.76 88.83L35 102.71L36.41 107.18L59.23 120.36L64.88 121.07L124.41 108.83C139.24 105.77 152.17 104.13 162.06 92.83L167.23 98.24L171.23 89.07L150.05 66.48L144.88 65.3V65.3ZM189.82 148.82L220.4 54.7V48.59L212.4 34.94L207.7 34L184.87 47.18L181.34 51.65L162.28 109.3C157.58 123.66 152.4 135.65 157.34 150L150.05 151.65L155.93 159.66L186.04 152.83L189.81 148.83Z"
      />
    </svg>
  );
}

/** BloFin's mark, from its site, on the black disc every exchange's mark sits on. tradoor does not chart BloFin, so it is not among EXCHANGES. */
function BlofinLogo(props: { size?: number }) {
  return (
    <svg class="xlogo" width={props.size ?? 14} height={props.size ?? 14} viewBox="0 0 256 256" aria-hidden="true">
      <circle cx="128" cy="128" r="128" fill="#000" />
      <g transform="translate(72 62) scale(6.5)">
        <path fill="#FF8800" d="M15.3838 2.94336L11.5385 5.83568L6.83398 9.28805V13.051L16.4455 5.89814C16.4455 5.884 16.4479 5.87104 16.4479 5.85689C16.4479 4.67592 16.0932 3.70592 15.3838 2.94454V2.94336Z" />
        <path
          fill="#fff"
          d="M16.7211 11.9873C16.3982 11.3956 15.9103 10.9218 15.2563 10.5647C15.03 10.4409 14.7802 10.3349 14.5115 10.2417L11.6702 12.3633C11.6702 12.3633 11.6738 12.3656 11.6749 12.3668C12.1015 12.6897 12.316 13.1541 12.316 13.7623C12.316 14.3704 12.1074 14.8584 11.6879 15.1707C11.2696 15.4842 10.6426 15.641 9.80591 15.641H4.46443V4.65512H9.51719C10.1795 4.65512 10.698 4.81659 11.0728 5.13835C11.2931 5.32693 11.4463 5.56029 11.5371 5.83491L15.3824 2.94259C15.1514 2.69508 14.8839 2.46879 14.5775 2.26607C13.3318 1.44104 11.5135 1.02734 9.12595 1.02734H0V19.2959H9.04699C11.6973 19.2959 13.7184 18.8515 15.1137 17.9652C16.5078 17.0777 17.2054 15.7907 17.2054 14.1029C17.2054 13.2849 17.044 12.5813 16.7211 11.9885V11.9873Z"
        />
      </g>
    </svg>
  );
}

const exchangeLogo =
  (id: 'lighter' | 'bybit' | 'binance' | 'okx' | 'bitget' | 'bingx'): Component<{ size?: number }> =>
  (p) => <ExchangeLogo exchange={EXCHANGES[id]} size={p.size} />;

const PARTNERS: readonly Partner[] = [
  {
    name: 'Lighter',
    Logo: exchangeLogo('lighter'),
    url: 'https://app.lighter.xyz/?referral=TRADOOR&source=tradoor',
    offer: 'Self-custody perpetuals on Ethereum · zero trading fees on a standard account',
    more: 'Matching and liquidations proven with zero-knowledge proofs · charted in tradoor with its DOM, tape and footprints',
    lead: true,
    badge: 'New',
  },
  {
    name: 'Nado',
    Logo: NadoLogo,
    url: 'https://app.nado.xyz?join=tradoor',
    offer: 'Backed by the team behind Kraken',
    more: 'Self-custody perps and spot on Ink · up to 20× · orders matched in 5–15 ms',
  },
  { name: 'Bybit', Logo: exchangeLogo('bybit'), url: 'https://www.bybitglobal.com/invite?ref=EWPZAPL&medium=referral&utm_campaign=evergreen' },
  { name: 'Binance', Logo: exchangeLogo('binance'), url: 'https://www.bmwweb.biz/referral/earn-together/refer2earn-usdc/claim?hl=en&ref=GRO_28502_YJYU6&utm_source=referral_entrance' },
  { name: 'OKX', Logo: exchangeLogo('okx'), url: 'https://okx.ac/join/XVG7SEEM' },
  { name: 'Bitget', Logo: exchangeLogo('bitget'), url: 'https://share.bitget.com/u/FX2KU6JL?clacCode=B65S309J' },
  { name: 'BloFin', Logo: BlofinLogo, url: 'https://blofin.com/register?referral_code=4CYzt5' },
  { name: 'BingX', Logo: exchangeLogo('bingx'), url: 'https://bingxdao.com/invite/WVGO7C/' },
];

export function ReferralDialog(props: { onClose(): void }) {
  return (
    <div class="backdrop" onPointerDown={() => props.onClose()}>
      <div
        class="dialog narrow ref"
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
          <span class="title caps">{tl('Support tradoor')}</span>
          <span class="spacer" />
          <button class="x" onClick={() => props.onClose()}>
            {tl('esc ✕')}
          </button>
        </header>
        <div class="ref-body">
        <p class="ref-intro">
          {tl('Sign up through these links and tradoor earns a share, at no extra cost to you — it keeps the charts free. Bybit and Binance add their new-user rewards.')}
        </p>
        <div class="ref-list">
          <For each={PARTNERS}>
            {(p) => (
              <a class="ref-row" classList={{ lead: p.lead }} href={p.url} target="_blank" rel="sponsored noopener" onClick={dismissReferralCard}>
                <Dynamic component={p.Logo} size={28} />
                <span class="who">
                  <b>
                    {p.name}
                    {p.badge && <i class="new">{p.badge}</i>}
                  </b>
                  {p.offer && <span>{p.offer}</span>}
                  {p.more && <span>{p.more}</span>}
                </span>
                <span class="go">
                  {tl('Sign up')} <Icon name="external" size={11} stroke={2} />
                </span>
              </a>
            )}
          </For>
        </div>
        <a class="ref-sponsor" href="https://github.com/sponsors/rsalianto" target="_blank" rel="noopener">
          <span class="heart" aria-hidden="true">
            ♥
          </span>
          <span class="who">
            <b>{tl('Sponsor tradoor on GitHub')}</b>
            <span>{tl('Free and open source, with nothing behind a paywall. Sponsors help cover servers, tools and development time, and keep tradoor moving.')}</span>
          </span>
          <span class="go">
            {tl('Sponsor')} <Icon name="external" size={11} stroke={2} />
          </span>
        </a>
        <Show when={SPONSORS.length > 0}>
          <div class="ref-backers">
            <span>{tl('Supported by')}</span>
            <For each={SPONSORS}>
              {(s) => (
                <a href={s.url} target="_blank" rel="noopener">
                  {s.logo ? <img src={s.logo} alt={s.name} loading="lazy" /> : s.name}
                </a>
              )}
            </For>
          </div>
        </Show>
        </div>
        <footer>
          <span>{tl('Referral links · open in a new tab')}</span>
        </footer>
      </div>
    </div>
  );
}

export function ReferralCard() {
  return (
    <aside class="ref-card" aria-label={tl('Support tradoor')}>
      <header>
        <span class="eyebrow">
          <Icon name="gift" size={12} /> {tl('Support tradoor')}
        </span>
        <button class="x" aria-label={tl('Close')} onClick={dismissReferralCard}>
          <Icon name="close" size={10} stroke={2.4} />
        </button>
      </header>
      <p>{tl('tradoor is free and open source, and stays that way thanks to the people who use it.')}</p>
      <a class="ref-sponsor" href="https://github.com/sponsors/rsalianto" target="_blank" rel="noopener" onClick={dismissReferralCard}>
        <span class="heart" aria-hidden="true">
          ♥
        </span>
        <span class="who">
          <b>{tl('Sponsor on GitHub')}</b>
          <span>{tl('Servers, market data and new features')}</span>
        </span>
        <Icon name="external" size={10} stroke={2} />
      </a>
      <p class="or">{tl('Or open an account through our partners: no extra cost, with new-user rewards on Bybit and Binance.')}</p>
      <For each={PARTNERS.filter((p) => p.lead)}>
        {(p) => (
          <a class="lead" href={p.url} target="_blank" rel="sponsored noopener" onClick={dismissReferralCard}>
            <Dynamic component={p.Logo} size={24} />
            <span class="who">
              <b>
                {p.name}
                {p.badge && <i class="new">{p.badge}</i>}
              </b>
              <span>{p.offer}</span>
            </span>
            <Icon name="external" size={10} stroke={2} />
          </a>
        )}
      </For>
      <div class="pair">
        <For each={PARTNERS.filter((p) => !p.lead)}>
          {(p) => (
            <a href={p.url} target="_blank" rel="sponsored noopener" onClick={dismissReferralCard}>
              <Dynamic component={p.Logo} size={18} />
              {p.name}
              <Icon name="external" size={10} stroke={2} />
            </a>
          )}
        </For>
      </div>
      <footer>
        <button class="later" onClick={dismissReferralCard}>
          {tl('Maybe later')}
        </button>
      </footer>
    </aside>
  );
}
