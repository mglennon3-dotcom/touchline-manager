"use strict";
/* World state: clubs, players, registration, values. */
let S = null;

const P = id => S.players[id];
const C = id => S.clubs[id];
const me = () => S.clubs[S.club];
const isUser = c => c && c.id === S.club;
const leagueKey = c => c.lg;
const leagueName = key => LG[key] ? LG[key].name : key;
const isForeign = c => !!LG[c.lg].foreign;
const sur = p => { const parts = p.name.split(" "); return parts.slice(1).join(" ") || parts[0]; };
const activeClubs = () => S.clubs.filter(c => !c.gone);

function newStats() { return { app: 0, min: 0, g: 0, lg: 0, a: 0, yc: 0, rc: 0, rt: 0, cs: 0 }; }
function nameFor(nat) { const N = NAMES[nat] || NAMES.ENG; return pick(N[0]) + " " + pick(N[1]); }

function makePlayer(o) {
  const age = o.age ?? ri(18, 33);
  let ovr = Math.round((o.base ?? 65) + gauss() * 3.4 + (age <= 17 ? -9 : age <= 19 ? -5 : age <= 21 ? -2.5 : age >= 33 ? -2 : 0));
  ovr = clamp(ovr, 28, 92);
  const gap = age <= 17 ? ri(8, 20) : age <= 19 ? ri(5, 16) : age <= 21 ? ri(2, 10) : age <= 24 ? ri(0, 5) : age <= 27 ? ri(0, 2) : 0;
  const p = {
    id: S.nextPid++, name: nameFor(o.nat), nat: o.nat, age, pos: o.pos, ovr, pot: clamp(ovr + gap, ovr, 95),
    fit: ri(92, 100), mood: ri(58, 76), pt: .5, wm: 0, amb: +R().toFixed(2), loy: +R().toFixed(2),
    club: o.club ?? -1, wage: 0, yrs: ri(1, 5), am: null, yt: {}, inj: 0, sus: 0, yc: 0,
    s: newStats(), hist: [], req: false, listed: false, promise: null, joined: S.year, loan: null, peak: ovr, tot: [0, 0],
  };
  p.wage = wageDemand(p, o.rep ?? 60);
  S.players[p.id] = p;
  return p;
}

/* Market value ignores contract length; value() applies it. */
function baseValue(p) {
  let v = 50000 * Math.pow(1.19, p.ovr - 50);
  if (p.age < 24) v *= 1 + (p.pot - p.ovr) * .045;
  if (p.age > 28) v *= Math.max(.12, 1 - (p.age - 28) * .14);
  return v;
}
function value(p) {
  const v = baseValue(p) * (p.yrs <= 1 ? .6 : p.yrs === 2 ? .85 : 1);
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
  return Math.max(10000, Math.round(v / mag) * mag);
}
function wageDemand(p, rep) { return Math.max(15000, Math.round(baseValue(p) * .16 * (.75 + rep / 200) / 1000) * 1000); }
const isHG = (p, country) => (p.yt[country] || 0) >= RULES.hgYears;
const isSenior = p => p.age >= 21;

function regInfo(c) {
  const ps = c.squad.map(P), seniors = ps.filter(isSenior), nonHG = seniors.filter(p => !isHG(p, c.country));
  const gks = ps.filter(p => p.pos === "GK" && !p.inj).length;
  return { seniors: seniors.length, nonHG: nonHG.length, u21: ps.length - seniors.length, gks, total: ps.length,
    loansIn: ps.filter(p => p.loan).length,
    ok: seniors.length <= RULES.squadMax && nonHG.length <= RULES.nonHGMax && ps.length >= 16 };
}

/* Club strength: average of the best realistic XI by line. Cached per tick — it is asked for constantly. */
function clubLevel(c) {
  if (c._lv && c._lv[0] === S._tick) return c._lv[1];
  const ps = c.squad.map(P);
  const best = (roles, n) => ps.filter(p => roles.includes(p.pos)).map(p => p.ovr).sort((a, b) => b - a).slice(0, n);
  const xi = [...best(["GK"], 1), ...best(["CB", "FB"], 4), ...best(["DM", "CM", "AM"], 3), ...best(["W", "ST", "AM"], 3)];
  const v = xi.length ? sum(xi) / xi.length : 40;
  c._lv = [S._tick, v];
  return v;
}
const bumpTick = () => { S._tick = (S._tick || 0) + 1; };
const avail = p => p && !p.inj && !p.sus;
const eff = (p, slot, fit) => p.ovr * FAM[p.pos][slot] * (.6 + .4 * (fit ?? p.fit) / 100) * (.95 + .1 * p.mood / 100);

