"use strict";
/* Transfers, contracts and the Squad Cost Ratio. */
function squadRank(p, c) { return c.squad.map(P).filter(x => x.id !== p.id && x.ovr > p.ovr).length; }
function askingPrice(p, buyer) {
  if (p.club < 0) return 0;
  const c = C(p.club);
  buyer = buyer || (S.club != null ? me() : null);
  let v = value(p) * (squadRank(p, c) < 3 ? 1.4 : squadRank(p, c) < 11 ? 1.15 : 1);
  if (p.req || p.listed) v *= .8;
  if (p.joined === S.year && !p.req && !p.listed) v *= 1.3;   // clubs rarely sell someone they just signed
  // Your listed players go at the price you set (p.listPct of his value; 5.55).
  if (p.listed && p.listPct && isUser(c)) v = value(p) * p.listPct;
  if (buyer) v *= 1 + .25 * rivalry(c.id, buyer.id);  // nobody sells cheaply to a rival
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
  return Math.round(v / mag) * mag;
}
/* Would this player move to club b? 0 (never) – 1 (desperate). Not just money: stature, minutes, Europe, mood. */
function willingness(p, b) {
  const cur = p.club >= 0 ? C(p.club) : null;
  let w = .5;
  if (cur) w += (b.rep - cur.rep) / 50; else w += .25;
  const rivals = b.squad.map(P).filter(x => x.pos === p.pos && x.ovr > p.ovr).length, slots = Math.max(1, roleSlots(b.formation, p.pos));
  w += rivals < slots ? .18 : rivals < slots * 2 ? 0 : -.22;
  if (roleSlots(b.formation, p.pos) === 0 && p.pos !== "GK") w -= .15;
  if (S.cont.CC && S.cont.CC.groups.flat().includes(b.id)) w += .08;
  w -= Math.max(0, p.ovr - clubLevel(b) - 5) * .05;  // good players won't drop far below their level
  if (cur && (p.req || p.mood < 35)) w += .25;
  if (cur && p.loy > .75 && !p.req) w -= .15;
  if (cur && !p.req) w -= .12 * rivalry(cur.id, b.id);  // crossing the divide is a big step for a player
  return clamp(w, 0, 1);
}
const willingLabel = w => w >= .7 ? ["Keen", "good"] : w >= .45 ? ["Open", "ok"] : w >= .3 ? ["Reluctant", "warn"] : ["Not interested", "bad"];
function contractDemand(p, b, w) { return Math.round(wageDemand(p, b.rep) * (1.2 - w * .3) / 1000) * 1000; }

function scr(c, extraCost = 0, extraRev = 0) {
  // Season-to-date ratio, projected to a full year where the season is still running.
  const f = c.fin; if (!f) return 0;
  const cost = squadCost(c) + extraCost;
  return cost / Math.max(1, annualIncome(c) + oneOffs(c) + extraRev);
}
/* One-off income the ratio counts on top of a year's regular income. In preseason it's the coming season's: profit
   on players sold this summer (c.pre), not last season's prize money, merit payment and sales, which vanished at
   kick-off and made the ratio leap (71% in preseason to 150% in week 1 for one club). */
function oneOffs(c) {
  if (S.phase === "summer") return Math.max(0, (c.pre || {}).sales || 0);
  const f = c.fin || {}; return (f.prize || 0) + (f.merit || 0) + (f.scheme || 0) + Math.max(0, f.sales || 0);
}
/* Where a transfer is booked: in preseason the coming season's accounts (c.pre, merged in at kick-off by
   startSeason), otherwise this season's. Before 5.58 summer business went into the season just finished. */
const acct = c => S.phase === "summer" ? (c.pre ||= { sales: 0, sold: 0, bought: 0, agent: 0 }) : c.fin;
/* plan: instalments for the fee (1 = lump sum). The first is paid now with the 5% agent fee on the whole fee; the
   rest at the start of each following season (payDues), and the seller receives them as they're paid. */
function transfer(p, to, fee, wage, yrs, plan = 1) {
  const from = p.club >= 0 ? C(p.club) : null, now = plan > 1 ? Math.round(fee / plan) : fee;
  if (from) {
    from.squad = from.squad.filter(id => id !== p.id);
    const book = p.am ? p.am.per * p.am.left : 0;
    from.cash += now; acct(from).sales += fee - book; acct(from).sold += now;
    if (isUser(from)) S.lineup = S.lineup.map(id => id === p.id ? null : id);
  } else S.fa = S.fa.filter(id => id !== p.id);
  to.cash -= now + fee * .05; acct(to).bought += now; acct(to).agent += fee * .05;
  if (plan > 1) (S.dues ||= []).push({ pid: p.id, name: p.name, payer: to.id, payee: from ? from.id : -1, per: Math.round((fee - now) / (plan - 1)), left: plan - 1, fee, plan, y: S.year });
  to.squad.push(p.id);
  p.club = to.id; p.yrs = yrs; p.wage = wage;
 p.am = fee > 0 ? { per: Math.round(fee / yrs), left: yrs } : null;
  p.req = false; p.listed = false; p.promise = null; p.mood = 72; p.joined = S.year; p.acad = false;
  // A fresh start: playing time begins at what he expects at the new club. A flat .5 (before 5.54.1) read as
  // "wants more playing time" on day one for anyone signed to start, before he'd had a game.
  p.pt = expectedShare(p, to);
  refreshRegistration(to); if (from) refreshRegistration(from);
  const big = fee >= 15e6 * MONEY || isUser(to) || (from && isUser(from));
  S.tlog.unshift({ y: S.year, w: whenLabel(), pid: p.id, name: p.name, from: from ? from.id : -1, to: to.id, fee });
  if (S.tlog.length > 300) S.tlog.length = 300;
  if (big) news(`${p.name} (${p.pos}, rated ${Math.round(r20(p.ovr))}) ${from ? `moves from ${from.name}` : "signs as a free agent"} to ${to.name}${fee ? ` for ${money(fee)}` : ""}.`, isUser(to) || (from && isUser(from)), "transfer");
}

