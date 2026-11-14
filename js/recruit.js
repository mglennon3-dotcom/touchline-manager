"use strict";
/* Youth recruitment. 15-year-olds pick an academy on more than money:
   distance from home, a route to minutes, whether the club's shape uses their position,
   who else is there, the club's standing, the academy itself, and the relationship you build. */
const FACTORS = [
  ["loc", "Close to home"], ["time", "Playing time"], ["form", "Formation fit"],
  ["dyn", "Squad dynamics"], ["prest", "Club prestige"], ["acad", "Youth development"],
];
const FACTOR_HELP = {
  loc: "Distance from his home town. Players abroad weigh this by how open they are to moving.",
  time: "Players ahead of him at his position, and how many minutes your club gave under-21s last season.",
  form: "How many places your formation has for his position.",
  dyn: "Compatriots in the squad, other recruits you've signed at his position, and dressing-room mood.",
  prest: "Reputation, division, and Champions Cup football.",
  acad: "Your youth development rating, out of 20.",
};
const starsOf = pot => pot >= 86 ? 5 : pot >= 80 ? 4 : pot >= 73 ? 3 : pot >= 66 ? 2 : 1;

/* Each year's class: 80 from England, 18 from each of the seven countries abroad and 30 from further afield (Brazil,
   Argentina, West Africa, Scandinavia). It was 7 and 22: a single foreign country showed a handful of names. */
const PROSPECTS = { ENG: 80, abroad: 18, row: 30 };
function addProspect(nat, country, region, lat, lon) {
  const pot = clamp(Math.round(62 + Math.pow(R(), 1.8) * 32 + gauss() * 2), 52, 95);
  const pri = {}; for (const [k] of FACTORS) pri[k] = .6 + R() * .6;
  const top = shuffle(FACTORS.map(f => f[0])).slice(0, 2); pri[top[0]] += 2.2; pri[top[1]] += 1.2;
  const tot = sum(Object.values(pri)); for (const k in pri) pri[k] /= tot;
  // Ids are "y<year>-<n>", n one past the highest in the class, so a top-up never reuses one.
  const n = S.prospects.reduce((m, x) => Math.max(m, +String(x.id).split("-")[1] || 0), -1) + 1;
  const y = { id: "y" + S.year + "-" + n, name: nameFor(nat), nat, country, region, lat: lat + rf(-.6, .6), lon: lon + rf(-.8, .8),
    pos: pick(["GK", "CB", "CB", "FB", "DM", "CM", "CM", "AM", "W", "W", "ST", "ST"]), ovr: clamp(Math.round(pot * .55 + gauss() * 3), 30, 60), pot, open: +rf(.15, 1).toFixed(2),
    pri, top, sc: 0, known: false, ir: clamp(Math.round(10 + gauss() * 3.2), 1, 20), rel: {}, offers: [], visit: false, called: -1, commit: null, cw: null };
  S.prospects.push(y); return y;
}
const addFrom = code => { const [r, la, lo] = pick(COUNTRY[code].regions); return addProspect(code, code, r, la, lo); };
const addRow = () => { const [code, r, la, lo] = pick(ABROAD); return addProspect(code, null, r, la, lo); };
function newProspectClass() {
  S.prospects = [];
  for (let i = 0; i < PROSPECTS.ENG; i++) addFrom("ENG");
  for (const K of COUNTRIES.filter(k => k.code !== "ENG")) for (let i = 0; i < PROSPECTS.abroad; i++) addFrom(K.code);
  for (let i = 0; i < PROSPECTS.row; i++) addRow();
  // AI clubs pick their targets for the year
  for (const c of activeClubs()) {
    if (isUser(c) || c.tier >= 5 || (isForeign(c) && c.tier >= 2)) continue;
    const k = 1 + Math.floor(c.academy / 5), reach = c.rep >= 80 || c.academy >= 16 ? 1 : 0;
    const cands = S.prospects.filter(y => y.country === c.country || reach || (y.country == null && c.rep >= 70))
      // Strong academies aim for the best prospects whatever division the club is in.
      .map(y => ({ y, s: starsOf(y.pot) * (c.rep / 80 + c.academy / 10) + factorScore(y, c) * 4 + R() * 2 })).sort((a, b) => b.s - a.s).slice(0, k + 3);
    for (const { y } of shuffle(cands).slice(0, k)) y.rel[c.id] = rf(.02, .08);
  }
  S.rec.offers = 0; S.rec.hours = recHours();
}
/* Top up a class made before the pool grew (5.60), and let AI clubs in those countries take an interest in the new
   names as they would at the start of the year. */
