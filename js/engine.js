"use strict";
/* Minute-by-minute match engine. */
/* How well a style suits the players on the pitch, in attribute points: the average amount by which the
   style's key attributes beat what's typical for each player's position and rating. 0 is an ordinary XI;
   a side of quick forwards scores well for counter-attacking, an ageing one badly. */
const DOFF = Object.fromEntries(Object.entries(AW).map(([pos, w]) => [pos, -Object.entries(w).reduce((s, [k, x]) => s + x * (AOFF[pos][k] || 0), 0)]));
function styleFit(on, ment) {
  const keys = STYLE_KEYS[ment]; if (!keys || !keys.length) return 0;
  let t = 0, n = 0;
  for (const o of on) { const p = o.p; if (p.pos === "GK") continue; const base = r20(p.ovr) + DOFF[p.pos];
    for (const k of keys) { t += p.at[k] - base - (AOFF[p.pos][k] || 0); n++; } }
  return n ? t / n : 0;
}
/* Fit decides whether a style's benefits arrive at all. A poor fit shrinks the upside toward nothing and
   enlarges the costs; a good one does the reverse. On top of that a side that can't play its style gets
   exposed (see MENT.expose): poor passers trying to keep the ball give it away where it hurts. Before this,
   a bad passing side playing possession lost only its bonus and finished level with playing neutral. */
const fitScale = fit => [clamp(1 + fit * .75, -.5, 1.6), clamp(1 - fit * .6, .5, 1.8)];  // [benefit, cost]
const bend = (m, F) => m >= 1 ? 1 + (m - 1) * F[0] : 1 + (m - 1) * F[1];
function sideRatings(on, ment, form, co, fitIn) {
  const N = FNORM[form];
  let a = 0, m = 0, d = 0;
  for (const o of on) { const e = eff(o.p, o.slot, o.fit), w = WT[o.slot]; a += e * w[0]; m += e * w[1]; d += e * w[2]; }
  const fit = fitIn ?? styleFit(on, ment), F = fitScale(fit);
  const k = MENT[ment].m.map(x => bend(x, F)), ca = co ? 1 + (co.off - 10) * .008 : 1, cd = co ? 1 + (co.def - 10) * .008 : 1, pf = co && co.form === form ? FORM_PREF_BONUS : 1;
  return { att: a / N[0] * k[0] * ca * pf, mid: m / N[1] * k[1] * pf, def: d / N[2] * k[2] * cd * pf, fit, F };
}
/* Every club has a usual style, set by its coach: attacking coaches attack, organisers sit deeper, and the
   rest lean toward possession, neutral or counter-attacking football. */
function baseStyle(c) {
  if (isUser(c)) return S.mentality;
  return clubStyles(c).base;
}
/* A club's usual style and how well each style suits its squad, worked out once a week (the XI doesn't
   change faster than that). Coaches with a strong leaning attack or sit deep, unless the squad plainly
   can't play that way; the rest play to their squad: possession with good passers, counters with quick
   forwards. */
function clubStyles(c) {
  const key = S.year * 100 + S.week;
  if (c._sty && c._sty[0] === key && typeof c._sty[1] === "object") return c._sty[1];  // 5.12.1 cached a bare string here
  const co = coachOf(c), t = co.off - co.def + (co.arch === "off" ? 2 : co.arch === "def" ? -2 : 0);
  const f = c.formation, sl = slotsOf(f), on = autoPick(eligibleIds(c), f).map((id, i) => id == null ? null : { p: P(id), slot: sl[i] }).filter(Boolean);
  const fits = Object.fromEntries(Object.keys(MENT).map(st => [st, styleFit(on, st)]));
  let base;
  if (t >= 5) base = fits.att > -.25 ? "att" : "bal";
  else if (t <= -5) base = fits.def > -.25 ? "def" : "bal";
  else { const lean = ["pos", "bal", "ctr", "bal"][(c.id + co.name.length) % 4], best = ["pos", "bal", "ctr"].reduce((a, b) => fits[b] > fits[a] ? b : a);
    base = fits[best] - fits[lean] > .15 || fits[lean] < -.25 ? best : lean; }
  const r = { base, fits }; c._sty = [key, r]; return r;
}
// Step from ag toward toAg until the style is one the players can manage.
function playable(fitOf, ag, toAg) {
  while (ag !== toAg && fitOf(STYLE_BY_AG[ag]) < -.25) ag += ag > toAg ? -1 : 1;
  return ag;
}
// The user's XI as on-pitch entries, for showing how each style suits it.
function userOn() { fixUserLineup(); const sl = slotsOf(S.formation); return S.lineup.map((id, i) => id == null ? null : { p: P(id), slot: sl[i] }).filter(Boolean); }
const FIT_WORDS = [[.35, "Great fit", "good"], [.12, "Good fit", "good"], [-.12, "Average fit", "muted"], [-.35, "Poor fit", "warn"], [-99, "Very poor fit", "bad"]];
const fitWord = f => FIT_WORDS.find(([t]) => f >= t);
// For one match the AI shifts its usual style: further forward against weaker sides, deeper against stronger.
function aiStyle(c, opp, home) {
  const { base, fits } = clubStyles(c), d = clubLevel(c) - clubLevel(opp) + (home ? 1.5 : -1.5);
  const shift = d >= 9 ? 2 : d >= 4 ? 1 : d <= -9 ? -2 : d <= -4 ? -1 : 0;
  return shift ? STYLE_BY_AG[playable(st => fits[st], clamp(MENT[base].ag + shift, -3, 3), MENT[base].ag)] : base;
}
/* In-game: chase a deficit, protect a lead, push late when a draw is no use. Checked every five minutes
   after the hour for AI sides, and for yours when the match is simulated and the assistant is allowed to. */