/* AI clubs buy where their squad is thin for the shape they play. */
function findNeed(c, minGap = 5) {
  const lvl = clubLevel(c), ps = c.squad.map(P);
  let worst = null, gap = 0;
  for (const role of new Set(slotsOf(c.formation))) {
    const n = roleSlots(c.formation, role), have = ps.filter(p => FAM[p.pos][role] >= .9 && p.age >= 18).sort((a, b) => b.ovr - a.ovr);
    const starterGap = have.length < n ? 20 : lvl - have[n - 1].ovr;
    const depthGap = have.length < n * 2 ? 6 : 0;
    const g = Math.max(starterGap, 0) + depthGap;
    if (g > gap) { gap = g; worst = role; }
  }
  return gap >= minGap ? worst : null;
}
/* How many AI clubs might bid for one of your players: they'd rate him (what they can see of him is in their range),
   could pay the price (within 60% of their cash) and he'd go (willingness .3+). For the Selling tab. */
function listInterest(p) {
  let n = 0;
  for (const b of activeClubs()) {
    if (isUser(b) || b.tier > 6) continue;
    const lvl = clubLevel(b), est = aiRating(p, b);
    if (est == null || est < lvl - 1 || est > lvl + 8 || askingPrice(p, b) > (b.cash + (b.owner === "reckless" ? b.revBase * .3 : 0)) * .6 || willingness(p, b) < .3) continue;
    n++;
  }
  return n;
}
const interestWord = n => n >= 25 ? ["High", "good"] : n >= 8 ? ["Moderate", ""] : n ? ["Low", "warn"] : ["None", "bad"];
/* A week of AI recruitment. Every AI club scouts every week with its own hours (aiScoutSetup, aiScout), on the
   same terms as you; intensity is the chance it bids this week, 0 outside the windows (scouting only). It looks
   at 270 random players plus those it has reports on, ranks them on what it can see (aiRating), then works down
   the top five: a player it knows well enough (its division, or a full report) and still rates is bid
   for; one it doesn't know yet is scouted if the hours allow. One bid a week at most.
   Before 5.46 clubs saw true ratings and needed no scouting; judged on bands alone, 73% of their signings came
   in below their level, so they bid only on players they have looked at. */
