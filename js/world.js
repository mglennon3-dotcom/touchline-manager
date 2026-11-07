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
// Pitch labels: the surname, with an initial when another player in the same XI shares it.
const pitchName = (p, xi) => xi.some(q => q && q !== p && sur(q) === sur(p)) ? p.name[0] + ". " + sur(p) : sur(p);
const activeClubs = () => S.clubs.filter(c => !c.gone);

function newStats() { return { app: 0, min: 0, g: 0, lg: 0, a: 0, yc: 0, rc: 0, rt: 0, cs: 0 }; }  // sh, sot, xg, kp, xa, sv are added by applyMatch when first non-zero: as zeros on every player they cost 650 KB of save
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

/* Growth speed: how quickly a player closes on his potential, never shown. 10 is the old rate; 1 develops at
   55% of it and 20 at 150%, so two players with the same potential can be years apart in reaching it. */
const newGrowthSpeed = () => clamp(Math.round(10 + gauss() * 3.2), 1, 20);
const gsMult = p => .5 + (p.gs ?? 10) / 20;
/* Your youth coaches' rough read on growth speed, for your own players 23 and under once they've watched him
   for 30 weeks (p.seen, counted weekly). The estimate is off by up to ±2 at Development 10, ±1 at 20, and
   stays the same for a given player, so it doesn't flicker. */
const GS_SEEN = 30;
function gsHint(p) {
  if (!S.me || p.club !== S.club || p.age > 23) return null;
  if ((p.seen || 0) < GS_SEEN) return ["Too early to tell", "muted"];
  const w = Math.max(2, 6 - S.me.dev * .2), est = (p.gs ?? 10) + (seedOf(p.id, 17) - .5) * w;
  return est >= 15 ? ["Picks things up very quickly", "good"] : est >= 12 ? ["A quick learner", "good"] : est > 8 ? ["Developing at a normal pace", ""] : est > 5 ? ["A late developer: be patient", "warn"] : ["Slow to develop", "bad"];
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
    gs: newGrowthSpeed(),  // growth speed: hidden, 1 slow – 20 quick (see gsMult)
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
// Wages follow what he can do now more than what he might become: half the potential premium that baseValue gives
// an under-24's transfer value (the full premium priced teenagers' wages like established stars').
function wageDemand(p, rep) { const prem = p.age < 24 ? (1 + (p.pot - p.ovr) * .0225) / (1 + (p.pot - p.ovr) * .045) : 1; return Math.max(15000, Math.round(baseValue(p) * prem * .16 * (.75 + rep / 200) / 1000) * 1000); }
/* A new deal at his own club: his market wage, but a player content enough to stay doesn't ask for more than
   double what he earns now or 20% over the club's top earner, whichever is higher (never less than he's on).
   Without it a youngster who'd jumped three points in a season asked five times his wage, far above anyone at a
   small club. */
function renewWage(p, c, mult = 1) {
  const top = Math.max(0, ...c.squad.filter(id => id !== p.id).map(id => P(id).wage));
  const cap = Math.max(p.wage * 2, top * 1.2);
  return Math.max(p.wage, Math.round(Math.min(wageDemand(p, c.rep) * mult, cap) / 1000) * 1000);
}
const isHG = (p, country) => (p.yt[country] || 0) >= RULES.hgYears;
// Academy players never need registering, whatever their age (they move up at 21, at the season's end).
const isSenior = p => p.age >= 21 && !p.acad;

/* Squads can be any size, but only 25 seniors (at most 17 not homegrown) can be registered for competitions.
   Under-21s are always eligible. Registration can only change while a transfer window is open. */
const isReg = (p, c) => !isSenior(p) || (c.reg || []).includes(p.id);
/* Your academy (p.acad): youth players kept apart from the first team. They aren't picked for senior matches
   unless you include them (S.set.acadSel), and they play their own unofficial matches (academyWeek). */
const ACAD_MAX_AGE = 20;
// S.acadPick: academy players a high-potential pick brought in for selection, without the general switch.
const acadOut = (p, c) => p.acad && isUser(c) && !(S.set && S.set.acadSel) && !(S.acadPick || []).includes(p.id);
const eligibleIds = c => c.squad.filter(id => isReg(P(id), c) && !acadOut(P(id), c));
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
  // A whole-number band is slid inside 1-20 rather than clipped, so a 19 still shows the full band (13-20, not 16-20)
  // and the true value stays inside it.
  if (lvl === 0 && Number.isInteger(w)) { const lo = clamp(Math.round(c - w / 2), 1, 20 - w); return [lo, lo + w]; }
  return [clamp(Math.round(c - w / 2), 1, 20), clamp(Math.round(c + w / 2), 1, 20)];
}
/* Before any scouting, every player still has rough bands for his rating and potential: what reputation, press and
   word of mouth tell you. How much you get follows your knowledge of his country, relative to your own spread
   (knowGap: 0 in your best-known country, 1 in your least known):
   - band width: 5 in your best-known country (e.g. 11-16), 6 in your least known (e.g. 9-15), in between elsewhere;
   - in your least-known country one of the two (rating or potential, fixed per player) is blank; elsewhere the
     chance of a blank falls with the gap, to none in your best-known country.
   Scouting fills both in and tightens them (partial report: narrower; full: exact rating, tight potential).
   The rating was "?" in 5.41-5.42, which made the world feel blank; 5.43 gave a rating band only (4-7 wide). */
