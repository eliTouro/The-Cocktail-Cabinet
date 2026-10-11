import { BASE_XS, CITY_XS, SURVIVE_SECONDS, TUNING } from './config.js';
import { PHASE, REJECTION } from './rules.js';

const CITY_COUNT = CITY_XS.length;
const BASE_COUNT = BASE_XS.length;
const HUMAN = TUNING.human();
const COMPUTER = TUNING.computer();

export const GOAL = {
  human: `Stop the warheads and keep a city standing for ${SURVIVE_SECONDS} s.`,
  computer: `Destroy all ${CITY_COUNT} cities before the defender survives ${SURVIVE_SECONDS} s.`,
};

export const CONTROLS = {
  human: 'Click or tap the sky: fire from the nearest base · keys 1 2 3: fire from that base',
  computer: 'Click or tap: send a warhead down onto that spot',
};

export const INTRO = {
  human: {
    title: 'Missile Command',
    detail: `Warheads fall on your ${CITY_COUNT} cities. Click or tap the sky to fire a counter-missile from the nearest base with ammo, or press 1, 2 or 3 to fire from that base at the pointer. It bursts where you aim (the ring shows how far) and the blast grows then fades, destroying any warhead it touches, so lead your targets. Each base holds ${HUMAN.ammoPerBase} missiles and is restocked between waves. Keep a city standing for ${SURVIVE_SECONDS} seconds to win.`,
  },
  computer: {
    title: 'Launch the attack',
    detail: `The computer defends. Click or tap anywhere to send a warhead from the top edge toward that spot on the ground. Each launch spends one point of a budget that refills slowly (up to ${COMPUTER.budgetCap}), and at most ${COMPUTER.maxWarheads} warheads can be in the air. Destroy all ${CITY_COUNT} cities before the defender survives ${SURVIVE_SECONDS} seconds. Its ${BASE_COUNT} bases hold limited ammo, so make it spend.`,
  },
};

/** Why a launch was refused: the hint to show and the meters that explain it. */
export const REFUSAL = {
  interceptor: {
    [REJECTION.noAmmo]: { label: 'out of ammo', hint: 'Out of missiles! Bases are restocked when the wave is cleared.', meters: ['ammo-0', 'ammo-1', 'ammo-2'] },
    [REJECTION.cooldown]: { label: 'reloading', hint: 'Bases are reloading. Wait a moment.', meters: [] },
  },
  warhead: {
    [REJECTION.cooldown]: { label: 'reloading', hint: 'Launcher reloading. Wait a moment.', meters: [] },
    [REJECTION.budget]: { label: 'need budget', hint: 'Out of launch budget. It refills over time.', meters: ['budget'] },
    [REJECTION.tooManyWarheads]: { label: 'too many in the air', hint: `Already ${COMPUTER.maxWarheads} warheads in the air. Wait for some to land.`, meters: ['air'] },
  },
};

export function gameOverText(mode, state) {
  if (mode.id === 'human') {
    return state.phase === PHASE.survived
      ? { title: 'The cities held', detail: `${SURVIVE_SECONDS} seconds, wave ${state.wave}, ${state.warheadsDestroyed} warheads stopped, score ${state.score}. Pick a higher level to push further.` }
      : { title: 'The cities have fallen', detail: `You lasted ${Math.round(state.time)} of ${SURVIVE_SECONDS} seconds, stopping ${state.warheadsDestroyed} warheads for a score of ${state.score}.` };
  }
  if (state.phase === PHASE.citiesLost) {
    return { title: 'All cities destroyed. You win', detail: `You levelled them in ${Math.round(state.time)} seconds with ${state.warheadsSent} warheads.` };
  }
  const standing = state.cities.filter((city) => city.alive).length;
  return { title: 'The defender held', detail: `${standing} of ${CITY_COUNT} cities survived ${SURVIVE_SECONDS} seconds. It shot down ${state.warheadsDestroyed} of your ${state.warheadsSent} warheads.` };
}
