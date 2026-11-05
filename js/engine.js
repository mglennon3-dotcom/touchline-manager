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
// A good fit makes a style's strengths stronger and its costs smaller; a poor fit the reverse.
const fitScale = fit => clamp(1 + fit * .5, .5, 1.7);
const bend = (m, F) => m >= 1 ? 1 + (m - 1) * F : 1 + (m - 1) / F;
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
  const co = coachOf(c), t = co.off - co.def + (co.arch === "off" ? 2 : co.arch === "def" ? -2 : 0);
  if (t >= 5) return "att";
  if (t <= -5) return "def";
  // Coaches without a strong leaning play to their squad: possession with good passers, counters with
  // quick forwards. Worked out once a week; the XI doesn't change much faster than that.
  const key = S.year * 100 + S.week;
  if (c._sty && c._sty[0] === key) return c._sty[1];
  const f = c.formation, sl = slotsOf(f), on = autoPick(eligibleIds(c), f).map((id, i) => id == null ? null : { p: P(id), slot: sl[i] }).filter(Boolean);
  const lean = ["pos", "bal", "ctr", "bal"][(c.id + co.name.length) % 4], fits = { pos: styleFit(on, "pos"), ctr: styleFit(on, "ctr"), bal: 0 };
  const best = Object.keys(fits).reduce((a, b) => fits[b] > fits[a] ? b : a);
  const st = fits[best] - fits[lean] > .15 ? best : lean;
  c._sty = [key, st]; return st;
}
// The user's XI as on-pitch entries, for showing how each style suits it.
function userOn() { fixUserLineup(); const sl = slotsOf(S.formation); return S.lineup.map((id, i) => id == null ? null : { p: P(id), slot: sl[i] }).filter(Boolean); }
const FIT_WORDS = [[.35, "Great fit", "good"], [.12, "Good fit", "good"], [-.12, "Average fit", "muted"], [-.35, "Poor fit", "warn"], [-99, "Very poor fit", "bad"]];
const fitWord = f => FIT_WORDS.find(([t]) => f >= t);
// For one match the AI shifts its usual style: further forward against weaker sides, deeper against stronger.
function aiStyle(c, opp, home) {
  const base = baseStyle(c), d = clubLevel(c) - clubLevel(opp) + (home ? 1.5 : -1.5);
  const shift = d >= 9 ? 2 : d >= 4 ? 1 : d <= -9 ? -2 : d <= -4 ? -1 : 0;
  return shift ? STYLE_BY_AG[clamp(MENT[base].ag + shift, -3, 3)] : base;
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
  const st = STYLE_BY_AG[ag];
  if (st !== s.ment) { s.ment = st; s.rt = null; s.changes = (s.changes || 0) + 1; lg(M, "tac", k, `${C(s.club).name} switch to ${MENT[st].l.toLowerCase()}.`); }
}

