# Submitting Current to CrazyGames

Everything that could be prepared is prepared. What's left needs your name on
it — an account and a revenue-share agreement are yours to sign, not mine.

## What is ready

- `dist/current-web.zip` — the whole game, 22 KB, one file (`index.html`) at
  the root of the archive, exactly the layout portals require
- `store/LISTING.md` — title, description, controls, tags, ready to paste
- `store/01-burn.png` … `04-lab.png` — 1280×720 screenshots

## Requirements already met

| Requirement | Status |
|---|---|
| Initial download ≤ 50 MB | 22 KB |
| Total ≤ 250 MB, ≤ 1500 files | one file |
| `index.html` at archive root | yes |
| Relative paths only | yes — the only external request is their own SDK |
| Reaches gameplay in ≤ 20 s | instant, no loading screen |
| Works with AdBlock | yes — the game runs whether or not the SDK loads |
| Mouse, keyboard and touch | mouse and touch; no keyboard needed |
| No double-tap zoom on mobile | `user-select` and `touch-action` set |
| iOS audio resumed on user gesture | yes, on first touch |
| SDK integrated, gameplay start event | yes, plus stop and happytime |
| Sitelock | yes, in `ALLOWED_HOSTS` near the top of the script |
| PEGI 12 content | no violence, chat or data collection |

## The five steps that need you

1. **Make a developer account** at `developer.crazygames.com`. Use an email
   you'll keep. I can't create accounts — that's a line I don't cross.

2. **Read the revenue share terms before accepting.** CrazyGames pays 60% of
   ad revenue and 70% of in-app purchases. It's a contract; read it yourself
   rather than clicking through. Ask me anything that's unclear.

3. **Upload `dist/current-web.zip`** and paste the copy from `LISTING.md`.
   Upload `01-burn.png` as the thumbnail — a trace opening mid-burn is the
   most arresting frame the game produces.

4. **Submit for review.** Expect days to a couple of weeks. They may come back
   with change requests; that's normal, not rejection.

5. **Tell me what they say.** If they ask for changes I can make them and
   repackage in one pass.

## Worth knowing before you sign anything

Submitting to one portal does not stop you submitting to others — ask for a
**non-exclusive** arrangement. Poki, GameDistribution and itch.io can all
carry the same build. Exclusivity pays more up front and closes every other
door; don't take it for a first game.

A well-performing casual web game on a portal earns roughly $200–$2,000 a
month. That is the realistic range, not a floor. Most earn less. Treat this
as a free market test of whether the drag feels good to someone who has never
heard of Ohm's law — that answer is worth more right now than the money.