function knowGap(p) {
  const ks = KNOW_KEYS.map(knowOf), lo = Math.min(...ks), hi = Math.max(...ks), k = knowOf(playerCountry(p));
  return hi > lo ? clamp((hi - k) / (hi - lo), 0, 1) : clamp(1 - k / 20, 0, 1);
}
const unscoutedWidth = p => Math.round(5 + knowGap(p));  // 4 in the best-known country (5.44) was too precise for word of mouth
// "ovr", "pot" or null: which band an unscouted player is missing.
const unscoutedBlank = p => scoutLevel(p) > 0 || seedOf(p.id, 21) >= knowGap(p) ? null : seedOf(p.id, 22) < .5 ? "ovr" : "pot";
const ratingBlank = p => unscoutedBlank(p) === "ovr";
// ratingView is also the scouts' private estimate (the scouting assistant ranks targets by it), so it exists even
// when the rating is blank to you; the display, sorting and filters check ratingBlank.
const ratingView = p => viewOf(p, r20(p.ovr), 1, scoutLevel(p) === 0 ? unscoutedWidth(p) : 0);
const attrView = (p, k) => scoutLevel(p) === 0 ? null : viewOf(p, p.at[k], k.charCodeAt(0) + k.charCodeAt(1), 0);
const ratingMid = p => { const [a, b] = ratingView(p); return (a + b) / 2; };
// Sorting and filtering use the middle of what you can see, never the true rating, so a band gives nothing away
// beyond the band itself; a blank rating sorts last.
const ratingSort = p => ratingBlank(p) ? -1 : ratingMid(p);
/* Potential and injury proneness are hidden. Scouts estimate them as a range out of 20:
   a first look gives a wide range, a full report a narrow one, and a better recruiter narrows both.
   Unscouted, potential gets the same band as the rating (above); injury risk stays unknown. */
