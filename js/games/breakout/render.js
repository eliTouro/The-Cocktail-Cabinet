import { BALL, FIELD, PADDLE, WALL } from './config.js';
import { brickRect, wallBounds } from './rules.js';

const COLORS = {
  ink: '#0e0b15',
  surface: '#171221',
  text: '#f1ebf6',
  amber: '#ffb347',
  cyan: '#52d6ff',
};

// Amber rows (human-controlled wall) fade from bright to deep; the neutral wall is a violet ramp.
const AMBER_ROWS = ['#ffcf85', '#ffb347', '#e89a30', '#c47f26', '#9c641f'];
const NEUTRAL_ROWS = ['#cdbfe6', '#b3a2d4', '#9884bf', '#7d69a6', '#665390'];

const BRICK_RADIUS = 3;
const PROMPT_FONT = '500 18px system-ui, sans-serif';
const PROMPT_LIFT = 70;
const AIM_MARKER_RADIUS = 7;
const AIM_MARKER_MIN_GAP = 4;

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

// The rail shows the human how far the wall can slide; the ring marks where the wall is heading,
// because the wall moves at a limited speed and trails the pointer.
function drawWallRail(context, state, wallAim) {
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
  if (wallAim === null || Math.abs(wallAim - state.wallX) < AIM_MARKER_MIN_GAP) return;
  context.strokeStyle = COLORS.amber;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(wallAim, y, AIM_MARKER_RADIUS, 0, Math.PI * 2);
  context.stroke();
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

// Sits between the wall and the paddle, clear of the help text along the bottom edge.
function drawServePrompt(context, state) {
  if (state.status !== 'serving') return;
  context.fillStyle = COLORS.text;
  context.font = PROMPT_FONT;
  context.textAlign = 'center';
  const prompt = state.modeId === 'human' ? 'Click, tap or press Space to launch' : 'The computer is about to serve';
  context.fillText(prompt, FIELD.width / 2, PADDLE.y - PROMPT_LIFT);
}

/**
 * `wallAim` is where the wall player is steering the wall to, or null when they are not steering.
 * `showServePrompt` is off while a start or result panel covers the field.
 */
export function drawScene(context, state, { wallAim = null, showServePrompt = false } = {}) {
  const isHuman = state.modeId === 'human';
  drawBackdrop(context);
  drawBricks(context, state, isHuman ? NEUTRAL_ROWS : AMBER_ROWS);
  if (!isHuman) drawWallRail(context, state, wallAim);
  drawPaddle(context, state, isHuman ? COLORS.amber : COLORS.cyan);
  drawBall(context, state.ball);
  if (showServePrompt) drawServePrompt(context, state);
}