function adaptStyle(M, k) {
  const s = k ? M.a : M.h, o = k ? M.h : M.a, ko = M.fx.ko, base = s.base;
  if (!s.auto || (isUser(C(s.club)) && S.set.autoStyle === false)) return;
  const own = s.goals + (ko ? (k ? ko.aggA : ko.aggH) : 0), opp = o.goals + (ko ? (k ? ko.aggH : ko.aggA) : 0), diff = own - opp, mn = M.min, b = MENT[base].ag;
  // A side behind only gets bolder and a side ahead only gets more careful, so a second goal doesn't
  // send a team that had dug in back out to play.
  const cur = MENT[s.ment].ag;
  let ag = b;
  if (diff <= -2) ag = 3;
  else if (diff === -1) ag = Math.max(cur, b, mn >= 75 ? 3 : 2);
  else if (diff === 0) ag = (ko || M.fx.needWinner) && mn >= 80 ? Math.max(b, 2) : b;
  else if (diff === 1) ag = Math.min(cur, b, mn >= 80 ? -2 : mn >= 70 ? -1 : b);
  else ag = Math.min(cur, b, mn >= 70 ? -1 : b);
  const st = STYLE_BY_AG[playable(x => styleFit(s.on, x), ag, b)];
  if (st !== s.ment) { s.ment = st; s.rt = null; s.changes = (s.changes || 0) + 1; lg(M, "tac", k, `${C(s.club).name} switch to ${MENT[st].l.toLowerCase()}.`); }
}

function makeSide(c, opp, home, auto) {
  let xi, f, ment;
  if (isUser(c)) { fixUserLineup(); xi = S.lineup; f = S.formation; ment = S.mentality; }
  else { f = c.formation; xi = autoPick(eligibleIds(c), f); ment = aiStyle(c, opp, home); auto = true; }
  const tk = isUser(c) && TACKLE[S.tackling] ? S.tackling : "normal";  // AI sides tackle normally
  const sl = slotsOf(f);
  // si is the formation slot a player stands in; the on list itself shrinks with red cards, so it can't be the index.
  const on = xi.map((id, i) => id == null ? null : { p: P(id), slot: sl[i], si: i, fit: P(id).fit, from: 0 }).filter(Boolean);
  const bench = benchFor(c, xi.filter(x => x != null));
  return { club: c.id, form: f, ment, base: ment, tk, auto, on, co: coachOf(c), bench, used: on.map(o => o.p.id), subs: 0, goals: 0, shots: 0, sot: 0, poss: 0, xg: 0, big: 0, hdr: 0, sav: 0, yel: {}, mins: {}, rt: null,
    susSnap: c.squad.filter(id => P(id).sus > 0) };
}
/* fx: { comp, neutral, ko: {aggH, aggA} | null, needWinner } */
function makeMatch(fx, userAuto) {
  const H = C(fx.h), A = C(fx.a);
  const M = { fx, h: makeSide(H, A, !fx.neutral, userAuto), a: makeSide(A, H, false, userAuto), min: 0, end: 90, et: false, pens: null,
    log: [], goals: [], inj: [], reds: [], cards: [], bk: [], ps: {}, fit: {}, done: false, riv: rivalry(fx.h, fx.a) };
  if (isUser(H) || isUser(A)) { const u = isUser(H) ? M.h : M.a; u.auto = !!userAuto; }
  return M;
}
const lg = (M, type, side, text) => M.log.push({ m: M.min, type, side, text });
const T_HEAD = ["{s} heads in at the near post", "{s} glances a header into the far corner", "{s} rises highest and powers a header home", "{s} nods in from close range"];
const T_GOAL = ["{s} fires low into the corner", "{s} slots it past the keeper", "{s} curls one in from the edge of the box", "{s} taps in at the back post", "{s} lashes in a half-volley", "{s} converts from the penalty spot", "{s} rounds the keeper and scores"];
const T_SAVE = ["{k} gets down well to keep out {s}", "Big save from {k} to deny {s}", "{s} tests {k}, who holds on", "{k} tips {s}'s effort over"];
const T_MISS = ["{s} drags a shot wide", "{s} skies it over the bar", "{s} hits the post", "{s} heads over from a corner", "{s} is denied by a last-ditch block"];
const fillT = (t, o) => t.replace(/\{(\w)\}/g, (_, k) => o[k]);

