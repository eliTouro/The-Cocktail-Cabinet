const MUTE_STORAGE_KEY = 'cocktail-cabinet-muted';
const MASTER_VOLUME = 0.5;
const MIN_SECONDS_BETWEEN_SAME_SOUND = 0.04;
const SILENT_GAIN = 0.0001;

/**
 * Sound effects are synthesised with the Web Audio API, so the site ships no audio files.
 * An effect is a list of voices that start together (or `delay` seconds apart):
 *   { wave: 'square' | 'sine' | 'triangle' | 'sawtooth' | 'noise',
 *     from: Hz, to: Hz, seconds, volume = 0.2, delay = 0 }
 * The pitch glides from `from` to `to`. For 'noise' the pitch is a low-pass filter cutoff,
 * so a falling cutoff sounds like an explosion fading away.
 * play() takes the name of one of these shared effects, or a recipe of a game's own.
 */
export const EFFECTS = {
  click: [{ wave: 'square', from: 520, to: 520, seconds: 0.04, volume: 0.12 }],
  place: [{ wave: 'triangle', from: 300, to: 480, seconds: 0.09, volume: 0.22 }],
  denied: [{ wave: 'square', from: 180, to: 130, seconds: 0.12, volume: 0.14 }],
  pickup: [
    { wave: 'square', from: 660, to: 660, seconds: 0.06, volume: 0.14 },
    { wave: 'square', from: 990, to: 990, seconds: 0.09, volume: 0.14, delay: 0.06 },
  ],
  bounce: [{ wave: 'triangle', from: 420, to: 300, seconds: 0.06, volume: 0.2 }],
  shoot: [{ wave: 'sawtooth', from: 900, to: 220, seconds: 0.12, volume: 0.12 }],
  hit: [
    { wave: 'noise', from: 3000, to: 400, seconds: 0.1, volume: 0.22 },
    { wave: 'square', from: 240, to: 120, seconds: 0.08, volume: 0.12 },
  ],
  explode: [{ wave: 'noise', from: 2400, to: 120, seconds: 0.45, volume: 0.3 }],
  bigExplode: [
    { wave: 'noise', from: 3200, to: 80, seconds: 0.8, volume: 0.38 },
    { wave: 'sine', from: 110, to: 40, seconds: 0.7, volume: 0.3 },
  ],
  warn: [
    { wave: 'square', from: 440, to: 440, seconds: 0.1, volume: 0.12 },
    { wave: 'square', from: 440, to: 440, seconds: 0.1, volume: 0.12, delay: 0.18 },
  ],
  levelUp: [
    { wave: 'square', from: 523, to: 523, seconds: 0.09, volume: 0.14 },
    { wave: 'square', from: 659, to: 659, seconds: 0.09, volume: 0.14, delay: 0.09 },
    { wave: 'square', from: 784, to: 784, seconds: 0.16, volume: 0.14, delay: 0.18 },
  ],
  win: [
    { wave: 'triangle', from: 523, to: 523, seconds: 0.14, volume: 0.24 },
    { wave: 'triangle', from: 659, to: 659, seconds: 0.14, volume: 0.24, delay: 0.14 },
    { wave: 'triangle', from: 784, to: 784, seconds: 0.14, volume: 0.24, delay: 0.28 },
    { wave: 'triangle', from: 1047, to: 1047, seconds: 0.4, volume: 0.24, delay: 0.42 },
  ],
  lose: [
    { wave: 'sawtooth', from: 392, to: 392, seconds: 0.18, volume: 0.16 },
    { wave: 'sawtooth', from: 330, to: 330, seconds: 0.18, volume: 0.16, delay: 0.18 },
    { wave: 'sawtooth', from: 262, to: 130, seconds: 0.5, volume: 0.16, delay: 0.36 },
  ],
};

let audioContext = null;
let muted = readStoredMute();
const lastPlayedAt = new Map();
const muteListeners = new Set();

function readStoredMute() {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function storeMute(value) {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Storage can be blocked (private windows); the setting then lasts for this visit only.
  }
}

function contextOrNull() {
  if (typeof AudioContext === 'undefined') return null;
  audioContext ??= new AudioContext();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function noiseBuffer(context, seconds) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
  return buffer;
}

function startVoice(context, voice, startTime) {
  const { wave, from, to, seconds, volume = 0.2, delay = 0 } = voice;
  const begin = startTime + delay;
  const end = begin + seconds;
  const gain = context.createGain();
  gain.gain.setValueAtTime(volume * MASTER_VOLUME, begin);
  gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, end);
  gain.connect(context.destination);

  if (wave === 'noise') {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context, seconds);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, begin);
    filter.frequency.exponentialRampToValueAtTime(Math.max(to, 1), end);
    source.connect(filter).connect(gain);
    source.start(begin);
    source.stop(end);
    return;
  }

  const oscillator = context.createOscillator();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(from, begin);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(to, 1), end);
  oscillator.connect(gain);
  oscillator.start(begin);
  oscillator.stop(end);
}

/** Play a shared effect by name (see EFFECTS) or a recipe array. Does nothing while muted. */
export function play(effect) {
  if (muted) return;
  const recipe = typeof effect === 'string' ? EFFECTS[effect] : effect;
  const context = contextOrNull();
  if (!recipe || !context) return;

  const now = context.currentTime;
  if (now - (lastPlayedAt.get(recipe) ?? -1) < MIN_SECONDS_BETWEEN_SAME_SOUND) return;
  lastPlayedAt.set(recipe, now);
  for (const voice of recipe) startVoice(context, voice, now);
}

export const isMuted = () => muted;

export function setMuted(value) {
  muted = value;
  storeMute(value);
  for (const listener of muteListeners) listener(muted);
}

/** Calls `listener(muted)` whenever the mute setting changes. Returns a function that unsubscribes. */
export function onMuteChange(listener) {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
}
