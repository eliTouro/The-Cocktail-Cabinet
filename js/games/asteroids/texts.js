import { SHIP, SURVIVE_SECONDS } from './config.js';
import { PHASE, SPAWN_REJECTION } from './rules.js';

export const GOAL = {
  human: `Survive ${SURVIVE_SECONDS} s with ${SHIP.startingLives} lives.`,
  computer: `Destroy its ${SHIP.startingLives} lives within ${SURVIVE_SECONDS} s.`,
};

export const CONTROLS = {
  human: '← → turn · ↑ thrust · Space fire',
  computer: '1 2 3 pick a rock · click to launch',
};

/** Same controls, worded for a touch screen. */
export const TOUCH_CONTROLS = {
  human: 'Hold the buttons: turn, thrust, fire',
  computer: 'Pick a rock size, tap to launch',
};

export const INTRO = {
  human: {
    title: 'Asteroids',
    detail: `Left and Right (or A and D) rotate, Up (or W) thrusts, Space fires. Shoot the rocks: each hit splits a hexagon into two squares, a square into two triangles, and a triangle into nothing. Survive ${SURVIVE_SECONDS} seconds to win. A short shield protects you after each crash.`,
  },
  computer: {
    title: 'Send the asteroids',
    detail: `The computer flies the ship. Press 1, 2 or 3 (or tap a size button) to pick a triangle, square or hexagon, then click or tap the field to launch it from the nearest edge toward that spot. Bigger rocks cost more budget, and the budget refills slowly. Destroy all ${SHIP.startingLives} lives before it survives ${SURVIVE_SECONDS} seconds.`,
  },
};

/** Why a launch was refused: the hint to show, a short label for the cursor, and the meter that explains it (if any). */
export const REFUSAL = {
  [SPAWN_REJECTION.cooldown]: { hint: 'Reloading. Wait for the Reload bar to fill.', short: 'reloading', meter: 'reload' },
  [SPAWN_REJECTION.budget]: { hint: 'Not enough budget for that rock. Pick a smaller one or wait.', short: 'need more budget', meter: 'budget' },
  [SPAWN_REJECTION.nearShip]: { hint: 'The ship is too close to that edge. Aim somewhere else.', short: 'ship too close', meter: null },
  [SPAWN_REJECTION.tooMany]: { hint: 'Too many rocks in play. Wait for some to leave.', short: 'too many rocks', meter: null },
  [SPAWN_REJECTION.shipDown]: { hint: 'The ship is respawning. Wait a moment.', short: 'ship respawning', meter: null },
};

export function gameOverText(mode, state) {
  if (mode.id === 'human') {
    return state.phase === PHASE.won
      ? { title: 'You survived', detail: `${SURVIVE_SECONDS} seconds with a score of ${state.score}. Pick a higher level to push further.` }
      : { title: 'Ship lost', detail: `You lasted ${Math.round(state.time)} of ${SURVIVE_SECONDS} seconds and scored ${state.score}.` };
  }
  if (state.phase === PHASE.lost) {
    return { title: 'Ship destroyed. You win', detail: `You took all ${SHIP.startingLives} lives in ${Math.round(state.time)} seconds with ${state.rocksSent} rocks.` };
  }
  return { title: 'The ship survived', detail: `It outlasted ${SURVIVE_SECONDS} seconds and shot down ${state.rocksDestroyed} rocks. Aim your next sends better.` };
}
