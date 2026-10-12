import { CANVAS, FLARE } from './config.js';

/** Canvas drawing for aMaze Me. Reads the game state, never changes it. Logical size is 480x360. */

const CELL = CANVAS.cell;
const HALF = CELL / 2;
const COLOUR_NAMES = ['floor', 'dot', 'wall', 'arrow', 'portal', 'start', 'exit', 'runner', 'danger', 'fog', 'route'];
const ARROW_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
const UNSEEN_FOG_ALPHA = 0.96;
const REMEMBERED_FOG_ALPHA = 0.62;
const TRAIL_LENGTH = 14;

/** Colours live in css/amaze-me.css as --am-* custom properties; the canvas copies them once. */
export function readColours(element) {
  const style = getComputedStyle(element);
  return Object.fromEntries(COLOUR_NAMES.map((name) => [name, style.getPropertyValue(`--am-${name}`).trim()]));
}

const column = (maze, index) => index % maze.cols;
const row = (maze, index) => Math.floor(index / maze.cols);
const centreOf = (maze, index) => ({ x: column(maze, index) * CELL + HALF, y: row(maze, index) * CELL + HALF });

function glow(ctx, colour, blur) {
  ctx.shadowColor = colour;
  ctx.shadowBlur = blur;
}

function drawFloor(ctx, maze, colours, isShown) {
  ctx.fillStyle = colours.floor;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  ctx.fillStyle = colours.dot;
  maze.cells.forEach((_, index) => {
    if (!isShown(index)) return;
    const { x, y } = centreOf(maze, index);
    ctx.fillRect(x - 1, y - 1, 2, 2);
  });
}

function drawWall(ctx, colours, x, y) {
  ctx.save();
  glow(ctx, colours.wall, 10);
  ctx.fillStyle = colours.wall;
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 7);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.roundRect(x + 7, y + 7, CELL - 14, 5, 2.5);
  ctx.fill();
}

