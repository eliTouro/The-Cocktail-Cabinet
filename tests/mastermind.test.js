import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng } from '../js/core/rng.js';
import { chooseGuess } from '../js/games/mastermind/breaker.js';
import { randomCode } from '../js/games/mastermind/codemaker.js';
import { CODE_COLOURS, FINAL_LEVEL, breakerSkill, levelSettings } from '../js/games/mastermind/config.js';
import { createEntry } from '../js/games/mastermind/entry.js';
import { EMPTY, allCodes, checkCode, createRound, guessesLeft, scoreGuess, submitGuess } from '../js/games/mastermind/rules.js';
import { createRun } from '../js/games/mastermind/session.js';
import { breakOneCode, failureRate } from './mastermindSimulation.js';

const [R, Y, G, B] = [0, 1, 2, 3];
const SIMPLE = { pegs: 4, colours: 4, repeats: false, guesses: 12 };
const WITH_REPEATS = { pegs: 4, colours: 6, repeats: true, guesses: 10 };

test('scoring counts black and white pegs', () => {
  assert.deepEqual(scoreGuess([R, Y, G, B], [R, Y, G, B]), { black: 4, white: 0 });
  assert.deepEqual(scoreGuess([R, Y, G, B], [B, G, Y, R]), { black: 0, white: 4 });
  assert.deepEqual(scoreGuess([R, Y, G, B], [R, G, B, Y]), { black: 1, white: 3 });
});

test('scoring handles duplicate colours without double counting', () => {
  assert.deepEqual(scoreGuess([R, R, G, B], [R, R, R, G]), { black: 2, white: 1 });
  assert.deepEqual(scoreGuess([R, G, G, G], [G, G, R, R]), { black: 1, white: 2 });
  assert.deepEqual(scoreGuess([R, R, R, R], [R, Y, Y, Y]), { black: 1, white: 0 });
  assert.deepEqual(scoreGuess([R, Y, Y, Y], [Y, R, R, R]), { black: 0, white: 2 });
});

test('scoring is symmetric in the colours it finds', () => {
  const rng = createRng(5);
  for (let game = 0; game < 200; game += 1) {
    const a = randomCode(WITH_REPEATS, rng);
    const b = randomCode(WITH_REPEATS, rng);
    const forward = scoreGuess(a, b);
    assert.deepEqual(forward, scoreGuess(b, a));
    assert.ok(forward.black + forward.white <= WITH_REPEATS.pegs);
  }
});

test('codes are validated for length, colours and repeats', () => {
  assert.equal(checkCode([R, Y, G, B], SIMPLE).ok, true);
  assert.equal(checkCode([R, Y, G], SIMPLE).reason, 'incomplete');
  assert.equal(checkCode([R, Y, EMPTY, B], SIMPLE).reason, 'incomplete');
  assert.equal(checkCode([R, Y, G, 4], SIMPLE).reason, 'colour');
  assert.equal(checkCode([R, R, G, B], SIMPLE).reason, 'repeat');
  assert.equal(checkCode([R, R, G, B], { ...SIMPLE, repeats: true }).ok, true);
});

test('invalid guesses are refused and cost nothing', () => {
  const round = createRound(SIMPLE, [R, Y, G, B]);
  assert.equal(submitGuess(round, [R, R, G, B]).ok, false);
  assert.equal(submitGuess(round, [R, Y]).ok, false);
  assert.equal(round.history.length, 0);
});

test('a round is won by cracking the code and lost when the guesses run out', () => {
  const won = submitGuess(createRound(SIMPLE, [R, Y, G, B]), [R, Y, G, B]).round;
  assert.equal(won.status, 'won');

  let round = createRound({ ...SIMPLE, guesses: 2 }, [R, Y, G, B]);
  round = submitGuess(round, [B, G, Y, R]).round;
  assert.equal(round.status, 'playing');
  assert.equal(guessesLeft(round), 1);
  round = submitGuess(round, [B, G, Y, R]).round;
  assert.equal(round.status, 'lost');
  assert.equal(submitGuess(round, [R, Y, G, B]).ok, false);
});

