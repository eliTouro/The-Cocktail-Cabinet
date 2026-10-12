import { createKeyboard } from '../core/input.js';
import { createLoop } from '../core/loop.js';
import { createBuilder } from './amaze-me/builder.js';
import {
  BUILD_SECONDS, BUMP_FLASH_SECONDS, COUNTDOWN_STEPS, COUNTDOWN_STEP_SECONDS, FLARE, FLARE_FLASH_SECONDS, GO_TEXT,
  GO_VISIBLE_SECONDS, GRID, MOVE_REPEAT_SECONDS, PART_LIMITS, REFUSAL_FLASH_SECONDS, SIGHT_RADIUS, SOLVE_SECONDS,
  TIME_UP_PAUSE_SECONDS, URGENT_SECONDS, WARN_SECONDS,
} from './amaze-me/config.js';
import * as copy from './amaze-me/copy.js';
import { DIRS, createMaze, findRoute, lockIn } from './amaze-me/maze.js';
import { cleanName, createMatch, holdBy, isMatchOver, matchWinner, recordRound, rematch, roles } from './amaze-me/match.js';
import { drawBuild, drawReveal, drawRun, readColours } from './amaze-me/render.js';
import { createRun, moveRunner, tickRun, useFlare } from './amaze-me/run.js';
import { cue } from './amaze-me/sounds.js';
import { createView } from './amaze-me/view.js';

const STYLESHEET_URL = new URL('../../css/amaze-me.css', import.meta.url).href;
const STAGE_CLASS = 'am-stage';

const RUN_KEYS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
const CURSOR_STEPS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const TOOL_KEYS = { Digit1: 'wall', Digit2: 'arrow', Digit3: 'portal', Digit4: 'erase' };
const FLARE_KEY = 'KeyF';
const CENTRE_CELL = Math.floor(GRID.rows / 2) * GRID.cols + Math.floor(GRID.cols / 2);

function loadStylesheet() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLESHEET_URL;
  document.head.append(link);
  return link;
}

