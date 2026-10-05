import { BALL, FIELD, PADDLE, WALL } from './config.js';
import { brickRect, wallBounds } from './rules.js';

const COLORS = {
  ink: '#0e0b15',
  surface: '#171221',
  text: '#f1ebf6',
  muted: '#a095b3',
  amber: '#ffb347',
  cyan: '#52d6ff',
};

// Amber rows (human-controlled wall) fade from bright to deep; the neutral wall is a violet ramp.
const AMBER_ROWS = ['#ffcf85', '#ffb347', '#e89a30', '#c47f26', '#9c641f'];
const NEUTRAL_ROWS = ['#cdbfe6', '#b3a2d4', '#9884bf', '#7d69a6', '#665390'];

const BRICK_RADIUS = 3;
const FONT = '14px system-ui, sans-serif';

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawBackdrop(context) {
  context.fillStyle = COLORS.ink;
  context.fillRect(0, 0, FIELD.width, FIELD.height);
  const glow = context.createRadialGradient(FIELD.width / 2, 120, 20, FIELD.width / 2, 120, 420);
  glow.addColorStop(0, 'rgba(120, 90, 190, 0.16)');
  glow.addColorStop(1, 'rgba(14, 11, 21, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, FIELD.width, FIELD.height);
}

function drawBricks(context, state, palette) {
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    const rect = brickRect(brick, state.wallX);
    context.fillStyle = palette[brick.row];
    roundedRect(context, rect.x, rect.y, rect.width, rect.height, BRICK_RADIUS);
    context.fill();
    context.fillStyle = 'rgba(255, 255, 255, 0.22)';
    context.fillRect(rect.x + 3, rect.y + 2, rect.width - 6, 2);
  }
}

// The rail shows the human how far the wall can slide.
function drawWallRail(context, state) {
  const { min, max } = wallBounds();
  const y = WALL.top - 14;
  context.strokeStyle = 'rgba(255, 179, 71, 0.28)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(min, y);
  context.lineTo(max, y);
  context.stroke();
  context.fillStyle = COLORS.amber;
  roundedRect(context, state.wallX - 14, y - 4, 28, 8, 4);
  context.fill();
}

function drawPaddle(context, state, tone) {
  const { paddle } = state;
  context.save();
  context.shadowColor = tone;
  context.shadowBlur = 14;
  context.fillStyle = tone;
  roundedRect(context, paddle.x - paddle.width / 2, PADDLE.y, paddle.width, PADDLE.height, PADDLE.height / 2);
  context.fill();
  context.restore();
}

function drawBall(context, ball) {
  context.save();
  context.shadowColor = COLORS.text;
  context.shadowBlur = 10;
  context.fillStyle = COLORS.text;
  context.beginPath();
  context.arc(ball.x, ball.y, BALL.radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawHint(context, text) {
  context.fillStyle = COLORS.muted;
  context.font = FONT;
  context.textAlign = 'center';
  context.fillText(text, FIELD.width / 2, FIELD.height - 14);
}

function hintFor(state) {
  if (state.status !== 'serving') return null;
  return state.modeId === 'human' ? 'Click, tap or press Space to launch' : 'Slide the wall: mouse, touch or arrow keys';
}

export function drawScene(context, state) {
  const isHuman = state.modeId === 'human';
  drawBackdrop(context);
  drawBricks(context, state, isHuman ? NEUTRAL_ROWS : AMBER_ROWS);
  if (!isHuman) drawWallRail(context, state);
  drawPaddle(context, state, isHuman ? COLORS.amber : COLORS.cyan);
  drawBall(context, state.ball);
  const hint = hintFor(state);
  if (hint) drawHint(context, hint);
}
