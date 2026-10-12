import {
  BUILD_SECONDS, DNF_BONUS_SECONDS, FLARE, PART_LIMITS, SOLVE_SECONDS,
} from './config.js';

/** Every word the player reads, in one place. Functions take the names and numbers they need. */

export const TITLE = 'aMaze Me';

export const DEFAULT_NAMES = ['Player 1', 'Player 2'];

export const TOOL_LABELS = { wall: 'Wall', arrow: 'Arrow', portal: 'Portal', erase: 'Erase' };

const MOVE_ENDS_HINT = 'Drag S or EXIT to move them.';

const TOOL_HELP = {
  wall: 'Drag to draw walls. Start a drag on a wall to erase instead.',
  arrow: 'Tap a square to place an arrow; tap it again to turn it. Runners can only go through the way it points.',
  portal: 'Place two portals. Stepping onto one jumps you to the other.',
  erase: 'Tap or drag over any part to remove it.',
};

export const toolHelp = (tool) => `${TOOL_HELP[tool]} ${MOVE_ENDS_HINT}`;

export const REFUSALS = {
  sealed: 'Blocked: that would wall the Exit off. There must always be a way out.',
  pocket: 'Blocked: that would trap the runner in a dead end with no way back.',
  'limit-wall': 'No walls left. Erase one to use it elsewhere.',
  'limit-arrow': `All ${PART_LIMITS.arrow} arrows are placed. Erase one first.`,
  'limit-portal': 'Both portals are placed. Erase one to move it.',
  occupied: "Start and Exit can't be covered.",
  'bad-move': 'The Start and Exit need open squares with a route between them.',
};

export const titleCard = {
  title: TITLE,
  lede: 'A maze duel for two people on one screen.',
  steps: [
    { lead: 'Build', text: `You get ${BUILD_SECONDS} seconds to draw a maze for your friend. It always has a way out: the game won't let you seal it.` },
    { lead: 'Run', text: `Your friend runs it in the fog, seeing only the squares around them. The exit glows, but the way there is hidden. They get ${SOLVE_SECONDS} seconds.` },
    { lead: 'Swap', text: 'Then they build and you run. The maze that holds its runner longest wins.' },
  ],
  startLabel: (firstBuilder) => `Start: ${firstBuilder} builds first`,
};

export const coverBuild = ({ builder, runner }) => ({
  title: `${builder}, you're the builder`,
  lede: `${runner}, look away until ${builder} hands you the screen. No peeking: the fog only works if you haven't seen the maze.`,
  buttonLabel: `I'm ${builder}: start building`,
});

export const coverRun = ({ builder, runner }) => ({
  title: `${builder}'s maze is ready`,
  lede: `Hand the screen to ${runner}. ${builder}: no hints! Find the glowing exit in ${SOLVE_SECONDS} seconds. Arrow keys or WASD, or the arrow buttons, move you. F or the Flare button lights up a wide area (${FLARE.count} per run).`,
  buttonLabel: `I'm ${runner}: start running`,
});

export const buildTopBar = (builder) => `${builder} is building`;
export const runTopBar = ({ builder, runner }) => `${runner} is running ${builder}'s maze`;
export const BUILD_TIMER_LABEL = 'Build time';
export const RUN_TIMER_LABEL = 'Time left';

export const READY_BUTTON = 'Maze ready: hand over';
export const TIME_UP = "Time's up! Your maze is locked in.";

export const escapable = ({ steps, loosePortal }) =>
  `✓ Escapable: shortest route ${steps} ${steps === 1 ? 'step' : 'steps'}${loosePortal ? ' · The lone portal needs a twin.' : ''}`;

export const REVEAL_KEY = 'Gold line: the path taken. Dashed line: the shortest route.';
export const RUN_GOAL = 'Reach the glowing exit before time runs out.';
export const RUN_LEGEND = '▲ Arrow: one way only · ◎ Portal: jumps to its twin · ◆ Exit';
export const BLOCKED_BY_ARROW = 'That arrow only lets you through the other way.';
export const FIRST_TELEPORT = 'Whoosh! Portals jump you to their twin.';
export const NO_FLARES = 'No flares left.';

export const flareLabel = (left) => `Flare (${left})`;

/** One decimal, dropped when it is a whole number: 41.3 and 120. */
const seconds = (value) => String(Number(value.toFixed(1)));

export function result({ builder, runner, escaped, elapsed, hold, isLastRound }) {
  return {
    title: escaped ? `${runner} escaped in ${seconds(elapsed)} s` : `${runner} is lost in the fog!`,
    detail: escaped
      ? `${builder}'s maze held them for ${seconds(elapsed)} seconds.`
      : `Time ran out. ${builder}'s maze scores ${SOLVE_SECONDS} + ${DNF_BONUS_SECONDS} bonus = ${hold}.`,
    buttonLabel: isLastRound ? 'See who won' : `Swap: ${runner} builds next`,
  };
}

export function finalCard({ names, holds, wins, winner, nextFirst }) {
  const [a, b] = names;
  return {
    title: winner === 'draw' ? 'Dead heat!' : `${names[winner]} wins!`,
    rows: [
      `${a}'s maze held ${b}: ${seconds(holds[0])} s`,
      `${b}'s maze held ${a}: ${seconds(holds[1])} s`,
    ],
    detail: 'The maze that holds its runner longest wins.',
    tally: `Wins so far: ${a} ${wins[0]} · ${b} ${wins[1]}`,
    rematchLabel: `Rematch: ${names[nextFirst]} builds first`,
    newPlayersLabel: 'New players',
  };
}