function topUpProspects() {
  if (!S.prospects || !S.prospects.length) return 0;
  const added = [];
  for (const K of COUNTRIES.filter(k => k.code !== "ENG")) for (let n = S.prospects.filter(y => y.country === K.code).length; n < PROSPECTS.abroad; n++) added.push(addFrom(K.code));
  for (let n = S.prospects.filter(y => y.country == null).length; n < PROSPECTS.row; n++) added.push(addRow());
  for (const y of added) {
    const keen = activeClubs().filter(c => !isUser(c) && c.tier < 5 && !(isForeign(c) && c.tier >= 2) && (y.country === c.country || c.rep >= 80 || c.academy >= 16 || (y.country == null && c.rep >= 70)));
    for (const c of shuffle(keen).slice(0, ri(0, 2))) y.rel[c.id] = rf(.02, .08);
  }
  return added.length;
}
const recHours = () => Math.max(4, 8 + 3 * S.rec.scoutLvl + Math.round((S.me.rec - 10) * .6));
const recMult = () => .7 + .03 * S.me.rec;  // a good recruiter builds relationships faster
const offerCap = () => 3 + Math.floor(me().academy / 4);

function factors(y, c) {
  const d = km(y, c), domestic = y.country === c.country;
  const loc = domestic ? 1 / (1 + d / 220) : (y.country == null ? y.open : y.open * .7) * .7 / (1 + d / 2500);
  const f = c.formation, slots = roleSlots(f, y.pos);
  const ahead = c.squad.map(P).filter(p => FAM[p.pos][y.pos] >= .9 && p.age <= 27 && p.ovr >= y.pot - 10).length;
  const time = clamp(1 - ahead / (Math.max(1, slots) * 2 + 1), 0, 1) * .7 + clamp(c.youthMin * 4, 0, 1) * .3;
  const form = y.pos === "GK" ? 1 : slots === 0 ? .12 : slots === 1 ? .62 : 1;
  const compat = c.squad.filter(id => P(id).nat === y.nat).length;
  const sameRole = S.prospects.filter(o => o !== y && o.commit === c.id && o.pos === y.pos).length;
  const moodAvg = sum(c.squad, id => P(id).mood) / Math.max(1, c.squad.length);
  const dyn = .45 * Math.min(1, compat / 5) + .35 * (1 - Math.min(1, sameRole / 2)) + .2 * (moodAvg / 100);
  const inCC = S.cont.CC && S.cont.CC.groups.some(g => g.includes(c.id));
  const prest = clamp(c.rep / 100 * [1, 1, .85, .75, .65, .55, .5][c.tier] + (inCC ? .1 : 0), 0, 1);
  const acad = c.academy / 20;
  return { loc, time, form, dyn, prest, acad, d, ahead, slots, compat, sameRole };
}
function factorScore(y, c) { const f = factors(y, c); return sum(FACTORS, ([k]) => y.pri[k] * f[k]); }
/* The club that offered him a place first, and still has the offer on the table, has an edge: he remembers
   who believed in him before anyone else did. Offers are kept in the order they were made, so it is the first
   entry. FIRST_OFFER is about what a home visit is worth to a typical lad, and enough to settle a close race. */
const FIRST_OFFER = .07;
const firstOffer = y => y.offers[0];
const clubScore = (y, c) => factorScore(y, c) + .45 * (y.rel[c.id] || 0) + (y.offers[0] === c.id ? FIRST_OFFER : 0);
const grade = v => v >= .8 ? "A" : v >= .62 ? "B" : v >= .45 ? "C" : v >= .3 ? "D" : "F";