function hiddenView(p, val, k) {
  const lvl = scoutLevel(p);
  if (lvl === 0) {
    if (k !== 11 || unscoutedBlank(p) === "pot") return null;
    const w = unscoutedWidth(p), lo = clamp(Math.round(val - w / 2 + (seedOf(p.id, k) - .5) * w), 1, 20 - w); return [lo, lo + w];
  }
  const rec = S.me ? S.me.rec : 10, kw = (p.club >= 0 && C(p.club).lg === (S.club != null ? me().lg : "")) || p.club === S.club ? 1 : knowWidth(playerCountry(p));
  let w = (lvl >= 2 ? Math.max(1, 5 - rec * .2) : Math.max(3, 9 - rec * .25)) * kw;
  // A first look never leaves the potential wider than the unscouted band it replaces.
  if (lvl === 1 && k === 11) w = Math.min(w, unscoutedWidth(p) - 1);
  const c = val + (seedOf(p.id, k) - .5) * w * .8;
  return [clamp(Math.round(c - w / 2), 1, 20), clamp(Math.round(c + w / 2), 1, 20)];
}
/* AI clubs see what you see, by the same rules. Each keeps its own country knowledge (c.know, drawn like yours: its
   home country best, one foreign speciality) and its own scouting reports (c.sc, player id -> 0-2, as S.scout).
   Its own division is exact; a full report is exact; a first look is a narrow band; anyone else is the middle of a
   band 5-6 wide by its knowledge gap, blank for a share of players exactly as yours are. Each club's bands are
   seeded by club, so rivals misjudge different players. Until 5.46 AI clubs used true ratings. Returns the 100
   scale, or null when the rating is blank to it. */
function aiRating(p, c) {
  if (p.club === c.id || (p.club >= 0 && C(p.club).lg === c.lg)) return p.ovr;
  const lvl = (c.sc || {})[p.id] || 0; if (lvl >= 2) return p.ovr;
  const code = playerCountry(p), k = p.id * 7919 + c.id * 104729, v = r20(p.ovr);
  if (lvl === 1) { const w = Math.max(1, 2 * clamp(1.3 - knowOf(code, c) / 25, .5, 1.3)); return o100(clamp(v + (seedOf(k, 2) - .5) * w, 1, 20)); }
  const ks = KNOW_KEYS.map(x => knowOf(x, c)), lo = Math.min(...ks), hi = Math.max(...ks), kn = knowOf(code, c);
  const gap = hi > lo ? clamp((hi - kn) / (hi - lo), 0, 1) : clamp(1 - kn / 20, 0, 1);
  if (seedOf(k, 21) < gap && seedOf(k, 22) < .5) return null;
  const w = Math.round(5 + gap), b = clamp(Math.round(v - w / 2 + (seedOf(k, 1) - .5) * w), 1, 20 - w);
  return o100(b + w / 2);
}
/* An AI club's weekly scouting hours, by your formula (recHours): its network level and its manager's
   Recruitment. The level follows the money, as yours would: 2 as standard (your default), 3 when it has cash to
   spare, 1 when it's over the cost-ratio line. */
