# Current — build plan

Working prototype: published as an Artifact in this project (open it on your phone).
Source: `current.html`, single file, ~900 lines, no dependencies.

---

## 1. What the game is

You drag your finger from a supply terminal to a lamp. The stroke lays down copper.
Drag **slowly** and you lay a wide, low-resistance trace; **flick** and you lay a hair-thin one.
Release, the supply energises, and you watch for 2.6 seconds to see whether it holds.

The whole game is four equations, and they are the real ones:

```
R_seg = ρ · L / w                     resistance of a trace segment
I     = V / (R_trace + R_load)        series circuit, one current everywhere
q     = I² · ρ / w²                   power density — cancels L, depends only on width
dH/dt = q·K_heat − H·K_cool + k∇²H    heating, cooling, conduction into neighbouring copper
```

The third line is why the game works. Because current is common to a series path, **the
hottest point of your trace is always its thinnest point**, and halving a width quadruples
the heat there. That is one sentence of physics that a player learns in about four seconds
by watching a trace glow white and open, and it is true.

### Three failure modes, one equation

| Failure | Cause | What the player learns |
|---|---|---|
| **No light** | I < 250 mA | Trace resistance too high — go thicker or shorter |
| **Burned out** | H > threshold at some node | Power density spikes at the pinch point |
| **Filament blown** | I > 550 mA | At high supply you must *add* resistance on purpose |

The third one is the interesting one. Early stages you fight to get *enough* current.
Later, supply voltage has climbed and you have to deliberately build a long, uniformly
medium trace to limit current without creating a hot spot. That is a current-limiting
resistor, discovered by feel, and no one has to explain it.


### What v2 added to the physics

- **Series boards.** One trace runs through two lamps. Load doubles to 40 Ω, so the same current has to be pushed through twice the load — you need shorter, fatter copper. Both lamps carry an identical current, because that is what series means.
- **Parallel boards.** Two separate branches off the one supply pad, one lamp each. Branches off an ideal source are independent, so each solves on its own — but they share **one copper budget** and their currents **add at the supply**, where a fuse is waiting. You cannot make both branches fat. That is the whole puzzle, and it is real.
- **A supply fuse**, on parallel boards only. Trip it and the run ends with a different failure than a burn or a pop.
- **Terminals sink heat.** Pads and lamp joints are copper pours, so the first and last few millimetres of a trace do not burn. Physically right, and it stops unfair deaths in the first instant of a stroke.
- **Chain multiplier.** Consecutive clean clears scale scoring up to ×2.5. Using a re-solder resets it — so the retry costs you something real, which is what stops it feeling like a free undo.

### Structure (borrowed from Dicero)

- Opens straight into stage 1. No menu, no loading, no tutorial screen — two lines of hint text that disappear after the first win.
- A stage is one board and takes 10–25 seconds.
- Boards are **generated**, not authored: pad positions, keep-out zones seeded on the direct route, and a supply voltage sized to that board's geometry.
- Every 2 stages you draft 1 of 3 modifiers from a pool of 9 (silver ink, heat-sink plane, forced air, wide nib, deep reserves, rated filament, thermal mass, fine nib, overvolt).
- Variety comes from combinatorics. There is no content treadmill to feed.

### Why it is defensible

A clone shop can copy the look in two weeks. They cannot copy a heat solver that feels
right, because getting the constants right requires understanding what the numbers mean.
Per Azur Games' 2026 report, the advice for small teams is to pick a genre where the
incumbents do not have a tenfold expertise advantage. This is the one place you have the
advantage instead.

---

## 1b. What the App Store actually looks like right now

Apple's own chart pages rate-limited me, so this is the top-20 free games chart from an
aggregator, timestamped **2 September 2026**, not a hand-review of 100 apps:

1 Meowdoku · 2 Smash Fest! · 3 Block Out! Color Sort · 4 Magic Sort! · 5 Bus Traffic Fever!
· 6 Vita Mahjong · 7 Roblox · 8 Car Evolve · 9 82-0.com · 10 CubeAway 3D Puzzle
· 11 Loop Sort · 12 Block Blast! · 13 Township · 14 Mahjong Blast · 15 Whiteout Survival
· 16 Triumph Arcade · 17 Royal Match · 18 Amaze GO! · 19 Fortnite · 20 Gossip Harbor

