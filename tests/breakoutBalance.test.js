import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedAtLevel } from '../js/core/level.js';
import { SECONDS_TO_HARDEST } from '../js/games/breakout/config.js';
import { casualPaddle, casualWall, computerGame, idleWall, playGame } from './breakoutSimulation.js';

/**
 * Computer-versus-computer balance. Every round runs through the real rules; each side is a bot
 * that sees only what a player sees and obeys the same speed caps. Seeds are fixed, so the rates
 * are repeatable. Rounds start at a chosen level, as the level picker does.
 *
 * Human mode: the human holds the paddle (a casual bot) and wins by clearing the wall.
 * Computer mode: the human holds the wall (a casual bot) and wins by making the computer's paddle
 * drop all its balls, so the computer's own win rate is the remainder.
 */
const GAMES_PER_LEVEL = 80;
const LEVELS = [1, 5, 10];
const EASY_BAND = [0.65, 0.95];
const FAIR_BAND = [0.25, 0.75];
const WINNABLE_AT_HARDEST = 0.1;

const startSecondsAt = (level) => elapsedAtLevel(level, SECONDS_TO_HARDEST);

function winRate(playRound, level) {
  let wins = 0;
  for (let seed = 1; seed <= GAMES_PER_LEVEL; seed += 1) {
    if (playRound(seed, startSecondsAt(level))) wins += 1;
  }
  return wins / GAMES_PER_LEVEL;
}

const paddleClearsWall = (seed, startSeconds) => playGame({
  modeId: 'human', startSeconds, paddleHand: casualPaddle(seed), wallHand: idleWall,
}).status === 'won';

const wallBeatsComputer = (seed, startSeconds) => computerGame({
  seed, startSeconds, wallHand: casualWall(),
}).status === 'lost';

const ratesByLevel = (playRound) => Object.fromEntries(LEVELS.map((level) => [level, winRate(playRound, level)]));
const asPercent = (rates) => Object.entries(rates).map(([level, rate]) => `L${level} ${Math.round(rate * 100)}%`).join(', ');

function assertBetween(rate, [low, high], label) {
  assert.ok(rate >= low && rate <= high, `${label}: ${rate} is outside ${low}-${high}`);
}

test('human mode: a casual paddle wins easily at level 1 and stays winnable at level 10', (t) => {
  const rates = ratesByLevel(paddleClearsWall);
  t.diagnostic(`paddle (human role) clears the wall: ${asPercent(rates)}`);
  assertBetween(rates[1], EASY_BAND, 'level 1');
  assertBetween(rates[5], FAIR_BAND, 'level 5');
  assert.ok(rates[10] >= WINNABLE_AT_HARDEST, `level 10: ${rates[10]} is too hard`);
  assert.ok(rates[1] > rates[5] && rates[5] > rates[10], 'each level is harder than the last');
});

test('computer mode: a casual wall beats the computer easily at level 1 and can still win at level 10', (t) => {
  const rates = ratesByLevel(wallBeatsComputer);
  t.diagnostic(`wall (human role) beats the computer: ${asPercent(rates)}`);
  assertBetween(rates[1], EASY_BAND, 'level 1');
  assertBetween(rates[5], FAIR_BAND, 'level 5, wall side');
  assertBetween(1 - rates[5], FAIR_BAND, 'level 5, computer paddle side');
  assert.ok(rates[10] >= WINNABLE_AT_HARDEST, `level 10: ${rates[10]} is too hard`);
  assert.ok(rates[1] > rates[5] && rates[5] > rates[10], 'each level is harder than the last');
});
