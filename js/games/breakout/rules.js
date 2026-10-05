import { BALL, FIELD, LIFE_VALUE, LIVES, PADDLE, ROW_POINTS, STANDING_BRICK_VALUE, WALL, difficultyAt } from './config.js';

const WALL_WIDTH = WALL.columns * WALL.brickWidth + (WALL.columns - 1) * WALL.gap;
const CENTER_X = FIELD.width / 2;

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

export const IDLE_INPUT = Object.freeze({
  paddle: Object.freeze({ target: null, direction: 0, launch: false }),
  wall: Object.freeze({ target: null, direction: 0 }),
});

export function createGame(modeId, startSeconds = 0) {
  const paddle = { x: CENTER_X, width: difficultyAt(modeId, startSeconds).paddleWidth };
  return {
    modeId,
    status: 'serving',
    time: startSeconds,
    lives: LIVES,
    livesLost: 0,
    score: 0,
    serves: 0,
    paddle,
    wallX: CENTER_X,
    wallVelocity: 0,
    bricks: createBricks(),
    ball: restingBall(paddle),
  };
}

function createBricks() {
  const bricks = [];
  for (let row = 0; row < WALL.rows; row += 1) {
    for (let col = 0; col < WALL.columns; col += 1) bricks.push({ col, row, alive: true });
  }
  return bricks;
}

function restingBall(paddle) {
  return { x: paddle.x, y: PADDLE.y - BALL.radius, vx: 0, vy: 0 };
}

export function brickRect(brick, wallX) {
  return {
    x: wallX - WALL_WIDTH / 2 + brick.col * (WALL.brickWidth + WALL.gap),
    y: WALL.top + brick.row * (WALL.brickHeight + WALL.gap),
    width: WALL.brickWidth,
    height: WALL.brickHeight,
    row: brick.row,
  };
}

export const bricksLeft = (state) => state.bricks.filter((brick) => brick.alive).length;

// The wall keeps its full width as bounds even when bricks vanish, so the dodging range never changes.
export const wallBounds = () => ({ min: WALL_WIDTH / 2, max: FIELD.width - WALL_WIDTH / 2 });

const paddleBounds = (paddle) => ({ min: paddle.width / 2, max: FIELD.width - paddle.width / 2 });

export const wallScore = (state) => state.livesLost * LIFE_VALUE + bricksLeft(state) * STANDING_BRICK_VALUE;

/** What a human at the screen could see: the ball, the paddle and the bricks as drawn right now. */
export function observe(state) {
  return {
    serving: state.status === 'serving',
    ball: { ...state.ball },
    paddle: { ...state.paddle },
    bricks: state.bricks.filter((brick) => brick.alive).map((brick) => brickRect(brick, state.wallX)),
  };
}

/** Advances the game by `dt` seconds. Mutates and returns `state`. */
export function step(state, input, dt) {
  if (state.status === 'won' || state.status === 'lost') return state;
  const level = difficultyAt(state.modeId, state.time);

  movePaddle(state, input.paddle, level.paddleWidth, dt);
  moveWall(state, input.wall, dt);

  if (state.status === 'serving') {
    state.ball = restingBall(state.paddle);
    if (input.paddle.launch) launch(state, level.ballSpeed);
  } else {
    state.time += dt;
    advanceBall(state, level.ballSpeed, dt);
  }
  return state;
}

function steer(position, { target, direction }, maxStep) {
  const goal = target ?? position + direction * maxStep;
  return position + clamp(goal - position, -maxStep, maxStep);
}

function movePaddle(state, control, width, dt) {
  state.paddle.width = width;
  const { min, max } = paddleBounds(state.paddle);
  state.paddle.x = clamp(steer(state.paddle.x, control, PADDLE.speed * dt), min, max);
}

function moveWall(state, control, dt) {
  const { min, max } = wallBounds();
  const before = state.wallX;
  state.wallX = clamp(steer(before, control, WALL.speed * dt), min, max);
  state.wallVelocity = (state.wallX - before) / dt;
}

function launch(state, speed) {
  const angle = BALL.serveSpread * (state.serves % 2 === 0 ? -1 : 1);
  state.serves += 1;
  state.ball.vx = speed * Math.sin(angle);
  state.ball.vy = -speed * Math.cos(angle);
  state.status = 'playing';
}

