/**
 * The game registry.
 *
 * A game is a module in ./games/<id>.js exporting:
 *   mount(container, { game, mode }) -> { destroy() }
 * `game` is its entry below; `mode` is one of that entry's `modes`. The cabinet calls
 * destroy() when the player leaves, so a game must stop its loop and remove its listeners.
 *
 * The stage is 4:3. Games draw on a 640x480 canvas from ./core/canvas.js, step with
 * ./core/loop.js. The stage carries `tone-<mode.tone>`, which colours the overlay button.
 *
 * Players: human input and the computer are interchangeable controllers. Both produce the same
 * kind of action for the same game rules, and the computer sees only what a human could see.
 * The rules module never knows who is playing, so no collision or physics is ever skipped.
 *
 * Modes: `tone` says who plays the classic role. 'human' means you do; 'computer' means the
 * computer does and you take the other side. `short` labels the chip on the game card.
 */
export const GAMES = [
  {
    id: 'snake',
    name: 'Snake',
    tagline: 'Eat, grow, and never run into yourself.',
    modes: [
      { id: 'human', tone: 'human', short: 'Steer', label: 'Steer the snake', blurb: 'Collect apples and grow longer. The tail is the only enemy.' },
      { id: 'computer', tone: 'computer', short: 'Place apples', label: 'Place the apples', blurb: 'The computer steers. Drop apples where they make it work for its dinner.' },
    ],
    load: () => import('./games/snake.js'),
  },
  {
    id: 'breakout',
    name: 'Breakout',
    tagline: 'Bounce the ball, clear the wall.',
    modes: [
      { id: 'human', tone: 'human', short: 'Play paddle', label: 'Play the paddle', blurb: 'Steer the paddle, angle the ball with its edges, and clear all 50 bricks with three lives.' },
      { id: 'computer', tone: 'computer', short: 'Slide the wall', label: 'Play against the computer', blurb: 'The computer swings the paddle. You slide the wall to throw its shots off, and win by making it drop all three lives.' },
    ],
    load: () => import('./games/breakout.js'),
  },
  {
    id: 'splat',
    name: 'Splat',
    tagline: 'Squeeze through the gaps between columns.',
    modes: [
      { id: 'human', tone: 'human', short: 'Fly through', label: 'Fly through the columns', blurb: 'Find the gap in every column and keep moving.' },
      { id: 'computer', tone: 'computer', short: 'Lay columns', label: 'Lay the columns', blurb: 'You build the course and the computer flies. Make it splat within 20 columns.' },
    ],
    load: () => import('./games/splat.js'),
  },
  {
    id: 'asteroids',
    name: 'Asteroids',
    tagline: 'Rotate, thrust, and shatter the rocks.',
    modes: [
      { id: 'human', tone: 'human', short: 'Fly ship', label: 'Fly the ship', blurb: 'Fly the ship, shoot the polygon rocks and survive three lives.' },
      { id: 'computer', tone: 'computer', short: 'Send rocks', label: 'Send the rocks', blurb: 'The computer pilots. Launch rocks from the edges with a refilling budget. Destroy its 3 lives before it survives 90 seconds.' },
    ],
    load: () => import('./games/asteroids.js'),
  },
  {
    id: 'missile-command',
    name: 'Missile Command',
    tagline: 'Defend the cities from incoming warheads.',
    modes: [
      { id: 'human', tone: 'human', short: 'Defend', label: 'Defend the cities', blurb: 'Click to fire counter-missiles from three bases and stop every warhead falling on your six cities.' },
      { id: 'computer', tone: 'computer', short: 'Send warheads', label: 'Launch the attack', blurb: 'The computer defends. Send warheads with a refilling budget and destroy all 6 cities before it survives 80 seconds.' },
    ],
    load: () => import('./games/missile-command.js'),
  },
  {
    id: 'imitation',
    name: 'Imitation',
    tagline: 'Judge or deceiver: can you tell a person from an AI?',
    modes: [
      { id: 'judge', tone: 'human', short: 'Judge', label: 'Be the judge', blurb: 'Question your friend and decide: are you talking to a person or an AI? They secretly choose whether to answer themselves or let an AI reply.' },
      { id: 'deceiver', tone: 'computer', short: 'Deceiver', label: 'Be the deceiver', blurb: 'Your friend is the judge. Answer yourself or switch on AI replies, and try to fool them.' },
    ],
    load: () => import('./games/imitation.js'),
  },
  {
    id: 'mastermind',
    name: 'Mastermind',
    tagline: 'Crack the hidden colour code, or hide one the computer cannot crack.',
    modes: [
      { id: 'human', tone: 'human', short: 'Break the code', label: 'Break the code', blurb: 'The computer hides a colour code. Use its red and white pegs to crack it before you run out of guesses.' },
      { id: 'computer', tone: 'computer', short: 'Make the code', label: 'Make the code', blurb: 'You hide a colour code and the computer tries to crack it from the pegs alone. Stump it to reach the next level.' },
    ],
    load: () => import('./games/mastermind.js'),
  },
];

export const findGame = (id) => GAMES.find((game) => game.id === id);

export const findMode = (game, id) => game.modes.find((mode) => mode.id === id);