function benchAvail(M, i) { const s = i ? M.a : M.h; return s.bench.map(P).filter(p => avail(p) && !s.used.includes(p.id)); }
// A substitute into a position nobody is in: after an injury you chose to cover later, or a gap you made.
function subIntoSlot(M, i, si, newId, why) {
  const s = i ? M.a : M.h, p = P(newId), sl = slotsOf(s.form);
  if (s.subs >= RULES.subs || sl[si] == null || s.on.some(o => o.si === si) || !p) return false;
  s.on.push({ p, slot: sl[si], si, fit: p.fit, from: M.min }); s.used.push(newId); s.subs++; s.rt = null; s.fitK = null;
  if (M.injWait && M.injWait.side === i && M.injWait.si === si) M.injWait = null;
  lg(M, "sub", i, `${why || "Change"}: ${p.name} comes on at ${ROLE_NAME[sl[si]].toLowerCase()}.`);
  return true;
}
function doSub(M, i, idx, newId, why) {
  const s = i ? M.a : M.h, o = s.on[idx], p = P(newId);
  M.fit[o.p.id] = o.fit; s.mins[o.p.id] = M.min - o.from;
  s.on[idx] = { p, slot: o.slot, si: o.si, fit: p.fit, from: M.min }; s.used.push(newId); s.subs++; s.rt = null;
  lg(M, "sub", i, `${why || "Change"}: ${p.name} replaces ${o.p.name}.`);
}
/* Before kick-off your team sheet can still change without using a substitution: swap a starter, a
   substitute and a player outside the matchday squad with one another. a and b are { on: index },
   { bench: id } or { out: id }. Your saved XI and bench follow, so the change carries to later matches. */
function preSwap(M, i, a, b) {
  const s = i ? M.a : M.h, idOf = x => x.on != null ? s.on[x.on].p.id : x.bench ?? x.out;
  const ia = idOf(a), ib = idOf(b);
  const put = (x, id) => {
    if (x.on != null) { const o = s.on[x.on], p = P(id); s.on[x.on] = { p, slot: o.slot, si: o.si, fit: p.fit, from: 0 }; }
    else if (x.bench != null) s.bench[s.bench.indexOf(x.bench)] = id;
  };
  put(a, ib); put(b, ia);
  s.used = s.on.map(o => o.p.id); s.rt = null; s.fitK = null;
  savePreMatch(s);
}
// Before kick-off your team sheet is your selection: keep the saved formation, XI and bench in step.
function savePreMatch(s) {
  if (!isUser(C(s.club))) return;
  const xi = Array(11).fill(null); for (const o of s.on) xi[o.si] = o.p.id;
  S.formation = s.form; S.lineup = xi; S.bench = s.bench.slice();
}
// Swap two players' positions on the pitch.
function swapSlots(M, i, a, b) {
  const s = i ? M.a : M.h, x = s.on[a], y = s.on[b];
  [x.slot, y.slot] = [y.slot, x.slot]; [x.si, y.si] = [y.si, x.si]; s.rt = null; s.fitK = null;
  lg(M, "tac", i, `${x.p.name} and ${y.p.name} swap positions.`);
}
// Move a player into a position nobody is filling: after a red card (or an injury with no subs left) the
// shape has a gap, and you choose who covers it, keeper included.
function moveToSlot(M, i, a, si) {
  const s = i ? M.a : M.h, o = s.on[a], sl = slotsOf(s.form);
  if (!o || si < 0 || si >= sl.length || s.on.some(x => x.si === si)) return false;
  o.si = si; o.slot = sl[si]; s.rt = null; s.fitK = null;
  lg(M, "tac", i, `${o.p.name} moves to ${ROLE_NAME[o.slot].toLowerCase()}.`);
  return true;
}
// Change formation mid-match: put the players on the pitch into the new shape, best fits first.
function changeForm(M, i, form) {
  const s = i ? M.a : M.h, sl = slotsOf(form), pairs = [];
  s.on.forEach((o, a) => sl.forEach((role, si) => pairs.push([eff(o.p, role, o.fit), a, si])));
  pairs.sort((x, y) => y[0] - x[0]);
  const doneP = new Set(), doneS = new Set();
  // Whoever is in goal stays in goal. A weak keeper otherwise "fits" an outfield slot better (a keeper
  // outfield rates 4, an outfielder in goal 2) and the shape change took him out of it.
  const gk = s.on.findIndex(o => o.slot === "GK"), gs = sl.indexOf("GK");
  if (gk >= 0 && gs >= 0) { s.on[gk].si = gs; s.on[gk].slot = "GK"; doneP.add(gk); doneS.add(gs); }
  for (const [, a, si] of pairs) { if (doneP.has(a) || doneS.has(si)) continue; doneP.add(a); doneS.add(si); s.on[a].si = si; s.on[a].slot = sl[si]; }
  s.form = form; s.rt = null; s.fitK = null;
  lg(M, "tac", i, `${C(s.club).name} switch to a ${form}.`);
}
function bestBench(M, i, slot) { const b = benchAvail(M, i); if (!b.length) return null; return b.reduce((x, y) => eff(y, slot) > eff(x, slot) ? y : x); }
function sendOff(M, i, o, why, games) {
  const s = i ? M.a : M.h; M.fit[o.p.id] = o.fit; s.mins[o.p.id] = M.min - o.from;
  s.on.splice(s.on.indexOf(o), 1); s.rt = null; M.reds.push([o.p.id, games]);
  // In a match you're watching (your side not on auto), a red card for either side pauses it for you to adjust.
  if (!(M.h.auto && M.a.auto)) M.redWait = { side: i, pid: o.p.id, slot: o.slot }; (M.bk = M.bk || []).push({ side: i, pid: o.p.id, min: M.min, red: 1, n: sur(o.p) });
  lg(M, "red", i, `${why}! ${o.p.name} is sent off.`);
}