/* What you can see depends on how much you've scouted him: potential and injury proneness as ranges out of 20. */
function prospectView(y, val, k) {
  // His youth coaches' view narrows the estimate on top of whatever your own scouting shows.
  const rec = S.me ? S.me.rec : 10, w = [8, 5, 3, Math.max(1, 3 - rec * .1)][y.sc] * knowWidth(prospectCountry(y)) * (y.coach ? .6 : 1);
  let h = 0; for (const ch of y.id) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  const c = val + (seedOf(h, k) - .5) * w * .8;
  return [clamp(Math.round(c - w / 2), 1, 20), clamp(Math.round(c + w / 2), 1, 20)];
}
const prospectPot = y => prospectView(y, r20(y.pot), 3);
const prospectInj = y => y.sc >= 2 || y.coach ? prospectView(y, y.ir, 5) : null;  // his coaches know his injury history
function shownStars(y) {
  const s = starsOf(y.pot);
  if (y.sc >= 2) return [s, s];
  if (y.sc === 1) { const lo = Math.max(1, s - (y.id.length % 2)), hi = Math.min(5, lo + 1); return [lo, hi]; }
  return [Math.max(1, s - 1), Math.min(5, s + 1)];
}
function contenders(y) {
  return Object.keys(y.rel).map(Number).filter(id => !C(id).gone).map(id => ({ c: C(id), s: clubScore(y, C(id)), offer: y.offers.includes(id) })).sort((a, b) => b.s - a.s);
}

/* ---------- actions ---------- */
const REC_COST = { scout: 3, call: 1, visit: 5, home: 4, coach: 2 };
function recAct(y, act) {
  const c = me();
  if (y.commit === c.id) return "He has already committed to you.";
  if (y.signed) return "He has already joined an academy.";
  if (act === "offer") {
    if (y.offers.includes(c.id)) { y.offers = y.offers.filter(id => id !== c.id); S.rec.offers--; return `Offer to ${y.name} withdrawn.`; }
    if (y.sc < 1) return "Scout him at least once before offering a place.";
    if (S.rec.offers >= offerCap()) return `Your academy can only offer ${offerCap()} places a year. Withdraw one first.`;
    const first = !y.offers.length;
    y.offers.push(c.id); y.rel[c.id] = (y.rel[c.id] || 0) + .05; S.rec.offers++;
    return first ? `Academy place offered to ${y.name}: the first offer he's had, and he'll remember it.` : `Academy place offered to ${y.name}. ${C(y.offers[0]).name} offered first, which counts in their favour.`;
  }
  if (act === "home" && y.sc < 1) return "Scout him at least once before visiting his family.";
  if (act === "coach" && y.coach) return "You've already spoken to his youth coaches.";
  if (act === "home" && y.home) return "You've already visited his family.";
  const code = prospectCountry(y), cost = act === "call" ? REC_COST.call : scoutHours(REC_COST[act], code);
  if (S.rec.hours < cost) return `Not enough recruiting hours left this week (${S.rec.hours} of ${recHours()}); that needs ${cost}.`;
  if (act === "scout") { if (y.sc >= 3) return "You already know everything about him."; y.hide = false; y.sc = Math.min(3, y.sc + (knowOf(code) >= 15 ? 2 : 1)); y.scT = whenLabel(); if (y.sc >= 2) y.known = true; learnCountry(code); payTravel(code); }
  if (act === "call") { if (y.called === S.week + S.year * 100) return "You've already spoken to his family this week."; y.called = S.week + S.year * 100; y.known = true; y.rel[c.id] = (y.rel[c.id] || 0) + (.045 + .03 * (y.pri.dyn + y.pri.acad)) * recMult(); }
  // Visiting him and his family at home: worth most to lads who want to stay near home and care about the
  // people around them (close to home, squad dynamics); hosting him at your ground suits the rest better.
  if (act === "home") { payTravel(code); y.home = true; y.known = true; y.rel[c.id] = (y.rel[c.id] || 0) + (.06 + .25 * ((y.pri.loc || 0) + (y.pri.dyn || 0))) * recMult(); }
  // Speaking to his youth coaches (by phone, so never any travel): their view of his potential and injury
  // history, what he cares about, and a word in his ear about your pathway if that's what he values.
  if (act === "coach") { y.coach = true; y.known = true; y.coachT = whenLabel(); y.rel[c.id] = (y.rel[c.id] || 0) + (.02 + .06 * ((y.pri.acad || 0) + (y.pri.time || 0))) * recMult(); }
  if (act === "visit") { if (y.visit) return "He has already visited."; payTravel(code); y.visit = true; y.known = true; y.rel[c.id] = (y.rel[c.id] || 0) + .16 * recMult(); }
  S.rec.hours -= cost;
  return { scout: `Scouting report on ${y.name} updated.`, call: `You spoke with ${y.name}'s family.`, visit: `${y.name} visited your training ground.`, home: `You visited ${y.name} and his family at home.`, coach: coachWord(y) }[act];
}

