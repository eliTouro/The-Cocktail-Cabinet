import { createRng } from '../js/core/rng.js';
import { createComputerPlayer } from '../js/games/breakout/computerPlayer.js';
import { difficultyAt, FIELD, WALL } from '../js/games/breakout/config.js';
import { createGame, IDLE_INPUT, observe, step, wallBounds } from '../js/games/breakout/rules.js';

export const DT = 1 / 60;
const MAX_SECONDS = 600;
const WALL_BOTTOM = WALL.top + WALL.rows * (WALL.brickHeight + WALL.gap);
const KICK_APPROACH_DISTANCE = 120;

export const idleWall = () => IDLE_INPUT.wall;

/**
 * A thoughtful human: as the ball climbs toward the wall, slide the wall toward the paddle's side.
 * The computer aims at where the wall is, so a wall that keeps moving makes its shot arrive late
 * (found by trying both directions; this one costs the computer more lives). Otherwise the wall
 * drifts back to the middle. It reads only the ball and the paddle, which are on screen.
 */
export function steeringWall(view) {
  const { min, max } = wallBounds();
  const climbing = view.ball.vy < 0 && view.ball.y < WALL_BOTTOM + KICK_APPROACH_DISTANCE;
  if (!climbing) return { target: FIELD.width / 2, direction: 0 };
  return { target: view.paddle.x < FIELD.width / 2 ? min : max, direction: 0 };
}

const FLAWLESS = { reaction: 0, aimError: 0 };
const flawlessHands = new WeakMap();

/** A paddle that sees the exact ball and never errs: the computer's own aiming with its flaws removed. */
export function perfectPaddle(state) {
  if (!flawlessHands.has(state)) flawlessHands.set(state, createComputerPlayer(createRng(1)));
  return flawlessHands.get(state)(observe(state), { ...difficultyAt(state.modeId, state.time), ...FLAWLESS }, DT);
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

/**
 * A casual human at the paddle: the computer's own paddle hand with a fixed reaction time and aim
 * error, so it sees only `observe(state)` and moves at the paddle's speed cap. The game's difficulty
 * ramp still shrinks the paddle and speeds the ball; only this skill stays fixed.
 */
export const CASUAL_HUMAN = { reaction: 0.15, aimError: 22 };

export function casualPaddle(seed) {
  const hand = createComputerPlayer(createRng(seed));
  return (state) => hand(observe(state), { ...difficultyAt('human', state.time), ...CASUAL_HUMAN }, DT);
}

const WALL_REACTION_SECONDS = 0.15;

/** A casual human at the wall: `steeringWall` acting on what was on screen a reaction time ago. */
export function casualWall() {
  const memory = [];
  let elapsed = 0;
  return (state) => {
    elapsed += DT;
    memory.push({ at: elapsed, ball: { ...state.ball }, paddle: { x: state.paddle.x } });
    while (memory.length > 1 && memory[1].at <= elapsed - WALL_REACTION_SECONDS) memory.shift();
    return steeringWall(memory[0]);
  };
}
