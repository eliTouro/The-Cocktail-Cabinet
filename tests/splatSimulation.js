import { createRng } from '../js/core/rng.js';
import { STEP_SECONDS } from '../js/core/loop.js';
import { createAi } from '../js/games/splat/ai.js';
import { HEIGHT } from '../js/games/splat/config.js';
import { PHASE, canPlaceColumn, observe } from '../js/games/splat/rules.js';
import { createSession } from '../js/games/splat/session.js';

const MAX_ROUND_SECONDS = 300;

/**
 * Stand-in for a person flying. It is the game's own pilot logic, given a person's reflexes
 * (slower and less accurate than the computer's best) and fed only `observe(state)`.
 * Each round draws its own reflexes from these ranges, like a crowd of different players.
 */
const HUMAN_PILOT = { reactionDelay: { min: 0.1, max: 0.16 }, aimError: { min: 8, max: 20 } };

function pilotFor(session, rng) {
  const skill = {
    reactionDelay: rng.range(HUMAN_PILOT.reactionDelay.min, HUMAN_PILOT.reactionDelay.max),
    aimError: rng.range(HUMAN_PILOT.aimError.min, HUMAN_PILOT.aimError.max),
  };
  const pilot = createAi(rng, () => skill);
  return () => ({ flap: pilot.decide(observe(session.state)).flap });
}

/**
 * Stand-in for a person laying columns. It waits a human beat after each column becomes
 * available, then asks for a gap on the opposite side of the screen from the last one, so the
 * creature has to climb or dive as far as the rules allow. The rules decide how far that
 * really is. Now and then it aims somewhere random, like a rushed player.
 */
const HUMAN_LAYER = { reactionSeconds: { min: 0.15, max: 0.6 }, slipRate: 0.2 };

function layerFor(session, rng) {
  const { state } = session;
  let waited = 0;
  let reaction = rng.range(HUMAN_LAYER.reactionSeconds.min, HUMAN_LAYER.reactionSeconds.max);

  function chooseAim() {
    const previous = state.columns[state.columns.length - 1];
    if (!previous || rng.next() < HUMAN_LAYER.slipRate) return rng.range(0, HEIGHT);
    return previous.gapCenter > HEIGHT / 2 ? 0 : HEIGHT;
  }

  return () => {
    if (!canPlaceColumn(state)) {
      waited = 0;
      return { column: null };
    }
    waited += STEP_SECONDS;
    if (waited < reaction) return { column: null };
    waited = 0;
    reaction = rng.range(HUMAN_LAYER.reactionSeconds.min, HUMAN_LAYER.reactionSeconds.max);
    return { column: chooseAim() };
  };
}

/**
 * Plays one whole round with the person's job done by a bot, through the public session API only.
 * The person wins by passing every column (fly-through mode) or by splatting the creature (lay mode).
 */
export function playRound({ modeId, level, seed }) {
  const rng = createRng(seed);
  const session = createSession({ modeId, rng, startLevel: level });
  const act = modeId === 'human' ? pilotFor(session, rng) : layerFor(session, rng);
  const startTime = session.state.time;
  while (!session.isOver() && session.state.time - startTime < MAX_ROUND_SECONDS) {
    session.advance(STEP_SECONDS, act());
  }
  const { phase, score } = session.state;
  const humanWon = modeId === 'human' ? phase === PHASE.survived : phase === PHASE.splat;
  return { phase, humanWon, score, endedLevel: session.level() };
}

/** Share of `rounds` seeded rounds the person's side wins. */
export function humanWinRate({ modeId, level, rounds, firstSeed = 1 }) {
  let wins = 0;
  for (let seed = firstSeed; seed < firstSeed + rounds; seed += 1) {
    if (playRound({ modeId, level, seed }).humanWon) wins += 1;
  }
  return wins / rounds;
}