/* ---------- the weekly cycle ---------- */
function weeklyRecruiting() {
  S.rec.hours = recHours();
  for (const y of S.prospects) {
    if (y.commit != null) {
      // A commitment isn't binding until signing day: a better offer can still turn his head.
      const cur = clubScore(y, C(y.commit)), rival = y.offers.filter(id => id !== y.commit).map(id => ({ id, s: clubScore(y, C(id)) })).sort((a, b) => b.s - a.s)[0];
      if (rival && rival.s > cur + .08 && R() < (S.week >= 30 ? .12 : .06)) {
        const old = C(y.commit); y.commit = rival.id; y.cw = S.week;
        if (isUser(C(rival.id))) news(`${y.name} has backed out of his commitment to ${old.name} and will join your academy instead!`, true, "youth");
        else if (isUser(old)) news(`${y.name} has broken his commitment to your academy and will join ${C(rival.id).name}.`, true, "youth");
        else if (starsOf(y.pot) >= 5) news(`Five-star prospect ${y.name} flips from ${old.name} to ${C(rival.id).name}.`, false, "youth");
      }
      continue;
    }
    for (const id of Object.keys(y.rel).map(Number)) {
      const c = C(id); if (isUser(c) || c.gone) continue;
      y.rel[id] += rf(.008, .03) * (.6 + c.academy / 20) * (.7 + .03 * c.coach.rec);
      if (!y.offers.includes(id) && y.rel[id] > .22 && y.offers.length < 6 && !hasNamesake(c, y.name)) y.offers.push(id);
    }
    if (S.week >= 8 && y.offers.length) {
      const ranked = y.offers.map(id => ({ id, s: clubScore(y, C(id)) })).sort((a, b) => b.s - a.s);
      const best = ranked[0], second = ranked[1] ? ranked[1].s : 0;
      const p = clamp((best.s - .5) * .6 + (best.s - second) * 1.2, 0, .25) * (S.week < 20 ? .35 : S.week >= 30 ? 1.6 : 1);
      if (R() < p) commitProspect(y, best.id);
    }
  }
}
function commitProspect(y, id) {
  y.commit = id; y.cw = S.week; const c = C(id);
  if (isUser(c)) news(`${y.name} (${y.pos}, ${y.region}) has committed to your academy!`, true, "youth");
  else if (y.offers.includes(S.club)) news(`${y.name} has chosen ${c.name} over your academy.`, false, "youth");
  else if (starsOf(y.pot) >= 5) news(`Five-star prospect ${y.name} (${y.region}) commits to ${c.name}.`, false, "youth");
}
function signingDay() {
  for (const y of S.prospects) {
    if (y.commit == null && y.offers.length) { const best = y.offers.map(id => ({ id, s: clubScore(y, C(id)) })).sort((a, b) => b.s - a.s)[0]; commitProspect(y, best.id); }
    if (y.commit == null || C(y.commit).gone) continue;
    const c = C(y.commit); y.signed = true;
    const p = makePlayer({ pos: y.pos, base: y.ovr + 9, age: 16, nat: y.nat, club: c.id, rep: c.rep });
    p.name = y.name; p.ir = y.ir || p.ir; setRating(p, clamp(y.ovr + ri(0, 4), 33, YOUTH_START_CAP)); capYouthStart(p); p.pot = Math.max(p.ovr, y.pot + ri(-2, 2)); p.yrs = 3; p.wage = 1500 * MONEY;
    p.yt[c.country] = 1; p.from = y.region; youthDeal(p); if (isUser(c)) p.acad = true;  // on a youth deal; yours start in the academy
    c.squad.push(p.id);
  }
}

/* ---------- scouting a senior player (yours, or the assistant's) ---------- */
function scoutPlayer(p) {
  const code = playerCountry(p); S.rec.hours -= scoutHours(2, code); payTravel(code); learnCountry(code);
  S.scout[p.id] = Math.min(2, (S.scout[p.id] || 0) + (knowOf(code) >= 15 ? 2 : 1));
  if (S.scoutHide) delete S.scoutHide[p.id];  // scouting him again puts him back on your list
  (S.scoutT ||= {})[p.id] = { y: S.year, w: whenLabel(), n: ((S.scoutT[p.id] || {}).n || 0) + 1, t: Date.now() };
}
/* ---------- the scouting assistant ----------
   An on/off toggle (S.set.autoScout), off unless you switch it on. At the end of each week it spends the
   hours you left unused, so your own scouting always comes first, on youth prospects and transfer targets
   alike. It only scouts in England, where scouting is free: it never spends your money (an earlier
   version could travel abroad, which charges travel costs). Youth: undecided prospects with the best potential
   estimates, favouring positions your formation uses and lads nearer home, taking each to a detailed
   report. Players: those at positions Team Needs flags who could improve on your weakest starter there and
   whose price you could meet. */