function autoPick(ids, f, fixed) {
  const sl = slotsOf(f), pool = ids.map(P).filter(avail);
  const out = fixed ? fixed.slice() : Array(11).fill(null), used = new Set(out.filter(x => x != null));
  const fill = minFam => sl.forEach((role, i) => {
    if (out[i] != null) return; let best = null, bs = -1;
    for (const p of pool) { if (used.has(p.id) || FAM[p.pos][role] < minFam) continue; const s = eff(p, role); if (s > bs) { bs = s; best = p; } }
    if (best) { out[i] = best.id; used.add(best.id); }
  });
  fill(1); fill(.85); fill(0);
  return out;
}
function benchFor(c, xi) {
  const used = new Set(xi), rest = c.squad.map(P).filter(p => avail(p) && !used.has(p.id)).sort((a, b) => b.ovr * b.fit - a.ovr * a.fit);
  const gk = rest.find(p => p.pos === "GK"), out = gk ? [gk] : [];
  for (const p of rest) { if (out.length >= RULES.benchSize) break; if (p !== gk) out.push(p); }
  return out.map(p => p.id);
}
function fixUserLineup() {
  const c = me(), sq = new Set(c.squad), seen = new Set();
  const keep = (S.lineup || []).slice(0, 11).map(id => { if (id == null || !sq.has(id) || seen.has(id) || !avail(P(id))) return null; seen.add(id); return id; });
  while (keep.length < 11) keep.push(null);
  S.lineup = autoPick(c.squad, S.formation, keep);
}
function reshapeUser(f) {
  const xi = S.lineup.filter(id => id != null && avail(P(id))), sl = slotsOf(f), out = Array(11).fill(null), used = new Set();
  sl.forEach((role, i) => { let best = null; for (const id of xi) { const p = P(id); if (used.has(id) || p.pos !== role) continue; if (!best || p.ovr > best.ovr) best = p; } if (best) { out[i] = best.id; used.add(best.id); } });
  S.formation = f; me().formation = f; S.lineup = autoPick(me().squad, f, out);
}

