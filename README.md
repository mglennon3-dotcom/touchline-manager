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

**Players** are rated out of 20 (10 is an average professional, 20 world class). Each line has its own
attributes: defenders show Tackling, Marking, Heading, Strength and Pace; midfielders Passing, Vision,
Technique, Tackling and Stamina; attackers Finishing, Dribbling, Pace, Heading and Composure; keepers
Shot-stopping, Long passing and Short passing. Every outfield player carries all twelve (the rest sit
under "Other attributes" on his card) because they matter when he plays out of position. Each position
weighs them differently, and the overall rating comes from them. In matches, Finishing and Composure
decide shots, Heading decides the one chance in five that's a header, and Stamina sets how fast a player tires. Two ratings are hidden and
only estimated by scouts, as a range out of 20: **potential**, and **injury proneness** (1 robust, 20 fragile;
fragile players get injured about three times as often as robust ones, and serious injuries make a player
more prone). Players only grow toward it with minutes, good form, a happy dressing room and
a coach who develops players; young players who don't play lose some of it. Ratings are exact for your own
players and your division; everyone else shows a range until scouted (2 hours of your weekly scouting time
for a first look, again for a full report).

**Style of play:** Very attacking, Attacking, Control possession, Neutral, Counter attack, Defensive or
Very defensive. Attacking styles create more chances at both ends, slightly more against than for, so they
pay when you're the stronger side or chasing a goal; deeper styles keep games against better teams close.
Possession keeps the ball (fewer chances against, less created, exposed to counters); counter-attacking
feeds on sides that commit forward and does little against a deep block. Every AI club has a usual style
from its coach, shifts it for stronger or weaker opponents, and changes it during the game: chasing a
deficit, protecting a lead, pushing late when a draw is no use. You set yours on the Tactics page, before
a match, or live; your assistant can adapt it with the score in matches you don't watch.
Styles also depend on your players. Each leans on four attributes (possession on Passing, Technique, Vision
and Composure; counter-attacking on Pace, Dribbling, Finishing and Vision; and so on), and its fit is how far
your XI's are above or below what's usual for their positions and ratings. A good fit strengthens a style's
benefits and softens its costs; a poor fit does the reverse, so a style your players can't play is worse
than Neutral. The Tactics page and the match card show each style's fit, and AI coaches without a strong
leaning pick possession or counter-attacking when their squad suits it.

**Coaches** are rated out of 20 for Attack, Defence, Recruitment and Development, and each has a preferred
formation: teams play about 2% better in their coach's own system. Twelve modern shapes are available
(4-3-3, 4-2-3-1, 4-4-2, 4-4-1-1, 4-1-4-1, 4-3-2-1, 4-1-2-1-2, 3-4-2-1, 3-4-3, 3-5-2, 5-3-2, 5-4-1), and AI
coaches favour them roughly as often as the modern game does. A better Recruitment rating narrows your scouts'
estimates. You pick an archetype (or balanced) and a preferred formation when you start, and earn points to
spend every season. You also have league knowledge out of 20 for England, each foreign country and the rest
of the world: high knowledge makes scouting there cheaper and sharper (from 15, one trip gives a full report),
low knowledge the reverse. Scouting abroad costs more hours and travel money. Knowledge grows as you scout and
can be raised with coaching points. Every AI club has its own coach, and a
sacked coach is replaced by a new one with a different style.

**Rivals:** every club's nearest neighbour is a rival, as is its nearest club in the same division, and some
clubs have a rival of similar standing too. Intensity runs from rivalry to local derby to fierce derby, by
distance. Derbies bring more cards, a stronger home crowd and bigger swings in board confidence, supporter
mood and gate money. Rival clubs charge each other more and fierce rivals won't sell to each other at all;
players are reluctant to cross the divide; and signing from or selling to a rival costs you some goodwill.
Head-to-head records are kept for every rivalry.

**Youth development** is a club rating out of 20, only loosely tied to division, so a small club can run an
excellent academy. It sets the potential of each summer's graduates, how fast under-21s improve, and how many
places you can offer prospects. It is one of six factors prospects weigh (with distance, playing time, formation
fit, squad dynamics and prestige), each prospect weighting them differently.

**Unsackable mode** (chosen when you create your manager, or on the Manager page) keeps the board's reactions but
stops it firing you. The test script uses it.

**Takeovers** are rare: one or two every few seasons across the game, more often at struggling or overstretched
clubs, and about a 1% chance a season for yours.
Investors bring cash, a commercial boost, a bigger appetite for spending and often academy money, and expect more.
Cost-cutters and leveraged buyers drain cash, cut spending tolerance and sometimes the academy, and push high earners
out; the board's expectations ease a little.

**Stadiums and supporters.** Every club has a ground, a support base rated out of 20 (some small clubs are
passionately backed) and fan engagement from 0 to 100. Grounds start at 20,000–70,000 in the Premier Division, 10,000–40,000 in
the First Division, 3,000–20,000 in the Second, and smaller below that (800–4,000 at the bottom). Engagement settles at a level set by support base and league
position, so success brings more engagement, and moves with results, derbies, ticket prices, full grounds and
owners. You set your own ticket prices: dearer seats earn more each but sell fewer and cost goodwill. When demand
outgrows the ground you can expand it; work takes from about a season (extending a stand) to four or more (a new
stadium), and is paid weekly out of cash, which squeezes the
transfer budget until it's done. AI clubs build too when they keep selling out.

**Sponsorship.** Every club has a shirt sponsor and a kit supplier, each with an annual fee and bonuses for
the title, promotion, European qualification and cup wins. A deal is priced at what the club could command when
it was signed, which grows with prestige, fan engagement, recent trophies and European football; promotion lifts
current deals and relegation cuts them. When one of your deals ends you choose between a long secure deal, a
short one at a higher rate, or a performance deal with a lower base and big bonuses.

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

**End-of-season awards:** every English division names a Player of the Season, Young Player of the
Season (21 or under), Golden Boot, Golden Glove (most clean sheets), Playmaker (most assists), Manager of
the Season (whoever most beat their pre-season prediction, with credit for a title or promotion) and a
Team of the Season. Foreign top flights name the first three. Winners get a morale boost and a line in
their honours; if you win Manager of the Season the board gains 5 and you earn an extra coaching point.
The season review shows your division's awards, and the History page browses every season and league.

**Rules modelled on the English game:** 25 registered senior players, at most 17 not homegrown, changeable only in the summer and January windows,
unlimited under-21s; homegrown means three seasons at an English club before turning 21; nine named
substitutes and five changes; yellow-card bans at 5, 10 and 15 bookings; three games for a straight red;
ties split on goal difference, goals scored, then head-to-head. Finances use a Squad Cost Ratio:
wages, amortised fees and agent fees against revenue plus player-sale profit, with a levy above 85%
and points deductions above 115%. AI clubs heading for a charge sell players before the accounts close, as real
clubs do, so charges are rare: one or two every few seasons across England.

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

When you change any game file, bump `VERSION` in `sw.js` and `APP_VERSION` in `js/data.js`. Installed copies fetch fresh files whenever
they're online and fall back to the cache offline, so updates show on the next open.