test('the secret is committed: guesses never change it', () => {
  const secret = [R, G, G, B];
  let round = createRound(WITH_REPEATS, secret);
  const original = round.secret;
  for (const guess of [[R, R, R, R], [G, G, B, B], [B, G, G, R]]) round = submitGuess(round, guess).round;
  assert.equal(round.secret, original);
  assert.deepEqual([...round.secret], secret);
  assert.throws(() => { 'use strict'; round.secret[0] = Y; }, TypeError);
});

test('random codes are valid, seeded and cover the colours', () => {
  const rng = createRng(11);
  const seen = new Set();
  for (let game = 0; game < 300; game += 1) {
    const code = randomCode(SIMPLE, rng);
    assert.equal(checkCode(code, SIMPLE).ok, true);
    code.forEach((colour) => seen.add(colour));
  }
  assert.equal(seen.size, SIMPLE.colours);
  assert.deepEqual(randomCode(WITH_REPEATS, createRng(3)), randomCode(WITH_REPEATS, createRng(3)));
});

test('the list of all codes has the right size', () => {
  assert.equal(allCodes(SIMPLE).length, 24);
  assert.equal(allCodes({ pegs: 4, colours: 4, repeats: true }).length, 256);
  assert.equal(allCodes({ pegs: 5, colours: 7, repeats: true }).length, 16807);
});

test('level settings never get easier and use the available colours', () => {
  let previous = levelSettings(1);
  assert.deepEqual(previous, { pegs: 4, colours: 6, guesses: 12, repeats: false });
  for (let level = 2; level <= FINAL_LEVEL + 3; level += 1) {
    const current = levelSettings(level);
    assert.ok(current.pegs >= previous.pegs);
    assert.ok(current.colours >= previous.colours);
    assert.ok(current.guesses <= previous.guesses);
    assert.ok(!previous.repeats || current.repeats);
    assert.ok(current.colours <= CODE_COLOURS.length);
    previous = current;
  }
  assert.deepEqual(levelSettings(FINAL_LEVEL), { pegs: 5, colours: 7, guesses: 8, repeats: true });
});

test('the computer breaker gets stronger with the level', () => {
  let previous = breakerSkill(1);
  for (let level = 2; level <= FINAL_LEVEL + 2; level += 1) {
    const current = breakerSkill(level);
    assert.ok(current.ignoreRate <= previous.ignoreRate);
    assert.ok(current.memory >= previous.memory);
    assert.ok(current.lookahead >= previous.lookahead);
    previous = current;
  }
  assert.ok(previous.ignoreRate > 0, 'even the strongest breaker can be stumped');
  assert.equal(previous.memory, 1);
});

test('the breaker is a function of what a human could see, never the secret', () => {
  assert.equal(chooseGuess.length, 1);
  const secret = [R, Y, G, B];
  const round = submitGuess(createRound(SIMPLE, secret), [R, G, Y, B]).round;
  const visible = { settings: SIMPLE, history: round.history, skill: breakerSkill(10) };
  const first = chooseGuess({ ...visible, rng: createRng(8) });
  const secretFreeInput = JSON.parse(JSON.stringify(visible));
  assert.ok(!JSON.stringify(secretFreeInput).includes('secret'));
  assert.deepEqual(chooseGuess({ ...secretFreeInput, rng: createRng(8) }), first);
});

test('a strong breaker only guesses codes that fit every reply so far', () => {
  const skill = { ignoreRate: 0, memory: 1, lookahead: 6 };
  const secret = [G, R, R, B];
  let round = createRound(WITH_REPEATS, secret);
  const rng = createRng(21);
  while (round.status === 'playing') {
    const guess = chooseGuess({ settings: WITH_REPEATS, history: round.history, skill, rng });
    for (const { guess: earlier, feedback } of round.history) {
      assert.deepEqual(scoreGuess(guess, earlier), feedback);
    }
    round = submitGuess(round, guess).round;
  }
  assert.equal(round.status, 'won');
});

