import { createRng } from '../js/core/rng.js';
import { createComputerPlayer, predictLanding } from '../js/games/breakout/computerPlayer.js';
import { difficultyAt, FIELD, WALL } from '../js/games/breakout/config.js';
import { createGame, IDLE_INPUT, observe, step, wallBounds } from '../js/games/breakout/rules.js';

export const DT = 1 / 60;
const MAX_SECONDS = 600;
const WALL_BOTTOM = WALL.top + WALL.rows * (WALL.brickHeight + WALL.gap);
const KICK_APPROACH_DISTANCE = 120;

export const idleWall = () => IDLE_INPUT.wall;

/**
 * A thoughtful human: as the ball climbs toward the wall, slide it away from the paddle so the
 * hit throws the ball to the far side; otherwise drift back to the middle.
 */
export function steeringWall(state) {
  const { min, max } = wallBounds();
  const climbing = state.ball.vy < 0 && state.ball.y < WALL_BOTTOM + KICK_APPROACH_DISTANCE;
  if (!climbing) return { target: FIELD.width / 2, direction: 0 };
  return { target: state.paddle.x < FIELD.width / 2 ? max : min, direction: 0 };
}

const AIM_SPREAD_STEPS = 5;

/**
 * A paddle that sees the exact ball and never errs: the best a human could hope to be.
 * It varies where on the paddle the ball lands so shots fan out across the wall.
 */
export function perfectPaddle(state) {
  const { ball } = state;
  const falling = state.status === 'playing' && ball.vy > 0;
  const landing = falling ? predictLanding(ball) : ball.x;
  const aim = ((Math.floor(landing) % AIM_SPREAD_STEPS) - 2) / 3;
  const target = falling ? landing - aim * (state.paddle.width / 2) : ball.x;
  return { target, direction: 0, launch: state.status === 'serving' };
}

export const idlePaddle = (state) => ({ ...IDLE_INPUT.paddle, launch: state.status === 'serving' });

/** Plays one full game through the real rules. `paddleHand(state)` and `wallHand(state)` give the inputs. */
export function playGame({ modeId, startSeconds = 0, paddleHand, wallHand, onStep, maxSeconds = MAX_SECONDS }) {
  const state = createGame(modeId, startSeconds);
  const limit = startSeconds + maxSeconds;
  while (state.status !== 'won' && state.status !== 'lost' && state.time < limit) {
    const before = { paddleX: state.paddle.x, wallX: state.wallX };
    step(state, { paddle: paddleHand(state), wall: wallHand(state) }, DT);
    onStep?.(state, before);
  }
  return state;
}

/** The computer plays the paddle through its real controller, seeing only `observe(state)`. */
export function computerGame({ seed, startSeconds = 0, wallHand, onStep }) {
  const computer = createComputerPlayer(createRng(seed));
  const paddleHand = (state) => computer(observe(state), difficultyAt('computer', state.time), DT);
  return playGame({ modeId: 'computer', startSeconds, paddleHand, wallHand, onStep });
}

export const bricksBroken = (state) => state.bricks.filter((brick) => !brick.alive).length;
