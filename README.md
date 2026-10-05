# The Cocktail Cabinet

One web page, seven arcade games, each playable by a human or by the computer on either side.
Static site: HTML, CSS and JavaScript only. No server, no API keys.

## Run locally

ES modules do not load from `file://`, so serve the folder:

```bash
python3 -m http.server 8000      # then open http://localhost:8000
# or: npx serve .
```

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `css/styles.css` | Dark arcade theme (design tokens at the top) |
| `js/main.js` | Entry point |
| `js/cabinet.js` | Shell: menu, side picker, hosts a running game |
| `js/router.js` | Hash routing (`#/snake`, `#/snake/computer`) |
| `js/games.js` | Registry of the seven games and the game contract |
| `js/dom.js` | Tiny `h()` helper for building DOM elements |
| `js/icons.js` | Geometric pictogram per game |
| `js/core/` | Shared game kit: fixed-step loop, canvas, keyboard/pointer input, difficulty ramp, seeded RNG, start/game-over overlay |
| `js/games/<id>.js` | One module per game, with helpers in `js/games/<id>/` (`rules.js` pure rules, AI/controller, `render.js`, `config.js` difficulty numbers). Mastermind is the seventh game; until built, any game without real code shows a placeholder. Imitation also has `css/imitation.css` |
| `tests/*.test.js` | Unit tests for pure logic, run with `npm test` (Node's built-in runner, no dependencies) |
| `js/games/placeholder.js` | "Coming soon" panel used until a game is built |
| `DELEGATION_LOG.md` | Record of what Claude was asked to do and how it was verified |

## Games and their flips

| Game | You play | Flipped: the computer plays the classic role, you take the other side |
| --- | --- | --- |
| Snake | Steer the snake | You place apples (reachable cells, max 3 on board, cooldown) to make the computer-steered snake crash before it reaches length 40 |
| Breakout | Paddle vs a 5x10 wall, 3 lives | You slide the wall to throw off the computer's paddle; win by making it lose 3 lives |
| Splat | Flap through columns | You lay out the columns (clamped so each is always passable); win by making the computer-flown creature splat within 20 columns |
| Asteroids | Fly the ship and shoot polygon rocks (triangle, square, hexagon) | You send rocks from the edges on a refilling budget; destroy the computer pilot's 3 lives before it survives 90 s |
| Missile Command | Defend 6 cities from 3 bases | You launch warheads on a refilling budget; destroy all 6 cities before the computer defender survives 80 s |
| Imitation | Be the judge: question a friend and call whether they are human or an AI | Be the deceiver: each round, answer yourself or let an in-browser AI (Llama-3.2-1B via WebLLM, scripted fallback) answer for you. Two browsers, direct WebRTC with a copy-paste invite link, no relay. Right call +1 judge, wrong +1 deceiver, unlimited rounds, score kept |
| Mastermind | Break the code: crack the computer's hidden colour code from red and white pegs | Make the code: hide one and the computer cracks it from the pegs alone (same scoring and guess limit, never sees your secret); stump it to level up. A run of 10+ levels with more pegs and colours and a smarter computer |

In every game (except Imitation, which is a chat between two people) the computer uses the same rules, collisions and speed limits as a human, sees only
what a human could see, and its skill ramps up over time so the human's challenge grows gradually.
Tests simulate full AI games (`npm test`).

## Adding a game

Each game lives in `js/games/<id>.js` and exports `mount(container, { game, mode })`
returning `{ destroy() }`. `game` is its registry entry and `mode` is the chosen entry from
`game.modes` (`mode.id` is the route segment, `mode.tone` says who plays the classic role).
See the contract at the top of `js/games.js`.
Game sessions only edit their own file, so sessions do not collide.

## Deployment

Live at **https://cocktail-cabinet.eliweiss.me**. Netlify deploys the repo root (`netlify.toml`, no
build step) from `main` on every push. Develop on `dev` and merge to `main` only when ready to
deploy, to conserve free build credits.

The domain `eliweiss.me` is registered at GoDaddy, which also hosts its DNS. Two records connect the
subdomain: a `TXT` record (`subdomain-owner-verification`) that proves ownership to Netlify, and a
`CNAME` (`cocktail-cabinet`) pointing at the Netlify site. Netlify issues the HTTPS certificate.
