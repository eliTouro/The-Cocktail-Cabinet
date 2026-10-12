import { createHud } from '../../core/hud.js';
import { CITY_XS, SURVIVE_SECONDS, TUNING } from './config.js';
import { CONTROLS, GOAL, REFUSAL } from './texts.js';

/** Bars move in this many steps, so the HUD only touches the page when a bar visibly changes. */
const BAR_STEPS = 20;

const CITY_COUNT = CITY_XS.length;
const oneDecimal = (value) => value.toFixed(1);
const standing = (state) => state.cities.filter((city) => city.alive).length;
const secondsLeft = (state) => Math.max(Math.ceil(SURVIVE_SECONDS - state.time), 0);
const ammoMeterId = (index) => `ammo-${index}`;

/**
 * The on-screen help for one Missile Command round: the goal and controls, plus a labelled meter
 * for each thing the player spends or waits on. Meters differ by side:
 *   defending: missiles in each base, cities left, time left;
 *   attacking: launch budget (and its refill), warheads in the air, cities left, time left,
 *   and the defender's total ammo.
 * A phone's stage is too small for all of them, so a compact screen keeps only what the player
 * acts on (each base's ammo, or the budget and warheads in the air) and moves cities and clock
 * into the score line.
 */
export function createMissileHud(container, { isDefending, isCompact }) {
  const side = isDefending ? 'human' : 'computer';
  const tuning = TUNING[side]();
  const hud = createHud(container, { goal: GOAL[side], controls: CONTROLS[side] });
  const reloadSeconds = isDefending ? tuning.baseCooldown : tuning.launchCooldown;
  const lastDrawn = new Map();

  function setMeter(id, spec) {
    const signature = `${spec.label}|${spec.text}|${Math.round((spec.value / spec.max) * BAR_STEPS)}|${Math.floor(spec.value)}`;
    if (lastDrawn.get(id) === signature) return;
    lastDrawn.set(id, signature);
    hud.setMeter(id, spec);
  }

  function showAmmo(state) {
    state.bases.forEach((base, index) => {
      const text = base.alive ? `${base.ammo}/${tuning.ammoPerBase}` : 'destroyed';
      setMeter(ammoMeterId(index), { label: `Base ${index + 1}`, value: base.ammo, max: tuning.ammoPerBase, text });
    });
  }

  /** One meter for all bases: the total as a bar, each base's own count in the readout. */
  function showCompactAmmo(state) {
    const counts = state.bases.map((base) => (base.alive ? base.ammo : 'X'));
    const total = state.bases.reduce((sum, base) => sum + base.ammo, 0);
    setMeter('ammo', { label: 'Ammo', value: total, max: state.bases.length * tuning.ammoPerBase, text: counts.join(' | ') });
  }

  /** Seconds until the player's next launch can go: the shared pause, or for a defender the soonest usable base. */
  function secondsUntilReady(state) {
    if (!isDefending) return state.launchCooldown;
    const usable = state.bases.filter((base) => base.alive && base.ammo > 0);
    const soonestBase = usable.length > 0 ? Math.min(...usable.map((base) => base.cooldown)) : 0;
    return Math.max(state.fireCooldown, soonestBase);
  }

  function showReload(state) {
    const wait = secondsUntilReady(state);
    setMeter('reload', {
      label: 'Reload',
      value: reloadSeconds - wait,
      max: reloadSeconds,
      text: wait > 0 ? `${oneDecimal(wait)} s` : 'ready',
    });
  }

  function showCitiesAndTime(state) {
    setMeter('cities', { label: 'Cities', value: standing(state), max: CITY_COUNT });
    setMeter('time', { label: 'Time left', value: secondsLeft(state), max: SURVIVE_SECONDS, text: `${secondsLeft(state)} s` });
  }

  function showAttackMeters(state) {
    setMeter('budget', {
      label: isCompact ? 'Budget' : `Budget +${tuning.budgetRefill}/s`,
      value: state.budget,
      max: tuning.budgetCap,
      text: `${oneDecimal(state.budget)}/${tuning.budgetCap}`,
    });
    setMeter('air', { label: 'In the air', value: state.warheads.length, max: tuning.maxWarheads });
  }

  function showDefenderAmmo(state) {
    const total = state.bases.reduce((sum, base) => sum + base.ammo, 0);
    const capacity = state.bases.length * tuning.ammoPerBase;
    setMeter('defender-ammo', { label: 'Defender ammo', value: total, max: capacity, text: `${total}/${capacity}` });
  }

  return {
    update(state) {
      if (isDefending) (isCompact ? showCompactAmmo : showAmmo)(state);
      else showAttackMeters(state);
      if (isCompact) return;
      showReload(state);
      showCitiesAndTime(state);
      if (!isDefending) showDefenderAmmo(state);
    },
    scoreLine(state) {
      const cities = `Cities ${standing(state)}/${CITY_COUNT} · ${secondsLeft(state)} s left`;
      if (!isCompact) return isDefending ? `Score ${state.score} · Wave ${state.wave}` : `Sent ${state.warheadsSent} · Stopped ${state.warheadsDestroyed}`;
      return isDefending ? `${cities} · Score ${state.score}` : `${cities} · Stopped ${state.warheadsDestroyed}`;
    },
    setLevel: hud.setLevel,
    showHint: hud.showHint,
    /** Tells the player why a launch did nothing, and flashes the meters that explain it. */
    refuse({ kind, reason }) {
      const { hint, meters } = REFUSAL[kind][reason];
      hud.showHint(hint);
      meters.forEach((meter) => hud.flashMeter(meter));
    },
    destroy: hud.destroy,
  };
}