test('the weak breaker sometimes fails, the strong one cracks most codes but not all', () => {
  const weakest = failureRate({ settings: levelSettings(1), skill: breakerSkill(1), games: 300 });
  assert.ok(weakest > 0, 'a human can stump the level 1 breaker');
  assert.ok(weakest < 0.35);

  const hardest = levelSettings(FINAL_LEVEL);
  const strong = failureRate({ settings: hardest, skill: breakerSkill(FINAL_LEVEL), games: 80 });
  assert.ok(strong < 0.2, `strong breaker should crack most codes (failed ${strong})`);
  const crackingStrongly = failureRate({ settings: hardest, skill: { ignoreRate: 0.3, memory: 1, lookahead: 6 }, games: 80 });
  assert.ok(crackingStrongly > 0, 'a breaker that wastes some guesses can be stumped');
});

test('when the person makes the code, they can stump the computer at every level without it being trivial', () => {
  for (const level of [1, 3, 5, 7, FINAL_LEVEL]) {
    const settings = levelSettings(level, { personBreaks: false });
    assert.equal(settings.guesses, 6);
    const stumped = failureRate({ settings, skill: breakerSkill(level), games: 120 });
    assert.ok(stumped >= 0.1, `level ${level}: a random code stumps the computer only ${stumped}`);
    assert.ok(stumped <= 0.85, `level ${level}: the computer is too weak (stumped ${stumped})`);
  }
});

test('every level is beatable by the breaker in simulation', () => {
  for (let level = 1; level <= FINAL_LEVEL; level += 1) {
    const rate = failureRate({ settings: levelSettings(level), skill: breakerSkill(level), games: 30 });
    assert.ok(rate < 0.5, `level ${level} breaker failed ${rate}`);
  }
});

test('the breaker scores through the same rules and respects the guess limit', () => {
  const settings = levelSettings(4);
  const round = breakOneCode({ settings, skill: breakerSkill(4), seed: 99 });
  assert.ok(round.history.length <= settings.guesses);
  round.history.forEach(({ guess, feedback }) => assert.deepEqual(scoreGuess(round.secret, guess), feedback));
});

test('a run in human mode ends on the first lost level and counts cleared levels', () => {
  const run = createRun({ modeId: 'human', rng: createRng(4) });
  assert.equal(run.startLevel().ok, true);
  const secret = run.round.secret;
  assert.equal(run.guess([...secret]).ok, true);
  assert.equal(run.levelCleared, true);
  assert.deepEqual(run.advance(), { runOver: false });
  assert.equal(run.level, 2);
  assert.equal(run.cleared, 1);

  run.startLevel();
  const wrong = run.round.secret.map((colour) => (colour + 1) % run.settings.colours);
  for (let turn = 0; turn < run.settings.guesses; turn += 1) run.guess(wrong);
  assert.equal(run.finished, true);
  assert.deepEqual(run.advance(), { runOver: true });
});

test('in computer mode the person clears a level by stumping the computer', () => {
  const run = createRun({ modeId: 'computer', rng: createRng(6) });
  assert.equal(run.startLevel([R, R, G, B]).reason, 'repeat');
  assert.equal(run.startLevel([R, Y, G, B]).ok, true);
  const secret = [...run.round.secret];
  while (!run.finished) run.computerGuess();
  assert.deepEqual([...run.round.secret], secret);
  assert.equal(run.levelCleared, run.round.status === 'lost');
});

test('the entry row supports placing, cycling, moving and deleting', () => {
  const entry = createEntry(3, 4);
  entry.place(2);
  entry.place(0);
  assert.deepEqual(entry.code, [2, 0, EMPTY]);
  assert.equal(entry.cursor, 2);
  entry.select(0);
  entry.select(0);
  assert.equal(entry.code[0], 3);
  entry.select(0);
  assert.equal(entry.code[0], 0);
  entry.move(-1);
  assert.equal(entry.cursor, 0);
  entry.backspace();
  assert.equal(entry.code[0], EMPTY);
  entry.reset();
  assert.deepEqual(entry.code, [EMPTY, EMPTY, EMPTY]);
});
