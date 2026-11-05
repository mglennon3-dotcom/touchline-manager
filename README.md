# Touchline Manager

A football management game in the browser. You manage one club in a seven-division English pyramid,
compete in three European cups against clubs from seven other countries, recruit fifteen-year-olds,
and try to keep the board happy for fifty seasons. All clubs and players are fictional.

## Play it

- **Online:** open the GitHub Pages address for this repository.
- **Offline:** open it once while online, then use your browser's *Install app* or *Add to Home Screen*.
  The game's files are cached by a service worker, so it opens with no connection after that.
  Google Fonts are cached the first time they load; until then the game uses system fonts.
- **Saves** live in the browser's IndexedDB on that device. Export a save file from the History page
  to back it up or move a career to another device, and import it there.

Running locally: any static server works, for example `python3 -m http.server 8000` in this folder,
then open <http://localhost:8000>. Opening `index.html` straight from disk works in most browsers but
skips the offline cache.

## The world

| Tier | Division | Clubs | Promoted | Play-offs | Relegated |
|---|---|---|---|---|---|
| 1 | Premier Division | 20 | — | — | 3 |
| 2 | First Division | 24 | 2 | 3rd–8th: 5v8 and 6v7 one-off, then two-legged semi-finals with 3rd and 4th | 3 |
| 3 | Second Division | 24 | 2 | 3rd–6th, two-legged semi-finals | 4 |
| 4 | Third Division | 24 | 3 | 4th–7th, two-legged semi-finals | 2 |
| 5 | National Division | 24 | 1 | 2nd–7th, one-off ties | 4 (split north/south) |
| 6 | National Division North / South | 24 each | 1 each | 2nd–7th, one-off ties | 4 each, out of the game |

The structure follows the real English pyramid (levels 1–6, current rules including the 2026–27
second-tier play-off format). Clubs relegated out of tier 6 are replaced by new clubs each summer.
All play-off finals are at a neutral ground.

Spain, Germany, Italy, France, Portugal, the Netherlands and Belgium each have three divisions of 20,
with three up and three down between them. You can't manage there; their results are simulated from club
strength, and their clubs buy, sell, loan, recruit youth and play in Europe.

**Players** are rated out of 20 (10 is an average professional, 20 world class). Outfield players have
Shooting, Passing, Tackling, Strength and Pace; keepers have Shot-stopping, Long passing and Short passing.
Each position weighs them differently, and the overall rating comes from them. Potential is hidden: your
scouts give a star estimate. Players only grow toward it with minutes, good form, a happy dressing room and
a coach who develops players; young players who don't play lose some of it. Ratings are exact for your own
players and your division; everyone else shows a range until scouted (2 hours of your weekly scouting time
for a first look, again for a full report).

**Coaches** are rated out of 20 for Attack, Defence, Recruitment and Development. You pick an archetype
(or balanced) when you start and earn points to spend every season. Every AI club has its own coach, and a
sacked coach is replaced by a new one with a different style.

**Injuries** range from knocks of a week or two, through tears that take months, to rare season-ending
injuries and very rare career-ending ones. **Retirements** start from age 30: some players announce at the
start of the season that it will be their last, others surprise you at the end.

**Cups**
- *National Cup*: all seven divisions, entering in stages; one-off ties, extra time and penalties.
- *League Cup*: the top four divisions; two-legged semi-finals.
- *Champions Cup*: the top four of each of the eight leagues. Eight groups of four, no two clubs from
  one country in a group, then two-legged knockout rounds and a one-off final.
- *Continental Shield*: 16 clubs, 5th and 6th from each top division. England's first place goes to the
  National Cup winner (or the runner-up, if the winner already qualifies). Two-legged knockout rounds.
- *Continental Trophy*: the third tier, 7th and 8th from each top division, with England's first place going
  to the League Cup winner (or runner-up). Two-legged knockout rounds.

**Rules modelled on the English game:** 25 registered senior players, at most 17 not homegrown,
unlimited under-21s; homegrown means three seasons at an English club before turning 21; nine named
substitutes and five changes; yellow-card bans at 5, 10 and 15 bookings; three games for a straight red;
ties split on goal difference, goals scored, then head-to-head. Finances use a Squad Cost Ratio:
wages, amortised fees and agent fees against revenue plus player-sale profit, with a levy above 85%
and points deductions above 115%.

## Code

Plain JavaScript, no build step. `index.html` is the standalone page; `artifact.html` is the same game
without the page shell, for publishing as a Claude artifact.

| File | What it holds |
|---|---|
| `js/data.js` | Helpers, positions and formations, leagues, rules, names, the calendar |
| `js/world.js` | World generation, players, values, registration, team selection |
| `js/engine.js` | The minute-by-minute match engine |
| `js/season.js` | Calendar, leagues, cups, play-offs, the weekly cycle, the end of season |
| `js/market.js` | Transfers, loans, contracts, the cost ratio |
| `js/recruit.js` | Youth recruitment |
| `js/story.js` | Player mood, transfer requests, owners, investigations and other storylines |
| `js/ui.js` / `js/main.js` | Rendering, the play loop, saving, offline support |

`tools/long-sim.js` simulates many seasons headlessly and checks the world stays consistent.
Run it after changing the economy or development code: a 50-season run takes about two minutes.

When you change any game file, bump `VERSION` in `sw.js` so installed copies pick up the update.
