/** tradoor's mark and name: the desktop's top bar, and a phone's chart toolbar in its place. */
export function Brand() {
  return (
    <div class="brand">
      <img src="/mark.svg" width="29" height="23" alt="Tradoor Terminal" />
      <span class="brand-name" aria-hidden="true">
        <b>TRADOOR</b>
        <i>
          {[...'TERMINAL'].map((c) => (
            <span>{c}</span>
          ))}
        </i>
      </span>
    </div>
  );
}