const clockText = (seconds) => {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const cleanNames = (typed) => typed.map((name, index) => cleanName(name, copy.DEFAULT_NAMES[index]));

export function mount(container) {
  const stylesheet = loadStylesheet();
  container.classList.add(STAGE_CLASS);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let destroyed = false;
  let colours = null;
  let phase = 'title';
  let phaseClock = 0;
  let match = null;
  let builder = null;
  let buildLeft = 0;
  let lastWholeSecond = 0;
  let lockedMaze = null;
  let revealRoute = null;
  let run = null;
  let keys = null;
  let pad = { held: null, tapped: null };
  let repeatClock = 0;
  let goClock = 0;
  let toldAboutPortals = false;
  let cursor = CENTRE_CELL;
  let hover = null;
  let trapped = { cells: [], until: 0 };
  let flareFlash = 0;
  let bump = null;
  let shownStep = -1;

  const view = createView(container, {
    onTool: (id) => { selectTool(id); cue('select'); },
    onReady: () => handOver(),
    onCellDown: (cell) => { if (phase === 'build') afterBuildAction(builder.press(cell)); },
    onCellEnter: (cell) => {
      hover = cell;
      if (phase === 'build') afterBuildAction(builder.drag(cell));
    },
    onCellLeave: () => {
      hover = null;
      if (phase === 'build') builder.leave();
    },
    onCellUp: () => { if (phase === 'build') afterBuildAction(builder.release()); },
    onCanvasKey: (event) => phase === 'build' && handleBuildKey(event),
    onMove: (dir, pressed) => {
      if (pressed) pad = { held: dir, tapped: dir };
      else if (pad.held === dir) pad.held = null;
    },
    onFlare: () => { if (phase === 'run') tryFlare(); },
  });

  const now = () => performance.now() / 1000;
  const names = () => {
    const { builder: builderIndex, runner: runnerIndex } = roles(match);
    return { builder: match.names[builderIndex], runner: match.names[runnerIndex] };
  };

  /* ---------- Cards ---------- */

  function showTitle() {
    phase = 'title';
    view.showCard({
      brand: true,
      title: copy.TITLE,
      lede: copy.titleCard.lede,
      steps: copy.titleCard.steps,
      names: true,
      buttons: [{
        label: (typed) => copy.titleCard.startLabel(cleanNames(typed)[0]),
        onClick: (typed) => {
          match = createMatch(cleanNames(typed));
          showCoverBuild();
        },
      }],
    });
  }

  function showCoverBuild() {
    phase = 'cover-build';
    const cover = copy.coverBuild(names());
    view.showCard({ title: cover.title, lede: cover.lede, buttons: [{ label: cover.buttonLabel, onClick: beginBuild }] });
  }

  function showCoverRun() {
    phase = 'cover-run';
    const cover = copy.coverRun(names());
    view.showCard({ title: cover.title, lede: cover.lede, buttons: [{ label: cover.buttonLabel, onClick: beginCountdown }] });
  }

  function showFinal() {
    phase = 'final';
    const winner = matchWinner(match);
    const card = copy.finalCard({
      names: match.names,
      holds: [holdBy(match, 0), holdBy(match, 1)],
      wins: match.wins,
      winner,
      nextFirst: 1 - match.firstBuilder,
    });
    view.showCard({
      title: card.title,
      rows: card.rows,
      detail: card.detail,
      tally: card.tally,
      buttons: [
        { label: card.rematchLabel, onClick: () => { match = rematch(match); showCoverBuild(); } },
        { label: card.newPlayersLabel, primary: false, onClick: showTitle },
      ],
    });
    cue(winner === 'draw' ? 'draw' : 'win');
  }

  /* ---------- Build ---------- */

  function beginBuild() {
    builder = createBuilder({ maze: createMaze(GRID), limits: PART_LIMITS });
    buildLeft = BUILD_SECONDS;
    lastWholeSecond = Math.ceil(buildLeft);
    cursor = CENTRE_CELL;
    hover = null;
    trapped = { cells: [], until: 0 };
    phase = 'build';
    view.showPlay('build');
    selectTool('wall');
    showBuildStatus();
    showBuildBar();
    view.canvas.focus();
  }

  function selectTool(id) {
    builder.select(id);
    view.setTools({ selected: id, left: builder.left() });
    view.setHelp(copy.toolHelp(id));
  }

  function showBuildStatus() {
    const maze = builder.maze();
    const loosePortal = maze.cells.filter((cell) => cell === 'portal').length === 1;
    view.setStatus(copy.escapable({ steps: builder.route().length - 1, loosePortal }));
  }

  function showBuildBar() {
    view.setTopBar({
      text: copy.buildTopBar(names().builder),
      timerLabel: copy.BUILD_TIMER_LABEL,
      fraction: buildLeft / BUILD_SECONDS,
      timeText: clockText(buildLeft),
      urgent: buildLeft <= URGENT_SECONDS,
    });
  }

  function afterBuildAction({ changed, erased, refusal }) {
    if (changed) {
      cue(erased ? 'erase' : 'place');
      view.setTools({ selected: builder.tool(), left: builder.left() });
      showBuildStatus();
    }
    if (!refusal) return;
    cue('refused');
    view.flashStatus(copy.REFUSALS[refusal.reason]);
    if (refusal.reason === 'pocket') trapped = { cells: refusal.trapped, until: now() + REFUSAL_FLASH_SECONDS };
  }

  function handleBuildKey(event) {
    if (event.code in TOOL_KEYS) {
      selectTool(TOOL_KEYS[event.code]);
      cue('select');
    } else if (event.code in CURSOR_STEPS) {
      moveCursor(CURSOR_STEPS[event.code]);
    } else if (event.code === 'Space' || event.code === 'Enter') {
      afterBuildAction(builder.tap(cursor));
    } else {
      return false;
    }
    return true;
  }

  function moveCursor([dx, dy]) {
    const x = Math.min(Math.max((cursor % GRID.cols) + dx, 0), GRID.cols - 1);
    const y = Math.min(Math.max(Math.floor(cursor / GRID.cols) + dy, 0), GRID.rows - 1);
    cursor = y * GRID.cols + x;
  }

  function updateBuild(dt) {
    buildLeft = Math.max(0, buildLeft - dt);
    showBuildBar();
    announceLastSeconds(buildLeft);
    if (buildLeft > 0) return;
    afterBuildAction(builder.release());
    phase = 'time-up';
    phaseClock = 0;
    view.setStatus(copy.TIME_UP);
  }

  function handOver() {
    if (phase !== 'build' && phase !== 'time-up') return;
    afterBuildAction(builder.release());
    lockedMaze = lockIn(builder.maze());
    showCoverRun();
  }

  /** One tick a second for the last ten seconds, and a double beep at three. */
  function announceLastSeconds(secondsLeft) {
    const whole = Math.ceil(secondsLeft);
    if (whole === lastWholeSecond) return;
    lastWholeSecond = whole;
    if (whole > 0 && whole <= URGENT_SECONDS) cue(whole === WARN_SECONDS ? 'warn' : 'tick');
  }

  /* ---------- Run ---------- */

  function beginCountdown() {
    run = createRun(lockedMaze, { seconds: SOLVE_SECONDS, sight: SIGHT_RADIUS, flares: FLARE.count });
    keys = createKeyboard();
    pad = { held: null, tapped: null };
    repeatClock = 0;
    goClock = 0;
    toldAboutPortals = false;
    flareFlash = 0;
    bump = null;
    lastWholeSecond = Math.ceil(run.timeLeft);
    phase = 'countdown';
    phaseClock = 0;
    view.showPlay('run');
    view.setStatus(copy.RUN_GOAL);
    view.setHelp(copy.RUN_LEGEND);
    view.setFlares(run.flaresLeft);
    showRunBar();
    showCountdownStep(-1);
  }

  function showRunBar() {
    view.setTopBar({
      text: copy.runTopBar(names()),
      timerLabel: copy.RUN_TIMER_LABEL,
      fraction: run.timeLeft / SOLVE_SECONDS,
      timeText: clockText(run.timeLeft),
      urgent: run.timeLeft <= URGENT_SECONDS,
    });
  }

  function showCountdownStep(step) {
    shownStep = step;
    view.showCountdown(COUNTDOWN_STEPS[step] ?? null);
    if (step >= 0 && step < COUNTDOWN_STEPS.length) cue('tick');
  }

  function updateCountdown(dt) {
    phaseClock += dt;
    const step = Math.floor(phaseClock / COUNTDOWN_STEP_SECONDS);
    if (step === shownStep) return;
    if (step < COUNTDOWN_STEPS.length) {
      showCountdownStep(step);
      return;
    }
    phase = 'run';
    goClock = GO_VISIBLE_SECONDS;
    view.showCountdown(GO_TEXT);
    cue('go');
  }

  function updateRun(dt) {
    if (goClock > 0) {
      goClock -= dt;
      if (goClock <= 0) view.showCountdown(null);
    }
    steer(dt);
    if (keys.consumeTap(FLARE_KEY)) tryFlare();
    tickRun(run, dt);
    showRunBar();
    announceLastSeconds(run.timeLeft);
    if (run.outcome) finishRun();
  }

  function tappedDirection() {
    let tapped = pad.tapped;
    pad.tapped = null;
    for (const [code, dir] of Object.entries(RUN_KEYS)) {
      if (keys.consumeTap(code)) tapped ??= dir;
    }
    return tapped;
  }

  const heldDirection = () => pad.held ?? Object.entries(RUN_KEYS).find(([code]) => keys.isDown(code))?.[1];

  /** A fresh press moves at once; a held key or button then repeats every MOVE_REPEAT_SECONDS. */
  function steer(dt) {
    repeatClock = Math.max(0, repeatClock - dt);
    const tapped = tappedDirection();
    if (tapped) {
      tryMove(tapped);
      repeatClock = MOVE_REPEAT_SECONDS;
      return;
    }
    const held = heldDirection();
    if (!held || repeatClock > 0) return;
    tryMove(held);
    repeatClock = MOVE_REPEAT_SECONDS;
  }

  function tryMove(dir) {
    if (run.outcome) return;
    const move = moveRunner(run, dir);
    if (move.moved) {
      cue(move.teleported ? 'warp' : 'step');
      if (move.teleported && !toldAboutPortals) {
        toldAboutPortals = true;
        view.flashStatus(copy.FIRST_TELEPORT);
      }
    } else if (move.blocked === 'arrow') {
      cue('refused');
      view.flashStatus(copy.BLOCKED_BY_ARROW);
    } else {
      cue('bump');
      bump = { vector: DIRS[dir], strength: 1 };
    }
  }

  function tryFlare() {
    if (useFlare(run, FLARE.radius)) {
      cue('flare');
      flareFlash = 1;
      view.setFlares(run.flaresLeft);
    } else {
      cue('refused');
      view.flashStatus(copy.NO_FLARES);
    }
  }

  function finishRun() {
    const { builder: builderName, runner: runnerName } = names();
    const builderIndex = roles(match).builder;
    const escaped = run.outcome === 'escaped';
    match = recordRound(match, { escaped, seconds: escaped ? run.elapsed : SOLVE_SECONDS });
    keys.destroy();
    keys = null;
    pad = { held: null, tapped: null };
    revealRoute = findRoute(run.maze);
    phase = 'result';
    view.showCountdown(null);
    view.showPlay('result');
    view.setStatus(copy.REVEAL_KEY);
    view.setHelp('');
    cue(escaped ? 'win' : 'lost');
    const outcome = copy.result({
      builder: builderName,
      runner: runnerName,
      escaped,
      elapsed: run.elapsed,
      hold: holdBy(match, builderIndex),
      isLastRound: isMatchOver(match),
    });
    view.showResult({ ...outcome, onClick: isMatchOver(match) ? showFinal : showCoverBuild });
  }

  /* ---------- Loop ---------- */

  function update(dt) {
    flareFlash = Math.max(0, flareFlash - dt / FLARE_FLASH_SECONDS);
    if (bump) bump.strength = Math.max(0, bump.strength - dt / BUMP_FLASH_SECONDS);
    if (phase === 'build') updateBuild(dt);
    else if (phase === 'time-up') updateTimeUp(dt);
    else if (phase === 'countdown') updateCountdown(dt);
    else if (phase === 'run') updateRun(dt);
  }

  function updateTimeUp(dt) {
    phaseClock += dt;
    if (phaseClock >= TIME_UP_PAUSE_SECONDS) handOver();
  }

  function showsCursor() {
    return document.activeElement === view.canvas && view.canvas.matches(':focus-visible');
  }

  function render() {
    if (!stylesheet.sheet) return;
    colours ??= readColours(container);
    const time = reducedMotion ? 0 : now();
    const context = view.context;
    if (phase === 'build' || phase === 'time-up') {
      drawBuild(context, {
        maze: builder.maze(),
        route: builder.route(),
        cursor: showsCursor() ? cursor : null,
        hover,
        trapped: now() < trapped.until ? trapped.cells : [],
        moving: builder.movingEnd(),
        colours,
        time,
      });
    } else if (phase === 'countdown' || phase === 'run') {
      drawRun(context, { run, colours, flareFlash, bump, time });
    } else if (phase === 'result') {
      drawReveal(context, { run, route: revealRoute, colours, time });
    }
  }

  const loop = createLoop({ update, render });
  const startWhenStyled = () => {
    if (destroyed) return;
    showTitle();
    loop.start();
  };
  stylesheet.addEventListener('load', startWhenStyled, { once: true });
  stylesheet.addEventListener('error', startWhenStyled, { once: true });

  return {
    destroy() {
      destroyed = true;
      loop.stop();
      keys?.destroy();
      view.destroy();
      container.classList.remove(STAGE_CLASS);
      stylesheet.remove();
    },
  };
}
