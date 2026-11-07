# Touchline Manager

A football management game in the browser. You manage one club in a seven-division English pyramid,
compete in three European cups against clubs from seven other countries, recruit fifteen-year-olds,
and try to keep the board happy for fifty seasons. All clubs and players are fictional.

## Play it

- **Online:** open the GitHub Pages address for this repository.
- **Offline:** open it once while online, then use your browser's *Install app* or *Add to Home Screen*.
  The game's files are cached by a service worker, so it opens with no connection after that.
  Google Fonts are cached the first time they load; until then the game uses system fonts.
- **Careers:** keep as many as you like. The app opens on a list of them, newest first, to continue or delete (deleting asks first), with a button to start a new one. The **Saves** tab inside a career brings you back to the list.
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
benefits and softens its costs. A poor fit takes the benefits away and exposes you on top: poor passers
trying to keep the ball give it away in dangerous places, so possession with a side that can't pass is the
worst choice on the board. The Tactics page and the match card show each style's fit. AI coaches know their
squads: those without a strong leaning pick possession or counter-attacking when it suits, and none of them
switch, before or during a match, to a style their players plainly can't play.

The Tactics page has four tabs: Line-up (formation, pitch, pick buttons; tap a shirt to list who could play
there, best first, and tap one to put him in; the nine substitutes sit under the pitch: tap one to list
everyone outside the matchday squad and swap him in), Selection (the squad list with bench picks), Style and Training.
Picking a side: "Pick best XI" (Tactics page) asks your assistant for the strongest side, and it will move a
player out of his usual position when his attributes make him better there than the specialist, say a
tough-tackling midfielder at centre-back. AI clubs pick the same way. "Pick fresh XI" (Tactics page and the
match card) picks the best side from players at 85%+ fitness, using tired players only where nobody fresh can
fill a spot. "Pick high-potential XI" favours players 23 and under with room to grow (up to about 4 points of credit for a
teenager far below his ceiling): academy players rated Ready to start can start and those rated Ready can be
substitutes, and the bench takes young prospects first. Across 15 clubs it changed 0-3 players, costing 0-0.4
of team strength. Tick "Assistant picks a fresh XI before every match" to rotate automatically: it picks once, on
the morning of each match day, so any change you make after that stands.