function makeSide(c, opp, home, auto) {
  let xi, f, ment;
  if (isUser(c)) { fixUserLineup(); xi = S.lineup; f = S.formation; ment = S.mentality; }
  else { f = c.formation; xi = autoPick(eligibleIds(c), f); ment = aiStyle(c, opp, home); auto = true; }
  const sl = slotsOf(f);
  const on = xi.map((id, i) => id == null ? null : { p: P(id), slot: sl[i], fit: P(id).fit, from: 0 }).filter(Boolean);
  const bench = benchFor(c, xi.filter(x => x != null));
  return { club: c.id, form: f, ment, base: ment, auto, on, co: coachOf(c), bench, used: on.map(o => o.p.id), subs: 0, goals: 0, shots: 0, sot: 0, poss: 0, yel: {}, mins: {}, rt: null,
    susSnap: c.squad.filter(id => P(id).sus > 0) };
}
/* fx: { comp, neutral, ko: {aggH, aggA} | null, needWinner } */
function makeMatch(fx, userAuto) {
  const H = C(fx.h), A = C(fx.a);
  const M = { fx, h: makeSide(H, A, !fx.neutral, userAuto), a: makeSide(A, H, false, userAuto), min: 0, end: 90, et: false, pens: null,
    log: [], goals: [], inj: [], reds: [], cards: [], fit: {}, done: false, riv: rivalry(fx.h, fx.a) };
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
function doSub(M, i, idx, newId, why) {
  const s = i ? M.a : M.h, o = s.on[idx], p = P(newId);
  M.fit[o.p.id] = o.fit; s.mins[o.p.id] = M.min - o.from;
  s.on[idx] = { p, slot: o.slot, fit: p.fit, from: M.min }; s.used.push(newId); s.subs++; s.rt = null;
  lg(M, "sub", i, `${why || "Change"}: ${p.name} replaces ${o.p.name}.`);
}
function bestBench(M, i, slot) { const b = benchAvail(M, i); if (!b.length) return null; return b.reduce((x, y) => eff(y, slot) > eff(x, slot) ? y : x); }
function sendOff(M, i, o, why, games) {
  const s = i ? M.a : M.h; M.fit[o.p.id] = o.fit; s.mins[o.p.id] = M.min - o.from;
  s.on.splice(s.on.indexOf(o), 1); s.rt = null; M.reds.push([o.p.id, games]);
  lg(M, "red", i, `${why}! ${o.p.name} is sent off.`);
}

function step(M) {
  if (M.done) return;
  M.min++;
  const sd = [M.h, M.a];
  for (const s of sd) for (const o of s.on) o.fit = Math.max(0, o.fit - (o.slot === "GK" ? .06 : .2 * (1.25 - o.p.at.sta / 40) * MENT[s.ment].tire));  // stamina 10 tires at the old rate, 20 a quarter slower
  if (M.min >= 60 && M.min % 5 === 0) { adaptStyle(M, 0); adaptStyle(M, 1); }
  // Fit only changes with the players or the style, so it isn't recomputed with every fitness update.
  for (const s of sd) if (!s.rt || M.min % 5 === 0) { const key = s.ment + "|" + s.subs + "|" + s.on.length; if (s.fitK !== key) { s.fitK = key; s.fitV = styleFit(s.on, s.ment); } s.rt = sideRatings(s.on, s.ment, s.form, s.co, s.fitV); }
  const hb = M.fx.neutral ? 1 : 1.035 + .01 * M.riv;  // a derby crowd lifts the home side a little more
  const rh = { att: M.h.rt.att * hb, mid: M.h.rt.mid * hb, def: M.h.rt.def * hb, F: M.h.rt.F }, ra = M.a.rt;
  const ph = rh.mid ** 2 / (rh.mid ** 2 + ra.mid ** 2), k = R() < ph ? 0 : 1, A = sd[k], D = sd[1 - k], rA = k ? ra : rh, rD = k ? rh : ra;
  A.poss++;
  // Measured against real football (about 25 shots, 8-9 on target and 2.7 goals a game): at one shot in
  // five minutes the game managed 18 shots and 2.2 goals, with 0-0s and clean sheets far too common.
  const stA = MENT[A.ment], stD = MENT[D.ment];
  if (A.on.length && R() < .26 * bend(stA.sh, rA.F || 1)) {
    A.shots++;
    // .12 rather than .125 since sides started chasing games late, which added goals.
    // A counter-attacking side gets better chances the more the other side has committed forward.
    const pg = clamp(.12 * Math.pow(rA.att / Math.max(1, rD.def), 2) * (stA.ctr ? 1 + stA.ctr * (rA.F || 1) * stD.open : 1), .03, .45);
    // About a fifth of chances are headers, from crosses and set pieces: centre-backs come up for those,
    // and the best in the air get them. The rest go to whoever is in position, weighted by role.
    const header = R() < .2;
    const sh = header ? wpick(A.on, o => ({ GK: 0, CB: 1.3, FB: .4, DM: .8, CM: .8, AM: .8, W: 1.2, ST: 5 })[o.slot] * (o.p.pos === "GK" ? 0 : o.p.at.hea ** 2))
      : wpick(A.on, o => ({ GK: 0, CB: .5, FB: .5, DM: .8, CM: 1.6, AM: 3, W: 4, ST: 6 })[o.slot] * eff(o.p, o.slot, o.fit));
    const gk = D.on.find(o => o.slot === "GK") || D.on[0], r0 = R();
    // The shooter's finishing (or heading) and the keeper's shot-stopping move each chance either way (10 is neutral).
    const shoQ = sh.p.pos === "GK" ? 2 : header ? sh.p.at.hea : sh.p.at.fin * .7 + sh.p.at.cmp * .3, ssQ = gk && gk.p.pos === "GK" ? gk.p.at.ss : 2;
    const r = r0 / ((.8 + .4 * shoQ / 20) * (1.2 - .4 * ssQ / 20));
    if (r < pg) {
      A.goals++; A.sot++;
      const others = A.on.filter(o => o !== sh);
      const as = others.length && R() < .72 ? wpick(others, o => ({ GK: .1, CB: .6, FB: 1.6, DM: 1.2, CM: 2.4, AM: 4, W: 3.4, ST: 2 })[o.slot]) : null;
      M.goals.push({ side: k, pid: sh.p.id, ast: as ? as.p.id : null, min: M.min, n: sur(sh.p) });
      lg(M, "goal", k, "GOAL! " + fillT(pick(header ? T_HEAD : T_GOAL), { s: sh.p.name }) + (as ? `, set up by ${sur(as.p)}.` : "."));
    } else if (r < pg + .23) { A.sot++; if (R() < .4 && gk) lg(M, "save", k, fillT(pick(T_SAVE), { s: sur(sh.p), k: sur(gk.p) }) + "."); }
    else if (R() < .25) lg(M, "miss", k, fillT(pick(T_MISS), { s: sur(sh.p) }) + ".");
  }
  for (let i = 0; i < 2; i++) {
    const s = sd[i], outf = s.on.filter(o => o.slot !== "GK");
    if (outf.length && R() < .021 * (1 + .15 * M.riv)) {  // derbies are feistier
      const o = pick(outf);
      if (s.yel[o.p.id]) sendOff(M, i, o, "Second yellow", RULES.secondYellow);
      else { s.yel[o.p.id] = 1; M.cards.push(o.p.id); lg(M, "card", i, `Yellow card for ${o.p.name}.`); }
    } else if (outf.length && R() < .0005) sendOff(M, i, pick(outf), "Straight red", RULES.straightRed);
    for (const o of s.on.slice()) {
      const risk = .00011 * (o.fit < 75 ? 1 + (75 - o.fit) / 12 : 1) * injMult(o.p);
      if (R() < risk) {
        M.inj.push(o.p.id); const idx = s.on.indexOf(o);
        lg(M, "inj", i, `${o.p.name} goes down injured.`);
        const b = s.subs < RULES.subs ? bestBench(M, i, o.slot) : null;
        if (b) doSub(M, i, idx, b.id, "Forced change");
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
function applyMatch(M) {
  const league = M.fx.comp === "L", frac = league ? (M.fx.round || 0) / roundsOf(M.fx.key) : 0;
  for (let i = 0; i < 2; i++) {
    const s = i ? M.a : M.h, o2 = i ? M.h : M.a, c = C(s.club);
    for (const id of s.susSnap) { const p = P(id); if (p && p.club === c.id && p.sus > 0) p.sus--; }
    for (const o of s.on) { M.fit[o.p.id] = o.fit; s.mins[o.p.id] = M.end - o.from; }
    const win = s.goals > o2.goals || (M.pens && matchWinner(M) === s.club), loss = s.goals < o2.goals || (M.pens && matchWinner(M) !== s.club);
    const lvl = clubLevel(c);
    for (const id of s.used) {
      const p = P(id), mins = s.mins[id] ?? 0;
      p.s.app++; p.s.min += mins; p.wm += mins;
      if (M.fit[id] != null) p.fit = Math.round(M.fit[id]);
      const g = M.goals.filter(x => x.pid === id).length, a = M.goals.filter(x => x.ast === id).length;
      const defLine = LINE[p.pos] === "DEF" || p.pos === "GK";
      let rt = 6.4 + (win ? .35 : loss ? -.35 : 0) + g * .95 + a * .5 + (p.ovr - lvl) / 25 + gauss() * .3;
      if (defLine) { rt -= o2.goals * .14; if (o2.goals === 0 && mins >= 60) { rt += .55; p.s.cs++; } }
      p.s.rt += clamp(rt, 3, 10);
      if (!isSenior(p)) c.ym += mins; c.tm += mins;
    }
    c.wkMatches++;
  }
  for (const g of M.goals) { const p = P(g.pid); p.s.g++; if (league) p.s.lg++; if (g.ast) P(g.ast).s.a++; }
  for (const id of M.cards) {
    const p = P(id); p.s.yc++;
    if (league) { p.yc++; for (const [n, before, ban] of RULES.yellowBans) if (p.yc === n && frac < before) { p.sus += ban; if (isUser(C(p.club))) news(`${p.name} has reached ${n} yellow cards and is banned for ${ban} match${ban > 1 ? "es" : ""}.`); } }
  }
  for (const [id, games] of M.reds) { const p = P(id); p.s.rc++; p.sus += games; }
  for (const id of M.inj) { const p = P(id); if (p) injure(p); }
}