/* ---------- world generation ---------- */
function townName(K) {
  for (let g = 0; g < 500; g++) {
    let t = pick(K.pre) + pick(K.suf); t = t.charAt(0).toUpperCase() + t.slice(1);
    if (!TOWN_BLOCK.has(t) && !S.towns[t]) { S.towns[t] = 1; return t; }
  }
  return pick(K.pre) + pick(K.suf) + " " + ri(2, 9);
}
function newClub(lgKey, rep) {
  const L = LG[lgKey], K = COUNTRY[L.c];
  const regions = L.half ? K.regions.filter(r => r[3] === L.half) : K.regions;
  const [rname, rlat, rlon] = pick(regions);
  const t = townName(K);
  const shorts = new Set(S.clubs.filter(c => c.country === K.code && !c.gone).map(c => c.short));
  let base = stripAcc(t).replace(/[^A-Za-z]/g, "").toUpperCase(), short = base.slice(0, 3), k = 3;
  while (shorts.has(short) && k < base.length) { short = base.slice(0, 2) + base[k]; k++; }
  const ownerType = wpick(["prudent", "balanced", "ambitious", "reckless"], o => ({ prudent: 3, balanced: 4, ambitious: 2, reckless: 1 })[o]);
  const c = { id: S.clubs.length, name: pick(K.fmt).replace("{t}", t), town: t, short, country: K.code, lg: lgKey, tier: L.tier, region: rname,
    lat: rlat + rf(-.6, .6), lon: rlon + rf(-.8, .8), color: CLUB_COLORS[S.clubs.length % CLUB_COLORS.length], rep, owner: ownerType,
    academy: clamp(Math.round(rep / 12 + gauss() * 1.4), 1, 10), formation: pick(["4-4-2", "4-3-3", "4-2-3-1", "4-3-3", "4-2-3-1", "3-5-2", "4-1-4-1", "5-3-2", "3-4-3", "4-4-2"]),
    squad: [], cash: 0, revBase: 0, revSeason: 0, fin: null, youthMin: rf(.03, .14), ym: 0, tm: 0, wkMatches: 0, trophies: [], hist: [], schemes: [], gone: false, founded: S.year };
  S.clubs.push(c);
  return c;
}
function genSquad(c) {
  const lvl = 48 + c.rep * .34, dom = isForeign(c) ? .62 : c.tier === 1 ? .6 : c.tier <= 3 ? .78 : .9;
  const foreign = ALL_NATS.filter(n => n !== c.country);
  for (const [pos, n] of Object.entries(ROLE_MIX)) for (let i = 0; i < n; i++) {
    const age = i === n - 1 && R() < .45 ? ri(18, 21) : ri(20, 33);
    const nat = R() < dom ? c.country : pick(foreign);
    const p = makePlayer({ pos, base: lvl + 1.6 - i * 2.3, age, nat, club: c.id, rep: c.rep });
    if (nat === c.country ? R() < .88 : (age <= 23 && R() < .25)) p.yt[c.country] = 3;
    if (R() < (c.tier <= 2 ? .5 : .2)) { const fee = Math.round(value(p) * rf(.6, 1.3)); const yrs = p.yrs + ri(0, 2); p.am = { per: Math.round(fee / yrs), left: p.yrs }; }
    c.squad.push(p.id);
  }
  for (let i = 0; i < 3; i++) academyPlayer(c, ri(16, 18));
  trimSquad(c, true);
}
function academyPlayer(c, age) {
  const p = makePlayer({ pos: pick(["CB", "FB", "DM", "CM", "AM", "W", "ST", "CB", "GK"]), base: 50, age, nat: c.country, club: c.id, rep: c.rep });
  // Academy kids peak around the club's own level: a few exceed it, most fall short.
  p.pot = clamp(Math.round(48 + c.rep * .34 - 4 + (c.academy - 5) * .6 + gauss() * 4.5), 42, 92);
  p.ovr = clamp(p.pot - ri(6, 14) - (18 - age) * 3, 28, p.pot);
  p.wage = Math.max(12000, Math.round(wageDemand(p, c.rep) * .6 / 1000) * 1000);
  p.yt[c.country] = Math.max(1, age - 15); p.yrs = ri(2, 3);
  c.squad.push(p.id);
  return p;
}
/* Keep an AI club inside the registration rules by releasing its least valuable surplus. */
function trimSquad(c, atGen) {
  const release = p => { c.squad = c.squad.filter(id => id !== p.id); if (atGen) delete S.players[p.id]; else if (p.loan) endLoan(p); else toFreeAgent(p); };
  let info = regInfo(c), guard = 0;
  while (info.nonHG > RULES.nonHGMax && guard++ < 40) {
    const cand = c.squad.map(P).filter(p => isSenior(p) && !isHG(p, c.country)).sort((a, b) => value(a) - value(b))[0];
    if (atGen) { cand.nat = c.country; cand.name = nameFor(c.country); cand.yt[c.country] = 3; } else release(cand);
    info = regInfo(c);
  }
  while (info.seniors > RULES.squadMax && guard++ < 80) { const cand = c.squad.map(P).filter(isSenior).sort((a, b) => value(a) - value(b))[0]; release(cand); info = regInfo(c); }
  while (c.squad.length > 32 && guard++ < 120) { const cand = c.squad.map(P).filter(p => !isSenior(p)).sort((a, b) => a.pot - b.pot)[0]; if (!cand) break; release(cand); }
}
function toFreeAgent(p) {
  p.club = -1; p.am = null; p.req = false; p.listed = false; p.promise = null; p.yrs = 0; p.loan = null;
  if (!S.fa.includes(p.id)) S.fa.push(p.id);
}
/* Retired players leave the save; the notable ones are kept in the hall of fame. */
function retirePlayer(p) {
  const apps = p.tot[0] + p.s.app, goals = p.tot[1] + p.s.g;
  if (apps >= 380 || goals >= 120 || p.peak >= 84 || (p.awards || []).length) {
    S.hof.push({ name: p.name, nat: p.nat, pos: p.pos, y0: p.hist.length ? p.hist[0][0] : S.year, y1: S.year, apps, goals, peak: p.peak, clubs: [...new Set(p.hist.map(h => h[1]))].slice(-6), awards: p.awards || [] });
    S.hof.sort((a, b) => (b.apps + b.goals * 3 + b.peak * 5) - (a.apps + a.goals * 3 + a.peak * 5));
    if (S.hof.length > 250) S.hof.length = 250;
  }
  S.fa = S.fa.filter(id => id !== p.id); delete S.players[p.id];
}

