export const EMPTY = null;

/** Black = right colour in the right place; white = right colour in the wrong place. */
export function scoreGuess(secret, guess) {
  let black = 0;
  const secretLeft = new Map();
  const guessLeft = new Map();
  secret.forEach((colour, place) => {
    if (colour === guess[place]) {
      black += 1;
      return;
    }
    secretLeft.set(colour, (secretLeft.get(colour) ?? 0) + 1);
    guessLeft.set(guess[place], (guessLeft.get(guess[place]) ?? 0) + 1);
  });
  let white = 0;
  for (const [colour, count] of guessLeft) white += Math.min(count, secretLeft.get(colour) ?? 0);
  return { black, white };
}

/** Returns { ok: true } or { ok: false, reason } where reason is 'incomplete', 'colour' or 'repeat'. */
export function checkCode(code, { pegs, colours, repeats }) {
  if (code.length !== pegs || code.some((peg) => peg === EMPTY)) return { ok: false, reason: 'incomplete' };
  if (code.some((peg) => !Number.isInteger(peg) || peg < 0 || peg >= colours)) return { ok: false, reason: 'colour' };
  if (!repeats && new Set(code).size !== code.length) return { ok: false, reason: 'repeat' };
  return { ok: true };
}

/** Every valid code for the settings, in order. At most 7^5 = 16807, so listing them is cheap. */
export function allCodes(settings) {
  const codes = [];
  const build = (prefix) => {
    if (prefix.length === settings.pegs) {
      codes.push(prefix);
      return;
    }
    for (let colour = 0; colour < settings.colours; colour += 1) {
      if (settings.repeats || !prefix.includes(colour)) build([...prefix, colour]);
    }
  };
  build([]);
  return codes;
}

export const isCracked = (feedback, settings) => feedback.black === settings.pegs;

/** The secret is frozen: nothing in a round can change it once it is committed. */
export function createRound(settings, secret) {
  return Object.freeze({ settings, secret: Object.freeze([...secret]), history: [], status: 'playing' });
}

export const guessesLeft = (round) => round.settings.guesses - round.history.length;

/** Returns { ok: true, round } with the new guess scored, or { ok: false, reason } if it is not allowed. */
export function submitGuess(round, guess) {
  if (round.status !== 'playing') return { ok: false, reason: 'finished' };
  const check = checkCode(guess, round.settings);
  if (!check.ok) return check;
  const feedback = scoreGuess(round.secret, guess);
  const history = [...round.history, { guess: [...guess], feedback }];
  const status = nextStatus(history, round.settings, feedback);
  return { ok: true, round: Object.freeze({ ...round, history, status }) };
}

function nextStatus(history, settings, feedback) {
  if (isCracked(feedback, settings)) return 'won';
  return history.length >= settings.guesses ? 'lost' : 'playing';
}