**Eleven of the top twenty are puzzle or sort games.** That matches the Azur report's finding
that block puzzle is the one subgenre with rising installs. One of them is literally called
*Loop Sort — Satisfying Sorting Puzzle Game*. The chart is telling you that a satisfying
puzzle is the right shape; it is not telling you to make another sort game, because that is
where the tenfold-expertise studios already are.

### Retention benchmarks to design against

| Genre | D1 | D7 | D30 |
|---|---|---|---|
| Match | 32.7% | 14.0% | 7.2% |
| **Puzzle** | **31.9%** | **12.2%** | **5.4%** |
| Hyper-casual | 29.3% | 5.9% | 1.4% |

Look at D1 versus D7. Puzzle and hyper-casual start within three points of each other and
then diverge by more than double. **The gap is not the mechanic — it is whether there is
something to come back for.** That is the single most important number in this document.

### The checklist, and what v2 does about each

| Pattern (sourced) | Built |
|---|---|
| Playable tutorial, not text — worth up to +50% retention | Stage 1 is hand-built: one lamp, no keep-out zones, low supply. You learn by drawing. |
| Meta layer becomes the re-engagement driver by day 3–5 | **The Lab.** Runs bank Research Points; six permanent upgrades across 2–3 levels each. Surfaced from run 2 onward, not immediately. |
| Hook understood within 10 seconds | Opens straight into stage 1; two lines of hint that vanish after the first win. |
| ~60% quit when difficulty spikes | Adaptive pacing: clearing boards with thermal headroom raises the voltage ramp; failures lower it. Persists between runs. |
| Continues after near-misses raise LTV | **Re-solder.** A burn-out (the near-miss failure, not the sloppy ones) offers one retry. This is the natural rewarded-ad slot. |
| Session length 3–6 minutes | Runs now stretch across more stages with the gentler curve. |
| Puzzle revenue splits ~59% IAP / 41% ads | Store plan below is cosmetic-led with one ad slot, matching that shape. |

---

## 2. Verified platform constraints

**Web has no haptics on iPhone.** `navigator.vibrate` is unsupported in Safari on iOS
(every version through 26.6) and on macOS Safari. Chrome on Android supports it. So the
web build cannot buzz on an iPhone at all — sound and visuals carry the whole feel there.
This is an argument *for* going native rather than shipping a web wrapper: iOS Core Haptics
is genuinely excellent, and a trace buzzing harder as current rises is the single biggest
missing piece of this game.

**Costs, confirmed at the source:**

| Item | Cost | Note |
|---|---|---|
| Apple Developer Program | $99 / year | **Fee waivers exist for accredited educational institutions.** Ask MSU's engineering or CS department whether they hold one. |
| Google Play Console | ~$25 one-time | No Mac required |
| GitHub Actions macOS runner | **free on public repos** | $0.062/min on private repos |
| Godot 4 | free | Runs on Windows |

The Apple fee waiver is worth a single email. Apple's enrollment page states it directly.

---

## 3. Getting from your Windows PC to the App Store

You do not own a Mac. You still need macOS + Xcode to compile and sign an iOS binary.
The path that costs nothing:

1. **Build in Godot 4 on Windows.** This game is 2D canvas work — Godot handles it easily, and it exports to both iOS and Android.
2. **Push to a public GitHub repo.** GitHub Actions macOS runners are free for public repos, and they run real macOS with Xcode.
3. **CI does the Xcode build and signing.** Certificates and provisioning profiles are created on Apple's developer portal in a browser; the signing request can be generated with `openssl` on Windows.
4. **Upload to TestFlight**, test on your own phone, then submit.

Two honest caveats. First: **I have not run this pipeline end to end.** It is documented by
several people and the pieces are all verified above, but treat step 3 as the risky one and
prove it with a hello-world export before you build a whole game on the assumption. Second:
**do not ship the web build in a native wrapper.** Apple's review guideline 4.2 targets thin
web wrappers, and you would also lose Core Haptics — the thing that makes this game feel good.

**Android first is the cheaper proof.** $25, no Mac, no CI puzzle, and Chrome on Android
already supports vibration so you can test the haptic mapping before committing to iOS.

---

## 4. Monetization

Structure first, numbers later — the Azur report notes revenue inside a single subgenre
varies by orders of magnitude, so any benchmark you read is close to meaningless until you
have your own retention data.

**Sell:**

