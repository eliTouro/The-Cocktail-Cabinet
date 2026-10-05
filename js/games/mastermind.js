import { createOverlay } from '../core/overlay.js';
import { createRng } from '../core/rng.js';
import { randomCode } from './mastermind/codemaker.js';
import { CODE_COLOURS, PAUSE_MS } from './mastermind/config.js';
import { createEntry } from './mastermind/entry.js';
import { guessesLeft } from './mastermind/rules.js';
import { createRun } from './mastermind/session.js';
import { createView } from './mastermind/view.js';

const STYLESHEET_URL = new URL('../../css/mastermind.css', import.meta.url).href;
const STAGE_CLASS = 'mm-stage';

const REJECTIONS = {
  incomplete: 'Fill every slot first.',
  repeat: 'Each colour can be used only once on this level.',
  colour: 'Pick one of the colours in the palette.',
};

const INTRO = {
  human: 'The computer has hidden a colour code. Click a colour, or press its number key, then press Enter to guess. A red peg is the right colour in the right place; a white peg is the right colour in the wrong place.',
  computer: 'Hide a colour code, or press Random code, then lock it in. The computer cracks it from red and white pegs alone. Use up its guesses and you move up a level.',
};

const EDIT_KEYS = ['ArrowLeft', 'ArrowRight', 'Backspace', 'Delete'];
const SECRET_LABEL = { human: "Computer's secret", computer: 'Your secret code' };

const colourNames = (code) => code.map((colour) => CODE_COLOURS[colour].name).join(', ');
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function loadStylesheet() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLESHEET_URL;
  document.head.append(link);
  return link;
}

