/**
 * A chart picture's title, in its top-left corner where the legend stands on
 * screen: the market, its timeframe and exchange, the bar's prices, and when
 * the picture was taken — a picture passed on says what it is of. Drawn on
 * the page, in its own font and colours, and only then made a PNG. Loaded
 * with the first picture.
 */
import type { CaptureTitle } from './capture';

/** A theme colour as the canvas can take it: the variable worked out on an element. */
function themed(name: string, fallback: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${name}, ${fallback})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || fallback;
}

/** The owl, as the live chart shows it; none if it will not load. */
async function owl(): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = '/mark.svg';
  return img.decode().then(() => img, () => null);
}

export async function titled({ picture, px }: { picture: ImageBitmap; px: number }, title: CaptureTitle): Promise<Blob> {
  const mark = title.mark ? await owl() : null;
  const canvas = document.createElement('canvas');
  canvas.width = picture.width;
  canvas.height = picture.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('this browser will not draw the picture');
  ctx.drawImage(picture, 0, 0);
  picture.close();
  ctx.scale(px, px);
  const family = getComputedStyle(document.body).fontFamily || 'monospace';
  const text = themed('--text', '#dfe6e0');
  // Muted and dim are the text over the surface, as the page mixes them: drawn faded over the box.
  type Run = { text: string; size: number; bold?: boolean; color: string; alpha?: number };
  const lines: Run[][] = [
    [
      { text: title.symbol, size: 15, bold: true, color: text },
      { text: `  ${title.detail}`, size: 12, color: text, alpha: 0.6 },
    ],
    ...(title.ohlc
      ? [
          [
            { text: title.ohlc, size: 11.5, color: text, alpha: 0.6 },
            { text: ` ${title.change}`, size: 11.5, color: themed(title.up ? '--bull' : '--bear', title.up ? '#aafd35' : '#ff4d5f') },
          ],
        ]
      : []),
    [{ text: title.time, size: 11, color: text, alpha: 0.42 }],
  ];
  const font = (run: Run) => `${run.bold ? 700 : 400} ${run.size}px ${family}`;
  const heights = lines.map((line) => Math.max(...line.map((r) => r.size)) * 1.35);
  const width = Math.max(
    ...lines.map((line) =>
      line.reduce((sum, run) => {
        ctx.font = font(run);
        return sum + ctx.measureText(run.text).width;
      }, 0),
    ),
  );
  const [x, y, padX, padY] = [8, 8, 10, 7];
  const box = { w: width + padX * 2, h: heights.reduce((a, b) => a + b, 0) + padY * 2 };
  ctx.beginPath();
  ctx.roundRect(x, y, box.w, box.h, 5);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = themed('--surface', '#0d100e');
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  ctx.strokeStyle = themed('--border', '#232823');
  ctx.stroke();
  ctx.textBaseline = 'middle';
  let top = y + padY;
  lines.forEach((line, i) => {
    let left = x + padX;
    const middle = top + heights[i]! / 2;
    for (const run of line) {
      ctx.font = font(run);
      ctx.fillStyle = run.color;
      ctx.globalAlpha = run.alpha ?? 1;
      ctx.fillText(run.text, left, middle);
      left += ctx.measureText(run.text).width;
    }
    top += heights[i]!;
  });
  // The owl, where the live chart has it (the engine leaves it out of the picture), and the name beside it.
  ctx.globalAlpha = 1;
  if (mark && title.mark) signed(ctx, mark, title.mark.x, title.mark.y, family, text);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('the picture was not made'))), 'image/png'));
}

/** The name's sizes in a picture, in CSS pixels. */
const [BIG, SMALL] = [11.5, 7.5];

/**
 * The owl in the 34px box the live chart gives it, and TRADOOR TERMINAL to its
 * right as the top bar writes it: the name bold, TERMINAL spread under it to
 * the same width, the two centred on the owl.
 */
function signed(ctx: CanvasRenderingContext2D, owl: HTMLImageElement, x: number, y: number, family: string, color: string): void {
  const [w, h] = [34, 34 * (1820 / 2320)];
  const middle = y + 17;
  ctx.drawImage(owl, x, middle - h / 2, w, h);
  const left = x + w + 6;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  // TRADOOR, its letters spaced as the bar's are (0.12em), the last one's space not counted.
  // The two lines together stand as tall as the owl's head and wings.
  ctx.font = `700 ${BIG}px ${family}`;
  const big = [...'TRADOOR'];
  const track = BIG * 0.12;
  const widths = big.map((c) => ctx.measureText(c).width);
  const wide = widths.reduce((a, b) => a + b, 0) + track * (big.length - 1);
  const cap = ctx.measureText('T').actualBoundingBoxAscent;
  ctx.font = `600 ${SMALL}px ${family}`;
  const small = [...'TERMINAL'];
  const smallCap = ctx.measureText('T').actualBoundingBoxAscent;
  const gap = 3;
  const top = middle - (cap + gap + smallCap) / 2;
  ctx.font = `700 ${BIG}px ${family}`;
  let at = left;
  big.forEach((c, i) => {
    ctx.fillText(c, at, top + cap);
    at += widths[i]! + track;
  });
  // TERMINAL: first letter at the left edge, last at the right, the rest spread evenly between.
  ctx.font = `600 ${SMALL}px ${family}`;
  ctx.globalAlpha = 0.75;
  const sw = small.map((c) => ctx.measureText(c).width);
  const space = (wide - sw.reduce((a, b) => a + b, 0)) / (small.length - 1);
  at = left;
  small.forEach((c, i) => {
    ctx.fillText(c, at, top + cap + gap + smallCap);
    at += sw[i]! + space;
  });
  ctx.globalAlpha = 1;
}