function aiTransferDay(intensity) {
  const all = Object.values(S.players).filter(p => p.age >= 18 && !p.loan && !p.intake);
  // Listing a player (or his transfer request) tells every club he's available: they all look at him, on top of
  // their random looks. Before 5.56 only a club whose sample happened to include him saw him, and four players listed
  // through a whole preseason drew no bids at all.
  const onMarket = all.filter(p => p.listed || p.req);
  for (const c of activeClubs()) {
    if (isUser(c)) continue;
    aiScoutSetup(c);
    const ratio = scr(c), rich = c.cash > c.revBase * .6, window = intensity > 0;
    // Clubs over the cost line try to shift their biggest earner instead of buying.
    if (window && ratio > 1.05 && c.owner !== "reckless" && R() < .5) { const top = c.squad.map(P).filter(p => !p.listed).sort((a, b) => b.wage - a.wage)[0]; if (top) top.listed = true; }
    if (ratio > (c.owner === "reckless" ? 1.18 : .97)) continue;
    const role = findNeed(c, rich ? 1 : 5); if (!role) continue;
    const lvl = clubLevel(c), budget = c.cash + (c.owner === "reckless" ? c.revBase * .3 : 0);
    const pool = all.length ? Array.from({ length: 270 }, () => all[Math.floor(R() * all.length)]) : [];
    for (const id of Object.keys(c.sc)) { const p = S.players[id]; if (p && !p.loan) pool.push(p); }
    pool.push(...onMarket);
    const seen = new Set(), cands = [];
    for (const p of pool) {
      if (!p || seen.has(p.id) || p.club === c.id || p.age < 18 || FAM[p.pos][role] < .9 || p.age > 31 || hasNamesake(c, p.name)) continue;
      seen.add(p.id);
      const est = aiRating(p, c);  // what this club can see of him, not his true rating
      // Development signings (worlds with the wider spread, 5.70): a club also looks at players of 21 and under a
      // little below its level, and bids only once a full report shows the potential to reach it (below). Without
      // them, graduates far better than their league (potential is drawn from the whole game) stayed and the
      // bottom divisions drifted back up within five seasons: the sixth tier from 6.2 to 7.4.
      const dev = S.spread2 && p.age <= 21;
      if (est == null || est < lvl - (dev ? 4 : 1) || est > lvl + 8) continue;
      if (p.club >= 0 && C(p.club).rep > c.rep + 8 && !p.req) continue;
      const fee = askingPrice(p, c); if (fee > budget * .6) continue;
      cands.push([est + (dev && est < lvl - 1 ? 3 : 0) - fee / (4e6 * MONEY) + (p.req || p.listed ? 3 : 0) + (p.club < 0 ? 2 : 0) + (30 - p.age) * .1, p]);
    }
    cands.sort((a, b) => b[0] - a[0]);
    const bid = window && R() <= intensity * (rich ? 1.5 : 1);
    for (const [, p] of cands.slice(0, 8)) {
      // A full report first (a first look still left 29% of signings below the club's level in a test season).
      const known = (p.club >= 0 && C(p.club).lg === c.lg) || (c.sc[p.id] || 0) >= 2;
      if (!known) { aiScout(c, p); continue; }  // no hours left: it waits for next week's
      if (!bid) continue;
      if (p.ovr < lvl - 3 && p.pot < lvl + 3) continue;  // a youngster below the level is only worth it with the potential to pass it
      const fee = askingPrice(p, c), w = willingness(p, c);
      if (w < .3) continue;
      // A listed player draws a bid every time a club settles on him at up to his value; dearer, fewer clubs follow
      // through (half as often at 150%, a fifth at 180%+). Unlisted, one time in four.
      if (p.club === S.club) { if (p.req || (p.listed ? R() < clamp(2 - (p.listPct || 1), .2, 1) : R() < .25)) (p.listed ? startAuction : offerToUser)(p, c, Math.round(fee * rf(.85, 1.05) / 1e5) * 1e5); break; }
      if (p.club >= 0) { const seller = C(p.club); if (seller.squad.filter(id => FAM[P(id).pos][p.pos] >= .9).length <= 2 || rivalry(seller.id, c.id) >= 2) continue; }
      transfer(p, c, fee, contractDemand(p, c, w), ri(2, 5)); delete c.sc[p.id];
      if (regInfo(c).seniors > RULES.aiSeniorCap) trimSquad(c, false);
      break;
    }
  }
  listedMarket(intensity);
  if (S.spread2 && intensity > 0) sellUp(intensity);
}
/* Talent moves up the pyramid (worlds with the wider spread, 5.70). A player at an AI club more than two points (out
   of 20) above its level, 27 or under, draws a club from a higher division at about his level that can pay and that
   he'll join. Graduates' potential is drawn from the whole game whatever the club, and with nothing taking the best
   of them up, the bottom divisions converged back to the old pyramid within five seasons (fifth tier 7 to 9.4, sixth
   5 to 7.5). Your own players are left to the offers you accept or refuse. */
function sellUp(intensity) {
  const buyers = activeClubs().filter(b => !isUser(b) && b.tier <= 6).map(b => [b, clubLevel(b)]);
  for (const c of activeClubs()) {
    if (isUser(c) || c.tier === 1) continue;
    const lvl = clubLevel(c);
    for (const p of c.squad.map(P)) {
      if (!p || p.loan || p.age > 27 || p.ovr <= lvl + 6 || R() > .12 * intensity) continue;
      const fits = buyers.filter(([b, bl]) => b.tier < c.tier && b.id !== c.id && Math.abs(bl - p.ovr) <= 4 && regInfo(b).seniors < RULES.aiSeniorCap && !hasNamesake(b, p.name));
      for (let k = 0; k < 4 && fits.length; k++) {
        const [b] = fits.splice(Math.floor(R() * fits.length), 1)[0], fee = askingPrice(p, b), w = willingness(p, b);
        if (w < .3 || fee > bidBudget(b)) continue;
        transfer(p, b, fee, contractDemand(p, b, w), ri(3, 5)); delete (b.sc || {})[p.id];
        if (isUser(c) || isUser(b) || c.lg === me().lg) news(`${b.name} sign ${p.name} from ${c.name} for ${money(fee)}.`, false, "transfer");
        break;
      }
    }
  }
}
/* A bidding war for one of your listed players. The club that settled on him opens; other clubs that could bid
   (keenOn) join, about one or two on average, up to four bidders in all. Each has a private top price: what it
   rates him at (85-140% of the asking price it sees) and no more than 60% of what it can spend. The price rises
   until one is left, who pays 5% over the runner-up's top bid (never more than its own). One decision lists every
   club's final bid; you take whichever you like, or none. With only the opener it's an ordinary bid. */
const bidBudget = b => (b.cash + (b.owner === "reckless" ? b.revBase * .3 : 0)) * .6;
/* Would club b bid for p? It rates him (what it can see is in its range), can pay the price and he'd go. */
function keenOn(p, b) {
  if (isUser(b) || b.tier > 6 || b.gone) return false;
  const lvl = clubLevel(b), est = aiRating(p, b);
  return est != null && est >= lvl - 1 && est <= lvl + 8 && askingPrice(p, b) <= bidBudget(b) && willingness(p, b) >= .3;
}
/* Each week of a window, your listed players are advertised: every keen club has a 3% chance to open the bidding
   (so about 70% a week with 40 keen clubs), scaled down for a dear price as in aiTransferDay. */