export function mount(container, { mode }) {
  const modeId = mode.id;
  const stylesheet = loadStylesheet();
  const overlay = createOverlay(container);
  const rng = createRng();
  const timers = new Set();
  container.classList.add(STAGE_CLASS);

  let run = createRun({ modeId, rng });
  let entry = null;
  let phase = 'intro';
  let pendingGuess = null;

  const view = createView(container, {
    onColour: (colour) => edit(() => entry.place(colour)),
    onSlot: (place) => { if (phase === 'guessing') edit(() => entry.select(place)); },
    onSecretSlot: (place) => { if (phase === 'hiding') edit(() => entry.select(place)); },
  });

  function edit(change) {
    change();
    view.clearWarning();
    draw();
  }

  function schedule(action, delay) {
    const id = setTimeout(() => {
      timers.delete(id);
      action();
    }, delay);
    timers.add(id);
  }

  const isEntering = () => phase === 'guessing' || phase === 'hiding';

  function visibleHistory() {
    const { history } = run.round ?? { history: [] };
    return pendingGuess ? history.slice(0, -1) : history;
  }

  function secretState() {
    if (phase === 'hiding') return { entry: { code: entry.code, cursor: entry.cursor }, masked: false };
    const hidden = modeId === 'human' && phase !== 'between';
    return { code: run.round?.secret, masked: hidden };
  }

  function draw() {
    view.draw({
      history: visibleHistory(),
      pendingGuess,
      entry: phase === 'guessing' ? { code: entry.code, cursor: entry.cursor } : null,
      secret: secretState(),
    });
  }

  function updateScore() {
    const level = `Level ${run.level}`;
    if (phase === 'hiding') overlay.setScore(`${level} · ${plural(run.settings.guesses, 'guess', 'guesses')} for the computer`);
    else overlay.setScore(`${level} · ${plural(guessesLeft(run.round), 'guess', 'guesses')} left`);
  }

  function setPhase(next) {
    phase = next;
    view.setPaletteVisible(isEntering());
    view.setThinking(next === 'computer');
    view.setActions(actionsFor(next));
  }

  function actionsFor(current) {
    if (current === 'guessing') {
      return [
        { label: 'Submit guess', primary: true, onClick: submitGuess },
        { label: 'Clear row', onClick: () => edit(() => entry.reset()) },
      ];
    }
    if (current === 'hiding') {
      return [
        { label: 'Lock in code', primary: true, onClick: lockInCode },
        { label: 'Random code', onClick: () => edit(() => entry.set(randomCode(run.settings, rng))) },
        { label: 'Clear', onClick: () => edit(() => entry.reset()) },
      ];
    }
    return [];
  }

  function beginLevel() {
    const { settings } = run;
    entry = createEntry(settings.pegs, settings.colours);
    pendingGuess = null;
    overlay.hide();
    view.buildRound(settings, { secretLabel: SECRET_LABEL[modeId] });
    if (modeId === 'human') {
      run.startLevel();
      setPhase('guessing');
      view.setMessage(`Level ${run.level}: crack the code. Press 1 to ${settings.colours} to place colours.`);
    } else {
      setPhase('hiding');
      view.setMessage('Choose your code, then lock it in.');
    }
    refresh();
  }

  function refresh() {
    draw();
    updateScore();
  }

  function submitGuess() {
    if (phase !== 'guessing') return;
    const result = run.guess(entry.code);
    if (!result.ok) {
      view.setMessage(REJECTIONS[result.reason], { warning: true });
      return;
    }
    const last = run.round.history.at(-1).feedback;
    view.setMessage(`Guess ${run.round.history.length}: ${plural(last.black, 'red peg')}, ${plural(last.white, 'white peg')}.`);
    entry.reset();
    refresh();
    if (run.finished) finishLevel();
  }

  function lockInCode() {
    if (phase !== 'hiding') return;
    const result = run.startLevel(entry.code);
    if (!result.ok) {
      view.setMessage(REJECTIONS[result.reason], { warning: true });
      return;
    }
    setPhase('computer');
    view.setMessage('Code locked. The computer sees only the pegs.');
    refresh();
    schedule(computerTurn, PAUSE_MS.think);
  }

  function computerTurn() {
    pendingGuess = run.computerGuess().guess;
    draw();
    schedule(revealPegs, PAUSE_MS.reveal);
  }

  function revealPegs() {
    pendingGuess = null;
    refresh();
    const last = run.round.history.at(-1).feedback;
    view.setMessage(`Guess ${run.round.history.length}: ${plural(last.black, 'red peg')}, ${plural(last.white, 'white peg')}.`);
    if (run.finished) finishLevel();
    else schedule(computerTurn, PAUSE_MS.think);
  }

  function finishLevel() {
    phase = 'between';
    view.setPaletteVisible(false);
    view.setThinking(false);
    view.setActions([]);
    draw();
    schedule(showLevelResult, PAUSE_MS.levelEnd);
  }

  function showLevelResult() {
    const { round, level } = run;
    const cleared = run.levelCleared;
    const used = round.history.length;
    const total = run.cleared + (cleared ? 1 : 0);
    const secret = `Secret revealed: ${colourNames(round.secret)}.`;
    overlay.show({
      ...resultText({ cleared, used, level, total, secret }),
      actionLabel: cleared ? 'Next level' : 'Play again',
      onAction: cleared ? nextLevel : startNewRun,
    });
  }

  function resultText({ cleared, used, level, total, secret }) {
    const summary = `${plural(total, 'level')} cleared.`;
    if (modeId === 'human') {
      return cleared
        ? { title: `Level ${level} cleared`, detail: `Cracked in ${plural(used, 'guess', 'guesses')}. ${summary}` }
        : { title: 'Out of guesses', detail: `${secret} ${summary}` };
    }
    return cleared
      ? { title: 'You stumped it', detail: `It used all ${plural(used, 'guess', 'guesses')} on level ${level}. ${secret} ${summary}` }
      : { title: 'The computer cracked it', detail: `Level ${level} fell in ${plural(used, 'guess', 'guesses')}. ${summary}` };
  }

  function nextLevel() {
    run.advance();
    beginLevel();
  }

  function startNewRun() {
    run = createRun({ modeId, rng });
    beginLevel();
  }

  function onKeyDown(event) {
    if (!isEntering() || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter') {
      if (event.target.closest?.('button')) return;
      (phase === 'guessing' ? submitGuess : lockInCode)();
    } else if (isEditKey(event.key)) {
      edit(() => applyEditKey(event.key));
    } else {
      return;
    }
    event.preventDefault();
  }

  const colourKey = (key) => (/^[1-9]$/.test(key) && Number(key) <= run.settings.colours ? Number(key) - 1 : null);
  const isEditKey = (key) => colourKey(key) !== null || EDIT_KEYS.includes(key);

  function applyEditKey(key) {
    if (colourKey(key) !== null) entry.place(colourKey(key));
    else if (key === 'ArrowLeft') entry.move(-1);
    else if (key === 'ArrowRight') entry.move(1);
    else if (key === 'Backspace') entry.backspace();
    else entry.clearSelected();
  }

  window.addEventListener('keydown', onKeyDown);
  overlay.show({
    title: 'Mastermind',
    detail: INTRO[modeId],
    actionLabel: 'Start',
    onAction: beginLevel,
  });
  overlay.setScore('Level 1');

  return {
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      timers.forEach(clearTimeout);
      timers.clear();
      overlay.destroy();
      view.destroy();
      container.classList.remove(STAGE_CLASS);
      stylesheet.remove();
    },
  };
}
