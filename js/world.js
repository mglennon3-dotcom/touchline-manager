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
/* No two players at one club share a name: the name pools are small enough that a quarter of squads had
   a pair of identical names, impossible to tell apart on the squad page. New players get a name nobody
   at their club has; AI clubs don't sign, borrow or offer academy places to a namesake of one of theirs. */
const hasNamesake = (c, name, exceptId) => c.squad.some(id => id !== exceptId && S.players[id] && S.players[id].name === name);
function uniqueNameFor(nat, c) {
  for (let i = 0; i < 40; i++) { const n = nameFor(nat); if (!c || !hasNamesake(c, n)) return n; }
  return nameFor(nat);
}
// Rename the later arrival of each same-name pair at a club (fewest appearances first, so the player with
// the shorter history changes). Used on old saves, and each summer for AI clubs, where a loanee coming
// home can still meet a namesake signed while he was away.
function dedupeNames(c) {
  const seen = new Set(), out = [];
  const ps = c.squad.map(P).filter(Boolean).sort((a, b) => sum(b.hist, h => h[3]) + b.s.app - (sum(a.hist, h => h[3]) + a.s.app) || a.id - b.id);
  for (const p of ps) { if (seen.has(p.name)) { const old = p.name; p.name = uniqueNameFor(p.nat, c); out.push([old, p.name]); } seen.add(p.name); }
  return out;
}

