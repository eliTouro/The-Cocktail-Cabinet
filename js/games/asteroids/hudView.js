import { createHud } from '../../core/hud.js';
import { BULLET, SHIP, SURVIVE_SECONDS } from './config.js';
import { CONTROLS, GOAL, REFUSAL, TOUCH_CONTROLS } from './texts.js';

/** Bars move in this many steps, so the HUD only touches the page when a bar visibly changes. */
const BAR_STEPS = 20;

/** The shared HUD draws whole-number meters up to this size as segments and anything else as a bar. */
const SEGMENT_LIMIT = 10;

const oneDecimal = (value) => value.toFixed(1);
const readyText = (secondsLeft) => (secondsLeft > 0 ? `${oneDecimal(secondsLeft)} s` : 'ready');

/**
 * The on-screen help for one Asteroids round: the goal and controls, plus a labelled meter for
 * each thing the player spends or waits on. Meters differ by side:
 *   flying the ship: lives, survival timer, gun reload, shield;
 *   sending rocks: the ship's lives, its survival timer, your rock budget, send reload, its shield.
 * A phone's stage is too small for all of them, so a compact screen keeps only what the player acts
 * on (flying: lives and time; sending: budget and reload) and moves the ship's lives and clock into
 * the score line.
 */
export function createAsteroidsHud(container, { isFlying, tuning, isTouch, isCompact }) {
  const side = isFlying ? 'human' : 'computer';
  const refillText = `+${tuning.budgetRefill}/s`;
  const controls = (isTouch ? TOUCH_CONTROLS : CONTROLS)[side];
  const hud = createHud(container, {
    goal: GOAL[side],
    controls: isCompact && !isFlying ? `${controls} · budget ${refillText}` : controls,
  });
  const lastDrawn = new Map();

  const isBar = ({ max }) => !Number.isInteger(max) || max > SEGMENT_LIMIT;

  /** The shared HUD only builds a bar when a meter switches from segments, so a new bar starts as one segment. */
  function startAsSegments(id, spec) {
    if (!lastDrawn.has(id) && isBar(spec)) hud.setMeter(id, { ...spec, value: 0, max: 1 });
  }

  function setMeter(id, spec) {
    startAsSegments(id, spec);
    const signature = `${spec.label}|${spec.text}|${Math.round((spec.value / spec.max) * BAR_STEPS)}|${Math.floor(spec.value)}`;
    if (lastDrawn.get(id) === signature) return;
    lastDrawn.set(id, signature);
    hud.setMeter(id, spec);
  }

  function showSharedMeters(state) {
    setMeter('lives', { label: isFlying ? 'Lives' : 'Ship lives', value: Math.max(state.lives, 0), max: SHIP.startingLives });
    setMeter('time', {
      label: 'Time left',
      value: Math.max(SURVIVE_SECONDS - state.time, 0),
      max: SURVIVE_SECONDS,
      text: `${Math.max(Math.ceil(SURVIVE_SECONDS - state.time), 0)} s`,
    });
  }

  function showShield(state) {
    setMeter('shield', {
      label: 'Shield',
      value: state.ship.invulnerable,
      max: SHIP.invulnerableSeconds,
      text: state.ship.invulnerable > 0 ? `${oneDecimal(state.ship.invulnerable)} s` : 'off',
    });
  }

  function showFlyingMeters(state) {
    setMeter('gun', {
      label: 'Gun',
      value: BULLET.cooldown - state.ship.cooldown,
      max: BULLET.cooldown,
      text: state.ship.cooldown > 0 ? 'reloading' : 'ready',
    });
  }

  function showSendingMeters(state) {
    setMeter('budget', {
      label: isCompact ? 'Budget' : `Budget ${refillText}`,
      value: state.budget,
      max: tuning.budgetCap,
      text: `${oneDecimal(state.budget)}/${tuning.budgetCap}`,
    });
    setMeter('reload', {
      label: 'Reload',
      value: tuning.sendCooldown - state.sendCooldown,
      max: tuning.sendCooldown,
      text: readyText(state.sendCooldown),
    });
  }

  return {
    update(state) {
      if (!isFlying) showSendingMeters(state);
      if (isFlying || !isCompact) showSharedMeters(state);
      if (!isCompact) showShield(state);
      if (isFlying && !isCompact) showFlyingMeters(state);
    },
    scoreLine(state, wave) {
      if (isFlying) return `Score ${state.score} · Wave ${wave}`;
      const rocks = `Rocks in play ${state.rocks.length}/${tuning.maxRocks}`;
      if (!isCompact) return `${rocks} · Sent ${state.rocksSent}`;
      return `Ship lives ${Math.max(state.lives, 0)} · ${Math.max(Math.ceil(SURVIVE_SECONDS - state.time), 0)} s left · Rocks ${state.rocks.length}/${tuning.maxRocks}`;
    },
    setLevel: hud.setLevel,
    showHint: hud.showHint,
    /** Tells the player why a launch did nothing, and flashes the meter that explains it. */
    refuse(reason) {
      const { hint, meter } = REFUSAL[reason];
      hud.showHint(hint);
      if (meter) hud.flashMeter(meter);
    },
    destroy: hud.destroy,
  };
}
