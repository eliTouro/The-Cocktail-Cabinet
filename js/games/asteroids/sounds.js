import { play } from '../../core/sound.js';
import { EVENT } from './rules.js';

const RECIPES = {
  start: [
    { wave: 'square', from: 330, to: 330, seconds: 0.08, volume: 0.12 },
    { wave: 'square', from: 494, to: 494, seconds: 0.08, volume: 0.12, delay: 0.08 },
    { wave: 'square', from: 660, to: 880, seconds: 0.18, volume: 0.12, delay: 0.16 },
  ],
  thrust: [{ wave: 'noise', from: 500, to: 180, seconds: 0.14, volume: 0.07 }],
  wave: [
    { wave: 'sawtooth', from: 160, to: 110, seconds: 0.25, volume: 0.1 },
    { wave: 'sawtooth', from: 200, to: 140, seconds: 0.25, volume: 0.08, delay: 0.12 },
  ],
  launch: [{ wave: 'sine', from: 140, to: 520, seconds: 0.16, volume: 0.2 }],
  splitLarge: [
    { wave: 'noise', from: 2600, to: 200, seconds: 0.3, volume: 0.28 },
    { wave: 'sine', from: 150, to: 60, seconds: 0.25, volume: 0.22 },
  ],
  splitMedium: [{ wave: 'noise', from: 3000, to: 300, seconds: 0.2, volume: 0.24 }],
  pop: [{ wave: 'noise', from: 4200, to: 600, seconds: 0.1, volume: 0.2 }],
};

const ROCK_BREAK_BY_TIER = ['pop', 'splitMedium', 'splitLarge'];

/** How long a held thrust key goes between puffs of sound. */
export const THRUST_PULSE_SECONDS = 0.18;

/** Which sound a rules event makes: a shared effect name or one of this game's recipes. */
export function soundForEvent(event) {
  switch (event.type) {
    case EVENT.shot: return 'shoot';
    case EVENT.rockDestroyed: return RECIPES[ROCK_BREAK_BY_TIER[event.tier]];
    case EVENT.rockLaunched: return RECIPES.launch;
    case EVENT.launchRefused: return 'denied';
    case EVENT.shipHit: return 'explode';
    case EVENT.shipRespawned: return 'pickup';
    default: return null;
  }
}

export function playEvents(events) {
  events.forEach((event) => {
    const sound = soundForEvent(event);
    if (sound) play(sound);
  });
}

export const playStart = () => play(RECIPES.start);
export const playThrust = () => play(RECIPES.thrust);
export const playWave = () => play(RECIPES.wave);
export const playLevelUp = () => play('levelUp');
export const playWin = () => play('win');
export const playLose = () => play('lose');
