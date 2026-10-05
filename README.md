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
| `js/games/<id>.js` | One module per game (currently placeholders) |
| `js/games/placeholder.js` | "Coming soon" panel used until a game is built |
| `DELEGATION_LOG.md` | Record of what Claude was asked to do and how it was verified |

## Adding a game

Each game lives in `js/games/<id>.js` and exports `mount(container, { game, mode })`
returning `{ destroy() }`. `game` is its registry entry and `mode` is the chosen entry from
`game.modes` (`mode.id` is the route segment, `mode.tone` says who plays the classic role).
See the contract at the top of `js/games.js`.
Game sessions only edit their own file, so sessions do not collide.

## Deployment

Netlify serves the repo root (`netlify.toml`) and is not connected yet. Until it is, `dev` and
`main` are kept in sync. Once it is connected, develop on `dev` and merge to `main` only when
ready to deploy, to conserve free build credits.
