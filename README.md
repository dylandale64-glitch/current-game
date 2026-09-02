# Current

A phone game where you draw copper by hand. Drag from the supply terminal to the lamp:
drag slowly and you lay wide, low-resistance copper; flick and you lay a hair-thin trace.
Release, the supply energises, and you watch for 2.6 seconds to see whether it holds.

No engine, no dependencies, no build step beyond one 20-line script. Just canvas and Web Audio.

## The model

```
R_seg = rho * L / w                    resistance of a trace segment
I     = V / (R_branch + sum R_load)    each branch solves on its own
q     = I^2 * rho / w^2                power density - L cancels, only width matters
dH/dt = q*K_HEAT - H*K_COOL + k*d2H    heating, cooling, conduction along the trace
```

The third line is the game. Current is common to a series path, so **the hottest point of a
trace is always its thinnest point**, and halving a width quadruples the heat there.

Three ways to lose, all from the same equation:

| Failure | Cause | What it teaches |
|---|---|---|
| No light | I below 250 mA | Trace resistance too high - go thicker or shorter |
| Burned out | H past the threshold at some node | Power density spikes at the pinch |
| Filament blown | I above 550 mA | At high supply you must *add* resistance on purpose |
| Supply tripped | branch currents sum past the fuse | Parallel branches add at the supply |

Board types: `single` (one lamp), `series` (one trace through two lamps, one current,
double the load) and `parallel` (two branches, independent currents, one shared copper
budget, one fuse).

## Running it

On Windows, double-click **`setup.cmd`** once (installs dependencies, fetches the test
browser, runs the suite), then **`play.cmd`** any time you want to play. Needs Node.js
installed; if `setup.cmd` closes instantly, that is what is missing.

Or by hand:

```
npm install
npm run build     # wraps src/game.html into a standalone index.html
npm test          # physics + end-to-end, in a real browser
npm run shots     # screenshots into shots/
```

Then open `index.html`. To play it on your phone, serve the folder
(`npx serve .`) and open the LAN address, or push to GitHub and turn on Pages.

## Layout

```
src/game.html      the game. Artifact format: no <!doctype>/<html>/<head>/<body>,
                   because the Artifact host supplies that skeleton when published.
tools/build.js     wraps src/game.html into a standalone index.html
index.html         generated - do not edit, it is gitignored
tests/             20 checks against hand-computed values and observable state
docs/DESIGN.md     market research, monetisation plan, the route to the App Store
```

Edit `src/game.html`. Everything else is generated or checks it.

## Tuning

All constants live in the `CFG` block at the top of the script.

- `SPEED_MAX` - drag speed that produces the thinnest trace. Lower it and thick copper gets harder to lay.
- `K_HEAT` / `K_COOL` - their **ratio** sets steady-state temperature; their **magnitude** sets how long a marginal trace holds. Tuned so a trace at ~1.2x the burn threshold survives the full 2.6 s. That near-miss is the best moment in the game - protect it.
- `K_DIFF` - conduction along the trace. Raise it and short pinches survive; lower it and every pinch kills.
- `I_MIN` / `I_MAX` - the green band on the ammeter. Narrow it and the game becomes a precision test instead of a thermal one.
- `LIVE_MS` - how long you watch. Below 2 s there is no tension.

Change one, run `npm test`, then play it. The tests catch broken physics; only playing
catches bad feel.

## Publishing

`src/game.html` is what gets published as an Artifact - it is already in the right format.
`index.html` is for local play and GitHub Pages.

## Status

Working prototype. Not built yet: haptics (impossible in web on iOS - Core Haptics in the
native build), clip export, any store or ad integration, a daily seeded board, and balance
past roughly stage 12.
