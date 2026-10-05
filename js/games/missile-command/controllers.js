import {
  BASE_KEYS, FIRST_WAVE_DELAY, GROUND_Y, NUMPAD_BASE_KEYS, WAVE, WAVE_LAYOUT, WAVE_PAUSE, WIDTH,
} from './config.js';
import { groundTarget, interceptorRequest, warheadRequest } from './rules.js';

const NO_INPUT = { launches: [], startWave: 0 };
/** How far sideways from the target a sent warhead may start, so attacks come in at varied angles. */
const SEND_SPREAD = 140;

/**
 * Human defender: a click or tap fires from the nearest base with ammo; keys 1-3 fire from a
 * chosen base at the pointer. Both produce plain interceptor requests for the rules to judge.
 */
export function createDefenderInput(keyboard, pointer) {
  function keyedLaunches() {
    return [BASE_KEYS, NUMPAD_BASE_KEYS].flatMap((codes) => codes
      .map((code, baseIndex) => (keyboard.consumeTap(code) ? interceptorRequest(pointer.position(), baseIndex) : null))
      .filter(Boolean));
  }

  return {
    read() {
      const press = pointer.consumePress();
      const clicked = press ? [interceptorRequest(press)] : [];
      return { ...NO_INPUT, launches: [...keyedLaunches(), ...clicked] };
    },
  };
}

/** Human attacker: a click or tap sends a warhead from the top edge toward that x on the ground. */
export function createWarheadSender(pointer, rng, tuning) {
  return {
    read() {
      const press = pointer.consumePress();
      if (!press) return NO_INPUT;
      const startX = Math.min(Math.max(press.x + rng.range(-SEND_SPREAD, SEND_SPREAD), 0), WIDTH);
      const request = warheadRequest({ x: startX, y: 0 }, groundTarget(press.x), tuning.warheadSpeed);
      return { ...NO_INPUT, launches: [request] };
    },
  };
}

function standingTargets(state) {
  const cities = state.cities.filter((city) => city.alive);
  const bases = state.bases.filter((base) => base.alive);
  return [...cities, ...cities, ...bases];
}

/** Classic mode's attacker: waves of warheads fall from random points on the top edge onto the cities and bases. */
export function createWaveGenerator(rng) {
  let schedule = [];
  let nextWaveTime = FIRST_WAVE_DELAY;
  let wasActive = false;

  function aimPoint(state) {
    const target = rng.pick(standingTargets(state));
    return target.x + rng.range(-WAVE_LAYOUT.targetJitter, WAVE_LAYOUT.targetJitter);
  }

  function buildLaunch(state, params) {
    const children = rng.next() < params.splitChance
      ? Array.from({ length: WAVE_LAYOUT.splitChildren }, () => aimPoint(state))
      : [];
    const { min, max } = WAVE_LAYOUT.splitAltitude;
    return warheadRequest({ x: rng.range(0, WIDTH), y: 0 }, groundTarget(aimPoint(state)), params.speed, {
      free: true,
      children,
      splitAt: children.length > 0 ? rng.range(min, Math.min(max, GROUND_Y - 40)) : null,
    });
  }

  function planWave(state) {
    const params = WAVE(state.time);
    const span = params.count * WAVE_LAYOUT.launchSecondsPerWarhead;
    schedule = Array.from({ length: params.count }, () => ({
      at: state.time + rng.range(0, span),
      request: buildLaunch(state, params),
    })).sort((a, b) => a.at - b.at);
    return params.count;
  }

  return {
    read(state) {
      if (wasActive && !state.waveActive) nextWaveTime = state.time + WAVE_PAUSE;
      wasActive = state.waveActive;
      if (!state.waveActive && schedule.length === 0 && state.time >= nextWaveTime) {
        return { launches: [], startWave: planWave(state) };
      }
      const due = schedule.filter((item) => item.at <= state.time);
      schedule = schedule.filter((item) => item.at > state.time);
      return { launches: due.map((item) => item.request), startWave: 0 };
    },
  };
}
