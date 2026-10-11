import { h } from '../dom.js';

const SEGMENT_LIMIT = 10;

/**
 * On-screen help for a running game, laid over the stage:
 * - a goal line along the bottom, always visible, so the player knows how to win;
 * - the current level, top right;
 * - meters for anything the player waits on or spends (ammo, apples left, a cooldown).
 *
 * setMeter(id, { label, value, max, text? }) adds or updates a meter. Up to 10 whole units show
 * as segments, anything finer as a bar. `text` overrides the "value/max" readout.
 * flashMeter(id) pulses a meter, e.g. when the player tries to spend what is not ready.
 */
export function createHud(container, { goal, controls }) {
  const level = h('span', { class: 'hud__level', hidden: true });
  const meters = h('div', { class: 'hud__meters' });
  const top = h('div', { class: 'hud__top' }, meters, level);
  const hint = h('p', { class: 'hud__hint', 'aria-live': 'polite' });
  const bottom = h('div', { class: 'hud__bottom' },
    hint,
    h('p', { class: 'hud__goal' }, h('b', {}, 'Goal '), goal),
    controls ? h('p', { class: 'hud__controls' }, h('b', {}, 'Controls '), controls) : null);
  const root = h('div', { class: 'hud' }, top, bottom);
  const meterNodes = new Map();
  let hintTimer = 0;

  container.append(root);

  function buildMeter(id) {
    const label = h('span', { class: 'meter__label' });
    const track = h('span', { class: 'meter__track' });
    const readout = h('span', { class: 'meter__readout' });
    const node = h('div', { class: 'meter', 'data-meter': id }, label, track, readout);
    meters.append(node);
    const parts = { node, label, track, readout, segments: 0 };
    meterNodes.set(id, parts);
    return parts;
  }

  function fillSegments(parts, value, max) {
    if (parts.segments !== max) {
      parts.track.replaceChildren(...Array.from({ length: max }, () => h('i', { class: 'meter__segment' })));
      parts.segments = max;
    }
    [...parts.track.children].forEach((segment, index) => segment.toggleAttribute('data-on', index < value));
  }

  function fillBar(parts, value, max) {
    if (parts.segments !== 0) {
      parts.track.replaceChildren(h('i', { class: 'meter__fill' }));
      parts.segments = 0;
    }
    parts.track.firstChild.style.transform = `scaleX(${Math.min(Math.max(value / max, 0), 1)})`;
  }

  return {
    setLevel(number) {
      level.hidden = false;
      level.textContent = `Level ${number}`;
    },
    setMeter(id, { label, value, max, text }) {
      const parts = meterNodes.get(id) ?? buildMeter(id);
      parts.label.textContent = label;
      parts.readout.textContent = text ?? `${Math.floor(value)}/${max}`;
      const wholeUnits = Number.isInteger(max) && max <= SEGMENT_LIMIT;
      if (wholeUnits) fillSegments(parts, Math.floor(value), max);
      else fillBar(parts, value, max);
      parts.node.toggleAttribute('data-empty', value <= 0);
    },
    flashMeter(id) {
      const node = meterNodes.get(id)?.node;
      if (!node) return;
      node.removeAttribute('data-flash');
      void node.offsetWidth;
      node.setAttribute('data-flash', '');
    },
    removeMeter(id) {
      meterNodes.get(id)?.node.remove();
      meterNodes.delete(id);
    },
    /** A short message above the goal line, such as why a move was refused. */
    showHint(text, seconds = 1.6) {
      hint.textContent = text;
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => { hint.textContent = ''; }, seconds * 1000);
    },
    destroy() {
      clearTimeout(hintTimer);
      root.remove();
    },
  };
}