- **Ink materials** — copper, silver, nichrome, gold. Cosmetic *plus* a small honest stat difference already modelled by `ρ`. Price $1.99–$3.99.
- **Board skins** — perfboard, FR-4 green, blueprint, oscilloscope phosphor. Pure cosmetic, $0.99–$2.99.
- **Sandbox mode** — no stages, no voltage ramp, just draw. One-time $4.99. This is the mode people will record and post.
- **Rewarded ad** — the re-solder. It is already built and already gated by a limited charge, so the ad slot drops straight in where the "Spare solder" upgrade currently sits.

**Do not:**

- Energy timers. They kill short-session games — the whole promise is that you can play for 40 seconds.
- Anything that sells current or heat tolerance directly. The moment a player suspects they lost because they did not pay, the physics stops being trustworthy, and the physics is the product.

**Where growth actually comes from:** a burnout is a five-second vertical video. Build the
clip export before you build the store. That is your marketing budget.

---

## 5. Test protocol — run this before writing another line

You test things yourself, so make the prototype earn its next hour:

1. **Ten strangers, no explanation.** Hand them the phone. Time how many seconds until they work out that slow drag = thick copper. Over 15 seconds and the visual language is wrong, not the idea.
2. **Count runs to boredom.** Watch where they put the phone down and note which stage it was. That number is your real retention ceiling.
3. **Ask one question afterwards:** "what killed you the last time?" If they cannot answer, the failure feedback is not readable and nothing else matters.
4. **Record five burnouts.** Watch them back as if they were on a feed. If none of them is worth sending to a friend, the visual payoff is not there yet.

---

## 6. Tuning

All the constants sit in one `CFG` block at the top of the script. The ones that change how the game feels:

- `SPEED_MAX` — drag speed that produces the thinnest trace. Lower it and thick copper gets harder to lay.
- `K_HEAT` / `K_COOL` — their **ratio** sets steady-state temperature; their **magnitude** sets how long a marginal trace holds before opening. Currently tuned so a trace at ~1.2× the burn threshold survives the full 2.6 s. That near-miss is the best moment in the game — protect it.
- `K_DIFF` — heat conduction along the trace. Raise it and short pinches become survivable; lower it and every pinch kills.
- `I_MIN` / `I_MAX` — the width of the green band on the ammeter. Narrow it and the game becomes a precision test rather than a thermal one.
- `LIVE_MS` — how long you watch. 2.6 s tested well; below 2 s there is no tension.

**Twenty automated checks run against every change**, in a real browser: the single-lamp
solver is compared against a hand-computed ρL/w; series lamps must carry identical current
matching V/(R+2R_load); parallel branches must solve independently and their currents must
sum at the supply; all four failure modes must produce the right verdict; the re-solder must
restore play, spend its charge and reset the chain; and a purchased upgrade must persist to
storage and apply to the next run. Plus an end-to-end pass driving real pointer input
through stage 1 and a two-branch parallel board. All twenty pass with no page errors.

Two real bugs were found this way and fixed: a supply fuse set just above the filament
rating made the "filament blown" failure unreachable on single-lamp boards, and a pending
stage-advance timer could fire onto a board that had already been replaced.

---

## 7. What is not built yet

- Haptics (impossible on iOS web; belongs in the native build)
- Clip export / share
- Any store, currency, or ad integration
- A daily board with a fixed seed
- Difficulty past roughly stage 12 — untested; the modifier pool probably needs rebalancing
- Sound is synthesised at runtime with Web Audio; a native build should use recorded samples
- Three-branch and mixed series/parallel boards — the solver already supports them, only the generator does not

---

## Sources

- Top free games chart, 2 Sept 2026 — https://appshunter.io/charts/games/free
- Retention benchmarks by genre — https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies
- Hybrid-casual design and revenue split, 2026 — https://gamegrowthadvisor.com/blog/2026-04-16-hybrid-casual-game-design-strategy-2026/
- Azur Games, *Hypercasual and hybrid casual in 2026* — https://azurgames.com/blog/hypercasual-and-hybrid-casual-in-2026-full-report/
- Vibration API browser support — https://caniuse.com/mdn-api_navigator_vibrate
- Apple Developer Program enrollment and fee waivers — https://developer.apple.com/support/enrollment/
- GitHub Actions billing (macOS runner rates, public-repo policy) — https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions
- Dicero! App Store listing — https://apps.apple.com/us/app/dicero/id6740966864