function listedMarket(intensity) {
  if (S.club == null || !intensity) return;
  for (const p of me().squad.map(P).filter(p => p.listed && !p.loan)) {
    const keen = activeClubs().filter(b => keenOn(p, b)); if (!keen.length) continue;
    const chance = (1 - Math.pow(.97, keen.length)) * clamp(2 - (p.listPct || 1), .2, 1) * clamp(intensity / .6, .4, 1.5);
    if (R() < chance) { const c = pick(keen); startAuction(p, c, Math.round(askingPrice(p, c) * rf(.85, 1.05) / 1e4) * 1e4); }
  }
}
function startAuction(p, opener, openFee) {
  if (S.inbox.some(m => !m.done && (m.type === "bid" || m.type === "auction") && m.pid === p.id)) return;
  const pool = activeClubs().filter(b => b.id !== opener.id && keenOn(p, b));
  const join = clamp(1.5 / Math.max(1, pool.length), .05, .5);  // about one or two rivals on average, however many could
  const rivals = shuffle(pool).filter(() => R() < join).slice(0, 3);
  if (!rivals.length) return offerToUser(p, opener, openFee);
  auctionDecision(p, runAuction(p, opener, openFee, rivals), `Bidding war for ${p.name}`, "went head to head for");
}
/* Each bidder's private top price: what it rates him at (85-140% of the asking price it sees), within what it can
   spend; the opener never below its own bid. The price rises until one is left, who pays 5% over the runner-up's
   top (never more than its own); the others' final bids are their tops. Returns the bids, best first. */
function runAuction(p, opener, openFee, rivals) {
  const top = b => Math.max(askingPrice(p, b) * .85, Math.min(bidBudget(b), askingPrice(p, b) * rf(.85, 1.4)));
  // rivals: clubs, or { c, max } when their top price was already drawn (acceptedOffer)
  const bids = [{ c: opener, max: Math.max(openFee, top(opener)) }, ...rivals.map(r => r.c ? r : { c: r, max: top(r) })].sort((a, b) => b.max - a.max);
  bids[0].fee = bids.length > 1 ? Math.min(bids[0].max, bids[1].max * 1.05) : openFee;
  for (const b of bids.slice(1)) b.fee = b.max;
  for (const b of bids) b.fee = roundFee(b.fee);
  return bids.sort((a, b) => b.fee - a.fee);
}
function auctionDecision(p, bids, title, verb, lead = "") {
  const r20s = Math.round(r20(p.ovr)), ambUp = p.amb > .6 && bids.some(b => b.c.rep > me().rep);
  addDecision({ type: "auction", pid: p.id, bids: bids.map(b => ({ from: b.c.id, fee: b.fee })),
    title: `${title}: ${bids.length} clubs, best ${money(bids[0].fee)}`,
    body: `${lead}${bids.length} clubs ${verb} ${p.name} (${p.pos}, ${p.age}, rated ${r20s}). Final bids: ${bids.map(b => `${b.c.name} (${leagueName(leagueKey(b.c))}) ${money(b.fee)}`).join("; ")}. Your asking price ${money(askingPrice(p))}; his value ${money(value(p))}.${ambUp ? " He is ambitious and would like a move to a bigger club." : ""}`,
    opts: [...bids.map(b => [`acc:${b.c.id}`, `Sell to ${b.c.short || b.c.name} · ${money(b.fee)}`]), ["reject", "Reject all"]] });
}
/* You accepted a single bid: the market hears an offer has been agreed, and any club that wants him and would pay
   more can step in (each keen club rates him privately, as in a bidding war; only those whose top beats the agreed
   fee bid). If someone does, the bidding is reopened as a decision with the agreed offer included (its club may
   raise); if nobody does, the sale goes through at the agreed fee. Your own purchases never get this. */
function acceptedOffer(p, buyer, fee) {
  const pool = activeClubs().filter(b => b.id !== buyer.id && keenOn(p, b));
  // About one club on average takes a look, and steps in only if it would pay 5% more: rivals came in on 23 of 30
  // accepted offers when one and a half looked and 2% more was enough.
  const join = clamp(1 / Math.max(1, pool.length), .05, .5);
  const top = b => Math.min(bidBudget(b), askingPrice(p, b) * rf(.85, 1.4));
  const rivals = shuffle(pool).filter(() => R() < join).map(c => ({ c, max: top(c) })).filter(r => r.max > fee * 1.05).slice(0, 3);
  if (!rivals.length) return null;
  auctionDecision(p, runAuction(p, buyer, fee, rivals), `Counter-bids for ${p.name}`, "are now in for", `You agreed ${money(fee)} with ${buyer.name}, and word got out. `);
  return `Word got out that you'd agreed a fee for ${p.name}, and ${rivals.length === 1 ? "another club wants" : `${rivals.length} more clubs want`} him: see the new decision.`;
}
function offerToUser(p, from, fee) {
  if (S.inbox.some(m => !m.done && (m.type === "bid" || m.type === "auction") && m.pid === p.id)) return;
  addDecision({ type: "bid", pid: p.id, from: from.id, fee, title: `${from.name} bid ${money(fee)} for ${p.name}`,
    body: `${from.name} (${leagueName(leagueKey(from))}) have offered ${money(fee)} for ${p.name}, ${p.age}, ${p.pos} rated ${Math.round(r20(p.ovr))}. His market value is ${money(value(p))}.${p.req ? " He has asked to leave." : ""}${from.rep > me().rep && p.amb > .6 ? " He is ambitious and would like the move." : ""}`,
    opts: [["accept", "Accept the bid"], ["reject", "Reject"]] });
}

