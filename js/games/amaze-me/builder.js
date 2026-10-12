import { edit, findRoute, partsLeft } from './maze.js';

export const TOOLS = ['wall', 'arrow', 'portal', 'erase'];

/**
 * The builder's side of the board, without any screen: which tool is selected and what a press,
 * a drag and a release do to the maze. Every change goes through `edit`, so the maze it holds
 * is always fair.
 *
 * Each call that touches the board returns { changed, erased, refusal }. `erased` says the change
 * removed a part (so the screen can play the erase sound). `refusal` is the first
 * { reason, trapped } of a drag that was turned down (later ones in the same drag are muted so
 * one stroke over a full board makes one warning, not forty).
 */
export function createBuilder({ maze, limits }) {
  let current = maze;
  let route = findRoute(maze);
  let tool = TOOLS[0];
  let drag = null;

  function apply(action) {
    const result = edit(current, action, limits);
    if (!result.ok) return reportRefusal(result);
    if (result.changed) {
      current = result.maze;
      route = result.route;
    }
    const erased = action.type === 'erase' || action.cell === 'floor';
    return { changed: result.changed, erased: result.changed && erased, refusal: null };
  }

  function reportRefusal({ reason, trapped }) {
    const alreadyWarned = drag?.warned;
    if (drag) drag.warned = true;
    return { changed: false, erased: false, refusal: alreadyWarned ? null : { reason, trapped } };
  }

  const nothing = { changed: false, erased: false, refusal: null };
  const isEnd = (at) => at === current.start || at === current.exit;

  const pressByTool = {
    wall(at) {
      const cell = current.cells[at] === 'wall' ? 'floor' : 'wall';
      drag = { kind: 'paint', cell };
      return apply({ type: 'paint', at, cell });
    },
    arrow(at) {
      drag = { kind: 'tap' };
      return apply({ type: 'arrow', at });
    },
    portal(at) {
      drag = { kind: 'tap' };
      return apply({ type: 'paint', at, cell: 'portal' });
    },
    erase(at) {
      drag = { kind: 'erase' };
      return apply({ type: 'erase', at });
    },
  };

  return {
    maze: () => current,
    route: () => route,
    tool: () => tool,
    left: () => partsLeft(current, limits),
    /** Where a Start or Exit being dragged is hovering, as { key, at }, or null. */
    movingEnd: () => (drag?.kind === 'move' ? { key: drag.key, at: drag.at } : null),

    select(id) {
      tool = id;
    },

    press(at) {
      if (isEnd(at)) {
        drag = { kind: 'move', key: at === current.start ? 'start' : 'exit', at };
        return nothing;
      }
      return pressByTool[tool](at);
    },

    drag(at) {
      if (drag?.kind === 'move') drag.at = at;
      if (drag?.kind === 'paint') return apply({ type: 'paint', at, cell: drag.cell });
      if (drag?.kind === 'erase') return apply({ type: 'erase', at });
      return nothing;
    },

    /** The pointer left the board: a Start or Exit being dragged is dropped nowhere, so it stays put. */
    leave() {
      if (drag?.kind === 'move') drag.at = null;
    },

    release() {
      const finished = drag;
      if (finished?.kind !== 'move' || finished.at === null) {
        drag = null;
        return nothing;
      }
      const result = apply({ type: finished.key === 'start' ? 'moveStart' : 'moveExit', at: finished.at });
      drag = null;
      return result;
    },

    /** A single press and release, as from the keyboard. */
    tap(at) {
      const result = this.press(at);
      this.release();
      return result;
    },
  };
}
