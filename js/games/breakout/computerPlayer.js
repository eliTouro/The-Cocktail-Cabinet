import { BALL, COMPUTER_MAX_AIM_OFFSET, COMPUTER_SERVE_PAUSE_SECONDS, FIELD, PADDLE } from './config.js';

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

/** Where a falling ball will cross the paddle line, folding its path off the side borders. */
export function predictLanding(ball) {
  const { radius } = BALL;
  const span = FIELD.width - 2 * radius;
  const secondsToPaddle = (PADDLE.y - radius - ball.y) / ball.vy;
  const unfolded = ball.x - radius + ball.vx * secondsToPaddle;
  const cycle = ((unfolded % (2 * span)) + 2 * span) % (2 * span);
  return radius + (cycle <= span ? cycle : 2 * span - cycle);
}

function averageOf(items, pick) {
  return items.reduce((sum, item) => sum + pick(item), 0) / items.length;
}

// Sum of three uniforms is a cheap bell curve: most shots land near the mark, a few stray far.
function bellError(rng, spread) {
  return (rng.next() + rng.next() + rng.next() - 1.5) * 2 * spread;
}

/**
 * The computer's paddle hand. Each frame it gets what a human could see (`observe`) plus the
 * current difficulty and returns the same kind of paddle input a human produces. It reacts to a
 * view that is `level.reaction` seconds old, predicts the landing spot with the borders but not
 * the bricks, then offsets the paddle so the bounce heads at the middle of the wall, with a
 * random aim error. It never touches the game state, so the rules treat it like any player.
 */
export function createComputerPlayer(rng) {
  const memory = [];
  let elapsed = 0;
  let servingFor = 0;
  let wasFalling = false;
  let shotError = 0;

  function viewFromAgo(reaction) {
    while (memory.length > 1 && memory[1].at <= elapsed - reaction) memory.shift();
    return memory[0].view;
  }

  function aimedTarget(view) {
    const { ball, paddle, bricks } = view;
    const landing = predictLanding(ball);
    if (bricks.length === 0) return landing;
    const aimX = averageOf(bricks, (brick) => brick.x + brick.width / 2);
    const aimY = averageOf(bricks, (brick) => brick.y + brick.height / 2);
    const bounceAngle = Math.atan2(aimX - landing, PADDLE.y - aimY);
    const offset = clamp(bounceAngle / BALL.maxBounceAngle, -COMPUTER_MAX_AIM_OFFSET, COMPUTER_MAX_AIM_OFFSET);
    return landing - offset * (paddle.width / 2) + shotError;
  }

  return function decide(observation, level, dt) {
    elapsed += dt;
    memory.push({ at: elapsed, view: observation });
    const view = viewFromAgo(level.reaction);

    if (view.serving) {
      servingFor += dt;
      wasFalling = false;
      return { target: view.paddle.x, direction: 0, launch: servingFor >= COMPUTER_SERVE_PAUSE_SECONDS };
    }
    servingFor = 0;

    const falling = view.ball.vy > 0;
    if (falling && !wasFalling) shotError = bellError(rng, level.aimError);
    wasFalling = falling;

    const target = falling ? aimedTarget(view) : view.ball.x;
    return { target, direction: 0, launch: false };
  };
}
