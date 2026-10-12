# Improvement Log

Improvements made after the first submission (2026-10-05). This is separate from the
[delegation log](DELEGATION_LOG.md), which records every request. Everything here was built by Claude
(Sonnet 5.5, with Opus 5.5 for the maze-game plan and the Imitation polish) and checked with the
tests and in the browser, as noted. Nothing was checked by ear: see [Not verified](#not-verified).

## Across the whole cabinet

- **Sound in every game.** One small module (`js/core/sound.js`) makes the effects with the Web
  Audio API, so the site ships no audio files. Each game has its own `sounds.js` and plays a sound for
  every meaningful event (start, hit, refused action, level up, win, lose). A speaker button in the
  corner mutes everything, and the choice is remembered.
- **Levels you can jump to.** Every game with a difficulty ramp now has ten named levels, a
  "Start at level N of 10" control on its start and game-over screens, and an address shortcut such as
  `#/snake/human?level=8`. This is the testing aid: no need to play for two hours to see the late game.
- **A clearer screen for every game** (`js/core/hud.js`): the goal and the controls are always shown,
  the current level is shown, and anything the player waits on or spends (ammo, apples left, a
  cooldown, lives) is a labelled meter. A refused action says why, plays a "denied" sound and flashes
  the meter that is empty. The layout is compact on phones.
- **Both sides tested by computer-versus-computer runs.** Each game has a seeded simulation where an
  honest stand-in for the person (same rules, same limits, sees only what a person could see) plays
  against the computer, at levels 1, 5 and 10. The tests assert that the person's side is clearly
  winnable at level 1, still winnable at level 10, and not lopsided at the middle level. Tuned numbers
  are in each game's `config.js`.
- **A new eighth game, aMaze Me.** See below.
- **Test count went from 160 to the current full suite** (run `npm test`).

## Win rates of the person's side (simulated, per level)

| Game | Side | Level 1 | Level 5 | Level 10 |
|---|---|---|---|---|
| Snake | Steer the snake | 86% | 62% | 16% |
| Snake | Place the apples | 83% | 59% | 18% |
| Breakout | Play the paddle | 78% | 53% | 35% |
| Breakout | Slide the wall | 81% | 54% | 26% |
| Splat | Fly through | 87% | 42% | 23% |
| Splat | Lay the columns | 85% | 45% | 16% |
| Asteroids | Fly the ship | 89% | 55% | 14% |
| Asteroids | Send the rocks | 77% | 58% | 15% |
| Missile Command | Defend the cities | 90% | 63% | 20% |
| Missile Command | Launch the attack | 93% | 60% | 28% |
| Mastermind | Break the code | 91% | 65% | 19% |
| Mastermind | Make the code | 77% | 28% | 25% |

Imitation and aMaze Me are not in the table: Imitation is two real people and has no difficulty ramp,
and aMaze Me is two people on one screen.

## Game by game

### Snake
- Sound for start, eating, placing and refusing apples, danger warnings, crash, win and lose.
- Steering now has a goal (eat 30 apples) and the computer-steers mode shows the snake's length against 24.
- Meters for apples left to place and the drop cooldown; the old cooldown bar drawn on the canvas is gone.
- A short get-ready pause, a visible wall outline, and a board shrunk so no apple hides behind the HUD.
- Fixed: keys and clicks during the game-over screen leaked into the next round.
- The snake's pathfinding was rewritten with typed arrays, about twice as fast.

### Breakout
- Sound for launch, paddle, wall and brick hits (brick pitch rises by row), ball lost, wall pushes and results.
- A lives meter, bricks left, hints when the ball is lost, and a hint plus sound when the wall is pushed past the end of its rail.
- In slide-the-wall mode the pointer now spreads across the whole screen onto the short rail, and a ring shows where the wall is heading.
- Layout reworked so the HUD fits on a phone.

### Splat
- Sound for flap, passing a column, laying a column, refused columns, splat, win and lose.
- Fly-through mode now has a goal (pass 30 columns); it used to be endless.
- Meters for the flap cooldown, columns left and the next column; a hint explains when a gap was limited.
- Fixed: the creature fell the instant Start was clicked, and the result panel hid the splat before you could see it.

### Asteroids
- Sound for thrust, shooting, rocks splitting, rocks launched, refused launches, ship hits, win and lose.
- Fly mode now has a win condition (survive 90 seconds with three lives).
- Meters for lives, time left, shield and gun, and for the rock budget with its refill rate.
- Rock-size buttons down the left edge show each rock's shape and cost, and dim when too expensive; on-screen buttons let phones fly the ship.
- Fixed: a win could overwrite a loss that happened in the same step.

### Missile Command
- Sound for shots, an empty base, detonations, warheads destroyed, cities lost, warheads launched, refusals, waves, win and lose.
- Defending now has a win condition (keep a city standing for 80 seconds); it used to be endless.
- Labelled meters for each base's ammo, cities left, time left, reload, the warhead budget with its refill rate, and warheads in the air. The cursor shows blast reach and, when attacking, where a warhead will land.
- Fixed: the computer's and the player's launches shared one cooldown, so the computer's shot could refuse the player's warhead.
- Fixed: the goal and controls text covered the cities, so the ground line moved up.

### Imitation
- Sound for matchmaking, connection, messages sent and received, the judge's call and results. The deceiver's choice makes one sound either way, and a test checks the judge hears the same thing both ways.
- A strip always shows your role and the score. Connect steps are numbered, with a Start over button and plain-language connection errors.
- A dropped connection now ends the match instead of hanging, and closing the tab tells the other player.
- The AI types at a human speed (about 55 to 110 words a minute instead of up to 170) and no longer shows "typing…" the instant a message arrives.
- New tests run two real sessions against each other.
- Fixed: a failed reply code could be retried into a raw WebRTC error.

### Mastermind
- Sound for picking colours, locking in a guess, one blip per red or white peg, refusals, and results.
- Start at any level from the start screen or `?level=N`.
- A goal line and a legend (red = right colour and place, white = right colour, wrong place) are always on screen.
- Balance retuned: fewer guesses early (10 instead of 12), and the computer gets 7 guesses early and 6 late when you make the code.

### aMaze Me (new, game eight)
- Two people on one screen: one builds a maze in 75 seconds, hands over, and the other runs it through fog in 90 seconds; then they swap. The maze that holds its runner longest wins.
- The editor refuses any edit that would seal the exit or trap the runner, so every maze is fair.
- Walls, one-way arrows and portals; two flares light a wide area. Mouse, touch, keyboard and an on-screen D-pad.
- Fast mouse drags fill in every cell they cross, so walls have no gaps.

## Not verified

- **Sound was never heard.** Checks confirmed the sound code runs without errors and fires on the right events, but nobody has listened to it.
- Real-device touch was tested only with emulation.
- The balance numbers come from stand-in players, not from real people.