function advanceBall(state, speed, dt) {
  reshape(state.ball, speed);
  const substeps = Math.max(1, Math.ceil((speed * dt) / BALL.maxSubstepDistance));
  const subDt = dt / substeps;
  for (let i = 0; i < substeps && state.status === 'playing'; i += 1) {
    const { ball } = state;
    ball.x += ball.vx * subDt;
    ball.y += ball.vy * subDt;
    bounceOffBorders(ball);
    bouncePaddle(state, speed);
    bounceBricks(state, speed);
    if (ball.y - BALL.radius > FIELD.height) loseLife(state);
  }
}

// Rescales the velocity to `speed` while keeping |vy| above the minimum share.
export function reshape(ball, speed) {
  const magnitude = Math.hypot(ball.vx, ball.vy) || 1;
  const vertical = clamp((Math.abs(ball.vy) / magnitude) * speed, speed * BALL.minVerticalRatio, speed);
  ball.vy = (Math.sign(ball.vy) || -1) * vertical;
  ball.vx = (Math.sign(ball.vx) || 1) * Math.sqrt(speed * speed - vertical * vertical);
}

function bounceOffBorders(ball) {
  const { radius } = BALL;
  if (ball.x < radius) {
    ball.x = radius;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x > FIELD.width - radius) {
    ball.x = FIELD.width - radius;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y < radius) {
    ball.y = radius;
    ball.vy = Math.abs(ball.vy);
  }
}

function bouncePaddle(state, speed) {
  const { ball, paddle } = state;
  const reachesPaddle = ball.vy > 0
    && ball.y + BALL.radius >= PADDLE.y
    && ball.y < PADDLE.y + PADDLE.height / 2
    && Math.abs(ball.x - paddle.x) <= paddle.width / 2 + BALL.radius;
  if (!reachesPaddle) return;

  const offset = clamp((ball.x - paddle.x) / (paddle.width / 2), -1, 1);
  const angle = offset * BALL.maxBounceAngle;
  ball.y = PADDLE.y - BALL.radius;
  ball.vx = speed * Math.sin(angle);
  ball.vy = -speed * Math.cos(angle);
  reshape(ball, speed);
}

/** Circle against rectangle. Returns the push-out normal and depth, or null when they do not touch. */
export function circleHitsRect(ball, rect) {
  const nearestX = clamp(ball.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(ball.y, rect.y, rect.y + rect.height);
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  const distance = Math.hypot(dx, dy);
  if (distance > BALL.radius) return null;
  if (distance > 0) return { nx: dx / distance, ny: dy / distance, depth: BALL.radius - distance };
  return exitFromInside(ball, rect);
}

// The ball centre is inside the brick (the wall slid over it): leave by the nearest face.
function exitFromInside(ball, rect) {
  const exits = [
    { gap: ball.x - rect.x, nx: -1, ny: 0 },
    { gap: rect.x + rect.width - ball.x, nx: 1, ny: 0 },
    { gap: ball.y - rect.y, nx: 0, ny: -1 },
    { gap: rect.y + rect.height - ball.y, nx: 0, ny: 1 },
  ];
  const nearest = exits.reduce((best, candidate) => (candidate.gap < best.gap ? candidate : best));
  return { nx: nearest.nx, ny: nearest.ny, depth: BALL.radius + nearest.gap };
}

function bounceBricks(state, speed) {
  const hit = deepestBrickHit(state);
  if (!hit) return;
  const { ball } = state;
  const { nx, ny, depth } = hit.contact;
  ball.x += nx * depth;
  ball.y += ny * depth;

  const approach = ball.vx * nx + ball.vy * ny;
  if (approach < 0) {
    ball.vx -= 2 * approach * nx;
    ball.vy -= 2 * approach * ny;
  }
  ball.vx += state.wallVelocity * WALL.kick;
  reshape(ball, speed);

  hit.brick.alive = false;
  state.score += ROW_POINTS[hit.brick.row];
  if (bricksLeft(state) === 0) state.status = 'won';
}

function deepestBrickHit(state) {
  let best = null;
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    const contact = circleHitsRect(state.ball, brickRect(brick, state.wallX));
    if (contact && (!best || contact.depth > best.contact.depth)) best = { brick, contact };
  }
  return best;
}

function loseLife(state) {
  state.lives -= 1;
  state.livesLost += 1;
  if (state.lives <= 0) {
    state.status = 'lost';
    return;
  }
  state.status = 'serving';
  state.ball = restingBall(state.paddle);
}