const OWNER = {
  prudent: { l: "Prudent owner", target: [.6, .74] }, balanced: { l: "Steady owner", target: [.72, .84] },
  ambitious: { l: "Ambitious owner", target: [.84, 1.0] }, reckless: { l: "Big-spending owner", target: [.95, 1.12] },
};
function repFor(lgKey, i) { const [top, step] = LG[lgKey].rep; return clamp(Math.round(top - i * step + gauss() * 1.5), 8, 96); }
function setupFinances(c) {
  const cost = squadCost(c), t = OWNER[c.owner].target;
  c.revBase = Math.round(cost / rf(t[0], t[1]));
  c.cash = Math.round(c.revBase * rf(.12, .4) + (c.owner === "reckless" ? c.revBase * .35 : 0));
}
function newWorld() {
  S = { v: 3, year: 2026, phase: "season", week: 0, di: 0, days: [], summerDay: 0, club: null, nextPid: 1, players: {}, clubs: [], fa: [], towns: {},
    leagues: {}, ko: {}, cont: {}, prospects: [], rec: { hours: 0, scoutLvl: 2, offers: 0 }, inbox: [], news: [], nextMsg: 1,
    history: [], career: [], hof: [], board: 60, training: "bal", formation: "4-4-2", mentality: "bal", lineup: [], cases: [], tlog: [],
    set: { live: true }, qual: null, lastPos: {}, sacked: false, _tick: 1 };
  for (const key of Object.keys(LG)) {
    const ids = [];
    for (let i = 0; i < LG[key].size; i++) ids.push(newClub(key, repFor(key, i)).id);
    S.leagues[key] = { key, clubs: ids };
  }
  for (const c of S.clubs) genSquad(c);
  for (const c of S.clubs) setupFinances(c);
  // Income scale per division, anchored to reputation the same way wages are anchored to ability (≈6% per point).
  S.revK = {};
  for (const key of Object.keys(LG)) { const ks = S.leagues[key].clubs.map(C).map(c => c.revBase / Math.pow(1.061, c.rep)).sort((a, b) => a - b); S.revK[key] = ks[Math.floor(ks.length / 2)]; }
  for (let i = 0; i < 80; i++) { const p = makePlayer({ pos: pick(ROLES), base: ri(48, 70), age: ri(22, 34), nat: R() < .6 ? "ENG" : pick(ALL_NATS), rep: 40 }); if (p.nat === "ENG") p.yt.ENG = 3; toFreeAgent(p); }
  for (const L of Object.values(S.leagues)) [...L.clubs].sort((a, b) => C(b).rep - C(a).rep).forEach((id, i) => S.lastPos[id] = i + 1);
  return S;
}
function squadCost(c) { return sum(c.squad, id => { const p = P(id); return p.wage + (p.am ? p.am.per : 0); }); }

/* Expected league finish = rank of club strength within its league. */
function expectedPos(c) {
  const L = S.leagues[c.lg];
  return L.clubs.map(id => ({ id, s: clubLevel(C(id)) + C(id).rep * .05 })).sort((a, b) => b.s - a.s).findIndex(x => x.id === c.id) + 1;
}
function expText(p, lgKey) {
  const L = LG[lgKey];
  if (L.tier === 1) return p <= 1 ? "Win the league" : p <= 4 ? "Qualify for the Champions Cup" : p <= 7 ? "Qualify for Europe" : p <= 12 ? "Finish in the top half" : p <= 16 ? "Stay clear of trouble" : "Avoid relegation";
  if (p <= L.up) return "Win automatic promotion";
  if (L.po && p <= L.po.to) return "Reach the play-offs";
  if (p <= L.size / 2) return "Finish in the top half";
  if (p <= L.size - L.down - 3) return "Finish mid-table";
  return "Avoid relegation";
}