function makePlayer(o) {
  const age = o.age ?? ri(18, 33);
  let ovr = Math.round((o.base ?? 65) + gauss() * 3.4 + (age <= 17 ? -9 : age <= 19 ? -5 : age <= 21 ? -2.5 : age >= 33 ? -2 : 0));
  ovr = clamp(ovr, 33, 90);
  const gap = age <= 17 ? ri(8, 20) : age <= 19 ? ri(5, 16) : age <= 21 ? ri(2, 10) : age <= 24 ? ri(0, 5) : age <= 27 ? ri(0, 2) : 0;
  const p = {
    id: S.nextPid++, name: o.club != null && o.club >= 0 && S.clubs[o.club] ? uniqueNameFor(o.nat, S.clubs[o.club]) : nameFor(o.nat), nat: o.nat, age, pos: o.pos, ovr, pot: clamp(ovr + gap, ovr, 95),
    fit: ri(92, 100), mood: ri(58, 76), pt: .5, wm: 0, amb: +R().toFixed(2), loy: +R().toFixed(2),
    club: o.club ?? -1, wage: 0, yrs: ri(1, 5), am: null, yt: {}, inj: 0, sus: 0, yc: 0,
    s: newStats(), hist: [], req: false, listed: false, promise: null, joined: S.year, loan: null, peak: ovr, tot: [0, 0],
    at: null, retiring: 0, injT: "", ir: clamp(Math.round(10 + gauss() * 3.2), 1, 20),  // injury proneness: hidden, 1 robust – 20 fragile
  };
  p.at = genAttrs(o.pos, r20(ovr)); setOvr(p); p.pot = Math.max(p.pot, p.ovr);
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

/* Squads can be any size, but only 25 seniors (at most 17 not homegrown) can be registered for competitions.
   Under-21s are always eligible. Registration can only change while a transfer window is open. */
const isReg = (p, c) => !isSenior(p) || (c.reg || []).includes(p.id);
const eligibleIds = c => c.squad.filter(id => isReg(P(id), c));
function regInfo(c) {
  const ps = c.squad.map(P), seniors = ps.filter(isSenior), reg = seniors.filter(p => isReg(p, c)), nonHG = reg.filter(p => !isHG(p, c.country));
  const gks = ps.filter(p => p.pos === "GK" && !p.inj && isReg(p, c)).length, eligible = ps.length - seniors.length + reg.length;
  return { seniors: seniors.length, registered: reg.length, unregistered: seniors.length - reg.length, nonHG: nonHG.length, u21: ps.length - seniors.length, gks, total: ps.length, eligible,
    loansIn: ps.filter(p => p.loan).length,
    ok: reg.length <= RULES.squadMax && nonHG.length <= RULES.nonHGMax && eligible >= 16 };
}
/* Register the best seniors, keeping existing registrations when asked (your choices stand; only empty places are filled). */
function autoRegister(c, keep) {
  const seniors = c.squad.map(P).filter(isSenior), ids = new Set(seniors.map(p => p.id));
  const reg = keep ? (c.reg || []).filter(id => ids.has(id)) : [];
  const score = p => p.ovr - (p.inj >= 8 ? 12 : 0) - (p.retiring === 1 ? 2 : 0);
  for (const p of seniors.filter(p => !reg.includes(p.id)).sort((a, b) => score(b) - score(a))) {
    if (reg.length >= RULES.squadMax) break;
    if (!isHG(p, c.country) && reg.filter(id => !isHG(P(id), c.country)).length >= RULES.nonHGMax) continue;
    reg.push(p.id);
  }
  c.reg = reg;
}
/* Called whenever squads change: AI clubs re-pick their best 25 in a window; you keep yours, with empty places filled. */
function refreshRegistration(c) {
  if (!c || c.gone) return;
  if (!windowOpen() && c.reg) { const ids = new Set(c.squad); c.reg = c.reg.filter(id => ids.has(id)); return; }
  autoRegister(c, isUser(c));
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
const eff = (p, slot, fit) => o100(slotRating(p, slot)) * (.6 + .4 * (fit ?? p.fit) / 100) * (.95 + .1 * p.mood / 100);

/* ---------- attributes ---------- */
const round1 = v => Math.round(v * 10) / 10;
const attrKeys = pos => LINE_ATTRS[LINE[pos]];              // the five (three for keepers) you see
const allKeys = pos => pos === "GK" ? GK_KEYS : OUT_KEYS;    // everything he carries
const AWL = Object.fromEntries(Object.entries(AW).map(([r, w]) => [r, Object.entries(w)]));
// A player's rating in a role comes from his attributes; keepers can't play outfield and vice versa.
function roleRating(p, role) {
  if ((role === "GK") !== (p.pos === "GK")) return role === "GK" ? 2 : 4;
  const a = p.at; let v = 0; for (const [k, w] of AWL[role]) v += a[k] * w; return v;
}
// Out of his usual role a player also loses something to unfamiliarity.
const slotRating = (p, slot) => p.pos === slot ? roleRating(p, slot) : roleRating(p, slot) * (FAM[p.pos][slot] >= .9 ? .97 : .9);
function setOvr(p) { p.ovr = clamp(Math.round(o100(roleRating(p, p.pos))), 30, 92); if (p.ovr > (p.peak || 0)) p.peak = p.ovr; }
function genAttrs(pos, rr) {
  const at = {};
  for (const k of allKeys(pos)) at[k] = rr + (AOFF[pos][k] || 0) + gauss() * 1.4;
  fitAttrs(at, pos, rr);
  return at;
}
// Nudge attributes so the position's rating is exactly rr (only `keys` move, if given).
function fitAttrs(at, pos, rr, keys) {
  for (const k of allKeys(pos)) at[k] = clamp(at[k], 1, 20);
  for (let i = 0; i < 4; i++) {
    const ks = (keys || allKeys(pos)).filter(k => at[k] > 1 && at[k] < 20 || i === 0), wsum = ks.reduce((s, k) => s + (AW[pos][k] || 0), 0);
    const cur = AWL[pos].reduce((s, [k, w]) => s + at[k] * w, 0), d = rr - cur;
    if (Math.abs(d) < .02 || !wsum) break;
    for (const k of ks) at[k] = clamp(at[k] + d / wsum, 1, 20);
  }
  for (const k of allKeys(pos)) at[k] = round1(at[k]);
}
function setRating(p, ovr) { p.at = genAttrs(p.pos, r20(ovr)); setOvr(p); }
/* Spread a change of `pts` (100-scale) across attributes so the role rating moves by about that much. */
function shiftAttrs(p, pts, weights) {
  const keys = allKeys(p.pos), w = AW[p.pos], rr = pts / 3;
  const g = Object.fromEntries(keys.map(k => [k, weights(k)]));
  const norm = keys.reduce((s, k) => s + (w[k] || 0) * g[k], 0) || 1;
  for (const k of keys) p.at[k] = clamp(round1(p.at[k] + rr * g[k] / norm), 1, 20);
  setOvr(p);
}
/* Saves from before line attributes had Shooting, Passing, Tackling, Strength and Pace for everyone.
   Keep what carries over (Shooting becomes Finishing), invent the rest in his position's shape, and fit
   the new ones so his rating doesn't move. */
function convertAttrs(p) {
  if (p.pos === "GK" || !p.at || p.at.fin != null) return;
  const old = p.at, rr = r20(p.ovr), at = genAttrs(p.pos, rr);
  Object.assign(at, { fin: old.sho, pas: old.pas, tac: old.tac, str: old.str, pac: old.pac });
  fitAttrs(at, p.pos, rr, ["dri", "hea", "cmp", "vis", "tec", "sta", "mar"]);
  p.at = at; const peak = p.peak; setOvr(p); p.peak = Math.max(peak || 0, p.ovr);
}
const growAttrs = (p, pts) => shiftAttrs(p, pts, k => (AW[p.pos][k] || 0) + R() * .3);
const declineAttrs = (p, pts) => shiftAttrs(p, -pts, k => DECLINE[k] * (.6 + R() * .8));

/* ---------- what you know about a player ---------- */
// Your own players and anyone in your division are known; everyone else needs scouting.
function scoutLevel(p) {
  if (!S || S.club == null) return 2;
  if (p.club === S.club || (p.loan && p.loan.from === S.club)) return 2;
  if (p.club >= 0 && C(p.club).lg === me().lg) return 2;
  return S.scout[p.id] || 0;
}
function seedOf(id, k) { const x = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }
function viewOf(p, v, k, wide) {
  const lvl = scoutLevel(p); if (lvl >= 2) return [Math.round(v), Math.round(v)];
  const w = lvl === 1 ? Math.max(1, 2 * knowWidth(playerCountry(p))) : wide, c = v + (seedOf(p.id, k) - .5) * w;
  return [clamp(Math.round(c - w / 2), 1, 20), clamp(Math.round(c + w / 2), 1, 20)];
}
const ratingView = p => viewOf(p, r20(p.ovr), 1, 5);
const attrView = (p, k) => scoutLevel(p) === 0 ? null : viewOf(p, p.at[k], k.charCodeAt(0) + k.charCodeAt(1), 0);
const ratingMid = p => { const [a, b] = ratingView(p); return (a + b) / 2; };
/* Potential and injury proneness are hidden. Scouts estimate them as a range out of 20:
   a first look gives a wide range, a full report a narrow one, and a better recruiter narrows both. */
function hiddenView(p, val, k) {
  const lvl = scoutLevel(p); if (lvl === 0) return null;
  const rec = S.me ? S.me.rec : 10, kw = (p.club >= 0 && C(p.club).lg === (S.club != null ? me().lg : "")) || p.club === S.club ? 1 : knowWidth(playerCountry(p));
  const w = (lvl >= 2 ? Math.max(1, 5 - rec * .2) : Math.max(3, 9 - rec * .25)) * kw;
  const c = val + (seedOf(p.id, k) - .5) * w * .8;
  return [clamp(Math.round(c - w / 2), 1, 20), clamp(Math.round(c + w / 2), 1, 20)];
}
const potView = p => hiddenView(p, r20(p.pot), 11);
const injView = p => hiddenView(p, p.ir, 13);
const viewMid = v => v ? (v[0] + v[1]) / 2 : 0;
const injMult = p => .45 + .055 * (p.ir || 10);  // 1 → about half the average risk, 20 → about 1.55×

/* ---------- coaches ---------- */
function genCoach(rep, nat) {
  const base = 6 + rep * .09, arch = pick(["bal", "off", "def", "rec", "dev", "bal"]), co = { name: nameFor(nat), nat, arch, form: prefFormation(arch) };
  for (const [k] of COACH_KEYS) co[k] = clamp(Math.round(base + gauss() * 1.6 + (ARCH[arch].key === k ? 3 : arch === "bal" ? 0 : -1)), 1, 20);
  return co;
}
/* Attacking coaches lean to front threes, defensive ones to back fives; everyone else follows the modern mix. */
function prefFormation(arch) {
  const tilt = { off: { "4-3-3": 2, "3-4-3": 2, "4-2-3-1": 1.3, "4-1-2-1-2": 1.5 }, def: { "5-4-1": 2.5, "5-3-2": 2.5, "4-1-4-1": 1.6, "4-4-1-1": 1.4 } }[arch] || {};
  return wpick(FORM_KEYS, f => FORM_WEIGHT[f] * (tilt[f] || 1));
}
function newManager(name, arch, form) {
  const co = { name, arch, nat: "ENG", pts: 0, seasons: 0, form: form || "4-3-3", know: newKnowledge("ENG") };
  for (const [k] of COACH_KEYS) co[k] = arch === "bal" ? 10 : ARCH[arch].key === k ? 14 : 9;
  if (arch !== "bal") co[COACH_KEYS.find(([k]) => k !== ARCH[arch].key)[0]] = 8;  // archetypes trade a point for focus
  return co;
}
const coachOf = c => isUser(c) ? S.me : c.coach;

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
  const used = new Set(xi), rest = eligibleIds(c).map(P).filter(p => avail(p) && !used.has(p.id)).sort((a, b) => b.ovr * b.fit - a.ovr * a.fit);
  const gk = rest.find(p => p.pos === "GK"), out = gk ? [gk] : [];
  for (const p of rest) { if (out.length >= RULES.benchSize) break; if (p !== gk) out.push(p); }
  return out.map(p => p.id);
}
function fixUserLineup() {
  const c = me(), sq = new Set(eligibleIds(c)), seen = new Set();
  const keep = (S.lineup || []).slice(0, 11).map(id => { if (id == null || !sq.has(id) || seen.has(id) || !avail(P(id))) return null; seen.add(id); return id; });
  while (keep.length < 11) keep.push(null);
  S.lineup = autoPick(eligibleIds(c), S.formation, keep);
}
function reshapeUser(f) {
  const xi = S.lineup.filter(id => id != null && avail(P(id))), sl = slotsOf(f), out = Array(11).fill(null), used = new Set();
  sl.forEach((role, i) => { let best = null; for (const id of xi) { const p = P(id); if (used.has(id) || p.pos !== role) continue; if (!best || p.ovr > best.ovr) best = p; } if (best) { out[i] = best.id; used.add(best.id); } });
  S.formation = f; me().formation = f; S.lineup = autoPick(eligibleIds(me()), f, out);
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
    // Youth development, out of 20. Only loosely tied to stature: a lower-division club can run a great academy.
    academy: clamp(Math.round(10 + gauss() * 3.5 + (rep - 50) * .04), 1, 20), formation: null,
    coach: genCoach(rep, K.code), squad: [], cash: 0, revBase: 0, revSeason: 0, fin: null, youthMin: rf(.03, .14), ym: 0, tm: 0, wkMatches: 0, trophies: [], hist: [], schemes: [], gone: false, founded: S.year };
  c.formation = c.coach.form;
  S.clubs.push(c);
  return c;
}
function genSquad(c) {
  const lvl = lvlForRep(c.rep), dom = isForeign(c) ? (c.tier === 1 ? .62 : .8) : c.tier === 1 ? .6 : c.tier <= 3 ? .78 : .9;
  const foreign = ALL_NATS.filter(n => n !== c.country);
  for (const [pos, n] of Object.entries(ROLE_MIX)) for (let i = 0; i < n - (isForeign(c) && c.tier > 1 && i === n - 1 && n > 2 ? 1 : 0); i++) {
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
  // The academy rating drives a graduate's ceiling far more than the club's division does.
  p.pot = clamp(Math.round(o100(5 + c.academy * .55 + gauss() * 2.2) + (lvlForRep(c.rep) - 60) * .25), 38, 92);
  setRating(p, clamp(p.pot - ri(6, 14) - (18 - age) * 3, 33, p.pot));
  p.wage = Math.max(12000, Math.round(wageDemand(p, c.rep) * .6 / 1000) * 1000);
  p.yt[c.country] = Math.max(1, age - 15); p.yrs = ri(2, 3);
  c.squad.push(p.id);
  return p;
}
/* Keep an AI club inside the registration rules by releasing its least valuable surplus. */
function trimSquad(c, atGen) {
  if (isUser(c) && !atGen) return;  // your squad size is your call
  const release = p => { c.squad = c.squad.filter(id => id !== p.id); if (atGen) delete S.players[p.id]; else if (p.loan) endLoan(p); else toFreeAgent(p); };
  let info = regInfo(c), guard = 0;
  // A new world starts with registrable squads: too many foreign seniors become homegrown locals.
  const seniorsNonHG = () => c.squad.map(P).filter(p => isSenior(p) && !isHG(p, c.country));
  while (atGen && seniorsNonHG().length > RULES.nonHGMax && guard++ < 40) { const cand = seniorsNonHG().sort((a, b) => value(a) - value(b))[0]; cand.nat = c.country; cand.name = nameFor(c.country); cand.yt[c.country] = 3; }
  const cap = atGen ? RULES.squadMax : RULES.aiSeniorCap;
  while (info.seniors > cap && guard++ < 80) { const cand = c.squad.map(P).filter(isSenior).sort((a, b) => value(a) - value(b))[0]; release(cand); info = regInfo(c); }
  while (c.squad.length > 34 && guard++ < 120) { const cand = c.squad.map(P).filter(p => !isSenior(p)).sort((a, b) => a.pot - b.pot)[0]; if (!cand) break; release(cand); }
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
  S = { v: 5, year: 2026, phase: "season", week: 0, di: 0, days: [], summerDay: 0, club: null, nextPid: 1, players: {}, clubs: [], fa: [], towns: {},
    leagues: {}, ko: {}, cont: {}, prospects: [], rec: { hours: 0, scoutLvl: 2, offers: 0 }, inbox: [], news: [], nextMsg: 1,
    history: [], career: [], hof: [], scout: {}, me: null, acad20: true, stadiums: true, sponsors: true, dem2: true, reg2: true, board: 60, training: "bal", formation: "4-4-2", mentality: "bal", lineup: [], cases: [], tlog: [],
    set: { live: true }, qual: null, lastPos: {}, sacked: false, _tick: 1 };
  for (const key of Object.keys(LG)) {
    const ids = [];
    for (let i = 0; i < LG[key].size; i++) ids.push(newClub(key, repFor(key, i)).id);
    S.leagues[key] = { key, clubs: ids };
  }
  for (const c of S.clubs) genSquad(c);
  for (const c of S.clubs) autoRegister(c, false);
  ensureRivals();
  for (const c of S.clubs) setupFinances(c);
  for (const c of S.clubs) initStadium(c);
  calibrateSponsors(S.clubs);
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

/* ---------- injuries and retirement ---------- */
function injure(p, minorOnly) {
  const r = minorOnly ? R() * .7 : R();
  const [, lo, hi, kinds] = INJURIES.find(x => r < x[0]);
  const what = pick(kinds), c = p.club >= 0 ? C(p.club) : null, mine = c && (isUser(c) || (p.loan && p.loan.from === S.club));
  if (!hi) {  // career-ending
    if (mine) news(`${p.name} has suffered a ${what}. At ${p.age}, he has been forced to retire.`, true, "squad");
    else if (c && !isForeign(c) && p.ovr >= 70) news(`${c.name}'s ${p.name} is forced to retire after a ${what}.`, false, "squad");
    retireNow(p); return;
  }
  p.inj = Math.max(p.inj, ri(lo, hi)); p.injT = what;
  if (lo >= 8) p.ir = Math.min(20, p.ir + 1);  // serious injuries leave a player more prone to the next one
  if (lo >= 30) { p.at[p.pos === "GK" ? "ss" : "pac"] = Math.max(1, p.at[p.pos === "GK" ? "ss" : "pac"] - 1); setOvr(p); }
  if (mine) news(`${p.name} has a ${what} and will be out for ${injLength(p.inj)}${lo >= 30 ? ". His season is over" : ""}.`, lo >= 8, "squad");
}
const injLength = w => w >= 30 ? "the rest of the season" : w >= 8 ? `about ${Math.round(w / 4.3)} months` : `${w} week${w > 1 ? "s" : ""}`;
function retireNow(p) {
  const c = p.club >= 0 ? C(p.club) : null;
  if (c) { c.squad = c.squad.filter(id => id !== p.id); if (isUser(c)) S.lineup = S.lineup.map(id => id === p.id ? null : id); }
  retirePlayer(p); bumpTick();
}
/* Each summer, players over 30 decide whether this will be their last season. Half say so up front; the rest surprise you. */
function planRetirements() {
  for (const p of Object.values(S.players)) {
    if (p.age < 30 || p.retiring) continue;
    const base = p.age >= 40 ? 1 : RETIRE_AGE[p.age] || 0;
    const ch = base * clamp(1.25 - (p.ovr - 55) / 80, .6, 1.5) * (p.pos === "GK" ? .7 : 1) * (p.club < 0 ? 1.8 : 1);
    if (R() >= ch) continue;
    p.retiring = R() < .5 ? 1 : 2;
    const c = p.club >= 0 ? C(p.club) : null;
    if (p.retiring === 1 && c && isUser(c)) news(`${p.name} tells you this will be his last season. He retires in the summer, aged ${p.age + 1}.`, true, "squad");
    else if (p.retiring === 1 && c && !isForeign(c) && p.ovr >= 75) news(`${c.name}'s ${p.name} announces he will retire at the end of the season.`, false, "squad");
  }
}

/* ---------- your coach's knowledge of each country ---------- */
// Out of 20. High knowledge makes scouting there cheaper in hours, sharper, and (from 15) a full report in one trip.
// Scouting abroad also costs more hours and travel money.
const KNOW_KEYS = ["ENG", "ESP", "GER", "ITA", "FRA", "POR", "NED", "BEL", "ROW"];
const KNOW_NAME = code => code === "ROW" ? "Rest of the world" : COUNTRY[code].name;
function newKnowledge(home) {
  const k = {}; for (const c of KNOW_KEYS) k[c] = c === home ? ri(12, 15) : ri(3, 8);
  k[pick(KNOW_KEYS.filter(c => c !== home))] = ri(10, 13);  // every coach has one foreign speciality
  return k;
}
const knowOf = code => (S.me && S.me.know ? S.me.know[code] : 10) ?? 8;
const playerCountry = p => p.club >= 0 ? C(p.club).country : (COUNTRY[p.nat] ? p.nat : "ROW");
const prospectCountry = y => y.country || "ROW";
const knowWidth = code => clamp(1.3 - knowOf(code) / 25, .5, 1.3);  // how much wider (or narrower) reports are
function scoutHours(base, code) { return Math.max(1, Math.round(base * (code !== "ENG" ? 1.5 : 1) * (1.5 - knowOf(code) / 20))); }
function travelCost(code) { return code === "ENG" ? 0 : Math.round([0, 6e4, 3e4, 1.5e4, 8e3, 5e3, 5e3][me().tier] * (code === "ROW" ? 2 : 1)); }
function learnCountry(code, amt = .25) { if (S.me && S.me.know) S.me.know[code] = Math.min(20, Math.round((knowOf(code) + amt) * 100) / 100); }
function payTravel(code) { const t = travelCost(code); if (t) { me().cash -= t; me().fin.scouting = (me().fin.scouting || 0) + t; } return t; }