/* User-facing transfer actions */
function canBuy(p) {
  if (!windowOpen()) return "The transfer window is closed. It opens in preseason and in January (weeks 19–22).";
  if (p.club === S.club) return "He is already your player.";
  if (p.loan) return `He is on loan at ${C(p.club).name} from ${C(p.loan.from).name}.`;
  if (S.tried && S.tried[p.id] === S.year + ":" + S.week + ":" + S.phase + S.summerDay) return "His club has already turned you down this week.";
  return null;
}
/* Every offer you make that gets an answer is kept for the Offers tab: the fee, the asking price then, and the
   outcome (club rejected the fee, player refused, or signed). Refusals before an answer (no cash, window shut)
   aren't offers. */
function logBid(p, fee, yrs, res, msg) { (S.bids ||= {})[p.id] = { y: S.year, w: S.phase === "season" ? S.week : -1, fee, ask: p.club >= 0 ? askingPrice(p) : 0, yrs, res, msg, club: p.club }; }
/* Negotiating a signing: the fee with his club, then personal terms with him. st carries the state of the
   talks (UI.bid): an agreed fee stays agreed while you work on his wage, and each side's refusals are counted.
   His club has a private floor, between 88% and 98% of the asking price (fixed for the season), and meets
   you half way with a counter it would accept. He has a minimum wage too: the keener he is the less he needs
   (a fully keen player takes 80% of his demand), and players 31 and over want 10% more for a one-year deal.
   Three refusals from either side and talks are off until next week. */
