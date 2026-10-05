import { EMPTY } from './rules.js';

/**
 * The row of pegs a player is building before submitting it: which colour sits in each slot and
 * which slot is selected. Pure state with no DOM, so mouse, touch and keyboard share one model.
 */
export function createEntry(pegs, colours) {
  let code = Array(pegs).fill(EMPTY);
  let cursor = 0;

  const clampSlot = (slot) => Math.min(Math.max(slot, 0), pegs - 1);

  function nextEmptyAfter(slot) {
    for (let step = 1; step < pegs; step += 1) {
      const candidate = (slot + step) % pegs;
      if (code[candidate] === EMPTY) return candidate;
    }
    return slot;
  }

  return {
    get code() { return [...code]; },
    get cursor() { return cursor; },
    /** Put a colour in the selected slot, then select the next empty slot. */
    place(colour) {
      code[cursor] = colour;
      cursor = nextEmptyAfter(cursor);
    },
    /** Selecting the selected slot again steps it to the next colour; otherwise it just selects. */
    select(slot) {
      if (slot !== cursor) {
        cursor = slot;
        return;
      }
      code[slot] = code[slot] === EMPTY ? 0 : (code[slot] + 1) % colours;
    },
    move(delta) { cursor = clampSlot(cursor + delta); },
    clearSelected() { code[cursor] = EMPTY; },
    /** Backspace: empty the selected slot, or step back and empty the one before it. */
    backspace() {
      if (code[cursor] === EMPTY) cursor = clampSlot(cursor - 1);
      code[cursor] = EMPTY;
    },
    set(newCode) {
      code = [...newCode];
      cursor = 0;
    },
    reset() { this.set(Array(pegs).fill(EMPTY)); },
  };
}
