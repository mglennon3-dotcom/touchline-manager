"use strict";
/* Stadiums. Demand for seats follows prestige and league position; ticket income comes from home league games.
   Expansions take months and are paid for week by week out of cash, so they squeeze the transfer budget
   until the work is done. Ticket income is carved out of each club's existing income when the world is
   made, so it rebalances the economy rather than inflating it: extra seats only pay if you can fill them. */
const MATCHDAY_SHARE = .2;  // share of a club's starting income that comes through the turnstiles
const capFor = rep => 600 * Math.pow(1.055, rep);  // typical crowd for a club of this standing: ~1,000 at the bottom, ~45,000 at the top
const supportMult = c => .6 + .04 * (c.support ?? 10);  // support base 1 → 0.64×, 10 → 1×, 20 → 1.4×
const homeGames = c => roundsOf(c.lg) / 2;
const EXPANSIONS = [
  ["small", "Extend a stand", .15], ["medium", "Rebuild a stand", .35], ["large", "Redevelop two stands", .7], ["new", "Build a new stadium", 1.2],
];
function initStadium(c) {
  // Support base, out of 20: only loosely tied to stature, so some small clubs are passionately backed.
  c.support = c.support ?? clamp(Math.round(10 + gauss() * 3.5 + (c.rep - 45) * .05), 1, 20);
  c.cap = Math.max(800, Math.round(capFor(c.rep) * (.7 + .03 * c.support) * rf(.85, 1.1) / 100) * 100);
  const att = Math.min(c.cap, demandOf(c));
  const md = c.revBase * MATCHDAY_SHARE;
  c.price = Math.max(5, md / (homeGames(c) * att));
  c.revBase = Math.round(c.revBase - md);
  c.build = null; c.att = [0, 0];  // season attendance: total, home games
  c.fans = c.fans ?? clamp(Math.round(fanTarget(c) + gauss() * 5), 20, 90); c.tkt = c.tkt || 1;
}
function demandOf(c) {
  const L = S.leagues[c.lg], pos = L && L.n ? posIn(L, c.id) / L.clubs.length : .5;
  return capFor(c.rep) * supportMult(c) * (.85 + .3 * (1 - pos)) * (.8 + .4 * (c.fans ?? 60) / 100);
}
/* Where engagement settles: well-supported clubs and winning clubs sit higher. */
function fanTarget(c) {
  const L = S.leagues[c.lg], pos = L && L.n ? (posIn(L, c.id) - 1) / (L.clubs.length - 1) : .5;
  return clamp(32 + 1.4 * (c.support ?? 10) + 26 * (1 - pos), 10, 95);
}
/* Fan engagement, 0–100: results, derbies, ticket prices, full grounds and big moments move it. */
const fanWord = f => f >= 75 ? ["Buoyant", "good"] : f >= 60 ? ["Engaged", "good"] : f >= 45 ? ["Steady", ""] : f >= 30 ? ["Restless", "warn"] : ["Disillusioned", "bad"];
function moveFans(c, d, why) {
  const before = c.fans; c.fans = clamp(c.fans + d, 0, 100);
  if (isUser(c) && why && Math.abs(d) >= 3) (c.fanLog ||= []).unshift({ y: S.year, w: S.week, d: Math.round(d), why });
  if (c.fanLog && c.fanLog.length > 12) c.fanLog.length = 12;
  if (isUser(c) && fanWord(before)[0] !== fanWord(c.fans)[0]) news(`Supporters are now ${fanWord(c.fans)[0].toLowerCase()} (${Math.round(c.fans)}/100).`, c.fans < 45, "club");
}
function fansAfterMatch(c, gf, ga, opp) {
  const n = rivalry(c.id, opp), r = gf > ga ? 1.2 : gf < ga ? -1.2 : 0;
  moveFans(c, r * (1 + n) + (fanTarget(c) - c.fans) * .04, n && r ? (r > 0 ? "Derby win" : "Derby defeat") : null);
}
const capacityNow = c => Math.round(c.cap * (c.build ? .92 : 1));  // works close part of the ground
function gateFor(c, opp) {
  const derby = rivalry(c.id, opp) ? 1.12 : 1;
  const pm = c.tkt || 1;  // ticket price multiplier you choose; dearer seats sell less
  const att = Math.round(Math.min(capacityNow(c), demandOf(c) * derby * rf(.92, 1.05) * Math.pow(1 / pm, .9)));
  const income = Math.round(att * c.price * pm);
  moveFans(c, -(pm - 1) * 1.5 + (att >= capacityNow(c) ? .3 : 0));
  c.cash += income; c.fin.rev += income; c.fin.gate = (c.fin.gate || 0) + income;
  c.att[0] += att; c.att[1]++;
  return att;
}
/* A project's cost and length. Roughly six seasons of ticket money pays back seats that are filled. */
function expansionQuote(c, kind) {
  const [, label, share] = EXPANSIONS.find(e => e[0] === kind);
  const add = Math.round(c.cap * share / 100) * 100;
  const cost = Math.round(add * c.price * homeGames(c) * 6 / 1e5) * 1e5;
  const weeks = Math.min(80, Math.round(20 + add / 400));
  return { kind, label, add, cost, weeks, perWeek: Math.round(cost / weeks) };
}
function startExpansion(c, kind) {
  const q = expansionQuote(c, kind);
  c.build = { ...q, left: q.weeks, paid: 0, y: S.year };
  if (isUser(c)) news(`Work begins: ${q.label.toLowerCase()} adds ${q.add.toLocaleString()} seats over ${q.weeks} weeks at a cost of ${money(q.cost)}, paid weekly.`, true, "finance");
  else if (!isForeign(c) && (c.lg === me().lg || rivalry(c.id, S.club))) news(`${c.name} start work to ${q.label.toLowerCase()}, adding ${q.add.toLocaleString()} seats.`, false, "club");
}
/* Runs every week for every club. */
function stadiumWeek(c) {
  const b = c.build; if (!b) return;
  c.cash -= b.perWeek; b.paid += b.perWeek; c.fin.stadium = (c.fin.stadium || 0) + b.perWeek; b.left--;
  if (b.left <= 0) {
    c.cap += b.add; c.build = null;
    if (isUser(c)) news(`The stadium work is finished: capacity is now ${c.cap.toLocaleString()}.`, true, "finance");
    else if (!isForeign(c) && (c.lg === me().lg || rivalry(c.id, S.club))) news(`${c.name}'s expanded ground opens with ${c.cap.toLocaleString()} seats.`, false, "club");
  }
}
/* AI clubs build when they keep selling out and the money is there. */
function aiStadium(c) {
  if (c.build || isUser(c)) return;
  const gap = demandOf(c) / c.cap;
  if (gap < 1.1 || R() > .15) return;
  const kind = gap > 1.8 ? "new" : gap > 1.5 ? "large" : gap > 1.25 ? "medium" : "small";
  const q = expansionQuote(c, kind);
  if (c.cash > q.cost * .35 && q.cost < c.revBase * 1.5) startExpansion(c, kind);
}
/* Ticket prices move with the club's income, so promotion lifts them and relegation cuts them. */
function rescalePrice(c, ratio) { c.price = Math.max(5, c.price * Math.sqrt(ratio)); }

/* What a price would do over a home game, for the price picker. */
function ticketForecast(c, pm) {
  const att = Math.round(Math.min(capacityNow(c), demandOf(c) * Math.pow(1 / pm, .9)));
  return { att, income: Math.round(att * c.price * pm), price: c.price * pm };
}
/* Saves made before stadiums existed get them now. */
function ensureStadiums() { for (const c of activeClubs()) if (c.cap == null) initStadium(c); S.stadiums = true; }