const clubFloor = p => askingPrice(p) * (.88 + .1 * seedOf(p.id + S.year * 7, 3));
const wageFloor = (p, demand, w, yrs) => demand * (1 - .2 * w) * (p.age >= 31 && yrs === 1 ? 1.1 : 1);
const roundFee = v => { const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, v))) - 1)); return Math.ceil(v / mag) * mag; };
/* Deferred fees: the selling club wants 5% more in total for each extra year it waits for its money. */
const DEFER_MAX = 4, deferMult = n => 1 + .05 * (Math.max(1, n) - 1);
/* What the club still owes on deferred fees: per year, in total, and the instalments. */
function duesOf(c) { const d = (S.dues || []).filter(x => x.payer === c.id); return { list: d, next: sum(d, x => x.per), total: sum(d, x => x.per * x.left) }; }
/* At the start of each season every club pays the next instalment on each deferred fee it owes. */
function payDues() {
  for (const d of S.dues || []) {
    const payer = C(d.payer), payee = d.payee >= 0 ? C(d.payee) : null;
    payer.cash -= d.per; payer.fin.bought += d.per;
    if (payee && !payee.gone) { payee.cash += d.per; payee.fin.sold += d.per; }
    d.left--;
    if (isUser(payer)) news(`Deferred fee for ${d.name}: ${money(d.per)} paid${d.left ? `, ${d.left} instalment${d.left > 1 ? "s" : ""} left` : ", the last instalment"}.`, false, "finance");
  }
  S.dues = (S.dues || []).filter(d => d.left > 0);
}
function userBid(p, fee, yrs, wage, st) {
  const r = userBidInner(p, fee, yrs, wage, st || {});
  if (r.res) logBid(p, fee, yrs, r.res, r.msg);
  return r;
}
function userBidInner(p, fee, yrs, wage, st) {
  const err = canBuy(p); if (err) return { ok: false, msg: err };
  const c = me(), w = willingness(p, c), lock = () => { (S.tried ||= {})[p.id] = S.year + ":" + S.week + ":" + S.phase + S.summerDay; };
  const plan = p.club >= 0 && fee > 0 ? clamp(st.plan || 1, 1, DEFER_MAX) : 1, dm = deferMult(plan), upfront = fee / plan + fee * .05;
  if (upfront > c.cash) return { ok: false, msg: `You can't cover ${plan > 1 ? `the first instalment (${money(fee / plan)})` : money(fee)} plus agent fees with ${money(c.cash)} in the bank.` };
  if (w < .3) return { ok: false, res: "refused", msg: `${p.name} doesn't want to join. ${whyNot(p, c)}` };
  // 1. The fee, unless it's already agreed at this figure or more.
  // Paid over several years, the club judges the total against its price scaled up by deferMult.
  if (p.club >= 0 && !(st.feeOK != null && fee >= st.feeOK && st.feePlan === plan)) {
    const ask = askingPrice(p) * dm, floor = clubFloor(p) * dm, how = plan > 1 ? ` over ${plan} years` : "";
    if (fee < floor) {
      st.clubNo = (st.clubNo || 0) + 1;
      if (st.clubNo >= 3 || fee < ask * .6) { lock(); return { ok: false, res: "rejected", msg: `${C(p.club).name} end the talks${fee < ask * .6 ? ` at ${money(fee)}${how}: nowhere near their ${money(ask)} valuation` : " after three offers below what they'll take"}. Try again next week.` }; }
      const counter = roundFee(Math.max(floor, fee + (ask - fee) * .5));
      st.counterFee = counter;
      return { ok: false, msg: `${C(p.club).name} turn down ${money(fee)}${how} and come back at ${money(counter)}${how}.` };
    }
    st.feeOK = fee; st.feePlan = plan; st.counterFee = null;
  }
  // 2. Personal terms.
  const demand = contractDemand(p, c, w), min = wageFloor(p, demand, w, yrs);
  if (wage < min) {
    st.playerNo = (st.playerNo || 0) + 1;
    if (st.playerNo >= 3) { lock(); return { ok: false, res: "refused", msg: `${p.name} walks away from the talks after three offers below what he'll accept. Try again next week.` }; }
    const counter = Math.ceil(Math.max(min, wage + (demand - wage) * .5) / 1000) * 1000;
    st.counterWage = counter;
    return { ok: false, msg: `${p.club >= 0 ? "Fee agreed. " : ""}${p.name} turns down ${perWeek(wage)} on a ${yrs}-year deal; he'd sign for ${perWeek(counter)}.` };
  }
  const fromRival = p.club >= 0 ? rivalry(p.club, c.id) : 0, rivalClub = p.club >= 0 ? C(p.club) : null;
  transfer(p, c, fee, wage, yrs, plan);
  if (fromRival) { S.board = clamp(S.board - fromRival, 0, 100); news(`Signing ${p.name} from ${rivalClub.name} divides opinion. Some supporters will never accept a player from across the divide.`, true, "transfer"); }
  fixUserLineup();
  return { ok: true, res: "signed", msg: `${p.name} signs a ${yrs}-year deal on ${perWeek(wage)}${fee ? ` for ${money(fee)}${plan > 1 ? `, paid over ${plan} years (${money(fee / plan)} now)` : ""}` : ""}.` };
}
function whyNot(p, b) {
  const cur = p.club >= 0 ? C(p.club) : null, out = [];
  if (cur && cur.rep > b.rep + 5) out.push("he'd be stepping down to a smaller club");
  const rivals = b.squad.map(P).filter(x => x.pos === p.pos && x.ovr > p.ovr).length;
  if (rivals >= Math.max(1, roleSlots(b.formation, p.pos))) out.push("he'd struggle for minutes behind your current " + ROLE_NAME[p.pos].toLowerCase() + "s");
  if (roleSlots(b.formation, p.pos) === 0 && p.pos !== "GK") out.push(`your ${b.formation} has no ${ROLE_NAME[p.pos].toLowerCase()} role`);
  if (p.ovr - clubLevel(b) > 8) out.push(`he's too good to drop to the ${leagueName(b.lg)}`);
  return out.length ? "He thinks " + out.join(", and ") + "." : "";
}
function sellToAbroad(p) {
  const c = me(), fee = Math.round(value(p) * .8 / 1e4) * 1e4;
  c.squad = c.squad.filter(id => id !== p.id); const book = p.am ? p.am.per * p.am.left : 0;
  c.cash += fee; acct(c).sales += fee - book; acct(c).sold += fee; S.lineup = S.lineup.map(id => id === p.id ? null : id);
  news(`${p.name} sold to a club abroad for ${money(fee)}.`, false, "transfer");
  delete S.players[p.id]; fixUserLineup();
  return fee;
}
function releasePlayer(p) {
  const c = me(), pay = Math.round(p.wage * Math.max(0, p.yrs) * .5);
  c.cash -= pay; c.fin.wages += pay; c.squad = c.squad.filter(id => id !== p.id); S.lineup = S.lineup.map(id => id === p.id ? null : id);
  toFreeAgent(p); fixUserLineup();
  news(`${p.name} released. Settlement: ${money(pay)}.`, false, "squad");
}
function renewTerms(p) {
  const c = me();
  if (p.retiring === 1) return { happy: false, wage: p.wage, reason: "He has decided to retire at the end of the season." };
  const happy = p.mood >= 45 && !p.req;
  const wage = renewWage(p, c, p.mood < 60 ? 1.25 : 1.05);
  return { happy, wage, reason: happy ? "" : p.req ? "He has asked to leave and won't discuss a new deal." : "He is unhappy and won't commit his future right now. More minutes or better results might change that." };
}

/* ---------- Squad Cost Ratio ---------- */
/* Before the accounts close, an AI club heading for a charge sells whoever books the biggest profit,
   as real clubs do, until it is back under the line or can't find a buyer. */
