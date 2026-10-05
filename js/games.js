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
      { id: 'human', tone: 'human', short: 'Fly ship', label: 'Fly the ship', blurb: 'Dodge and shoot your way through drifting rocks.' },
      { id: 'computer', tone: 'computer', short: 'Send rocks', label: 'Send the asteroids', blurb: 'The computer flies the ship. You decide which rocks come its way.' },
    ],
    load: () => import('./games/asteroids.js'),
  },
  {
    id: 'missile-command',
    name: 'Missile Command',
    tagline: 'Defend the cities from incoming warheads.',
    modes: [
      { id: 'human', tone: 'human', short: 'Defend', label: 'Defend the cities', blurb: 'Aim your counter-missiles and stop every warhead.' },
      { id: 'computer', tone: 'computer', short: 'Attack', label: 'Launch the attack', blurb: 'The computer defends. You send the warheads. Rules for this side are still to be designed.' },
    ],
    load: () => import('./games/missile-command.js'),
  },
  {
    id: 'imitation',
    name: 'Imitation',
    tagline: 'Chat, then work out who is on the other end.',
    modes: [
      { id: 'ai', tone: 'computer', short: 'Vs the AI', label: 'Play the AI', blurb: 'Your opponent is an AI running in your own browser.' },
      { id: 'human', tone: 'human', short: 'Vs a person', label: 'Play another person', blurb: 'Matched with a human in a second browser.' },
    ],
    load: () => import('./games/imitation.js'),
  },
  {
    id: 'wildcard',
    name: 'Wild Card',
    tagline: 'Game seven. Still to be chosen.',
    modes: [
      { id: 'human', tone: 'human', short: 'Play it', label: 'Play it yourself', blurb: 'The game and its flip are still to be designed.' },
      { id: 'computer', tone: 'computer', short: 'Flip it', label: 'Play the flip', blurb: 'The game and its flip are still to be designed.' },
    ],
    load: () => import('./games/wildcard.js'),
  },
];

export const findGame = (id) => GAMES.find((game) => game.id === id);

export const findMode = (game, id) => game.modes.find((mode) => mode.id === id);
