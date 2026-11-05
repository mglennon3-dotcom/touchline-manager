"use strict";
/* Minute-by-minute match engine. */
function sideRatings(on, ment, form, co) {
  const N = FNORM[form];
  let a = 0, m = 0, d = 0;
  for (const o of on) { const e = eff(o.p, o.slot, o.fit), w = WT[o.slot]; a += e * w[0]; m += e * w[1]; d += e * w[2]; }
  const k = MENT[ment].m, ca = co ? 1 + (co.off - 10) * .008 : 1, cd = co ? 1 + (co.def - 10) * .008 : 1, pf = co && co.form === form ? FORM_PREF_BONUS : 1;
  return { att: a / N[0] * k[0] * ca * pf, mid: m / N[1] * k[1] * pf, def: d / N[2] * k[2] * cd * pf };
}
function aiMent(c, opp, home) { const d = clubLevel(c) - clubLevel(opp) + (home ? 1.5 : -1.5); return d < -4 ? "def" : d > 4 ? "att" : "bal"; }

function makeSide(c, opp, home, auto) {
  let xi, f, ment;
  if (isUser(c)) { fixUserLineup(); xi = S.lineup; f = S.formation; ment = S.mentality; }
  else { f = c.formation; xi = autoPick(c.squad, f); ment = aiMent(c, opp, home); auto = true; }
  const sl = slotsOf(f);
  const on = xi.map((id, i) => id == null ? null : { p: P(id), slot: sl[i], fit: P(id).fit, from: 0 }).filter(Boolean);
  const bench = benchFor(c, xi.filter(x => x != null));
  return { club: c.id, form: f, ment, auto, on, co: coachOf(c), bench, used: on.map(o => o.p.id), subs: 0, goals: 0, shots: 0, sot: 0, poss: 0, yel: {}, mins: {}, rt: null,
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
const T_GOAL = ["{s} fires low into the corner", "{s} heads in at the near post", "{s} slots it past the keeper", "{s} curls one in from the edge of the box", "{s} taps in at the back post", "{s} lashes in a half-volley", "{s} converts from the penalty spot", "{s} rounds the keeper and scores"];
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
  for (const s of sd) for (const o of s.on) o.fit = Math.max(0, o.fit - (o.slot === "GK" ? .06 : .2));
  for (const s of sd) if (!s.rt || M.min % 5 === 0) s.rt = sideRatings(s.on, s.ment, s.form, s.co);
  const hb = M.fx.neutral ? 1 : 1.035 + .01 * M.riv;  // a derby crowd lifts the home side a little more
  const rh = { att: M.h.rt.att * hb, mid: M.h.rt.mid * hb, def: M.h.rt.def * hb }, ra = M.a.rt;
  const ph = rh.mid ** 2 / (rh.mid ** 2 + ra.mid ** 2), k = R() < ph ? 0 : 1, A = sd[k], D = sd[1 - k], rA = k ? ra : rh, rD = k ? rh : ra;
  A.poss++;
  if (A.on.length && R() < .2) {
    A.shots++;
    const pg = clamp(.135 * Math.pow(rA.att / Math.max(1, rD.def), 2), .03, .4);
    const sh = wpick(A.on, o => ({ GK: 0, CB: .5, FB: .5, DM: .8, CM: 1.6, AM: 3, W: 4, ST: 6 })[o.slot] * eff(o.p, o.slot, o.fit));
    const gk = D.on.find(o => o.slot === "GK") || D.on[0], r0 = R();
    // The shooter's finishing and the keeper's shot-stopping move each chance either way (10 is neutral).
    const shoQ = sh.p.pos === "GK" ? 2 : sh.p.at.sho, ssQ = gk && gk.p.pos === "GK" ? gk.p.at.ss : 2;
    const r = r0 / ((.8 + .4 * shoQ / 20) * (1.2 - .4 * ssQ / 20));
    if (r < pg) {
      A.goals++; A.sot++;
      const others = A.on.filter(o => o !== sh);
      const as = others.length && R() < .72 ? wpick(others, o => ({ GK: .1, CB: .6, FB: 1.6, DM: 1.2, CM: 2.4, AM: 4, W: 3.4, ST: 2 })[o.slot]) : null;
      M.goals.push({ side: k, pid: sh.p.id, ast: as ? as.p.id : null, min: M.min, n: sur(sh.p) });
      lg(M, "goal", k, "GOAL! " + fillT(pick(T_GOAL), { s: sh.p.name }) + (as ? `, set up by ${sur(as.p)}.` : "."));
    } else if (r < pg + .32) { A.sot++; if (R() < .4 && gk) lg(M, "save", k, fillT(pick(T_SAVE), { s: sur(sh.p), k: sur(gk.p) }) + "."); }
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