const autoScoutOn = () => { const v = (S.set || {}).autoScout; return v === true || (typeof v === "string" && v !== "off"); };  // 5.18 stored a mode name
function autoScout() {
  if (!autoScoutOn() || !S.me) return;
  const mode = "both", c = me(), ok = code => code === "ENG" && travelCost(code) === 0, uses = new Set(slotsOf(S.formation));
  const youth = mode === "players" ? [] : S.prospects.filter(y => y.commit == null && !y.signed && y.sc < 2 && !y.hide && ok(prospectCountry(y)))
    .map(y => ({ k: "y", o: y, cost: scoutHours(REC_COST.scout, prospectCountry(y)), s: viewMid(prospectPot(y)) + (uses.has(y.pos) ? 1.5 : 0) - km(y, c) / 400 }));
  let players = [];
  if (mode !== "youth") {
    const needs = teamNeeds().filter(n => n.status[1] !== "good"), budget = c.cash * 1.2;
    for (const n of needs.slice(0, 4)) for (const p of Object.values(S.players)) {
      if (p.club === S.club || p.club < 0 && !S.fa.includes(p.id) || p.loan || p.age < 18 || p.age > 31 || scoutLevel(p) >= 2 || (S.scoutHide || {})[p.id] || FAM[p.pos][n.role] < .9 || !ok(playerCountry(p))) continue;
      if (ratingMid(p) < n.weakest + .5 || (p.club >= 0 && askingPrice(p) > budget)) continue;
      players.push({ k: "p", o: p, cost: scoutHours(2, playerCountry(p)), s: ratingMid(p) - n.weakest + n.score * .2 - (p.club >= 0 ? askingPrice(p) / (1e7 * MONEY) : 0) });
    }
    const seen = new Set(); players = players.filter(x => !seen.has(x.o.id) && seen.add(x.o.id));
  }
  youth.sort((a, b) => b.s - a.s); players.sort((a, b) => b.s - a.s);
  const done = { y: [], p: [] }; let turn = mode === "players" ? "p" : "y", guard = 0;
  while (guard++ < 40) {
    const list = turn === "y" ? youth : players, other = turn === "y" ? players : youth;
    const i = list.findIndex(x => x.cost <= S.rec.hours), j = other.findIndex(x => x.cost <= S.rec.hours);
    if (i < 0 && j < 0) break;
    const [pickList, idx] = i >= 0 ? [list, i] : [other, j], x = pickList[idx];
    if (x.k === "y") { recAct(x.o, "scout"); if (x.o.sc >= 2) pickList.splice(idx, 1); if (!done.y.includes(x.o.name)) done.y.push(x.o.name); }
    else { scoutPlayer(x.o); if (scoutLevel(x.o) >= 2) pickList.splice(idx, 1); if (!done.p.includes(x.o.name)) done.p.push(x.o.name); }
    if (mode === "both") turn = turn === "y" ? "p" : "y";
  }
  S.autoLast = { w: whenLabel(), y: done.y.length, p: done.p.length };
  const names = a => a.slice(0, 3).join(", ") + (a.length > 3 ? ` and ${a.length - 3} more` : "");
  if (done.y.length || done.p.length) news(`Your scouts filed reports on ${[done.y.length ? `${done.y.length} youth prospect${done.y.length > 1 ? "s" : ""} (${names(done.y)})` : "", done.p.length ? `${done.p.length} transfer target${done.p.length > 1 ? "s" : ""} (${names(done.p)})` : ""].filter(Boolean).join(" and ")}.`, false, done.p.length ? "transfer" : "youth");
}

// What his coaches say, from the (narrowed) potential estimate you now have.
function coachWord(y) {
  const [lo, hi] = prospectPot(y), m = (lo + hi) / 2;
  const view = m >= 17 ? "say he's the best they've had in years" : m >= 14 ? "rate him very highly" : m >= 11 ? "think he can make a career in the game" : m >= 8 ? "think he'll need to keep working" : "aren't sure he'll make it";
  return `${y.name}'s youth coaches ${view}. Potential estimate now ${lo === hi ? lo : lo + "–" + hi}.`;
}
