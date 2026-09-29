import { formatClock } from './time';
import type { ClassSlot } from './types';

/**
 * Android shows a wide image under a notification, and that is the only part of
 * an OS notification a web app gets to design. The picture is drawn here, in the
 * page, and handed to the service worker as a data URL so a reminder raised in
 * the background still looks like the rest of the app.
 */

const WIDTH = 1024;
const HEIGHT = 512;

const TINTS = ['#F59B1C', '#4CC9F0', '#34D399', '#A78BFA', '#FB7185', '#38BDF8', '#FBBF24'];

export function courseTint(code: string): string {
  let n = 0;
  for (let i = 0; i < code.length; i++) n = (n * 31 + code.charCodeAt(i)) % 9973;
  return TINTS[n % TINTS.length];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, min: number, weight = '600'): number {
  let size = start;
  do {
    ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size > min);
  return min;
}

export interface BannerInput {
  readonly slot: ClassSlot;
  readonly minutesAway: number;
  readonly position?: string;
  readonly nextAfter?: string;
}

/** A wide card: course, time, room, and how long you have. */
export function drawBanner(input: BannerInput): string {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const tint = courseTint(input.slot.code);

  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#131B30');
  bg.addColorStop(1, '#0B1120');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH * 0.86, HEIGHT * 0.2, 20, WIDTH * 0.86, HEIGHT * 0.2, 520);
  glow.addColorStop(0, `${tint}33`);
  glow.addColorStop(1, '#0B112000');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = tint;
  roundRect(ctx, 0, 0, 14, HEIGHT, 0);
  ctx.fill();

  /* the countdown, as the loudest thing on the card */
  const away = input.minutesAway <= 0
    ? 'NOW'
    : input.minutesAway < 60
      ? `${input.minutesAway}`
      : `${Math.floor(input.minutesAway / 60)}h`;
  const awayUnit = input.minutesAway <= 0 ? 'starting' : input.minutesAway < 60 ? 'minutes away' : 'away';

  ctx.textAlign = 'right';
  ctx.fillStyle = tint;
  ctx.font = '700 168px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(away, WIDTH - 64, 232);
  ctx.fillStyle = '#AFBBD8';
  ctx.font = '500 30px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(awayUnit, WIDTH - 64, 282);

  /* course identity */
  ctx.textAlign = 'left';
  ctx.fillStyle = tint;
  ctx.font = '600 34px "Cascadia Mono", Consolas, monospace';
  ctx.fillText(input.slot.code, 64, 112);

  const nameSize = fitText(ctx, input.slot.name, WIDTH - 420, 62, 34);
  ctx.fillStyle = '#F1F5FF';
  ctx.font = `600 ${nameSize}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(input.slot.name, 64, 190);

  /* facts along the bottom */
  const chips: string[] = [
    `${formatClock(input.slot.startMinutes)} to ${formatClock(input.slot.endMinutes)}`,
    input.slot.room ? input.slot.room : 'Room to be announced'
  ];
  if (input.position) chips.push(input.position);
  if (input.slot.mode) chips.push(input.slot.mode);

  let x = 64;
  const y = HEIGHT - 132;
  ctx.font = '500 26px "Segoe UI", system-ui, sans-serif';
  for (const chip of chips) {
    const w = ctx.measureText(chip).width + 44;
    ctx.fillStyle = '#1E2846';
    roundRect(ctx, x, y, w, 60, 30);
    ctx.fill();
    ctx.strokeStyle = '#2C3860';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, 60, 30);
    ctx.stroke();
    ctx.fillStyle = '#D7E0F5';
    ctx.fillText(chip, x + 22, y + 39);
    x += w + 14;
    if (x > WIDTH - 200) break;
  }

  if (input.nextAfter) {
    ctx.fillStyle = '#7D8BAC';
    ctx.font = '400 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`Then: ${input.nextAfter}`, 64, HEIGHT - 44);
  }

  /* JPEG keeps a week of banners small enough to sit in storage comfortably;
     the card has no transparency to lose. */
  return canvas.toDataURL('image/jpeg', 0.84);
}
