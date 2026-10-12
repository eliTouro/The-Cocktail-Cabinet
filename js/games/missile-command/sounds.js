import { play } from '../../core/sound.js';
import { EVENT, REJECTION } from './rules.js';

const RECIPES = {
  start: [
    { wave: 'square', from: 330, to: 330, seconds: 0.08, volume: 0.12 },
    { wave: 'square', from: 494, to: 494, seconds: 0.08, volume: 0.12, delay: 0.08 },
    { wave: 'square', from: 660, to: 880, seconds: 0.18, volume: 0.12, delay: 0.16 },
  ],
  detonation: [{ wave: 'noise', from: 1800, to: 150, seconds: 0.3, volume: 0.16 }],
  emptyBase: [{ wave: 'square', from: 140, to: 120, seconds: 0.05, volume: 0.1 }],
  launchWarhead: [{ wave: 'sine', from: 700, to: 160, seconds: 0.22, volume: 0.18 }],
  waveStarted: [
    { wave: 'sawtooth', from: 160, to: 110, seconds: 0.25, volume: 0.1 },
    { wave: 'sawtooth', from: 200, to: 140, seconds: 0.25, volume: 0.08, delay: 0.12 },
  ],
};

/** Which sound a rules event makes: a shared effect name or one of this game's recipes. */
export function soundForEvent(event) {
  switch (event.type) {
    case EVENT.interceptorFired: return 'shoot';
    case EVENT.warheadLaunched: return RECIPES.launchWarhead;
    case EVENT.refused: return event.reason === REJECTION.noAmmo ? RECIPES.emptyBase : 'denied';
    case EVENT.detonation: return RECIPES.detonation;
    case EVENT.warheadDestroyed: return 'hit';
    case EVENT.cityDestroyed:
    case EVENT.baseDestroyed: return 'bigExplode';
    case EVENT.waveStarted: return RECIPES.waveStarted;
    case EVENT.waveCleared: return 'pickup';
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
export const playLevelUp = () => play('levelUp');
export const playWin = () => play('win');
export const playLose = () => play('lose');