function deadlineSales(c, ratio) {
  const lvl = clubLevel(c), buyers = activeClubs().filter(b => b.id !== c.id && !isUser(b) && b.squad.length < 32 && clubLevel(b) >= lvl - 2 && rivalry(b.id, c.id) < 2);
  const book = p => p.am ? p.am.per * p.am.left : 0;
  const list = c.squad.map(P).filter(p => !p.loan && p.age >= 18).sort((a, b) => (value(b) - book(b)) - (value(a) - book(a)));
  let sold = 0;
  if (R() < .06) { c.missedDeadline = S.year; return; }  // sometimes no deal gets done before the accounts close
  for (const p of list.slice(0, 8)) {
    if (ratio() <= RULES.scrSporting - .05 || sold >= 5) break;
    if (R() < .12) continue;  // this deal falls through; try the next player
    const buyer = pick(buyers.filter(b => b.cash > value(p) && !hasNamesake(b, p.name))); if (!buyer) continue;
    const fee = Math.round(value(p) * rf(.85, 1.05) / 1e4) * 1e4;
    transfer(p, buyer, fee, contractDemand(p, buyer, .6), ri(2, 5)); sold++; trimSquad(buyer, false);
    if (!isForeign(c) && (c.lg === me().lg || c.lg === "E1" || rivalry(c.id, S.club))) news(`${c.name} sell ${p.name} to ${buyer.name} for ${money(fee)} to stay inside the cost rules.`, false, "finance");
  }
}
function assessSCR() {
  for (const c of activeClubs()) {
    if (!c.fin || c.fin.rev < 1 || c.newcomer === S.year) continue;  // clubs that joined this summer have no season to judge
    const f = c.fin, costOf = () => f.wages + f.amort + f.agent, revOf = () => f.rev + f.prize + f.merit + f.scheme + Math.max(0, f.sales);
    // Clubs plan as if any connected-party income might be struck out, since the review comes after the deadline.
    const risky = sum(c.schemes.filter(s => s.y === S.year), s => s.amt), safeRatio = () => costOf() / Math.max(1, revOf() - risky);
    if (!isUser(c) && safeRatio() > RULES.scrSporting - .03) deadlineSales(c, safeRatio);
    const cost = costOf(), rev = revOf(), ratio = cost / Math.max(1, rev); c.lastSCR = ratio;
    let schemeBad = false;
    for (const s of c.schemes.filter(s => s.y === S.year)) {
      if (R() < s.risk) { schemeBad = true; s.found = true; news(`The league rules ${c.name}'s ${s.what} was not at fair market value. ${money(s.amt)} is struck from their accounts.`, isUser(c) || c.lg === me().lg || c.lg === "E1", "finance"); }
    }
    const adj = schemeBad ? cost / Math.max(1, rev - sum(c.schemes.filter(s => s.y === S.year && s.found), s => s.amt)) : ratio;
    // An amnesty (S.amnesty, a season you were misled about the ratio): no charge, deduction or levy that season.
    if (isUser(c) && S.amnesty && S.amnesty.y === S.year && S.amnesty.club === c.id) { if (adj > RULES.scrLimit) news(`Cost-ratio amnesty: your ${pct(adj)} ratio this season brings no levy, charge or points deduction. Normal rules apply from next season.`, true, "finance"); continue; }
    // Points deductions are an English-league sanction; foreign clubs only pay the levy.
    if (adj > RULES.scrSporting && !isForeign(c)) {
      const pts = Math.min(15, 6 + Math.floor((adj - RULES.scrSporting) / .05) + (schemeBad ? 2 : 0));
      S.cases.push({ club: c.id, ratio: adj, pts, hearing: ri(6, 20), status: "charged", y: S.year + 1 });
      if (!isForeign(c)) news(`${c.missedDeadline === S.year ? `${c.name} failed to sell in time. ` : ""}${c.name} charged with breaching the Squad Cost Ratio (${pct(adj)} against a ${pct(RULES.scrLimit)} limit). A hearing will follow next season.`, true, "finance");
    } else if (adj > RULES.scrLimit) {
      const levy = Math.round((adj - RULES.scrLimit) * rev * .5); c.cash -= levy; c.fin.levy += levy;
      if (isUser(c) || c.lg === "E1") news(`${c.name} pay a ${money(levy)} levy after a Squad Cost Ratio of ${pct(adj)}.`, isUser(c), "finance");
    }
  }
}

/* ---------- loans ---------- */
// A loanee sits in the borrowing club's squad and counts towards its registration; the parent keeps the contract.
function startLoan(p, to, share) {
  const from = C(p.club);
  if (share != null && share < 1) (S.loanSplits ||= {})[p.id] = share;
  from.squad = from.squad.filter(id => id !== p.id); to.squad.push(p.id);
  p.loan = { from: from.id, y: S.year }; p.club = to.id; p.pt = expectedShare(p, to); p.listed = false;  // a fresh start, as for a transfer
  refreshRegistration(to); refreshRegistration(from);
  if (isUser(from)) S.lineup = S.lineup.map(id => id === p.id ? null : id);
  bumpTick();
  if (isUser(from) || isUser(to)) news(`${p.name} joins ${to.name} on a season-long loan from ${from.name}.`, true, "transfer");
}
function endLoan(p) {
  const from = C(p.loan.from), cur = p.club >= 0 ? C(p.club) : null;
  if (cur) cur.squad = cur.squad.filter(id => id !== p.id);
  if (isUser(cur)) S.lineup = S.lineup.map(id => id === p.id ? null : id);
  p.loan = null; if (S.loanSplits) delete S.loanSplits[p.id];
  if (from && !from.gone) { from.squad.push(p.id); p.club = from.id; } else toFreeAgent(p);
  bumpTick();
}
const loanable = p => p.club >= 0 && !p.loan && p.age <= RULES.loanMaxAge && !p.inj;
function wouldStart(p, c) { return c.squad.map(P).filter(x => x.id !== p.id && FAM[x.pos][p.pos] >= .9 && x.ovr >= p.ovr).length < Math.max(1, roleSlots(c.formation, p.pos)); }
function canTakeLoan(c, p) { const r = regInfo(c); return r.loansIn < RULES.loansIn && (!isSenior(p) || r.registered < RULES.squadMax) && (!isSenior(p) || isHG(p, c.country) || r.nonHG < RULES.nonHGMax); }
/* Where should a young player go to play? Clubs a little below his level that would start him. */
function loanDestinations(p, opts = {}) {
  const fit = c => Math.abs(clubLevel(c) - p.ovr - 1);
  const ok = activeClubs().filter(c => c.id !== p.club && !isUser(c) && clubLevel(c) <= p.ovr + 3 && clubLevel(c) >= p.ovr - 9 && wouldStart(p, c) && canTakeLoan(c, p) && !hasNamesake(c, p.name)).sort((a, b) => fit(a) - fit(b));
  if (!opts.mix) return ok.slice(0, 4);
  // For you: a choice at home and abroad.
  return [...ok.filter(c => !isForeign(c)).slice(0, 4), ...ok.filter(c => isForeign(c)).slice(0, 4)];
}
/* Negotiating who pays a loanee's wage (5.73). The share is what the borrowing club pays, in quarters.
   The parent club wants you to pay at least parentMinShare: less if he'd be a regular for you (the point of a loan)
   or it's comfortably off, more if its own cost ratio is stretched, less again if his wage is far above what your
   club would pay him. A borrowing club pays at most borrowerMaxShare: what it would pay a player like him, against
   what he earns, a little less if it's short of cash. */