function drawArrow(ctx, colours, direction, x, y) {
  ctx.save();
  ctx.translate(x + HALF, y + HALF);
  ctx.rotate(ARROW_ANGLE[direction]);
  glow(ctx, colours.arrow, 8);
  ctx.strokeStyle = colours.arrow;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const offset of [-6, 5]) {
    ctx.beginPath();
    ctx.moveTo(offset - 5, -9);
    ctx.lineTo(offset + 5, 0);
    ctx.lineTo(offset - 5, 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPortal(ctx, colours, x, y, isInert) {
  ctx.save();
  ctx.globalAlpha = isInert ? 0.4 : 1;
  glow(ctx, colours.portal, 10);
  ctx.strokeStyle = colours.portal;
  ctx.lineWidth = 3;
  for (const radius of [15, 8]) {
    ctx.beginPath();
    ctx.arc(x + HALF, y + HALF, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParts(ctx, maze, colours, isShown) {
  const portals = maze.cells.filter((cell) => cell === 'portal').length;
  maze.cells.forEach((cell, index) => {
    if (cell === 'floor' || !isShown(index)) return;
    const x = column(maze, index) * CELL;
    const y = row(maze, index) * CELL;
    if (cell === 'wall') drawWall(ctx, colours, x, y);
    else if (cell === 'portal') drawPortal(ctx, colours, x, y, portals === 1);
    else drawArrow(ctx, colours, cell, x, y);
  });
}

function drawStart(ctx, maze, colours) {
  const { x, y } = centreOf(maze, maze.start);
  ctx.save();
  glow(ctx, colours.start, 10);
  ctx.strokeStyle = colours.start;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = colours.start;
  ctx.font = '700 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', x, y + 1);
}

function drawExit(ctx, maze, colours, time) {
  const { x, y } = centreOf(maze, maze.exit);
  const pulse = (Math.sin(time * 3) + 1) / 2;
  ctx.save();
  ctx.globalAlpha = 0.25 + 0.35 * (1 - pulse);
  ctx.strokeStyle = colours.exit;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 14 + pulse * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  glow(ctx, colours.exit, 16);
  ctx.fillStyle = colours.exit;
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x + 18, y);
  ctx.lineTo(x, y + 18);
  ctx.lineTo(x - 18, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = colours.floor;
  ctx.font = '800 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', x, y + 1);
}

function strokePath(ctx, maze, cells) {
  ctx.beginPath();
  cells.forEach((cell, order) => {
    const { x, y } = centreOf(maze, cell);
    if (order === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawRoute(ctx, maze, route, colours) {
  if (!route) return;
  ctx.save();
  ctx.strokeStyle = colours.route;
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 6]);
  strokePath(ctx, maze, route);
  ctx.restore();
}

function outlineCell(ctx, maze, index, colour, width) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.strokeRect(column(maze, index) * CELL + 2, row(maze, index) * CELL + 2, CELL - 4, CELL - 4);
}

function drawTrapped(ctx, maze, cells, colours, time) {
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.3 * ((Math.sin(time * 9) + 1) / 2);
  ctx.fillStyle = colours.danger;
  for (const cell of cells) ctx.fillRect(column(maze, cell) * CELL, row(maze, cell) * CELL, CELL, CELL);
  ctx.restore();
}

const everywhere = () => true;

export function drawBuild(ctx, { maze, route, cursor, hover, trapped, moving, colours, time }) {
  drawFloor(ctx, maze, colours, everywhere);
  drawRoute(ctx, maze, route, colours);
  drawParts(ctx, maze, colours, everywhere);
  drawTrapped(ctx, maze, trapped, colours, time);
  drawStart(ctx, maze, colours);
  drawExit(ctx, maze, colours, time);
  if (hover !== null) outlineCell(ctx, maze, hover, moving ? colours.start : colours.route, 2);
  if (cursor !== null) outlineCell(ctx, maze, cursor, colours.runner, 2.5);
}

/* ---------- The runner's view ---------- */

function drawDriftingFog(ctx, run, colours, time) {
  const { maze } = run;
  const unseen = new Path2D();
  maze.cells.forEach((_, index) => {
    if (!run.seen.has(index)) unseen.rect(column(maze, index) * CELL, row(maze, index) * CELL, CELL, CELL);
  });
  ctx.save();
  ctx.clip(unseen);
  for (let blob = 0; blob < 3; blob += 1) {
    const x = ((blob * 190 + time * 14) % (CANVAS.width + 240)) - 120;
    const y = 70 + blob * 110 + Math.sin(time * 0.4 + blob) * 20;
    const mist = ctx.createRadialGradient(x, y, 0, x, y, 130);
    mist.addColorStop(0, colours.wall);
    mist.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.11;
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  }
  ctx.restore();
}

function drawFog(ctx, run, colours, time) {
  const { maze } = run;
  ctx.fillStyle = colours.fog;
  maze.cells.forEach((_, index) => {
    const nearby = Math.hypot(column(maze, index) - column(maze, run.pos), row(maze, index) - row(maze, run.pos)) <= run.sight;
    if (nearby) return;
    ctx.globalAlpha = run.seen.has(index) ? REMEMBERED_FOG_ALPHA : UNSEEN_FOG_ALPHA;
    ctx.fillRect(column(maze, index) * CELL, row(maze, index) * CELL, CELL, CELL);
  });
  ctx.globalAlpha = 1;
  drawDriftingFog(ctx, run, colours, time);
}

function drawRunnerLight(ctx, run, colours) {
  const { x, y } = centreOf(run.maze, run.pos);
  const reach = (run.sight + 0.4) * CELL;
  const light = ctx.createRadialGradient(x, y, 0, x, y, reach);
  light.addColorStop(0, 'rgba(255, 190, 110, 0.28)');
  light.addColorStop(1, 'transparent');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);

  run.trail.slice(-TRAIL_LENGTH, -1).forEach((cell, order, recent) => {
    const spot = centreOf(run.maze, cell);
    ctx.globalAlpha = ((order + 1) / recent.length) * 0.35;
    ctx.fillStyle = colours.start;
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.save();
  glow(ctx, colours.start, 20);
  ctx.fillStyle = colours.runner;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFlareBurst(ctx, run, strength) {
  if (strength <= 0) return;
  const { x, y } = centreOf(run.maze, run.pos);
  const reach = FLARE.radius * CELL;
  const burst = ctx.createRadialGradient(x, y, 0, x, y, reach);
  burst.addColorStop(0, 'rgba(255, 244, 214, 0.9)');
  burst.addColorStop(1, 'transparent');
  ctx.save();
  ctx.globalAlpha = strength * 0.55;
  ctx.fillStyle = burst;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  ctx.restore();
}

/** A red mark on the side of the runner's square they just bumped into. */
function drawBump(ctx, run, bump, colours) {
  if (!bump || bump.strength <= 0) return;
  const { x, y } = centreOf(run.maze, run.pos);
  const [dx, dy] = bump.vector;
  ctx.save();
  ctx.globalAlpha = bump.strength;
  glow(ctx, colours.danger, 12);
  ctx.strokeStyle = colours.danger;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + dx * HALF - dy * 14, y + dy * HALF - dx * 14);
  ctx.lineTo(x + dx * HALF + dy * 14, y + dy * HALF + dx * 14);
  ctx.stroke();
  ctx.restore();
}

export function drawRun(ctx, { run, colours, flareFlash, bump, time }) {
  const { maze } = run;
  const isSeen = (index) => run.seen.has(index);
  drawFloor(ctx, maze, colours, isSeen);
  drawParts(ctx, maze, colours, isSeen);
  if (isSeen(maze.start)) drawStart(ctx, maze, colours);
  drawFog(ctx, run, colours, time);
  drawRunnerLight(ctx, run, colours);
  drawFlareBurst(ctx, run, flareFlash);
  drawExit(ctx, maze, colours, time);
  drawBump(ctx, run, bump, colours);
}

/** After a round: the whole maze, the shortest route, and the path the runner actually took. */
export function drawReveal(ctx, { run, route, colours, time }) {
  const { maze } = run;
  drawFloor(ctx, maze, colours, everywhere);
  drawRoute(ctx, maze, route, colours);
  drawParts(ctx, maze, colours, everywhere);
  drawStart(ctx, maze, colours);

  ctx.save();
  glow(ctx, colours.start, 8);
  ctx.strokeStyle = colours.start;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  strokePath(ctx, maze, run.trail);
  ctx.restore();

  drawExit(ctx, maze, colours, time);
  const { x, y } = centreOf(maze, run.pos);
  ctx.fillStyle = colours.runner;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
}