/* Chance quality multiplier: a gamma(2) draw divided by 2 (mean 1); about 1 shot in 9 is twice the average or better. */
const CHANCE_SPREAD = () => -Math.log((1 - R()) * (1 - R())) / 2;
/* Defending, which the match didn't record (5.41 added a single tackle count; this is the full set). When an
   attack comes to nothing someone won the ball back: a tackle (good tacklers win more), an interception (good
   markers read more), and sometimes a clearance (good in the air). Missed shots are sometimes blocked. When a goal
   goes in, one defender was beaten for it, more often a weak one. All weighted by role (centre-backs and holding
   midfielders most), shown on the ratings line and counted in the rating, so a defender's mark is what he did. */
const DEF_ROLE = { GK: 0, CB: 3, FB: 2, DM: 3, CM: 1.5, AM: .5, W: .4, ST: .2 };
const CLR_ROLE = { GK: 0, CB: 4, FB: 1.5, DM: 1, CM: .4, AM: .1, W: .1, ST: .2 };
const psOf = (M, id) => (M.ps = M.ps || {})[id] || (M.ps[id] = { sh: 0, sot: 0, xg: 0, kp: 0, xa: 0, sv: 0 });
const credit = (M, o, kind) => { if (o) { const x = psOf(M, o.p.id); x[kind] = (x[kind] || 0) + 1; } };
const at2 = (o, a) => Math.pow((o.p.at[a] ?? 6) / 10, 2);
function defAct(M, i, D, kind) {
  if (kind === "bk") return credit(M, wpick(D.on, o => DEF_ROLE[o.slot] * at2(o, "mar")), "bk");
  if (R() < .55) credit(M, wpick(D.on, o => DEF_ROLE[o.slot] * at2(o, "tac")), "tk");
  else credit(M, wpick(D.on, o => DEF_ROLE[o.slot] * at2(o, "mar")), "int");
  if (R() < .75) credit(M, wpick(D.on, o => CLR_ROLE[o.slot] * at2(o, "hea")), "clr");  // about 4 a game for a centre-back
}
// The defender beaten for a goal: the weaker his tackling and marking, the likelier it was him.
function beaten(M, D) { credit(M, wpick(D.on, o => ({ CB: 3, FB: 2.5, DM: 1.5, CM: .6, AM: .2, W: .3, ST: .1, GK: 0 })[o.slot] * Math.max(1, 21 - ((o.p.at.tac ?? 6) + (o.p.at.mar ?? 6)) / 2)), "bt"); }
const BIG_CHANCE = .25;  // the xG at which a chance counts as a big one: about 1 shot in 9
function step(M) {
  if (M.done) return;
  M.min++;
  const sd = [M.h, M.a];
  // Keepers have no Stamina attribute: a keeper sent on outfield (an injury with only a keeper on the bench)
  // used to get NaN fitness, which made his side's ratings NaN in every later match: they never had the ball,
  // and their opponents had it every minute and could never score. He tires like a stamina-8 player.
  for (const s of sd) for (const o of s.on) o.fit = Math.max(0, o.fit - (o.slot === "GK" ? .06 : .4 * (1.35 - (o.p.at.sta ?? 8) / 25) * MENT[s.ment].tire));  // a full match: stamina 5 costs ~41, 10 ~34, 15 ~27, 20 ~20. Half this (5.30) left a starting XI barely out of the green at full time, so fatigue and substitutions hardly mattered
  if (M.min >= 60 && M.min % 5 === 0) { adaptStyle(M, 0); adaptStyle(M, 1); }
  // Fit only changes with the players or the style, so it isn't recomputed with every fitness update.
  for (const s of sd) if (!s.rt || M.min % 5 === 0) { const key = s.ment + "|" + s.subs + "|" + s.on.length; if (s.fitK !== key) { s.fitK = key; s.fitV = styleFit(s.on, s.ment); } s.rt = sideRatings(s.on, s.ment, s.form, s.co, s.fitV); }
  const hb = M.fx.neutral ? 1 : 1.035 + .01 * M.riv;  // a derby crowd lifts the home side a little more
  const rh = { att: M.h.rt.att * hb, mid: M.h.rt.mid * hb, def: M.h.rt.def * hb, F: M.h.rt.F, fit: M.h.rt.fit }, ra = M.a.rt;
  const ph = rh.mid ** 2 / (rh.mid ** 2 + ra.mid ** 2), k = R() < ph ? 0 : 1, A = sd[k], D = sd[1 - k], rA = k ? ra : rh, rD = k ? rh : ra;
  A.poss++;
  // Measured against real football (about 25 shots, 8-9 on target and 2.7 goals a game): at one shot in
  // five minutes the game managed 18 shots and 2.2 goals, with 0-0s and clean sheets far too common.
  const stA = MENT[A.ment], stD = MENT[D.ment];
  if (A.on.length && R() < .26 * bend(stA.sh, rA.F || [1, 1])) {
    A.shots++;
    // .12 rather than .125 since sides started chasing games late, which added goals.
    // A counter-attacking side gets better chances the more the other side has committed forward.
    const pg = clamp(.12 * Math.pow(rA.att / Math.max(1, rD.def * TACKLE[D.tk || "normal"].def), 2) * (stA.ctr ? 1 + stA.ctr * (rA.F || [1])[0] * stD.open : 1) * (1 + (stD.expose || 0) * clamp(-(rD.fit || 0), 0, .8)), .03, .45);
    // About a fifth of chances are headers, from crosses and set pieces: centre-backs come up for those,
    // and the best in the air get them. The rest go to whoever is in position, weighted by role.
    const header = R() < .2;
    const sh = header ? wpick(A.on, o => ({ GK: 0, CB: 1.3, FB: .4, DM: .8, CM: .8, AM: .8, W: 1.2, ST: 5 })[o.slot] * (o.p.pos === "GK" ? 0 : o.p.at.hea ** 2))
      : wpick(A.on, o => ({ GK: 0, CB: .5, FB: .5, DM: .8, CM: 1.6, AM: 3, W: 4, ST: 6 })[o.slot] * eff(o.p, o.slot, o.fit));
    const gk = D.on.find(o => o.slot === "GK") || D.on[0], r0 = R();
    // The shooter's finishing (or heading) and the keeper's shot-stopping move each chance either way (10 is neutral).
    const shoQ = sh.p.pos === "GK" ? 2 : header ? sh.p.at.hea : sh.p.at.fin * .7 + sh.p.at.cmp * .3, ssQ = gk && gk.p.pos === "GK" ? gk.p.at.ss : 2;
    const r = r0 / ((.8 + .4 * shoQ / 20) * (1.2 - .4 * ssQ / 20));
    // Each chance's quality varies around the side's average pg: most shots are half-chances, a few are
    // tap-ins. Before, every shot in a match was within a few points of the same quality, so there was no
    // such thing as a big chance. The spread has mean 1, so goals per game stay where they were.
    const q = Math.min(.85, pg * CHANCE_SPREAD());
    // Advanced stats. pg is the chance's quality before the shooter and keeper come in (with a finisher and
    // keeper of 10 a shot scores exactly pg of the time), so xG is the chance's quality q. Measured over
    // 1,372 matches, goals came to 0.97 of xG. (An earlier 1.2 scaling was fitted against player goal
    // totals, which include the quick-simmed foreign leagues where no shots are taken.)
    // The creator is picked for every shot, not just goals, so key passes and expected assists exist; a
    // goal's assist is the same player, at the same 72% rate the assist was always given.
    const others = A.on.filter(o => o !== sh);
    const as = others.length && R() < .72 ? wpick(others, o => ({ GK: .1, CB: .6, FB: 1.6, DM: 1.2, CM: 2.4, AM: 4, W: 3.4, ST: 2 })[o.slot]) : null;
    const st = id => (M.ps = M.ps || {})[id] || (M.ps[id] = { sh: 0, sot: 0, xg: 0, kp: 0, xa: 0, sv: 0 });
    const xg = q, xs = st(sh.p.id); xs.sh++; xs.xg += xg; A.xg = (A.xg || 0) + xg; if (xg >= BIG_CHANCE) A.big = (A.big || 0) + 1; if (header) A.hdr = (A.hdr || 0) + 1;
    if (as) { const xc = st(as.p.id); xc.kp++; xc.xa += xg; }
    if (r < q) {
      A.goals++; A.sot++; xs.sot++; if (D.on.length) beaten(M, D);
      M.goals.push({ side: k, pid: sh.p.id, ast: as ? as.p.id : null, min: M.min, n: sur(sh.p) });
      lg(M, "goal", k, "GOAL! " + fillT(pick(header ? T_HEAD : T_GOAL), { s: sh.p.name }) + (as ? `, set up by ${sur(as.p)}.` : "."));
    } else if (r < q + .23) { A.sot++; xs.sot++; if (gk) { st(gk.p.id).sv++; D.sav = (D.sav || 0) + 1; } if (R() < .4 && gk) lg(M, "save", k, fillT(pick(T_SAVE), { s: sur(sh.p), k: sur(gk.p) }) + "."); }
    else { if (D.on.length && R() < .35) defAct(M, 1 - k, D, "bk"); if (R() < .25) lg(M, "miss", k, fillT(pick(T_MISS), { s: sur(sh.p) }) + "."); }
  } else if (D.on.length && R() < .5) defAct(M, 1 - k, D, "tk");  // an attack broken up: a tackle or interception
  for (let i = 0; i < 2; i++) {
    const s = sd[i], outf = s.on.filter(o => o.slot !== "GK");
    const tkc = TACKLE[s.tk || "normal"].card;
    if (outf.length && R() < .021 * (1 + .15 * M.riv) * tkc) {  // derbies are feistier
      // A booked player eases off: he is about a seventh as likely to be the one carded. Picking anyone at random sent off
      // 0.29 a match on a second yellow, four times the real rate, while the yellows themselves (3.6) were right.
      const wt = o => s.yel[o.p.id] ? .15 : 1; let x = R() * sum(outf, wt), o = outf[outf.length - 1];
      for (const c of outf) if ((x -= wt(c)) < 0) { o = c; break; }
      if (s.yel[o.p.id]) sendOff(M, i, o, "Second yellow", RULES.secondYellow);
      else { s.yel[o.p.id] = 1; M.cards.push(o.p.id); (M.bk = M.bk || []).push({ side: i, pid: o.p.id, min: M.min, n: sur(o.p) }); lg(M, "card", i, `Yellow card for ${o.p.name}.`); }
    } else if (outf.length && R() < .0005 * tkc) sendOff(M, i, pick(outf), "Straight red", RULES.straightRed);
    for (const o of s.on.slice()) {
      const risk = .00011 * (o.fit < 75 ? 1 + (75 - o.fit) / 12 : 1) * injMult(o.p);
      if (R() < risk) {
        M.inj.push(o.p.id); const idx = s.on.indexOf(o);
        lg(M, "inj", i, `${o.p.name} goes down injured.`);
        const b = s.subs < RULES.subs ? bestBench(M, i, o.slot) : null;
        // Your side in a match you're watching (not auto): he goes off and the match waits for you to choose
        // who comes on (M.injWait), instead of the assistant sending on the best fit.
        if (b && !s.auto) { M.fit[o.p.id] = o.fit; s.mins[o.p.id] = M.min - o.from; s.on.splice(idx, 1); s.rt = null; s.fitK = null; M.injWait = { side: i, si: o.si, slot: o.slot, pid: o.p.id }; lg(M, "inj", i, `${o.p.name} can't continue.`); }
        else if (b) doSub(M, i, idx, b.id, "Forced change");
        else { M.fit[o.p.id] = o.fit; s.mins[o.p.id] = M.min - o.from; s.on.splice(idx, 1); s.rt = null; lg(M, "inj", i, `${C(s.club).short} are down to ${s.on.length}.`); }
      }
    }
    if (s.auto && M.min >= 56 && s.subs < RULES.subs && R() < .28) {
      const tired = s.on.filter(o => o.fit < 66 && o.slot !== "GK").sort((a, b) => a.fit - b.fit)[0];
      if (tired) { const b = bestBench(M, i, tired.slot); if (b && eff(b, tired.slot) > eff(tired.p, tired.slot, tired.fit)) doSub(M, i, s.on.indexOf(tired), b.id); }
    }
  }
  if (M.min === 45) lg(M, "ht", -1, `Half-time: ${C(M.h.club).short} ${M.h.goals}–${M.a.goals} ${C(M.a.club).short}.`);
  if (M.min >= M.end) {
    const ko = M.fx.ko, level = ko ? (M.h.goals + ko.aggH === M.a.goals + ko.aggA) : (M.fx.needWinner && M.h.goals === M.a.goals);
    if (M.end === 90 && level && (ko || M.fx.needWinner)) { M.end = 120; M.et = true; lg(M, "ht", -1, "Level after 90 minutes. Extra time."); return; }
    if (level && (ko || M.fx.needWinner)) shootout(M);
    M.done = true;
    lg(M, "ft", -1, `Full time: ${C(M.h.club).name} ${M.h.goals}–${M.a.goals} ${C(M.a.club).name}${M.et ? " after extra time" : ""}${M.pens ? `, ${M.pens[0] > M.pens[1] ? C(M.h.club).short : C(M.a.club).short} win ${Math.max(...M.pens)}–${Math.min(...M.pens)} on penalties` : ""}.`);
  }
}
function shootout(M) {
  const takers = s => s.on.filter(o => o.slot !== "GK").sort((a, b) => eff(b.p, "ST") - eff(a.p, "ST")).concat(s.on.filter(o => o.slot === "GK"));
  const tk = [takers(M.h), takers(M.a)], gk = [M.h, M.a].map(s => (s.on.find(o => o.slot === "GK") || s.on[0]).p);
  const sc = [0, 0];
  const kick = (i, n) => { const t = tk[i][n % tk[i].length].p; const ok = R() < .76 + (t.ovr - 70) * .004 - (gk[1 - i].ovr - 70) * .003; if (ok) sc[i]++; return ok; };
  let n = 0;
  const decided = (r0, r1) => sc[0] > sc[1] + r1 || sc[1] > sc[0] + r0;
  for (; n < 5; n++) { kick(0, n); if (decided(4 - n, 5 - n)) break; kick(1, n); if (decided(4 - n, 4 - n)) break; }
  if (n < 5) n++;
  while (sc[0] === sc[1]) { kick(0, n); kick(1, n); n++; }
  M.pens = sc;
  lg(M, "pens", -1, `Penalties: ${C(M.h.club).short} ${sc[0]}–${sc[1]} ${C(M.a.club).short}.`);
}
function runToEnd(M) { while (!M.done) step(M); return M; }
/* For a second leg the tie is decided on aggregate, not on this match. */
function tieWinner(M) {
  const ko = M.fx.ko; if (!ko) return matchWinner(M);
  if (M.pens) return M.pens[0] > M.pens[1] ? M.h.club : M.a.club;
  const h = M.h.goals + ko.aggH, a = M.a.goals + ko.aggA;
  return h > a ? M.h.club : a > h ? M.a.club : null;
}
const matchWinner = M => M.pens ? (M.pens[0] > M.pens[1] ? M.h.club : M.a.club) : M.h.goals > M.a.goals ? M.h.club : M.a.goals > M.h.goals ? M.a.club : null;

