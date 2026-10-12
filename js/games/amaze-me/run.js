import { step } from './maze.js';

/**
 * One runner's attempt at a locked-in maze. Pure rules: the object is changed in place by the
 * functions below, and nothing here knows about the screen or the clock.
 * run = { maze, pos, trail, seen, sight, flaresLeft, timeLeft, elapsed, outcome }
 * `seen` holds every cell the runner has had in view; `outcome` is null, 'escaped' or 'lost'.
 */
export function createRun(maze, { seconds, sight, flares }) {
  const run = {
    maze,
    pos: maze.start,
    trail: [maze.start],
    seen: new Set(),
    sight,
    flaresLeft: flares,
    timeLeft: seconds,
    elapsed: 0,
    outcome: null,
  };
  revealAround(run, run.pos, sight);
  return run;
}

/** Marks every cell whose centre is within `radius` cell widths of `centre` as seen. */
export function revealAround(run, centre, radius) {
  const { cols, rows } = run.maze;
  const cx = centre % cols;
  const cy = Math.floor(centre / cols);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (Math.hypot(x - cx, y - cy) <= radius) run.seen.add(y * cols + x);
    }
  }
}

/** Tries one move. A blocked move changes nothing (no step, no trail mark). */
export function moveRunner(run, dir) {
  if (run.outcome) return { moved: false, blocked: 'over', teleported: false, escaped: false };
  const move = step(run.maze, run.pos, dir);
  if (move.blocked) return { moved: false, blocked: move.blocked, teleported: false, escaped: false };

  run.pos = move.to;
  run.trail.push(move.to);
  revealAround(run, move.to, run.sight);
  const escaped = move.to === run.maze.exit;
  if (escaped) run.outcome = 'escaped';
  return { moved: true, blocked: null, teleported: move.teleported, escaped };
}

/** Lights up a wide area for good. Returns false when none are left or the run is over. */
export function useFlare(run, radius) {
  if (run.outcome || run.flaresLeft <= 0) return false;
  run.flaresLeft -= 1;
  revealAround(run, run.pos, radius);
  return true;
}

/** Advances the clock. The clock stops once the run has ended. */
export function tickRun(run, seconds) {
  if (run.outcome) return;
  run.elapsed += seconds;
  run.timeLeft = Math.max(0, run.timeLeft - seconds);
  if (run.timeLeft === 0) run.outcome = 'lost';
}
