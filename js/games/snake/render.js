import { APPLE_RULES, CANVAS, GRID } from './config.js';

const COLORS = {
  ink: '#0e0b15',
  surface: '#171221',
  grid: 'rgba(241, 235, 246, 0.05)',
  text: '#f1ebf6',
  human: '#ffb347',
  computer: '#52d6ff',
  blocked: 'rgba(160, 149, 179, 0.35)',
};

const SEGMENT_INSET = 1.5;
const APPLE_RADIUS = GRID.cell * 0.36;
const EYE_RADIUS = 2;
const COOLDOWN_BAR_HEIGHT = 4;
const NOTICE_Y = CANVAS.height - 14;

/** Who controls what: the human always owns the amber side, the computer the cyan side. */
const colorsFor = (modeId) =>
  modeId === 'human'
    ? { snake: COLORS.human, apple: COLORS.computer }
    : { snake: COLORS.computer, apple: COLORS.human };

/**
 * Draws one frame. `view` is { session, hover, notice }: `hover` is the grid cell under the
 * pointer with a `valid` flag (computer mode only), `notice` a short message or ''.
 */
export function drawFrame(context, view) {
  const { session } = view;
  const colors = colorsFor(session.modeId);
  drawBoard(context);
  session.state.apples.forEach((apple) => drawApple(context, apple, colors.apple));
  drawSnake(context, session.state, colors.snake);
  if (session.modeId === 'computer') drawPlacementHelpers(context, view, colors.apple);
  if (view.notice) drawNotice(context, view.notice);
}

function drawBoard(context) {
  context.fillStyle = COLORS.surface;
  context.fillRect(0, 0, CANVAS.width, CANVAS.height);
  context.fillStyle = COLORS.grid;
  for (let x = 0; x < GRID.cols; x += 1) {
    for (let y = 0; y < GRID.rows; y += 1) {
      if ((x + y) % 2 === 0) context.fillRect(x * GRID.cell, y * GRID.cell, GRID.cell, GRID.cell);
    }
  }
}

function drawApple(context, apple, color) {
  const centerX = (apple.x + 0.5) * GRID.cell;
  const centerY = (apple.y + 0.5) * GRID.cell;
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 10;
  context.fillStyle = color;
  context.beginPath();
  context.arc(centerX, centerY, APPLE_RADIUS, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSnake(context, state, color) {
  context.fillStyle = color;
  state.snake.forEach((part, index) => {
    context.globalAlpha = index === 0 ? 1 : 0.85;
    context.fillRect(
      part.x * GRID.cell + SEGMENT_INSET,
      part.y * GRID.cell + SEGMENT_INSET,
      GRID.cell - SEGMENT_INSET * 2,
      GRID.cell - SEGMENT_INSET * 2,
    );
  });
  context.globalAlpha = 1;
  drawEyes(context, state);
}

function drawEyes(context, state) {
  const head = state.snake[0];
  const sideways = state.direction === 'left' || state.direction === 'right';
  const offset = GRID.cell * 0.22;
  const centerX = (head.x + 0.5) * GRID.cell;
  const centerY = (head.y + 0.5) * GRID.cell;
  context.fillStyle = COLORS.ink;
  for (const side of [-1, 1]) {
    context.beginPath();
    context.arc(centerX + (sideways ? 0 : side * offset), centerY + (sideways ? side * offset : 0), EYE_RADIUS, 0, Math.PI * 2);
    context.fill();
  }
}

function drawPlacementHelpers(context, { session, hover }, color) {
  if (hover) {
    context.strokeStyle = hover.valid ? color : COLORS.blocked;
    context.lineWidth = 2;
    context.strokeRect(hover.x * GRID.cell + 1, hover.y * GRID.cell + 1, GRID.cell - 2, GRID.cell - 2);
  }
  const ready = 1 - session.cooldownLeft / APPLE_RULES.cooldownSeconds;
  context.fillStyle = color;
  context.fillRect(0, 0, CANVAS.width * ready, COOLDOWN_BAR_HEIGHT);
}

function drawNotice(context, text) {
  context.font = '600 14px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillStyle = COLORS.text;
  context.fillText(text, CANVAS.width / 2, NOTICE_Y);
}