function aiScoutSetup(c) {
  if (!c.know) c.know = newKnowledge(c.country);
  if (!c.sc) c.sc = {};
  c.scLvl = scr(c) > RULES.scrLimit ? 1 : c.cash > c.revBase * .6 ? 3 : 2;
  c.hrs = Math.max(4, 8 + 3 * c.scLvl + Math.round((((c.coach || {}).rec || 10) - 10) * .6));
}
/* One look, at your price: the same hours (scoutHours), travel cost and knowledge gained as scoutPlayer. */
function aiScout(c, p) {
  const code = playerCountry(p), h = scoutHours(2, code, c); if (c.hrs < h) return false;
  const t = travelCost(code, c);
  // Travel is budgeted: at most 3% of a year's base income a season, and never from a thin balance. Uncapped, clubs
  // scouting abroad every week spent more on trips than a small club earns, and median AI cash fell 40% in a season.
  if (t && (((c.fin || {}).scouting || 0) + t > c.revBase * .03 || c.cash < t * 10)) return false;
  c.hrs -= h; if (t) { c.cash -= t; if (c.fin) c.fin.scouting = (c.fin.scouting || 0) + t; }
  c.know[code] = Math.min(20, Math.round((knowOf(code, c) + .25) * 100) / 100);
  c.sc[p.id] = Math.min(2, (c.sc[p.id] || 0) + (knowOf(code, c) >= 15 ? 2 : 1));
  const ks = Object.keys(c.sc); if (ks.length > 100) delete c.sc[ks[0]];  // drops the lowest id, not the oldest; capped so 200-odd clubs don't bloat the save
  return true;
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

/* Picking an XI maximises the side's total rating, with each player scored by eff() in the slot he'd play:
   slotRating() already prices in playing out of position, so a midfielder whose tackling and heading make
   him a better centre-back than the club's actual centre-backs gets picked there. The old picker filled
   natural positions first and never moved anyone, so a strong squad player sat out while a weak specialist
   started. Greedy on the best player-slot pairs, then swaps and bench replacements until nothing improves.
   Keepers stay in goal and outfielders out of it unless there is no other way to fill the slot. */
function optimisePick(pool, sl, out, score) {
  const fixedI = new Set(out.map((x, i) => x != null ? i : -1).filter(i => i >= 0)), used = new Set(out.filter(x => x != null));
  const sc = (p, role) => score(p, role) - ((role === "GK") !== (p.pos === "GK") ? 1000 : 0);
  const pairs = [];
  for (const p of pool) if (!used.has(p.id)) sl.forEach((role, i) => { if (!fixedI.has(i)) pairs.push([sc(p, role), p, i]); });
  pairs.sort((a, b) => b[0] - a[0]);
  for (const [, p, i] of pairs) if (out[i] == null && !used.has(p.id)) { out[i] = p.id; used.add(p.id); }
  const free = sl.map((_, i) => i).filter(i => !fixedI.has(i) && out[i] != null);
  for (let pass = 0, better = true; better && pass < 6; pass++) {
    better = false;
    for (const a of free) for (const b of free) {
      if (b <= a) continue; const pa = P(out[a]), pb = P(out[b]);
      if (sc(pa, sl[b]) + sc(pb, sl[a]) > sc(pa, sl[a]) + sc(pb, sl[b]) + 1e-9) { out[a] = pb.id; out[b] = pa.id; better = true; }
    }
    for (const a of free) for (const q of pool) {
      if (used.has(q.id)) continue; const pa = P(out[a]);
      if (sc(q, sl[a]) > sc(pa, sl[a]) + 1e-9) { used.delete(pa.id); used.add(q.id); out[a] = q.id; better = true; }
    }
  }
  return out;
}
function autoPick(ids, f, fixed) {
  return optimisePick(ids.map(P).filter(avail), slotsOf(f), fixed ? fixed.slice() : Array(11).fill(null), eff);
}
/* A high-potential side: the strongest XI once players 23 and under get credit for their room to grow, up to
   about 4 points on the 20 scale for a teenager far below his ceiling (so a promising 19-year-old beats a
   somewhat better veteran, not a far better one). A gentler first version (up to 2) changed no one at most clubs. Academy players rated Ready to start can play, those rated
   Ready can be substitutes; the bench takes them and other high-potential youngsters first. */
const youthBonus = p => p.age <= 23 ? Math.min(10, Math.max(0, p.pot - p.ovr) * .5) + (p.age <= 20 ? 2 : 0) : 0;
function potentialPick(c) {
  const acad = c.squad.map(P).filter(p => p.acad && avail(p) && !p.loan).map(p => [p, acadReadiness(p, c)[0]]);
  const starters = acad.filter(([, r]) => r === "Ready to start").map(([p]) => p.id), benchers = acad.filter(([, r]) => r === "Ready").map(([p]) => p.id);
  S.acadPick = [...starters, ...benchers];
  const pool = eligibleIds(c).filter(id => !P(id).acad || starters.includes(id) || (S.set && S.set.acadSel)).map(P).filter(avail);
  S.lineup = optimisePick(pool, slotsOf(S.formation), Array(11).fill(null), (p, role) => eff(p, role) + youthBonus(p));
  const xi = new Set(S.lineup);
  S.bench = eligibleIds(c).map(P).filter(p => !xi.has(p.id) && avail(p) && (S.acadPick.includes(p.id) || (p.age <= 23 && p.pot - p.ovr >= 8)))
    .sort((a, b) => b.pot - a.pot).slice(0, 5).map(p => p.id);
  S.benchNo = [];
  return { acadXI: S.lineup.filter(id => id != null && P(id).acad).length, acadBench: S.bench.filter(id => P(id).acad).length };
}
/* A fresh XI: the same optimiser, but anyone under 80% fitness counts only once every fresher option is used
   (including moving a fresh player out of position). "Pick best XI" weighs fitness lightly: a player at 60%
   keeps 84% of his strength, so tired regulars kept being picked. */
const FRESH_FIT = 85;  // was 80; at 80 a side could start at "amber" fitness, which isn't fresh
function freshPick(ids, f) {
  return optimisePick(ids.map(P).filter(avail), slotsOf(f), Array(11).fill(null), (p, role) => eff(p, role) - (p.fit < FRESH_FIT ? 500 : 0));
}
/* The nine substitutes. Yours are the ones you picked on the Tactics page (S.bench), still eligible,
   available and not in the XI; any spots left are filled as for AI clubs: a keeper, then the best and
   fittest. */
function benchFor(c, xi) {
  const used = new Set(xi), elig = new Set(eligibleIds(c));
  const mine = isUser(c) && S.bench ? S.bench.filter(id => elig.has(id) && !used.has(id) && S.players[id] && avail(P(id))).slice(0, RULES.benchSize) : [];
  mine.forEach(id => used.add(id));
  const no = new Set(isUser(c) ? S.benchNo || [] : []);  // subs you've dropped aren't brought back automatically
  // You can switch off the automatic substitute keeper (S.set.benchGK false): the fill then skips keepers
  // altogether, though you can still pick one yourself.
  const noGK = isUser(c) && S.set && S.set.benchGK === false;
  const rest = [...elig].map(P).filter(p => avail(p) && !used.has(p.id) && !no.has(p.id) && !(noGK && p.pos === "GK")).sort((a, b) => b.ovr * b.fit - a.ovr * a.fit);
  const out = [], gk = noGK || mine.some(id => P(id).pos === "GK") ? null : rest.find(p => p.pos === "GK");
  if (gk && mine.length < RULES.benchSize) out.push(gk);
  // One keeper on the bench is enough: the fill adds no more once there is one (you can still pick a second).
  const haveGK = () => gk || mine.some(id => P(id).pos === "GK");
  for (const p of rest) { if (mine.length + out.length >= RULES.benchSize) break; if (p !== gk && !(p.pos === "GK" && isUser(c) && haveGK())) out.push(p); }
  return [...mine, ...out.map(p => p.id)];
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
/* Ratings of established players (22-32, at a club), refreshed once a season: the shape graduates' potential is
   drawn from. null while the world is still being built. */
let SKILL = null;
function skillSample() {
  if (SKILL && SKILL.y === S.year && SKILL.s === S) return SKILL.a;
  const a = []; for (const p of Object.values(S.players)) if (p.club >= 0 && p.age >= 22 && p.age <= 32) a.push(p.ovr);
  if (a.length < 2000) return null;  // world not built yet: the old academy-centred draw
  SKILL = { y: S.year, s: S, a }; return a;
}
function academyPlayer(c, age) {
  const p = makePlayer({ pos: pick(["CB", "FB", "DM", "CM", "AM", "W", "ST", "CB", "GK"]), base: 50, age, nat: c.country, club: c.id, rep: c.rep });
  // Graduates are chance, shaped like the game itself: potential is the rating of a random established player
  // (skillSample), so stars are as rare among graduates as among pros, whatever the club or its academy (Youth
  // development still sets how fast they improve). History: centred on the academy rating (+- 2.2, then 3.2), then
  // uniform 3-20 in 5.52.0, which made one graduate in 17 a potential 19-20 at every club.
  const sk = skillSample();
  p.pot = clamp(Math.round(sk ? pick(sk) + gauss() * 1.5 : o100(5 + c.academy * .55 + gauss() * 2.2)), 33, 95);
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
  p.club = -1; p.am = null; p.req = false; p.listed = false; p.promise = null; p.yrs = 0; p.loan = null; p.faY = S.year;  // when he went free (FA_YEARS)
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
// c: an AI club, which keeps its own knowledge (c.know) on the same scale as yours; omitted, it's you.
const knowOf = (code, c) => c && !isUser(c) ? (c.know || {})[code] ?? 8 : (S.me && S.me.know ? S.me.know[code] : 10) ?? 8;
const playerCountry = p => p.club >= 0 ? C(p.club).country : (COUNTRY[p.nat] ? p.nat : "ROW");
const prospectCountry = y => y.country || "ROW";
const knowWidth = code => clamp(1.3 - knowOf(code) / 25, .5, 1.3);  // how much wider (or narrower) reports are
function scoutHours(base, code, c) { return Math.max(1, Math.round(base * (code !== (c ? c.country : "ENG") ? 1.5 : 1) * (1.5 - knowOf(code, c) / 20))); }
function travelCost(code, c = me()) { return code === c.country ? 0 : Math.round([0, 6e4, 3e4, 1.5e4, 8e3, 5e3, 5e3][c.tier] * (code === "ROW" ? 2 : 1)); }
function learnCountry(code, amt = .25) { if (S.me && S.me.know) S.me.know[code] = Math.min(20, Math.round((knowOf(code) + amt) * 100) / 100); }
function payTravel(code) { const t = travelCost(code); if (t) { me().cash -= t; me().fin.scouting = (me().fin.scouting || 0) + t; } return t; }

/* ---------- team needs: your XI's attribute profile ----------
   (Positions are assessed by teamNeeds() in ui.js, against the division's top four and its average.)
   The XI's attributes against the division's average XI, and what stands out or lags against the rest
   of your own side: a good side is above average almost everywhere, so "better than the division"
   alone names everything. */
const NEED_ATTRS = [["Finishing", ["fin", "cmp"]], ["Creativity", ["pas", "vis", "tec"]], ["Dribbling", ["dri"]], ["Defending", ["tac", "mar"]], ["Aerial", ["hea"]], ["Pace", ["pac"]], ["Stamina", ["sta"]], ["Physical strength", ["str"]]];
const avgOf = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function divisionAttrs(lg) {
  const key = lg + ":" + S._tick; if (S._battrs && S._battrs.k === key) return S._battrs.v;
  const xis = S.leagues[lg].clubs.map(C).map(c => autoPick(eligibleIds(c), c.formation).filter(x => x != null).map(P).filter(p => p.pos !== "GK")), v = {};
  for (const [l, ks] of NEED_ATTRS) v[l] = avgOf(xis.map(xi => avgOf(xi.map(p => avgOf(ks.map(k => p.at[k]))))));
  S._battrs = { k: key, v }; return v;
}
function xiProfile(c) {
  fixUserLineup();
  const B = divisionAttrs(c.lg), xi = S.lineup.map(id => S.players[id]).filter(p => p && p.pos !== "GK");
  const attrs = NEED_ATTRS.map(([l, ks]) => { const v = avgOf(xi.map(p => avgOf(ks.map(k => p.at[k])))); return { l, v, bench: B[l], diff: v - B[l] }; });
  const mean = avgOf(attrs.map(a => a.diff)); for (const a of attrs) a.rel = a.diff - mean;
  return { attrs, mean, standout: attrs.filter(a => a.rel >= .4).sort((a, b) => b.rel - a.rel).slice(0, 2), lacking: attrs.filter(a => a.rel <= -.4).sort((a, b) => a.rel - b.rel).slice(0, 2) };
}