/* Write a finished match back into players: fitness, stats, cards, injuries, ratings, minutes. */
/* A player's rating for this match, out of 10, live or final: 6.4, plus or minus for the result (the score
   as it stands, during the game), goals, assists, his quality against his team's, a clean sheet or goals
   conceded for defenders and keepers, and bookings. The random part is drawn once per player per match,
   so what you see at the final whistle is what goes on his record. */
/* Match ratings on one scale: 6 an average game, 7 good, 8 great, 9 amazing, 10 perfect. Only what he did in the
   match counts: goals, assists, chances he got (xG), key passes, shots on target, tackles and interceptions, blocks,
   a keeper's saves, a defence's clean sheet or goals conceded, the result, cards. His ability doesn't count in itself
   (it shows through what he does: better finishers get more chances, better defenders win the ball more), so a
   modest striker who wins the golden boot out-rates a star who plays badly. Everything but his own actions scales
   with his minutes, so a late substitute sits near 6 unless he does something. (5.40 rated quality, (ovr - level)
   / 4.1: a good centre-back got 9.4 for an ordinary game, a weaker substitute 4.8 the minute he came on.) */
// A wide curve, measured over a season of starts: under 5 in 11%, 5-6 31%, 6-7 31%, 7-8 18%, 8+ 8%, 10 0.4%
// (median 6.23). One goal is about 7.4, two 8.8, two and an assist 9.9, a hat-trick 10. A 10 isn't only goals: about
// 40% of them are defensive or goalkeeping displays (13 clearances and a clean sheet; 8 tackles and 9 interceptions;
// 7 saves and a clean sheet), and a playmaker's chances created can carry him to 9+ without an assist (xA beyond his
// assists 0.9, key passes 0.3). Late substitutes 6.0, a
// red card about 3.9. (5.41 sat too many games between 5 and 7: under 5 in only 4%.)
const RTW = { base: 6, off: .6, res: .4, q: 9, qcap: 0, g: 1.15, a: .75, xg: .25, miss: .4, kp: .3, xa: .9, sot: .08, tk: .2, int: .18, clr: .08, bk: .25, bt: .45, sv: .3, cs: .8, ga: .25, noise: .45 };
function matchRating(M, i, id, W = RTW) {
  const s = i ? M.a : M.h, o2 = i ? M.h : M.a, p = P(id), on = s.on.find(o => o.p.id === id);
  const mins = on ? M.min - on.from : (s.mins[id] ?? 0), m = clamp(mins / Math.max(30, M.done ? M.end : M.min), 0, 1);
  const win = M.done ? s.goals > o2.goals || (M.pens && matchWinner(M) === s.club) : s.goals > o2.goals;
  const loss = M.done ? s.goals < o2.goals || (M.pens && matchWinner(M) !== s.club) : s.goals < o2.goals;
  const g = M.goals.filter(x => x.pid === id).length, a = M.goals.filter(x => x.ast === id).length;
  const form = (M.form ||= {})[id] ??= gauss();
  const lvl = M.lvl || (M.lvl = (clubLevel(C(M.h.club)) + clubLevel(C(M.a.club))) / 2), x = (M.ps || {})[id] || {};
  // Chances count a little for getting into position, and chances missed cost: xG well above his goals is points off.
  // Chances he created count beyond those already rewarded as assists (xA above his assists), so a playmaker whose
  // team-mates miss can still have a 9; counting all xA paid assist games twice and doubled the 10s.
  const did = g * W.g + a * W.a + W.xg * (x.xg || 0) - (W.miss || 0) * Math.max(0, (x.xg || 0) - g) + W.kp * (x.kp || 0) + (W.xa || 0) * Math.max(0, (x.xa || 0) - a) + W.sot * (x.sot || 0) + W.tk * (x.tk || 0) + (W.int || 0) * (x.int || 0) + (W.clr || 0) * (x.clr || 0) + W.bk * (x.bk || 0) - (W.bt || 0) * (x.bt || 0) + (p.pos === "GK" ? W.sv * (x.sv || 0) : 0);
  let ctx = (win ? W.res : loss ? -W.res : 0) + clamp((p.ovr - lvl) / W.q, -W.qcap, W.qcap) + form * W.noise - W.off;
  if (LINE[p.pos] === "DEF" || p.pos === "GK") { ctx -= o2.goals * W.ga; if (o2.goals === 0 && mins >= 60) ctx += W.cs; }
  let rt = W.base + m * ctx + did;
  if (M.cards.includes(id)) rt -= .2;
  if (M.reds.some(r => r[0] === id)) rt -= 2;  // a sending-off costs his side the game: about 4 (it was -1, leaving 5.1)
  return clamp(rt, 3, 10);
}
function applyMatch(M) {
  const league = M.fx.comp === "L", frac = league ? (M.fx.round || 0) / roundsOf(M.fx.key) : 0;
  for (let i = 0; i < 2; i++) {
    const s = i ? M.a : M.h, o2 = i ? M.h : M.a, c = C(s.club);
    for (const id of s.susSnap) { const p = P(id); if (p && p.club === c.id && p.sus > 0) p.sus--; }
    for (const o of s.on) { M.fit[o.p.id] = o.fit; s.mins[o.p.id] = M.end - o.from; }
    for (const id of s.used) {
      const p = P(id), mins = s.mins[id] ?? 0;
      p.s.app++; p.s.min += mins; p.wm += mins;
      if (M.fit[id] != null) p.fit = Math.round(M.fit[id]);
      if ((LINE[p.pos] === "DEF" || p.pos === "GK") && o2.goals === 0 && mins >= 60) p.s.cs++;
      p.s.rt += matchRating(M, i, id);
      if (!isSenior(p)) c.ym += mins; c.tm += mins;
    }
    c.wkMatches++;
  }
  for (const [id, x] of Object.entries(M.ps || {})) { const p = P(id); if (p) for (const k in x) if (x[k]) p.s[k] = Math.round(((p.s[k] || 0) + x[k]) * 100) / 100; }  // rounded: full-precision xG added 6% to the save
  if (league) for (let i = 0; i < 2; i++) { const c = C((i ? M.a : M.h).club), xs = c.xs || (c.xs = { xg: 0, xga: 0 }); xs.xg = Math.round((xs.xg + ((i ? M.a : M.h).xg || 0)) * 100) / 100; xs.xga = Math.round((xs.xga + ((i ? M.h : M.a).xg || 0)) * 100) / 100; }
  for (const g of M.goals) { const p = P(g.pid); p.s.g++; if (league) p.s.lg++; if (g.ast) P(g.ast).s.a++; }
  for (const id of M.cards) {
    const p = P(id); p.s.yc++;
    if (league) { p.yc++; for (const [n, before, ban] of RULES.yellowBans) if (p.yc === n && frac < before) { p.sus += ban; if (isUser(C(p.club))) news(`${p.name} has reached ${n} yellow cards and is banned for ${ban} match${ban > 1 ? "es" : ""}.`); } }
  }
  for (const [id, games] of M.reds) { const p = P(id); p.s.rc++; p.sus += games; }
  for (const id of M.inj) { const p = P(id); if (p) injure(p); }
}