**Team needs** has its own tab. It judges your best XI in your formation (ratings in position, ignoring fitness,
form and who you've actually picked; injured and academy players left out). Each role is ranked by priority: your
weakest starter there against the best at that role in your division's four strongest squads and the division average, the
cover behind them, warnings (ageing, contract ending, on loan, wants to leave, out of position), and upgrades
you can afford who would come, with Sign or Bid buttons. Above them, your best XI's finishing, creativity,
dribbling, defending, aerial ability, pace, stamina and physical strength against the division's average XI,
and the style that suits your players. The Squad page shows a summary and Transfers lists the roles to fix.

**Winning over youth prospects:** scouting reveals a prospect but doesn't win him over. Interest comes from
how your club fits his six priorities plus your relationship with him, which calls (weekly), hosting him at
your training ground and visiting his family at home (each once), and offering a place build. Speaking to his youth coaches (by phone, never
any travel) narrows the potential estimate, shows his injury history before a detailed report and what he
cares about, and nudges lads who value youth development or playing time. A home visit
counts most with lads who want to stay near home or care about squad dynamics; hosting suits the rest.
Trips abroad cost travel, shown on the button.
The first club to offer a place (while the offer stands) gets an edge, worth about a home visit: he remembers
who believed in him first. It settles about a quarter of contested races, and offering early to your top
targets won 9 of 12 in testing against 5-8 without it. The Offered tab and his profile show who offered first.
The Youth page has four tabs: Offered, Scouted, All prospects (the full class with filters) and Committed.
Offered and Scouted are your working lists: **Offered places** (everyone you've offered a place who
hasn't signed: your standing among his suitors, how many other offers he has, or which club he chose) and
**Scouted prospects** (everyone you've scouted but not offered). Offering moves a prospect from the second
to the first; those who accept move to Committed to you.

**Growth speed** is a hidden trait (1-20, average 10) that sets how quickly a player closes on his
potential: 1 develops at 55% of the normal rate, 20 at 150%. Over two seasons, 17-20-year-olds with slow growth
speed closed 31% of the gap to their potential, average 38%, quick 45%. The number never appears, but once your
coaches have watched one of your players aged 23 and under for 30 weeks they give a rough read on his card and
the Academy page (from "Slow to develop" to "Picks things up very quickly"): right 73% of the time at
Development 10 and 86% at 20, never more than one band out.

**Match ratings** follow one scale: 6 an average game, 7 good, 8 great, 9 amazing, 10 perfect, and only what a
player did in the match counts: goals, assists, chances he got (xG), key passes, shots on target, tackles and
interceptions, blocks, a keeper's saves, clean sheets and goals conceded, the result and cards. Ability counts only
through what it lets him do, so a modest striker who wins the golden boot out-rates a star who plays badly. All but
his own actions scale with his minutes, so a late substitute sits near 6; a red card costs 2. Chances missed cost
points: xG well above his goals is taken off. A 10 is a performance on the level of a hat-trick or two goals and
an assist (one goal is about 7.4, two 8.8): about 40% of 10s go to defenders and keepers, for displays like 13
clearances and a clean sheet, or 7 saves and a clean sheet. Chances a player creates count (key passes, and xA
beyond his assists), so a playmaker whose team-mates miss can still reach 9+. Measured over a season of starts: under 5 in 11%, 5-6 31%, 6-7 31%, 7-8 18%, 8+ 8%, 10 0.4%. Defending is recorded: tackles (good tacklers win more), interceptions (good markers), clearances (good in the
air; about 4 a game for a centre-back), blocks, and the defender beaten for each goal conceded (more often a weak
one). The ratings line shows each player's shots, xG, key passes, xA, tackles, interceptions, clearances, blocks,
goals he was beaten for, or saves; the Squad page's Advanced stats adds season Tackles, Interceptions, Clearances,
Blocks and Beaten columns.
**Development** follows the same rating scale for every age: a season averaging 5 or less slows a player's weekly
progress (x0.85), 6 is neutral, 7 (good) speeds it (x1.15) and 8+ (great) more (x1.25). With 60%+ of the minutes,
a good season (7+) raises his potential by 1-3 at the end of it and a great one (8+) by 2-4.

**Academy** (its own page): your youth players are kept apart from the first team. Graduates (see Graduate intake below) and
signed youth recruits join it; players 20 and under can be sent down from the first-team squad (on the
Academy page or the player's own card, which also has Promote to first team). Academy
players never need registering; anyone turning 21 moves up as the season ends, in time to register him in
preseason. Each season week the academy plays an unofficial under-18 match (unnamed trialists fill
the side when it's short), which counts as playing time: over a season academy players gained about +5 on the
internal scale against +3.4 for unused teenagers in the first-team squad. Each player shows whether he's ready
for the first team against your senior players at his position (Ready to start, Ready for the matchday squad,
Close, Not yet), with a Promote button. Academy players aren't picked for senior matches unless you tick
"Include academy players in selection" (Tactics or the Academy page); they're marked ACA in the pickers.

**Scouting assistant:** an on/off toggle on both Scouted lists (Youth and Transfers), off unless you
switch it on. When on, at the end of each week it spends the scouting hours you left unused (your own
scouting comes first) on youth prospects and transfer targets: prospects with the best potential estimates,
favouring positions your formation uses, and players at positions Team Needs flags who would improve on
your weakest starter. It only scouts in England, where scouting is free, so it never spends your money.

**Preseason:** every season, your first included, opens with five weeks of preseason. The transfer window is
open throughout (buy, sell, loan, renew, register), AI clubs do business week by week, and training brings
your squad to full fitness. Play it a week at a time, or start the season straight away. The second window
is January, weeks 19 to 22.

**Preseason friendlies:** book up to one a week from the Preseason card, home or away, against any English
club near your level (or in the top division) or a top-flight side abroad. Smaller clubs always agree; much
bigger ones may refuse to visit but will usually host you. A home friendly draws about a third of a league
crowd (more for a big-name visitor) at 60% of your ticket price, less a 30% appearance fee if the visitors
are much bigger; away at a bigger club, they pay you 15% of their gate. Sort the opponent list "Most money first" to see each club's expected take for the chosen venue, highest first. Friendlies are played live or
simulated like any match, with real fitness and injuries, but don't count: no table, appearances, goals,
cards, bans or ratings.

**Live matches** show your team on a pitch in its formation: each player's rating in his position right now
(fitness included), fitness as a percentage (green 85+, amber 70+, red below) and bookings, with the bench below. Tap a player and then a substitute to
bring him on, or two players to swap their positions; change formation from the menu above the pitch. Any of
these pauses the match until you resume.
When one of your players is injured in a match you're watching, the match pauses and asks who comes on,
listing your substitutes by their rating in his position; or play on short and bring someone on later (tap a
sub, then the empty position). A red card for either side pauses the match too, with a button to the Tactics tab (your ten, or a more
attacking style against their ten). Matches you don't watch, or skip, are left to your assistant. After a red card (or an injury with no subs left) the gap shows on the pitch as an empty position: tap a
player and then the gap (or the gap, then a player) to move him there, keeper included, or change formation
and then arrange the ten as you like. Substitutes sit directly under the pitch, above the Starting XI. Before kick-off, tap a sub (or a starter)
to list everyone outside the matchday squad and swap one in.
**Fitness** drains during a match by Stamina: a full 90 minutes costs about 41 at Stamina 5, 34 at 10, 27 at 15
and 20 at 20, so starters finish around 64-69% and substitutions matter (AI sides now make 4-7 a match between
them). Between fixtures each day wins back a share of what's been lost (Recovery 27%, Balanced 20%, Intense
15%, more with good Stamina), so fatigue can't snowball. With Balanced training an unrotated XI starts about
95% when it plays once a week and 80-88% in two-match weeks. Preseason weeks recover the same way.
The scoreboard lists each side's scorers and bookings with the minute, and goals and bookings show on
your players on the pitch too. Below the play controls, three tabs replace the long page: Commentary,
Tactics (style, formation, team and bench) and Stats (possession, shots, cards, subs and match ratings).

**Advanced stats.** Every shot in an English match has an expected-goals value: the chance of an average
finisher scoring it against an average keeper, so over a season a league's goals come to within a few
percent of its xG. A striker well above his xG is finishing better than the chances he gets; one below is
wasting them. The player who set up a shot gets a key pass and its xG as expected assists (xA). Shots of
0.25 xG or more count as big chances. In a match, the Stats tab adds xG, big chances, headed shots and
saves, and each player's line in the ratings shows his shots, xG, key passes, xA or saves. The Squad page's
Advanced stats button (off by default, remembered per career) adds season Shots, On target, xG, G−xG, xG/90 (from 450 minutes), Key passes, xA, Saves and Clean
sheets. Each English league page lists the xG and chance-creation leaders, and the table shows each
club's league xG for and against. Foreign leagues are quick-simmed without shots, so they have none.

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

**Free agents** who go three seasons without a club leave the game at the end of the third season. (The pool is
also held to 300 at each season's end, dropping the least valuable.)
**Renewing contracts.** A player happy enough to stay asks for his market wage, capped at double what he earns now
or 20% above your top earner, whichever is higher (never less than his current wage). So a youngster who has
outgrown your wage structure is still affordable to keep; his full market wage applies if a bigger club buys him. A loyal player ("Loyal to the
club" on his card) asks 10% under his market wage and at most one and a half times what he earns now; his Renew
button says "loyal".
Wages weigh potential half as much as transfer values do.
**Graduate intake.** At the end of each season your academy offers a pool of five local 16-year-olds. Their
potential is chance, shaped like the game: it's drawn from the ratings of established players (22-32), so most
land around 7-14 of 20 and stars are as rare as they are among pros, whatever the club or its academy. They appear at the top of the Academy page with their rating and
potential: keep up to three, or none, by the end of preseason week 2. Those you don't keep are released as free
agents, leaving three weeks of the window for any club to sign them. Nobody is picked for you: at the deadline
whoever is ticked joins and the rest go, so ticking none releases all five. The academy holds 15 (places used are shown on the Home screen too, with the intake while it waits): graduates and
players sent down need a free place (youth recruits who committed still join), so promote or release to make room.
AI clubs get one or two graduates and keep each unless he's well below the club's level or they have no room
(15 players aged 20 and under); the ones they release join the free agents if their potential is 9 or more.
**Youth development** is a club rating out of 20, only loosely tied to division, so a small club can run an
excellent academy. It sets how fast under-21s improve and how many
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

**Rules modelled on the English game:** 25 registered senior players, at most 17 not homegrown, changeable only in preseason and the January window,
unlimited under-21s; homegrown means three seasons at an English club before turning 21; nine named
substitutes and five changes; yellow-card bans at 5, 10 and 15 bookings; three games for a straight red;
ties split on goal difference, goals scored, then head-to-head. Finances use a Squad Cost Ratio:
wages, amortised fees and agent fees against revenue plus player-sale profit, with a levy above 85%
and points deductions above 115%. AI clubs heading for a charge sell players before the accounts close, as real
clubs do, so charges are rare: one or two every few seasons across England.

**Season projection** (top of the Finances page): the season's income and costs so far and projected to the
end, with the projected profit or loss and closing cash. Known flows are projected: broadcast and commercial
income, sponsorship, league gates at today's ticket forecast, the merit payment for your current position,
wages at today's bill, running costs, scouting, stadium works and any cost-ratio levy. Cup runs, sponsor
bonuses and future transfers count once they happen. In preseason it projects the coming season. Checked
by projecting at week 6 and playing the season out: a Premier club came to €34.4M projected against €38.9M
actual (the gap was a cup run), and a fifth-tier club to €230k against €260k.
**What you know about a player.** Your own players and everyone in your division show their exact rating.
Every other player shows bands for his rating and his potential, each always containing the true figure. What
you get depends on how well you know his country, measured against your own range of knowledge: in your
best-known country both bands are 5 wide (e.g. 11-16); in your least-known one, one of the two (rating or
potential, fixed per player) is blank and the other is 6 wide; countries in between get a width of 5 or 6 and a
blank for a share of players that grows as your knowledge falls. Scouting fills both in and narrows them: a
first look to a few points, a full report to the exact rating and a tight potential range. Sorting and the
Min rating filter use the middle of the band (a blank rating sorts last and fails the filter), and Team Needs
upgrades need even the bottom of the band to be an upgrade. Attributes and injury risk still need scouting.
Match stats (apps, goals, average rating) are public.
**AI clubs scout like you.** Every rival keeps its own country knowledge (home country best, one foreign
speciality, as yours), its own scouting reports and weekly hours from your formula: network level (2 as
standard, 3 with cash to spare, 1 over the cost-ratio line) and its manager's Recruitment. A look costs it the same
hours and travel as you (travel capped at 3% of its base income a season) and teaches it the country the same way. It sees its own division exactly and everyone
else through bands like yours (blank ratings included). It scouts every week of the season for its current
needs, and bids only for players in its division or with a full report. In preseason its pace builds through the
window instead of landing in week one, and at the end of the season it takes only free agents it has scouted,
filling other gaps with journeymen, so the free-agent pool is still full when your preseason starts.
**Contracts running out.** A player whose deal is ending won't sign again if he's unhappy (mood under 45) or
has asked to leave, at your club or any other. Yours leave as free agents when the contract ends. AI clubs
otherwise keep most of their under-32s who are good enough for the side, and the rest join the free-agent pool,
which AI clubs draw on at once to fill thin positions.
**Countries to search.** Under the search filters on the Transfers page, a toggle for each country (and the rest
of the world) switches it on or off for every search tab: All players, Free agents, Transfer listed and Loan
targets. A player counts by his club's country (a free agent by his nationality). Your choice is saved; "Select all"
and "Unselect all" switch every country on or off (handy for picking just one or two), and the Scouted tab always lists everyone. The Youth page's All prospects tab has its own set of toggles, saved separately (a prospect counts by where he lives; Brazil, Argentina, West Africa and Scandinavia are Rest of world).
**Favourites.** Tap the ☆ by a player's name on his card to star him: he joins the Favourites tab on Transfers
(separate from Scouted, and any country), where the ★ takes him off again. Prospects work the same way, with a
Favourites tab on the Youth page.
**Scouted list.** The ✕ on a row of the Transfers Scouted tab takes a player you've decided against off the list.
His report is kept, and the scouting assistant won't scout him again. "Show removed" lists them with Restore, and
scouting him again yourself puts him back. The Youth page's Scouted tab works the same way for prospects.
**Selling.** List a player from his card and choose his asking price, 80% to 200% of his value. A listed player is
advertised to every club, and each window week the clubs that could bid (they'd rate him, could pay, and he'd go)
may open the bidding: most weeks with plenty of interest at his value, less often the dearer he is. Rivals join in
a **bidding war**: each has its own top price (its budget, and what it rates him at), the price rises until one is
left, and the winner pays just over the runner-up's top bid. One decision lists every club's final bid: sell to
whichever you like (not only the highest), or reject them all. Unlisted players still draw the odd single bid. Accepting any
single bid tells the market: a club that would pay at least 5% more can step in, and the sale becomes a bidding war
decision with the agreed offer included (its club may raise); if nobody does, the sale goes through at the agreed
fee. Accepted at the asking price, about half of sales draw a counter-bid; well above it, about a third. Your own
purchases from AI clubs are never gazumped. The Offers tab lists bids received for your players (each club's
bid, when, and the outcome), with buttons on any still waiting, above the offers you've made. The Selling tab shows each player's price
and the interest: how many clubs could bid (they'd rate him, could pay, and he'd go). Listing a player who wants
to stay costs 6 morale, given back if you take him off; one who wants out (asked to leave, or feels he's outgrown
the club) doesn't mind.
**Paying a fee over time.** On the offer screen, Payment is a lump sum or spread over 2, 3 or 4 years. Spread,
the selling club wants 5% more in total for each extra year (+10% over three years), and the fee choices and its
counter-offers follow that. You pay the first instalment and the 5% agent fee on signing, then an equal instalment
at the start of each following season; the seller receives them as they're paid. What you still owe is on the
Finances page, and the coming season's instalments are in its projection and transfer budget.
**Negotiating a signing.** The offer screen shows his contract request (and what he earns now) before you
commit. Choose the fee, your wage offer and the contract length. His club has a private floor, 88-98% of the
asking price, and answers a lower bid with a counter it would accept; once the fee is agreed it stays agreed
while you settle his wage. He accepts less than his request the keener he is (a fully keen player takes 80%),
wants 10% more for a one-year deal from 31, and names his price when he says no. Three refusals from either
side end the talks until next week. Loan buttons show his wage, which you pay while he's with you.
**Transfers page** is laid out like the Youth page, in tabs with counts: Offers (players you bid for who
turned you down, with your offer, today's asking price, the answer and how keen they are now, plus a New
offer button; players you sign drop off), Scouted, Search (all players, free agents, transfer listed, loan
targets), Selling (your listed players) and Activity. The Offers tab opens with a one-line transfer budget.
Both the Transfers and Youth pages show this week's scouting hours above the tabs, on every tab.
Sorting a search sorts every player who matches, then shows the first 200, so the cheapest-first order is the
whole market's. The search filters include Interest: Keen, Open or keen, Would sign (everyone but Not interested, who turn
any offer down) or Not interested.
**Promotion and relegation money.** Broadcast money is largely shared within a division: a promoted club's base
income goes to at least 90% of its new division's lower quartile, and the yearly adjustment never drags it back
below that; its sponsorship rises at least as far. A relegated club is capped at 110% of its new division's upper
quartile. (Before, promotion scaled income by about 1.4x and closed 20% of the remaining gap a season, leaving a
promoted club on its old division's money for years.)
**Preseason accounts.** Transfers in the summer window count in the coming season's accounts (they used to go
into the season just finished), and the preseason cost ratio counts only income that carries into that season:
regular income plus profit on players sold this summer, not last season's prize money, merit payment or sales.
Before, those made the preseason ratio look far healthier than the one you'd face at kick-off.
**Transfer budget** (Finances page, summarised on Transfers): the fee you can pay for a player on your starters'
average wage over four years. It is the smaller of what your cash allows without ending the season in the
red and the room left under the 85% cost-ratio line, shown with this season's fees in, fees out and net spend. In preseason both use the division you will play in, so a promoted club is judged on its new income.

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