const SHARES = [1, .75, .5, .25];
function parentMinShare(p, c) {
  const parent = C(p.club), rank = c.squad.map(P).filter(x => FAM[x.pos][p.pos] >= .9 && x.ovr >= p.ovr).length, slots = Math.max(1, roleSlots(c.formation, p.pos));
  let m = .8;
  if (rank < slots) m -= .25;
  if (parent.cash > parent.revBase * .6) m -= .15;
  if (scr(parent) > .9) m += .25;
  if (p.wage > wageDemand(p, c.rep) * 1.3) m -= .15;
  return clamp(m, .25, 1);
}
function borrowerMaxShare(p, b) {
  let m = wageDemand(p, b.rep) / Math.max(1, p.wage);
  if (b.cash < b.revBase * .2) m -= .15;
  return clamp(m, .25, 1);
}
const upToQuarter = x => Math.min(1, Math.ceil(x * 4 - 1e-9) / 4), downToQuarter = x => Math.max(.25, Math.floor(x * 4 + 1e-9) / 4);
function userLoanIn(p, share = 1) {
  const c = me();
  if (!windowOpen()) return { ok: false, msg: "Loans can only be agreed while the transfer window is open." };
  if (!loanable(p) || p.club < 0) return { ok: false, msg: "He isn't available for loan." };
  if (!canTakeLoan(c, p)) return { ok: false, msg: `You can have ${RULES.loansIn} loan players at most, and he must fit your registration.` };
  const parent = C(p.club);
  if (wouldStart(p, parent)) return { ok: false, msg: `${parent.name} see him as a starter and won't loan him out.` };
  const rank = c.squad.map(P).filter(x => FAM[x.pos][p.pos] >= .9 && x.ovr >= p.ovr).length, slots = Math.max(1, roleSlots(c.formation, p.pos));
  if (rank >= slots * 2) return { ok: false, msg: `${parent.name} want him playing regularly, and he'd be behind ${rank} players at your club.` };
  if (clubLevel(c) < p.ovr - 10) return { ok: false, msg: `${parent.name} want him tested at a higher level than the ${leagueName(c.lg)}.` };
  const need = parentMinShare(p, c);
  if (share < need - 1e-9) return { ok: false, msg: `${parent.name} won't cover that much of his wage: they want you to pay at least ${Math.round(upToQuarter(need) * 100)}%.` };
  startLoan(p, c, share); fixUserLineup();
  return { ok: true, msg: `${p.name} joins on loan for the season. You pay ${share < 1 ? `${Math.round(share * 100)}% of his wage, ${perWeek(p.wage * share)} (${parent.name} pay the rest)` : `his wage, ${perWeek(p.wage)}`}${S.phase === "season" ? `, about ${money(loanWageLeft(p))} to the end of the season` : ""}.` };
}
/* What a loanee's wage still costs you this season. Wages are paid each week by whichever club's squad he's in,
   so this is also what sending him back saves. In preseason it is the whole season ahead. */
function loanWageLeft(p) { return Math.round(p.wage * loanShare(p) * (S.phase === "season" ? Math.max(0, (S.days.length ? S.days[S.days.length - 1].w + 11 : 52) - S.week) / 52 : 1)); }
/* Cutting a loan short: he goes back to his parent club, and his wage leaves your books from this week. What
   you've already paid stays paid. Allowed any time, not just in the window: the parent club always takes him back. */
function cancelLoanIn(p) {
  const c = me(), from = C(p.loan.from), saved = loanWageLeft(p);
  endLoan(p); refreshRegistration(c); if (p.club === from.id) refreshRegistration(from);
  if (p.club >= 0) p.pt = expectedShare(p, C(p.club));
  fixUserLineup();
  news(`${p.name}'s loan is cut short and he returns to ${from.name}.`, true, "transfer");
  return saved;
}
function aiLoans() {
  for (const c of activeClubs()) {
    if (isUser(c) || c.tier > 4) continue;
    let n = 0;
    for (const p of c.squad.map(P)) {
      if (n >= 2 || !loanable(p) || p.age > 22 || p.pot < clubLevel(c) - 4 || wouldStart(p, c) || R() > .3) continue;
      const d = loanDestinations(p)[0]; if (!d) continue;
      startLoan(p, d); n++;
    }
  }
}
