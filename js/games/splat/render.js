import { COLUMN_WIDTH, CREATURE_RADIUS, FLOOR_Y, HEIGHT, SPAWN_X, WIDTH } from './config.js';
import { PHASE } from './rules.js';

const COLORS = {
  ink: '#0e0b15',
  surface: '#171221',
  human: '#ffb347',
  computer: '#52d6ff',
};
const SPLAT_LOBES = 11;
const TILT_PER_SPEED = 0.0012;
const MAX_TILT = 0.7;

function drawBackdrop(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, COLORS.ink);
  sky.addColorStop(1, COLORS.surface);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(0, FLOOR_Y, WIDTH, HEIGHT - FLOOR_Y);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.fillRect(0, FLOOR_Y, WIDTH, 2);
}

function drawColumn(ctx, column, color, alpha = 1) {
  const gapTop = column.gapCenter - column.gapSize / 2;
  const gapBottom = column.gapCenter + column.gapSize / 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillRect(column.x, 0, COLUMN_WIDTH, gapTop);
  ctx.fillRect(column.x, gapBottom, COLUMN_WIDTH, FLOOR_Y - gapBottom);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(14, 11, 21, 0.35)';
  ctx.fillRect(column.x + 8, 0, 6, gapTop);
  ctx.fillRect(column.x + 8, gapBottom, 6, FLOOR_Y - gapBottom);
  ctx.globalAlpha = 1;
}

function drawCreature(ctx, creature, color) {
  ctx.save();
  ctx.translate(creature.x, creature.y);
  ctx.rotate(Math.max(-MAX_TILT, Math.min(MAX_TILT, creature.vy * TILT_PER_SPEED)));
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, 0, CREATURE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(5, -4, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSplat(ctx, hit, color) {
  const radius = CREATURE_RADIUS * 1.5;
  const maxReach = radius * 1.7;
  const splat = { x: hit.x, y: Math.min(Math.max(hit.y, maxReach), FLOOR_Y - maxReach) };
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  for (let lobe = 0; lobe < SPLAT_LOBES; lobe += 1) {
    const angle = (lobe / SPLAT_LOBES) * Math.PI * 2;
    const reach = radius * (lobe % 2 === 0 ? 1.7 : 0.9);
    ctx.lineTo(splat.x + Math.cos(angle) * reach, splat.y + Math.sin(angle) * reach);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(splat.x - 8, splat.y - 6, 4, 4);
  ctx.fillRect(splat.x + 3, splat.y - 6, 4, 4);
}

function drawPreview(ctx, preview) {
  const ghost = { x: SPAWN_X - COLUMN_WIDTH - 4, gapCenter: preview.center, gapSize: preview.gapSize };
  drawColumn(ctx, ghost, COLORS.human, preview.isReady ? 0.55 : 0.18);
  ctx.strokeStyle = COLORS.human;
  ctx.globalAlpha = preview.isReady ? 0.9 : 0.3;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(ghost.x, preview.center - preview.gapSize / 2, COLUMN_WIDTH, preview.gapSize);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/**
 * view: { state, creatureColor, columnColor, preview } where preview is null or
 * { center, gapSize, isReady } for the flipped mode's next-column ghost.
 */
export function render(ctx, { state, creatureColor, columnColor, preview }) {
  drawBackdrop(ctx);
  for (const column of state.columns) drawColumn(ctx, column, columnColor);
  if (preview) drawPreview(ctx, preview);
  if (state.phase === PHASE.splat) drawSplat(ctx, state.splat, creatureColor);
  else drawCreature(ctx, state.creature, creatureColor);
}

export const TONE_COLORS = { human: COLORS.human, computer: COLORS.computer };
