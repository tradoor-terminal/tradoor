/** Stroke icons, drawn on a 24-unit grid in the current text colour. */

const PATHS = {
  pointer: 'M6 3l12 9-5.5 1L10 20z',
  path: 'M3 18l5-8 5 5 8-10',
  trendline: 'M4 20L20 4',
  horizontal: 'M3 12h18',
  vertical: 'M12 3v18',
  rotrect: 'M3 14L13 4l8 8-10 10z',
  fibext: 'M3 20l6-9 4 5M3 6h18M3 10h18M3 14h18',
  fibchannel: 'M3 13L15 3M3 17l12-10M3 21l12-10M9 21l12-10',
  fibtime: 'M4 3v18M7 3v18M10 3v18M15 3v18M21 3v18',
  fibcircles: 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0',
  fibfan: 'M3 21L21 3M3 21l18-9M3 21l18-4M3 21l9-18M3 21l4-18',
  gannbox: 'M3 3h18v18H3zM3 3l18 18M21 3L3 21M12 3v18M3 12h18',
  gannfan: 'M3 21L21 3M3 21L21 12M3 21L12 3M3 21L21 17M3 21L7 3',
  signpost: 'M12 21V9M6 3h12v6H6z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  folder: 'M3 6h6l2 2h10v11H3z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  avwap: 'M3 18c4-1 6-8 9-8s5 4 9 2M6 15v6',
  forecast: 'M3 18l7-6 3 3 8-9M15 6h6v6',
  barspattern: 'M5 6v12M3 9h4v5H3zM11 4v9M9 6h4v4H9zM17 10v10M15 12h4v5h-4z',
  vprofile: 'M4 3v18M4 5h6M4 9h11M4 13h16M4 17h8M4 21h4',
  comment: 'M4 4h16v11H9l-5 4z',
  pricerange: 'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4M5 3h14M5 21h14',
  daterange: 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4M3 5v14M21 5v14',
  marker: 'M4 20l10-10M10 6h8v8zM6 20l-2-2',
  markup: 'M12 3l7 8h-4v9h-6v-9H5z',
  markdown: 'M12 21l7-8h-4V4H9v9H5z',
  pricelabel: 'M3 6h18v10h-7l-2 4-2-4H3z',
  pricenote: 'M3 20L12 11M12 6h9v7h-9zM3 20h.01',
  callout: 'M3 4h18v11H11l-5 5v-5H3z',
  flag: 'M5 21V3M5 4h13l-3 4 3 4H5',
  pin: 'M12 22s-6-7-6-12a6 6 0 0 1 12 0c0 5-6 12-6 12zM12 10h.01',
  regression: 'M3 15L21 5M3 20L21 10M3 10L21 0.5',
  flat: 'M3 18L21 8M3 6h18',
  disjoint: 'M3 16L12 8M12 20l9-8',
  pitchfork: 'M3 18L21 9M9 7l12 0M9 21l12-3M9 7v14',
  schiff: 'M3 14l18-5M9 6l12-1M9 21l12-4M9 6v15M3 18v-8',
  mschiff: 'M5 16L21 9M9 6l12-1M9 21l12-4M9 6v15M3 20l4-8',
  disk: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12h.01',
  ellipse: 'M2 12a10 6.5 0 1 0 20 0a10 6.5 0 1 0-20 0',
  triangle: 'M12 3l9.5 17h-19z',
  arc: 'M3 19a9 12 0 0 1 18 0',
  curve: 'M3 19Q8 2 21 9',
  dcurve: 'M3 17C7 3 12 3 12 12s5 9 9-5',
  cross: 'M12 3v18M3 12h18',
  trendray: 'M7.2 16.8L21 3M3 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  extended: 'M2 21L22 3M6 17.4a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M14.8 9.4a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0',
  infoline: 'M3 21L13 11M14 3h7v6h-7z',
  arrowline: 'M4 20L19 5M11 5h8v8',
  highlighter: 'M14.5 3.5l6 6-7.5 7.5H7v-6zM4 21h9',
  angle: 'M4 19L19 5M4 19h16M12 19a8 8 0 0 0-2.3-5.6',
  ray: 'M5 12h16M17 8l4 4-4 4',
  rect: 'M4 6h16v12H4z',
  fib: 'M3 5h18M3 9.5h18M3 12h18M3 14.5h18M3 19h18',
  channel: 'M3 15L15 5M9 19L21 9',
  /** The drawing tools: a pencil over the line it drew, a path of straight legs. */
  tools: 'M14.5 3l3 3L9 14.5H6v-3zM13 4.5l3 3M3 21l4.5-3 4 2 4.5-3.5 5 2.5',
  magnet: 'M5 4h4v8a3 3 0 0 0 6 0V4h4v8a7 7 0 0 1-14 0zM5 8h4M15 8h4',
  text: 'M5 5h14M12 5v14M9 19h6',
  measure: 'M4 17L17 4l3 3L7 20zM8 13l2 2M11 10l2 2M14 7l2 2',
  long: 'M12 20V5M6 11l6-6 6 6',
  short: 'M12 4v15M6 13l6 6 6-6',
  brush: 'M4 20c3 0 4-1.5 4-4a3 3 0 0 1 3-3M11 13l8-8 1.5 1.5-8 8z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  eraser: 'M9 20h11M4 15l9-9 6 6-8 8H9z',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  eyeOff: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.6M6.5 7.6C3.8 9.2 2 12 2 12s3.5 6 10 6a9.7 9.7 0 0 0 4.5-1.1',
  close: 'M6 6l12 12M18 6L6 18',
  menu: 'M3 6h18M3 12h18M3 18h18',
  plus: 'M12 5v14M5 12h14',
  section: 'M4 6h16M4 6v12M9 12h11M9 18h11',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.8-4.8',
  chevron: 'M6 9l6 6 6-6',
  filter: 'M4 5h16l-6 7.5V19l-4-2v-4.5z',
  maximize: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  minimize: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  splitRight: 'M4 5h16v14H4zM12 5v14',
  splitDown: 'M4 5h16v14H4zM4 12h16',
  layout: 'M4 5h16v14H4zM12 5v14M4 12h16',
  /** A gear of eight teeth around a hole (it was a sun of rays, and read as one). */
  settings: 'M9.9 4.9L10.2 2.2L13.8 2.2L14.1 4.9L15.5 5.5L17.7 3.8L20.2 6.3L18.5 8.5L19.1 9.9L21.8 10.2L21.8 13.8L19.1 14.1L18.5 15.5L20.2 17.7L17.7 20.2L15.5 18.5L14.1 19.1L13.8 21.8L10.2 21.8L9.9 19.1L8.5 18.5L6.3 20.2L3.8 17.7L5.5 15.5L4.9 14.1L2.2 13.8L2.2 10.2L4.9 9.9L5.5 8.5L3.8 6.3L6.3 3.8L8.5 5.5zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  command: 'M4 7l5 5-5 5M11 17h9',
  indicators: 'M3 17l5-6 4 3 8-9M3 21h18',
  replay: 'M11 6l-7 6 7 6zM20 6l-7 6 7 6z',
  flask: 'M9 3h6M10 3v6l-5.4 9.2A1.9 1.9 0 0 0 6.2 21h11.6a1.9 1.9 0 0 0 1.6-2.8L14 9V3M7.2 15h9.6',
  play: 'M7 5l12 7-12 7z',
  pause: 'M8 5v14M16 5v14',
  stepForward: 'M6 5l10 7-10 7zM18 5v14',
  realTime: 'M3 6l7 6-7 6zM11 6l7 6-7 6zM21 5v14',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM7 7h4M7 17h4',
  up: 'M6 15l6-6 6 6',
  alarm: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M3.5 6.5l3-3M20.5 6.5l-3-3',
  camera: 'M3 8h3.5L8 5.5h8L17.5 8H21v11H3zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  sort: 'M7 4v16M4 17l3 3 3-3M14 6h6M14 11h4M14 16h2',
  down: 'M6 9l6 6 6-6',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7C11 4.5 8.5 3 7.2 4.3S8.5 7 12 7zM12 7c1-2.5 3.5-4 4.8-2.7S15.5 7 12 7z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  /** Frost Script's mark: an ice crystal. */
  ice: 'M12 2L12 22M3.3 7L20.7 17M3.3 17L20.7 7M12 6.4L10 4.2M12 6.4L14 4.2M7.2 9.2L4.2 9.8M7.2 9.2L6.2 6.3M7.2 14.8L6.2 17.7M7.2 14.8L4.2 14.2M12 17.6L14 19.8M12 17.6L10 19.8M16.8 14.8L19.8 14.2M16.8 14.8L17.8 17.7M16.8 9.2L17.8 6.3M16.8 9.2L19.8 9.8',
  star: 'M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z',
  user: 'M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  send: 'M21 3L10 14M21 3l-6.5 18-4.5-7-7-4.5z',
  chat: 'M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.2A8 8 0 1 1 21 12zM8.5 12h.01M12 12h.01M15.5 12h.01',
  smile: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  droplet: 'M12 3l5.5 5.5a7.8 7.8 0 1 1-11 0z',
  /** The chart's types: candles, a line through the closes, a footprint's rows, TPO's letters stacked by price. */
  candles: 'M7 3v3M7 18v3M5 6h4v12H5zM17 4v4M17 14v4M15 8h4v6h-4z',
  linechart: 'M3 17l5-6 4 3 9-9',
  footprint: 'M3 4h18v16H3zM12 4v16M3 9h18M3 14h18',
  tpo: 'M4 4h3M4 8h8M4 12h14M4 16h9M4 20h4',
  check: 'M5 12l4.5 4.5L19 7',
  /** GitHub's mark, drawn filled (`fill`, no stroke). */
} as const;

export type IconName = keyof typeof PATHS;

export function Icon(props: { name: IconName; size?: number; stroke?: number; fill?: boolean }) {
  return (
    <svg
      width={props.size ?? 14}
      height={props.size ?? 14}
      viewBox="0 0 24 24"
      fill={props.fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width={props.stroke ?? 1.8}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[props.name]} />
    </svg>
  );
}
