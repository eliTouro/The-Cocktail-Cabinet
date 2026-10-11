import { createRng } from '../js/core/rng.js';
import { chooseAction } from '../js/games/snake/ai.js';
import { difficultyAt } from '../js/games/snake/config.js';
import { DIRECTIONS, isOutside, reachableCells } from '../js/games/snake/rules.js';
import { createSession } from '../js/games/snake/session.js';

const FRAME = 1 / 60;
const MAX_ROUND_SECONDS = 600;

/**
 * Stand-in for a person steering. It sees the board and picks a move each time the snake ticks,
 * then queues it through the same `queueTurn` a keypress uses. A person fumbles more the faster
 * the snake goes, so its mistake rate grows as the step time shrinks below a comfortable pace.
 */
const HUMAN_STEER = { comfortableStepSeconds: 0.18, mistakeAtComfort: 0.003, fumbleExponent: 3, carefulness: 0.9 };

function steererFor(session, rng) {
  let lastHead = null;
  return () => {
    const head = session.state.snake[0];
    if (lastHead && head.x === lastHead.x && head.y === lastHead.y) return;
    lastHead = { ...head };
    const { stepSeconds } = difficultyAt('human', session.elapsed);
    const pace = HUMAN_STEER.comfortableStepSeconds / stepSeconds;
    const skill = { mistakeRate: Math.min(1, HUMAN_STEER.mistakeAtComfort * pace ** HUMAN_STEER.fumbleExponent), carefulness: HUMAN_STEER.carefulness };
    session.queueTurn(chooseAction(session.state, skill, rng));
  };
}

/**
 * Stand-in for a person dropping apples. It looks at the board like a player would, waits a human
 * beat after the cooldown, and aims for cramped cells (walls, the snake's own body) so the snake
 * has to squeeze past itself. Now and then it just clicks somewhere, like a rushed player.
 */
const HUMAN_PLACE = { reactionSeconds: { min: 0.15, max: 0.6 }, slipRate: 0.2, favouredFreeNeighbours: 1 };

function cramp(state, cell) {
  const open = Object.values(DIRECTIONS).filter((vector) => {
    const next = { x: cell.x + vector.x, y: cell.y + vector.y };
    return !isOutside(state, next) && !state.snake.some((part) => part.x === next.x && part.y === next.y);
  });
  return Math.abs(open.length - HUMAN_PLACE.favouredFreeNeighbours);
}

function chooseDropCell(state, rng) {
  const options = [...reachableCells(state).values()]
    .filter((cell) => !state.apples.some((apple) => apple.x === cell.x && apple.y === cell.y));
  if (!options.length) return null;
  if (rng.next() < HUMAN_PLACE.slipRate) return rng.pick(options);
  const best = Math.min(...options.map((cell) => cramp(state, cell)));
  return rng.pick(options.filter((cell) => cramp(state, cell) === best));
}

function placerFor(session, rng) {
  let waited = 0;
  let reaction = rng.range(HUMAN_PLACE.reactionSeconds.min, HUMAN_PLACE.reactionSeconds.max);
  return () => {
    if (session.cooldownLeft > 0 || session.applesLeftToPlace() <= 0) { waited = 0; return; }
    waited += FRAME;
    if (waited < reaction) return;
    const cell = chooseDropCell(session.state, rng);
    if (cell && session.requestApple(cell).ok) {
      waited = 0;
      reaction = rng.range(HUMAN_PLACE.reactionSeconds.min, HUMAN_PLACE.reactionSeconds.max);
    }
  };
}

/**
 * Plays one whole round with the human's job done by a bot, through the public session API only.
 * Returns the outcome and whether the human-role side won. The human wins by reaching the apple
 * target (human mode) or by crashing the snake before it escapes (computer mode).
 */
export function playRound({ modeId, level, seed }) {
  const rng = createRng(seed);
  const session = createSession({ modeId, rng, startLevel: level });
  const act = modeId === 'human' ? steererFor(session, rng) : placerFor(session, rng);
  for (let time = 0; time < MAX_ROUND_SECONDS && !session.outcome; time += FRAME) {
    act();
    session.update(FRAME);
  }
  const humanWon = modeId === 'human' ? session.outcome === 'won' : session.outcome === 'dead';
  return { outcome: session.outcome, humanWon, seconds: session.elapsed, length: session.state.snake.length };
}

/** Share of `rounds` seeded rounds the human-role side wins. */
export function humanWinRate({ modeId, level, rounds, firstSeed = 1 }) {
  let wins = 0;
  for (let seed = firstSeed; seed < firstSeed + rounds; seed += 1) {
    if (playRound({ modeId, level, seed }).humanWon) wins += 1;
  }
  return wins / rounds;
}
