# CLAUDE.md — The Cocktail Cabinet (Wave 1)

Project-level instructions for Claude. These add to the user's global `~/.claude/CLAUDE.md`; where they conflict, this file wins for this project.

## Assignment Overview

Build a single web page — **the cocktail cabinet** — holding seven arcade games, each playable by a human or by the computer on either side. Deploy it with Netlify at a domain the user owns, and submit that URL on Canvas.

## Project Facts

| Item | Value |
|---|---|
| Domain owned | `eliweiss.me` |
| Site URL | a subdomain of it (e.g. `games.eliweiss.me` — name TBD) serving a single page where the player selects and plays each game. Must NOT be a `netlify.app` address |
| GitHub repo | https://github.com/eliTouro/The-Cocktail-Cabinet |
| Hosting | Netlify, continuous deployment from the GitHub repo |
| Stack | Static site only: HTML, CSS, JavaScript. Nothing running on a server |

## Requirements

1. **Seven games:** Snake, Breakout, Splat, Asteroids, Missile Command, Imitation, and one game of our choice.
2. **Every game plays in both directions.** A human or the computer can take either side.
3. **Every game is fun and fair on both sides.** Each game starts easy and gets gradually harder — never trivial, never impossible — whichever side the human or the computer is playing. **The computer must actually play: no scripted wins, no skipped collisions.** The AI obeys the same rules and physics as a human.
4. **Two browsers can play each other.** Imitation connects two players in separate browsers. A match must not connect instantly; simulate matchmaking (variable delay, "searching…" states) so an AI opponent is not obvious.
5. **Static site only.** HTML, CSS and JavaScript, nothing on a server. A game engine is allowed if its output is a static site.
6. **No API keys.** Never create or use an Anthropic API key. The AI runs through Claude in the user's own browser.
7. **Own domain on Netlify with continuous deployment.** Served at a domain/subdomain the user bought — not `netlify.app`. Every push to the GitHub repo deploys automatically.
8. **Talk on Slack.** The user posts in the course channel about challenges and solutions, and replies in thread to classmates. (User-only task; Claude can help draft posts and keep a running list of challenges worth mentioning.)
9. **Delegation log.** A short record of what the user asked Claude to do, what it produced, and how it was verified. Stored and managed in the GitHub repo. See [Delegation Log](#delegation-log).

### The flip, game by game

| Game | Flipped mode |
|---|---|
| Snake | The human places the apples; the computer steers the snake. |
| Breakout | The computer plays against the human. |
| Splat | The human lays out the columns; the computer must get through them without cheating. |
| Asteroids | The computer flies the ship; the human sends the asteroids. |
| Missile Command | Design the flip ourselves. |
| Imitation | Play the AI, or another human in a second browser. |
| Our game | Design the flip ourselves. |

Design decisions for the open items (Missile Command flip, game seven and its flip) must be recorded in the delegation log when made.

## Submission (Canvas text box)

Paste all three:

1. The site's URL — the owned domain/subdomain served by Netlify. Must load for someone not signed in to anything of ours.
2. The GitHub repository URL.
3. The delegation log.

A repository or a `netlify.app` link on its own is not a submission.

## Grading

Worth 20 points, graded as a whole: a cabinet of working games that are legitimately fun to play, on both sides.

**The user must be able to explain, trace and change any part of the submission on request, whether the user or Claude wrote it.** So: keep the code small, readable and well-named; explain non-obvious decisions as we go; avoid cleverness and unneeded dependencies.

## Decisions Already Made

- **Asteroids:** use simple geometric shapes for the rocks (regular/irregular polygons — triangles, squares, hexagons, etc.), not organic blobs.
- **Styling:** modern, clean **dark-mode arcade** CSS. Design tokens as CSS custom properties; consistent spacing; neon-accent colors on near-black surfaces; readable type. Every interactive element has hover, `:focus-visible` and active states; respect `prefers-reduced-motion`. Mobile-first and responsive. (The global CLAUDE.md anti-generic rules still apply — custom palette, layered tinted shadows, no `transition-all`.)
- **Teacher's guidance on student questions:** local AI via Ollama (with CORS), an Imitation game framed as "guess whether it's a human or an AI," a different free host or upgrading Netlify, and a condensed delegation log are *all acceptable* — "all your options are reasonable. Up to you." We still must obey the **No API keys** rule, so any AI must run in the user's own browser. Pick the approach per feature and record the choice in the delegation log.

## Clean Code Principles

- **Small, single-purpose functions and modules.** One reason to change each.
- **Meaningful names** over comments; comment only the *why*, never the *what*.
- **No magic numbers** — name constants (speeds, spawn rates, difficulty steps) in one config per game.
- **DRY, but not prematurely** — share a small core (game loop, input, canvas setup, difficulty curve, collision helpers, AI-controller interface) and keep game-specific logic inside each game.
- **Separate concerns:** game state/rules (pure, testable) ↔ rendering ↔ input/AI controllers. A "player" is any controller implementing the same interface, human or AI, so the computer plays by the identical rules and collision code.
- **Fair difficulty is data-driven:** a documented difficulty curve per game (start easy → ramp gradually) applied identically whichever side the human/computer plays. AI skill should scale with the same curve, not be hard-coded to win or lose.
- **No dead code, no commented-out code, no `console.log` leftovers.**
- **Plain ES modules** (`<script type="module">`), vanilla JS, no build step unless clearly justified. Prefer zero dependencies.
- **Consistent formatting** and file layout; keep files short.
- Layout (the README's table is the source of truth; keep both in sync):
  ```
  index.html            # page shell
  css/styles.css        # dark arcade theme, design tokens at the top
  js/main.js            # entry point
  js/cabinet.js         # menu, side picker, hosts a running game
  js/router.js          # hash routing: #/<game>/<mode>
  js/games.js           # registry of the seven games + the game contract
  js/dom.js, icons.js   # tiny DOM helper, game pictograms
  js/games/<id>.js      # one module per game: mount(container, { game, mode }) -> { destroy() }
  js/core/              # shared loop, input, difficulty, collision, controller interface (added with the first real game)
  DELEGATION_LOG.md
  README.md
  ```
- Each game only edits its own `js/games/<id>.js` (plus its own helper files), so parallel sessions don't collide.

## Delegation Log

- File: `DELEGATION_LOG.md` in the repo root, committed and pushed with the work it describes.
- **Everything Claude does is marked as Claude** (nearly all the work). Each entry records:
  - **Date**
  - **Asked** — what the user asked Claude to do
  - **Produced** — what Claude produced (files/features)
  - **Actor** — `Claude` (and which model/subagent when relevant); mark any part the user did themselves as `User`
  - **Verified** — how it was verified (ran locally, played it on both sides, checked difficulty ramp, AI collision behavior, tests, screenshots, etc.)
- Update the log in the same change as the work. Keep entries short; a condensed log is acceptable per the teacher.
- Never log secrets, tokens or credentials.

## Local Development & Testing (no Netlify builds until the end)

We deploy to Netlify only when done (or roughly, for final testing) to conserve free build credits.

- Run the site **locally**. ES modules need HTTP (not `file://`), so use a static server, e.g.:
  ```bash
  npx serve .
  # or
  python -m http.server 3000
  ```
  Then test at `http://localhost:3000` (use the screenshot workflow from the global CLAUDE.md for visual checks).
- **Do not push in a way that triggers Netlify builds during development.** Until we're ready to deploy, either keep Netlify un-linked/paused ("Stop auto publishing") or work on a non-production branch and merge to `main` only for deploy. Confirm the setting with the user before the first push once the Netlify site exists.
- Imitation two-browser testing locally: open two browser windows/profiles against the local server. Because nothing runs on a server, the transport must be static-friendly (e.g. peer-to-peer WebRTC with a public signaling/STUN option, or a serverless relay) — decide and document in the log before building.
- Test each game on **both sides** (human & computer), and check the difficulty ramp from the first seconds through late game.

## GitHub Workflow

- Update the repo `https://github.com/eliTouro/The-Cocktail-Cabinet` (owner `eliTouro`, repo `The-Cocktail-Cabinet`) **through the GitHub integration connector** (GitHub MCP tools), as the user directed. If the connector is unavailable, tell the user rather than silently falling back to another method.
- **Connector notes:** the working GitHub MCP tools are the `mcp__<uuid>__*` GitHub server (`push_files`, `create_or_update_file`, `get_file_contents`, `create_branch`, …); load their schemas with ToolSearch first. The `plugin:github` server has failed with an authorization error. As of 2026-10-05 the connector could read the repo but every write (`create_branch`, `create_or_update_file`) returned `403 Resource not accessible by integration`: the GitHub app/token needs write access (Contents: read & write) to this repo before anything can be pushed. `push_files` makes one commit with many files; it overwrites the paths you send, so send complete file contents.
- **The local folder is a plain working copy, not a git clone.** Edit and test locally, then push the changed files with `push_files`. Before pushing, `get_file_contents` the remote path if the file may have changed there (e.g. `README.md`) so remote edits aren't overwritten blindly.
- **Branches:** `main` is the deploy branch (Netlify will watch it). Day-to-day work is pushed to the `dev` branch, and merged to `main` (pull request or merge via the connector) only when the user says it's time to deploy. Never push straight to `main` without the user asking.
- Repo is public; never commit secrets, tokens or personal data.
- Commit and push only relevant files after finishing a plan or an independent part of one (per global CLAUDE.md). Meaningful, descriptive commit messages.
- Keep `README.md` current when architecture, structure, features or constraints meaningfully change (per global CLAUDE.md).

## Netlify / Domain Notes (for deploy time)

- Create a subdomain of `eliweiss.me` (e.g. `games`) with a CNAME to the Netlify site; add it as a custom domain in Netlify and enable HTTPS. The final URL must be the custom subdomain, not `*.netlify.app`.
- Verify the live URL loads in a private/incognito window (not signed in to anything).
- Static site only: no server functions required by the app.

## Working Agreements

- Follow the global CLAUDE.md "Always Do First": invoke the `frontend-design` skill before writing any frontend code each session.
- Mark model choice and parallelism in plans (simpler tasks → smaller models; group independent tasks to run in parallel), per the global CLAUDE.md.
- Ask before outward-facing/irreversible actions (pushing, deploying, DNS changes, posting to Slack).
