"use strict";
/* Calendar, competitions, standings, the weekly cycle and the end of season. */
function news(t, hi, tag) { S.news.unshift({ t, hi: !!hi, tag: tag || "", y: S.year, w: S.phase === "summer" ? "Summer" : "Wk " + (S.week + 1) }); if (S.news.length > 160) S.news.length = 160; }
const seasonLabel = y => `${y}–${String((y + 1) % 100).padStart(2, "0")}`;

function roundRobin(ids) {
  const n = ids.length, arr = ids.slice(), rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const m = [];
    for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; m.push((r + i) % 2 ? [b, a] : [a, b]); }
    rounds.push(m); arr.splice(1, 0, arr.pop());
  }
  return rounds.concat(rounds.map(rd => rd.map(([a, b]) => [b, a])));
}
const windowOpen = () => S.phase === "summer" || CAL.jan.includes(S.week);

/* ---------- calendar ---------- */
function buildDays() {
  const d = [], add = (w, o, ord) => d.push({ w, ord, ...o });
  const cnt = {};
  for (let w = 0; w < 38; w++) for (const mid of CAL.midweekLeague.includes(w) ? [true, false] : [false]) {
    const rounds = {};
    for (const k of Object.keys(S.leagues)) { const R = roundsOf(k); if (R === 46 || !mid) { cnt[k] = cnt[k] || 0; if (cnt[k] < R) rounds[k] = cnt[k]++; } }
    add(w, { k: "lg", rounds, mid }, mid ? 2 : 3);
  }
  for (const [key, comp] of Object.entries(S.ko)) comp.sched.forEach((weeks, r) => weeks.forEach((w, li) => add(w, { k: "ko", comp: key, r, leg: li + 1 }, 1)));
  CAL.contGroups.forEach((w, md) => add(w, { k: "grp", comp: "CC", md }, 0));
  return d.sort((a, b) => a.w - b.w || a.ord - b.ord);
}

/* ---------- season start ---------- */
function newKO(key, kind, name, roundNames, sched, extra) {
  return { key, kind, name, sched, w: null, ru: null, ...extra,
    rounds: roundNames.map((n, i) => ({ name: n, legs: sched[i].length, neutral: i === roundNames.length - 1, ties: null })) };
}
function startSeason() {
  S.phase = "season"; S.week = 0; S.di = 0; S.myRes = []; bumpTick();
  for (const L of Object.values(S.leagues)) { L.fixtures = roundRobin(shuffle(L.clubs.slice())); L.results = []; L.ded = {}; L.n = 0; L._st = null; }
  for (const c of activeClubs()) {
    c.fin = { rev: 0, wages: 0, amort: 0, agent: 0, sales: 0, bought: 0, sold: 0, prize: 0, levy: 0, scheme: 0, merit: 0, ops: 0, scouting: 0 };
    c.revSeason = c.revBase; c.ym = 0; c.tm = 0; c.wkMatches = 0;
  }
  for (const p of Object.values(S.players)) { p.s = newStats(); p.yc = 0; }
  S.ko = {
    FA: newKO("FA", "cup", CUPS.FA.name, CUPS.FA.rounds, CAL.FA),
    LC: newKO("LC", "cup", CUPS.LC.name, CUPS.LC.rounds, CAL.LC),
    CC: newKO("CC", "cont", CONT.CC.name, CONT_ROUNDS, CAL.contKO.CC),
    CS: newKO("CS", "cont", CONT.CS.name, CONT_ROUNDS, CAL.contKO.CS),
    CT: newKO("CT", "cont", CONT.CT.name, CONT_ROUNDS, CAL.contKO.CT),
  };
  for (const k of ENG_LGS) { const po = LG[k].po; if (!po) continue; const names = { c: ["Quarter-finals", "Semi-finals", "Final"], std: ["Semi-finals", "Final"], nl: ["Quarter-finals", "Semi-finals", "Final"] }[po.type]; S.ko["PO" + k] = newKO("PO" + k, "po", leagueName(k) + " play-offs", names, CAL.po[po.type], { lg: k }); }
  setupContinental();
  planRetirements();
  for (const c of activeClubs()) autoRegister(c, isUser(c));  // the summer window's last act: register for the season
  S.days = buildDays();
  newProspectClass();
  S.expPos = expectedPos(me());
}

/* ---------- continental ---------- */
function setupContinental() {
  let q = S.qual;
  if (!q) {
    q = { CC: [], CS: [], CT: [] };
    for (const key of TOP_LGS) { const ids = S.leagues[key].clubs.slice().sort((a, b) => S.lastPos[a] - S.lastPos[b]); q.CC.push(...ids.slice(0, 4)); q.CS.push(...ids.slice(4, 6)); q.CT.push(...ids.slice(6, 8)); }
  }
  S.cont = {};
  for (const key of ["CS", "CT"]) { S.cont[key] = { key, entrants: q[key].slice() }; for (const id of q[key]) pay(id, CONT[key].prize[0]); }
  for (const key of ["CC"]) {
    const byC = {}; for (const id of q[key]) (byC[C(id).country] ||= []).push(id);
    const codes = shuffle(Object.keys(byC)), n = codes.length, groups = Array.from({ length: 8 }, () => []);
    // Pot k holds each country's k-th qualifier; the offsets keep every group to four different countries.
    for (let pot = 0; pot < 4; pot++) for (let g = 0; g < 8; g++) { const id = (byC[codes[(g + 2 * pot) % n]] || [])[pot]; if (id != null && !groups.flat().includes(id)) groups[g].push(id); }
    const placed = new Set(groups.flat()), extra = q[key].filter(id => !placed.has(id));
    for (const g of groups) while (g.length < 4 && extra.length) g.push(extra.shift());
    S.cont[key] = { key, groups, gfix: groups.map(() => roundRobin([0, 1, 2, 3])), gres: [] };
    for (const id of groups.flat()) pay(id, CONT[key].prize[0]);
  }
  S.contIds = [...S.cont.CC.groups.flat(), ...S.cont.CS.entrants, ...S.cont.CT.entrants];
}
function groupTable(key, gi) {
  const K = S.cont[key], rows = K.groups[gi].map(id => ({ id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })), by = Object.fromEntries(rows.map(r => [r.id, r]));
  for (const r of K.gres) if (r.g === gi) tally(by[r.h], by[r.a], r.hg, r.ag);
  return rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || C(b.id).rep - C(a.id).rep);
}
function tally(H, A, hg, ag) {
  H.p++; A.p++; H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
  if (hg > ag) { H.w++; A.l++; H.pts += 3; (H.form ||= []).push("W"); (A.form ||= []).push("L"); }
  else if (hg < ag) { A.w++; H.l++; A.pts += 3; (H.form ||= []).push("L"); (A.form ||= []).push("W"); }
  else { H.d++; A.d++; H.pts++; A.pts++; (H.form ||= []).push("D"); (A.form ||= []).push("D"); }
}

/* ---------- league tables ---------- */
function standings(L) {
  const ver = L.n + ":" + sum(Object.values(L.ded || {})) + ":" + L.clubs.length;
  if (L._st && L._st[0] === ver) return L._st[1];
  const rows = L.clubs.map(id => ({ id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [], ded: (L.ded || {})[id] || 0 })), by = Object.fromEntries(rows.map(r => [r.id, r]));
  for (const rd of L.results || []) for (const r of rd || []) if (by[r.h] && by[r.a]) tally(by[r.h], by[r.a], r.hg, r.ag);
  for (const r of rows) r.pts -= r.ded;
  const h2h = (a, b) => { let pa = 0, pb = 0; for (const rd of L.results) for (const r of rd || []) { if (r.h === a && r.a === b || r.h === b && r.a === a) { const ga = r.h === a ? r.hg : r.ag, gb = r.h === a ? r.ag : r.hg; if (ga > gb) pa += 3; else if (gb > ga) pb += 3; else { pa++; pb++; } } } return pb - pa; };
  rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || h2h(a.id, b.id) || C(a.id).name.localeCompare(C(b.id).name));
  L._st = [ver, rows];
  return rows;
}
const posIn = (L, id) => standings(L).findIndex(r => r.id === id) + 1;
const leagueDone = key => { const L = S.leagues[key]; return L.n >= L.clubs.length / 2 * roundsOf(key); };

/* ---------- knockout draws ---------- */
function pairUp(ids, legs, neutral) {
  shuffle(ids); const ties = [];
  if (ids.length % 2) { const bye = ids.slice().sort((a, b) => C(b).rep - C(a).rep)[0]; ids = ids.filter(x => x !== bye); ties.push({ h: bye, a: null, w: bye, bye: true }); }
  for (let i = 0; i + 1 < ids.length; i += 2) ties.push({ h: ids[i], a: ids[i + 1], legs, neutral, g1: null, g2: null, pens: null, w: null });
  return ties;
}
/* Avoid same-country ties in the first knockout round where the draw allows it. */
function pairUpApart(ids) {
  let best = null, bestN = 99;
  for (let t = 0; t < 40 && bestN > 0; t++) { shuffle(ids); let n = 0; for (let i = 0; i + 1 < ids.length; i += 2) if (C(ids[i]).country === C(ids[i + 1]).country) n++; if (n < bestN) { bestN = n; best = ids.slice(); } }
  const ties = []; for (let i = 0; i + 1 < best.length; i += 2) ties.push({ h: best[i], a: best[i + 1], legs: 2, neutral: false, g1: null, g2: null, pens: null, w: null });
  return ties;
}
const winnersOf = rd => rd && rd.ties && rd.ties.every(t => t.w != null) ? rd.ties.map(t => t.w) : null;
function drawKO(comp, r) {
  const rd = comp.rounds[r]; if (rd.ties) return rd.ties;
  const prev = r > 0 ? winnersOf(comp.rounds[r - 1]) : [];
  if (prev == null) return null;
  const lgIds = k => S.leagues[k].clubs.slice();
  if (comp.kind === "cup") {
    let add = [];
    if (comp.key === "FA") {
      if (r === 0) add = [...lgIds("E5"), ...[...lgIds("E6N"), ...lgIds("E6S")].sort((a, b) => C(b).rep - C(a).rep).slice(0, 40)];
      if (r === 1) add = [...lgIds("E3"), ...lgIds("E4")];
      if (r === 3) add = [...lgIds("E1"), ...lgIds("E2")];
    } else {
      if (r === 0) add = [...lgIds("E2"), ...lgIds("E3"), ...lgIds("E4")];
      if (r === 1) add = lgIds("E1").filter(id => !S.contIds.includes(id));
      if (r === 2) add = lgIds("E1").filter(id => S.contIds.includes(id));
    }
    rd.ties = pairUp([...prev, ...add], rd.legs, rd.neutral);
  } else if (comp.kind === "cont") {
    const K = S.cont[comp.key];
    if (r === 0 && comp.key !== "CC") rd.ties = pairUpApart(K.entrants.slice());
    else if (r === 0) {
      if (K.gres.length < 96) return null;
      const t = K.groups.map((g, gi) => groupTable(comp.key, gi));
      rd.ties = t.map((tb, g) => ({ h: tb[0].id, a: t[g ^ 1][1].id, legs: 2, neutral: false, g1: null, g2: null, pens: null, w: null }));
    } else rd.ties = pairUp(prev, rd.legs, rd.neutral);
  } else {
    const key = comp.lg, po = LG[key].po;
    if (!leagueDone(key)) return null;
    const t = standings(S.leagues[key]).map(r => r.id), seed = pos => t[pos - 1], seedOf = id => t.indexOf(id);
    const T = (h, a, legs, neutral) => ({ h, a, legs, neutral: !!neutral, g1: null, g2: null, pens: null, w: null });
    if (po.type === "std") rd.ties = r === 0 ? [T(seed(po.from), seed(po.to), 2), T(seed(po.from + 1), seed(po.to - 1), 2)] : [T(prev[0], prev[1], 1, true)];
    else {
      const qfH = po.type === "c" ? [5, 6] : [4, 5], qfA = po.type === "c" ? [8, 7] : [7, 6], top = po.type === "c" ? [3, 4] : [2, 3], legs = po.type === "c" ? 2 : 1;
      if (r === 0) rd.ties = [T(seed(qfH[0]), seed(qfA[0]), 1), T(seed(qfH[1]), seed(qfA[1]), 1)];
      else if (r === 1) { const w = prev.slice().sort((a, b) => seedOf(b) - seedOf(a)); rd.ties = [T(seed(top[0]), w[0], legs), T(seed(top[1]), w[1], legs)]; }
      else rd.ties = [T(prev[0], prev[1], 1, true)];
    }
  }
  const mine = rd.ties.find(t => t.h === S.club || t.a === S.club);
  if (mine && mine.a != null) {
    const o = C(mine.h === S.club ? mine.a : mine.h), n = rivalry(S.club, o.id);
    news(`${comp.name} ${rd.name.toLowerCase()} draw: ${rd.legs === 2 ? "you face" : rd.neutral ? "you meet" : mine.h === S.club ? "home to" : "away at"} ${o.name}.${n ? ` ${n >= 2 ? `It's ${rivalName(S.club, o.id)}` : `A tie against your rivals`}${o.lg !== me().lg ? `, a rare meeting across the divisions` : ""}.` : ""}`, n > 0 || comp.kind !== "cup" || r >= 3, comp.kind === "cont" ? "cont" : "cup");
  }
  return rd.ties;
}

/* ---------- fixtures for a day ---------- */
function dayFixtures(day) {
  const out = [];
  if (day.k === "lg") for (const [k, r] of Object.entries(day.rounds)) { if (LG[k].foreign) continue; for (const [h, a] of S.leagues[k].fixtures[r]) out.push({ comp: "L", key: k, round: r, h, a }); }
  if (day.k === "grp") { const K = S.cont[day.comp]; K.gfix.forEach((rd, g) => rd[day.md].forEach(([i, j]) => out.push({ comp: "G", key: day.comp, md: day.md, g, h: K.groups[g][i], a: K.groups[g][j] }))); }
  if (day.k === "ko") {
    const comp = S.ko[day.comp], ties = drawKO(comp, day.r); if (!ties) return out;
    ties.forEach((t, i) => {
      if (t.bye) return;
      const base = { comp: "K", key: day.comp, r: day.r, tie: i, leg: day.leg };
      if (t.legs === 1) out.push({ ...base, h: t.h, a: t.a, neutral: t.neutral, needWinner: true });
      else if (day.leg === 1) out.push({ ...base, h: t.a, a: t.h });
      else if (t.g1) out.push({ ...base, h: t.h, a: t.a, ko: { aggH: t.g1[0], aggA: t.g1[1] } });
    });
  }
  return out;
}
function compLabel(fx) {
  if (fx.comp === "L") return leagueName(fx.key);
  if (fx.comp === "G") return `${CONT[fx.key].name} · Group ${"ABCDEFGH"[fx.g]}`;
  const comp = S.ko[fx.key], rd = comp.rounds[fx.r];
  return `${comp.name} · ${rd.name}${rd.legs === 2 ? (fx.leg === 1 ? ", 1st leg" : ", 2nd leg") : ""}`;
}

/* ---------- recording results ---------- */
const FA_PRIZE = [25e3, 50e3, 85e3, 150e3, 250e3, 400e3, 800e3, 1.5e6, 3e6], LC_PRIZE = [50e3, 75e3, 100e3, 200e3, 400e3, 800e3, 2e6];
function pay(id, amt) { const c = C(id); c.cash += amt; c.fin.prize += amt; }
function recordResult(fx, M) {
  const hg = M.h.goals, ag = M.a.goals;
  let att = null;
  if (fx.comp === "L") { const L = S.leagues[fx.key]; (L.results[fx.round] ||= []).push({ h: fx.h, a: fx.a, hg, ag }); L.n++; att = gateFor(C(fx.h), fx.a); fansAfterMatch(C(fx.h), hg, ag, fx.a); fansAfterMatch(C(fx.a), ag, hg, fx.h); }
  if (fx.comp === "G") { S.cont[fx.key].gres.push({ g: fx.g, h: fx.h, a: fx.a, hg, ag }); if (hg !== ag) pay(hg > ag ? fx.h : fx.a, CONT[fx.key].prize[1]); }
  if (fx.comp === "K") {
    const comp = S.ko[fx.key], rd = comp.rounds[fx.r], t = rd.ties[fx.tie];
    if (t.legs === 1) { t.g1 = [hg, ag]; t.pens = M.pens; t.w = tieWinner(M); }
    else if (fx.leg === 1) t.g1 = [ag, hg];
    else { t.g2 = [hg, ag]; t.pens = M.pens; t.w = tieWinner(M); }
    if (t.w != null) {
      if (comp.key === "FA") pay(t.w, FA_PRIZE[fx.r]); else if (comp.key === "LC") pay(t.w, LC_PRIZE[fx.r]); else if (comp.kind === "cont") pay(t.w, CONT[comp.key].prize[1] * (fx.r + 2));
      if (fx.r === comp.rounds.length - 1) {
        comp.w = t.w; comp.ru = t.w === t.h ? t.a : t.h; const W = C(t.w);
        if (comp.kind === "po") news(`${W.name} beat ${C(comp.ru).name} in the ${comp.name} final and are promoted.`, Math.abs(LG[comp.lg].tier - me().tier) <= 1, "league");
        else {
          W.trophies.push({ y: S.year, t: comp.key });
          if (comp.kind === "cont") { pay(t.w, CONT[comp.key].prize[2]); W.rep = Math.min(99, W.rep + 2); }
          news(`${W.name} win the ${comp.name}, beating ${C(comp.ru).name}${M.pens ? " on penalties" : ""}.`, true, comp.kind === "cont" ? "cont" : "cup");
        }
      }
    }
  }
  recordRivalry(fx.h, fx.a, hg, ag);
  if (fx.h === S.club || fx.a === S.club) {
    S.myRes.push({ w: S.week, label: compLabel(fx), comp: fx.comp, h: fx.h, a: fx.a, hg, ag, pens: M.pens, et: M.et, att, sc: M.goals.map(g => [g.side, g.n, g.min]) });
    afterUserMatch(fx, M);
  }
}

/* ---------- foreign leagues: quick results from club strength ---------- */
function quickLeagueRound(key, r) {
  const L = S.leagues[key], rd = (L.results[r] ||= []);
  const pois = l => { let k = 0, p = Math.exp(-l), s = p; const u = R(); while (u > s && k < 9) { k++; p *= l / k; s += p; } return k; };
  for (const [h, a] of L.fixtures[r]) {
    const H = C(h), A = C(a), d = (clubLevel(H) - clubLevel(A)) * .085;
    const hg = pois(1.32 * Math.exp(d) * 1.1), ag = pois(1.32 * Math.exp(-d) / 1.1);
    rd.push({ h, a, hg, ag }); L.n++; recordRivalry(h, a, hg, ag); gateFor(H, a); fansAfterMatch(H, hg, ag, a); fansAfterMatch(A, ag, hg, h);
    for (const [c, gf, ga] of [[H, hg, ag], [A, ag, hg]]) {
      const xi = autoPick(eligibleIds(c), c.formation).filter(x => x != null).map(P), won = gf > ga, lost = gf < ga;
      for (const p of xi) { p.s.app++; p.s.min += 90; p.wm += 90; p.s.rt += clamp(6.4 + (won ? .35 : lost ? -.35 : 0) + (p.ovr - clubLevel(c)) / 25 + gauss() * .3, 3, 10); if (R() < .009 * injMult(p)) injure(p); }
      for (let g = 0; g < gf; g++) { const s = wpick(xi, p => ({ GK: 0, CB: .5, FB: .5, DM: .8, CM: 1.6, AM: 3, W: 4, ST: 6 })[p.pos] * p.ovr); s.s.g++; s.s.lg++; s.s.rt += .9; }
      c.wkMatches++;
    }
  }
}

/* ---------- playing a day ---------- */
function playOthers(day, fxs) {
  bumpTick();
  if (day.k === "lg") for (const [k, r] of Object.entries(day.rounds)) if (LG[k].foreign) quickLeagueRound(k, r);
  for (const fx of fxs) { if (fx.h === S.club || fx.a === S.club) continue; const M = runToEnd(makeMatch(fx, true)); applyMatch(M); recordResult(fx, M); }
}
function userFixture(fxs) { return fxs.find(fx => fx.h === S.club || fx.a === S.club) || null; }
function finishDay() {
  S.di++;
  if (S.di >= S.days.length) { weekly(); endSeason(); return; }
  if (S.days[S.di].w > S.week) { weekly(); S.week = S.days[S.di].w; }
}

/* ---------- the weekly cycle ---------- */
function weekly() {
  const wk = 1 / 52; bumpTick();
  for (const c of activeClubs()) {
    const wages = sum(c.squad, id => P(id).wage) * wk, amort = sum(c.squad, id => P(id).am ? P(id).am.per : 0) * wk, rev = c.revSeason * wk;
    // Staff, stadium and running costs sit outside the cost ratio but still come out of the bank.
    const ops = rev * .2; c.fin.ops += ops;
    c.fin.rev += rev; c.fin.wages += wages; c.fin.amort += amort; c.cash += rev - wages - ops;
    if (isUser(c)) { const sc = S.rec.scoutLvl * scoutCost(); c.cash -= sc * wk; c.fin.scouting += sc * wk; }
    const t = TRAIN[isUser(c) ? S.training : "bal"], acad = 1 + c.academy * .015, co = coachOf(c), coachDev = .6 + .04 * (co ? co.dev : 10);
    const possible = Math.max(1, c.wkMatches) * 90;
    for (const id of c.squad) {
      const p = P(id);
      p.fit = Math.min(100, p.fit + t.fit);
      p.pt = .75 * p.pt + .25 * Math.min(1, p.wm / possible); p.wm = 0;
      if (p.inj > 0) p.inj--;
      // Potential is a ceiling, not a promise: minutes, form, happiness and the coach decide how close a player gets.
      if (p.ovr < p.pot) {
        const form = p.s.app >= 3 ? clamp((p.s.rt / p.s.app - 6) / 1.2, 0, 1.5) : .5;
        const ch = (p.age <= 18 ? .085 : p.age <= 21 ? .07 : p.age <= 24 ? .04 : p.age <= 27 ? .015 : 0) * 1.12 * t.grow * (p.age <= 21 ? acad : 1)
          * coachDev * (.6 + .6 * p.pt) * (.8 + .4 * p.mood / 100) * (.85 + .2 * form);
        if (R() < ch) growAttrs(p, 1);
      }
      if (isUser(c) && S.training === "int" && !p.inj && R() < .006 * injMult(p)) injure(p, true);
    }
    c.wkMatches = 0;
  }
  for (const c of activeClubs()) { stadiumWeek(c); sponsorPay(c, 1 / 52); if (windowOpen() && !isUser(c)) refreshRegistration(c); }
  for (const id of S.fa) { const p = P(id); p.fit = 100; if (p.inj) p.inj--; }
  weeklyMood();
  weeklyRecruiting();
  weeklyStories();
  if (CAL.jan.includes(S.week + 1) || CAL.jan.includes(S.week)) aiTransferDay(.12);
  if (S.week === CAL.jan[0] - 1) news("The January transfer window is now open.", true, "transfer");
  if (S.week === CAL.jan[CAL.jan.length - 1]) news("The January transfer window has closed.", true, "transfer");
}
const scoutCost = () => [0, 4e5, 2.5e5, 1.2e5, 6e4, 4e4, 4e4][me().tier];

/* ---------- board ---------- */
function afterUserMatch(fx, M) {
  const home = M.h.club === S.club, mine = home ? M.h : M.a, them = home ? M.a : M.h, opp = C(them.club);
  const w = matchWinner(M), pts = w === S.club ? 3 : w == null ? 1 : 0;
  let delta = 0;
  if (fx.comp === "L") delta = Math.round((pts - clamp(1.35 + (clubLevel(me()) - clubLevel(opp) + (home ? 2 : -2)) * .07, .3, 2.6)) * 1.4);
  else if (pts === 0 && clubLevel(opp) < clubLevel(me()) - 6) delta = -3;
  else if (pts === 3 && clubLevel(opp) > clubLevel(me()) + 4) delta = 2;
  if (me().cash < 0) delta -= 2;
  delta += derbyAftermath(fx, M, pts);
  S.board = clamp(S.board + delta, 0, 100);
  const word = pts === 3 ? "Win" : pts === 1 ? "Draw" : "Defeat";
  news(`${word} ${fx.neutral ? "against" : home ? "at home to" : "away at"} ${opp.name}, ${mine.goals}–${them.goals}${M.pens ? ` (${M.pens[home ? 0 : 1]}–${M.pens[home ? 1 : 0]} pens)` : ""}. ${compLabel(fx)}.${delta ? ` Board ${delta > 0 ? "+" : ""}${delta}.` : ""}`, pts === 3, "result");
  for (const id of M.inj) if (P(id).club === S.club) news(`${P(id).name} is injured and will miss about ${P(id).inj} week${P(id).inj > 1 ? "s" : ""}.`, false, "squad");
  for (const [id, g] of M.reds) if (P(id).club === S.club) news(`${P(id).name} was sent off and is banned for ${g} match${g > 1 ? "es" : ""}.`, false, "squad");
  if (S.board <= 0 && !S.set.unsackable) S.sacked = true;  // unsackable mode: the board grumbles but can't fire you
}

/* ---------- end of season ---------- */
function awardsFor(key) {
  const L = S.leagues[key], ps = L.clubs.flatMap(id => C(id).squad.map(P));
  const avg = p => p.s.app ? p.s.rt / p.s.app : 0, n = roundsOf(key);
  const top = ps.slice().sort((a, b) => b.s.lg - a.s.lg || a.s.app - b.s.app)[0];
  const poty = ps.filter(p => p.s.app >= n * .55).sort((a, b) => avg(b) - avg(a))[0];
  const ypoty = ps.filter(p => p.s.app >= n * .3 && p.age <= 21).sort((a, b) => avg(b) - avg(a))[0];
  const tag = (p, v, what) => { if (!p) return null; (p.awards ||= []).push(`${what} ${seasonLabel(S.year)}`); return [p.id, p.name, C(p.club).short, v]; };
  return { top: top && top.s.lg ? tag(top, top.s.lg, "Golden boot, " + leagueName(key)) : null,
    poty: poty ? tag(poty, +avg(poty).toFixed(2), "Player of the season, " + leagueName(key)) : null,
    ypoty: ypoty ? tag(ypoty, +avg(ypoty).toFixed(2), "Young player of the season, " + leagueName(key)) : null };
}
function endSeason() {
  bumpTick();
  const rec = { year: S.year, L: {}, K: {} };
  const tables = {};
  for (const key of Object.keys(S.leagues)) {
    const L = S.leagues[key], t = standings(L); tables[key] = t.map(r => r.id);
    const champ = C(t[0].id); champ.trophies.push({ y: S.year, t: key });
    rec.L[key] = { table: t.map(r => [r.id, r.pts]), champ: champ.id, ...(TOP_LGS.includes(key) || !LG[key].foreign ? awardsFor(key) : {}) };
    t.forEach((r, i) => {
      const c = C(r.id); c.hist.push({ y: S.year, lg: key, pos: i + 1, pts: r.pts });
      S.lastPos[r.id] = i + 1;
      const merit = c.revBase * (LG[key].tier === 1 ? .2 : .06) * (L.clubs.length - 1 - i) / (L.clubs.length - 1); c.cash += merit; c.fin.merit += merit;
    });
    if (key === "E1" || key === me().lg) news(`${champ.name} win the ${leagueName(key)}.${rec.L[key].top ? ` ${rec.L[key].top[1]} takes the golden boot with ${rec.L[key].top[3]}.` : ""}`, true, "league");
  }
  for (const [k, comp] of Object.entries(S.ko)) rec.K[k] = { w: comp.w, ru: comp.ru };
  const myKey = me().lg, myPos = tables[myKey].indexOf(S.club) + 1;

  // continental places for next season
  const q = { CC: [], CS: [], CT: [] };
  for (const key of TOP_LGS) {
    const t = tables[key], top4 = t.slice(0, 4); q.CC.push(...top4);
    if (key === "E1") {
      const taken = new Set(top4);
      const pickQ = (w, ru, label) => {
        let id = w;
        if (id == null || taken.has(id)) { if (id != null && ru != null && !taken.has(ru)) news(`${C(w).name} already qualify for Europe, so the ${label} place passes to runners-up ${C(ru).name}.`, true, "cont"); id = ru; }
        if (id == null || taken.has(id)) id = t.find(x => !taken.has(x));
        taken.add(id); return id;
      };
      const next = () => { const id = t.find(x => !taken.has(x)); taken.add(id); return id; };
      // National Cup winner goes to the Shield, League Cup winner to the Trophy; each passes on if already qualified.
      q.CS.push(pickQ(S.ko.FA.w, S.ko.FA.ru, CUPS.FA.name), next());
      q.CT.push(pickQ(S.ko.LC.w, S.ko.LC.ru, CUPS.LC.name), next());
    } else { q.CS.push(t[4], t[5]); q.CT.push(t[6], t[7]); }
  }
  S.qual = q;

  // promotion and relegation down the English pyramid
  const ups = {}, downs = {};
  for (const key of ENG_LGS) {
    const L = LG[key], t = tables[key], up = t.slice(0, L.up), po = S.ko["PO" + key];
    if (po) { let w = po.w; if (w == null || up.includes(w)) w = t.find(id => !up.includes(id)); up.push(w); }
    ups[key] = key === "E1" ? [] : up;
    downs[key] = t.slice(t.length - L.down);
  }
  const moves = [];
  const move = (id, to, dir) => {
    const c = C(id), from = c.lg; S.leagues[from].clubs = S.leagues[from].clubs.filter(x => x !== id); S.leagues[to].clubs.push(id);
    c.lg = to; c.tier = LG[to].tier;
    const ratio = Math.pow(S.revK[to] / S.revK[from], .7); c.revBase = Math.round(c.revBase * ratio); rescalePrice(c, ratio); sponsorClause(c, dir);
    // Relegation clauses: wages fall roughly in line with income.
    if (dir === "down") { c.rep = Math.max(8, c.rep - 4); for (const pid of c.squad) P(pid).wage = Math.round(P(pid).wage * clamp(ratio * 1.1, .55, .95)); if (isUser(c)) news("Relegation clauses cut the squad's wages.", true, "finance"); }
    else c.rep = Math.min(90, c.rep + 4);
    moves.push([id, dir, from, to]);
  };
  for (const key of ["E1", "E2", "E3", "E4"]) for (const id of downs[key]) move(id, LG_BELOW[key], "down");
  downs.E5.slice().sort((a, b) => C(b).lat - C(a).lat).forEach((id, i) => move(id, i < 2 ? "E6N" : "E6S", "down"));
  for (const key of ["E2", "E3", "E4", "E5", "E6N", "E6S"]) for (const id of ups[key]) move(id, LG_ABOVE[key], "up");
  // the bottom of step two drops out of the game; new clubs come up from the regional leagues
  for (const key of ["E6N", "E6S"]) for (const id of downs[key]) {
    const c = C(id); c.gone = true; c.goneYear = S.year; dropRivals(c); S.leagues[key].clubs = S.leagues[key].clubs.filter(x => x !== id);
    for (const pid of c.squad.slice()) { const p = P(pid); if (!p) continue; if (p.loan) { endLoan(p); continue; } if (p.age < 31 && R() < .6) toFreeAgent(p); else retirePlayer(p); }
    c.squad = [];
    const wasMine = isUser(c);
    if (wasMine && !S.set.unsackable) { S.sacked = true; S.sackReason = `${c.name} dropped out of the National Division.`; }
    const n = newClub(key, clamp(Math.round(LG[key].rep[0] - 13 + gauss() * 2), 8, 24)); genSquad(n); autoRegister(n, false); setupFinances(n); S.leagues[key].clubs.push(n.id); assignRivals(n); initStadium(n); initSponsors(n); n.newcomer = S.year;
    n.fin = { rev: 0, wages: 0, amort: 0, agent: 0, sales: 0, bought: 0, sold: 0, prize: 0, levy: 0, scheme: 0, merit: 0, ops: 0, scouting: 0 };
    // In unsackable mode you can't be left without a club: you take over one of the newcomers instead.
    if (wasMine && S.set.unsackable) { S.club = n.id; S.lineup = []; S.formation = S.me.form; n.formation = S.me.form; news(`${c.name} have dropped out of the National Division. You take charge of newcomers ${n.name}.`, true, "board"); }
    moves.push([n.id, "new", null, key]);
  }
  for (const c of Object.keys(FOREIGN_DEF)) {
    const t1 = tables[c + "1"], t2 = tables[c + "2"], t3 = tables[c + "3"];
    for (const id of t1.slice(-3)) move(id, c + "2", "down");
    for (const id of t2.slice(-3)) move(id, c + "3", "down");
    for (const id of t2.slice(0, 3)) move(id, c + "1", "up");
    for (const id of t3.slice(0, 3)) move(id, c + "2", "up");
  }
  for (const key of ENG_LGS) { rec.L[key].up = ups[key]; rec.L[key].down = downs[key]; }
  news(`Promoted: ${ENG_LGS.filter(k => k !== "E1").map(k => `${ups[k].map(id => C(id).short).join(", ")} from the ${leagueName(k)}`).join("; ")}.`, true, "league");
  news(`New to the National Division North and South: ${moves.filter(m => m[1] === "new").map(m => C(m[0]).name).join(", ")}.`, false, "league");

  // reputation follows results; income drifts toward what that reputation earns in the division
  for (const key of Object.keys(S.leagues)) rec.L[key].table.forEach(([id], i) => { const c = C(id); if (c.gone) return; const target = LG[key].rep[0] - (i + 1) * LG[key].rep[1]; c.rep = clamp(Math.round(c.rep * .85 + target * .15), 8, 99); });
  for (const c of activeClubs()) { const fair = S.revK[c.lg] * Math.pow(1.061, c.rep), old = c.revBase; c.revBase = Math.round(c.revBase * .8 + fair * .2); rescalePrice(c, c.revBase / Math.max(1, old)); c.lastAtt = c.att[1] ? Math.round(c.att[0] / c.att[1]) : c.lastAtt; c.att = [0, 0]; aiStadium(c); }

  // finances close: the summer share of income and costs, then the cost-ratio check
  for (const c of activeClubs()) {
    const k = 10 / 52, wages = sum(c.squad, id => P(id).wage) * k, amort = sum(c.squad, id => P(id).am ? P(id).am.per : 0) * k, rev = c.revSeason * k;
    c.fin.rev += rev; c.fin.wages += wages; c.fin.amort += amort; c.fin.ops += rev * .2; c.cash += rev - wages - rev * .2;
    sponsorPay(c, k);
  }
  // sponsor bonuses for what each club achieved, then renewals at today's market value
  for (const c of activeClubs()) sponsorSeason(c, {
    title: false,  // title bonuses are paid just below, to each league's champions
    up: moves.some(m => m[0] === c.id && m[1] === "up"),
    europe: [...q.CC, ...q.CS, ...q.CT].includes(c.id),
    cup: c.trophies.some(t => t.y === S.year && !LG[t.t]),
  });
  for (const key of Object.keys(rec.L)) { const ch = C(rec.L[key].champ); if (ch.deals && !ch.gone) { const paid = sum(ch.deals, d => d.bonus.title); ch.cash += paid; ch.fin.rev += paid; ch.fin.spons = (ch.fin.spons || 0) + paid; if (isUser(ch)) news(`Sponsors pay a ${money(paid)} title bonus.`, true, "finance"); } }
  assessSCR();
  for (const c of activeClubs()) if (c.cash > c.revBase) { const inv = Math.round((c.cash - c.revBase) * .5); c.cash -= inv; if (isUser(c)) news(`The board invests ${money(inv)} of surplus cash in the stadium and training ground.`, false, "finance"); }

  // board verdict
  const exp = S.expPos, myMove = moves.find(m => m[0] === S.club);
  let d = (exp - myPos) * (LG[myKey].tier === 1 ? 2.5 : 1.6);
  const won = me().trophies.filter(t => t.y === S.year);
  d += won.length * 10;
  if (myMove && myMove[1] === "down") d -= 30;
  moveFans(me(), clamp((exp - myPos) * 1.5, -10, 10) + won.length * 5 + (myMove && myMove[1] === "up" ? 8 : myMove && myMove[1] === "down" ? -8 : 0), "The season as a whole");
  if (myMove && myMove[1] === "up") d += 20;
  d = Math.round(d);
  S.board = clamp(S.board + d, 0, 100);
  S.career.unshift({ year: S.year, club: S.club, lg: myKey, pos: myPos, exp, trophies: won.map(t => t.t), board: d });
  // You earn coaching points to spend: one a season, more for beating the target or winning something.
  const earned = 1 + (myPos < exp ? 1 : 0) + Math.min(2, won.length) + (myMove && myMove[1] === "up" ? 1 : 0);
  S.me.pts += earned; S.me.seasons++;
  if (S.me.formPending) { S.me.form = S.me.formPending; S.me.formPending = null; }
  // AI coaches improve slowly too, and drift back if they're past it.
  for (const c of activeClubs()) if (!isUser(c) && c.coach && R() < .3) { const k = pick(COACH_KEYS)[0]; c.coach[k] = clamp(c.coach[k] + (R() < .7 ? 1 : -1), 1, 20); }
  S.seasonOver = { pos: myPos, exp, lg: myKey, board: d, earned, won: won.map(t => t.t), moved: myMove ? myMove[1] : null, to: myMove ? myMove[3] : null };
  if (S.board <= 0 && !S.set.unsackable) S.sacked = true;  // unsackable mode: the board grumbles but can't fire you

  // player records, then loans go home
  for (const p of Object.values(S.players)) {
    if (p.club >= 0 && p.s.app > 0 && (!isForeign(C(p.club)) || C(p.club).tier === 1 || p.hist.length)) p.hist.push([S.year, C(p.club).short, p.club, p.s.app, p.s.g, p.s.a, +(p.s.rt / p.s.app).toFixed(2), p.loan ? 1 : 0]);
    p.tot[0] += p.s.app; p.tot[1] += p.s.g;
  }
  for (const p of Object.values(S.players)) if (p.loan) endLoan(p);
  for (const c of activeClubs()) c.youthMin = c.tm ? clamp(c.ym / c.tm, 0, .5) : c.youthMin;
  S.history.unshift(rec);
  S.cases = S.cases.filter(k => k.y >= S.year - 3);

  signingDay();
  ageAndContracts();
  for (const c of activeClubs()) if (!isUser(c)) aiMaintain(c);
  S.phase = "summer"; S.summerDay = 0; S.seasonOverSeen = false;
  news(`The ${seasonLabel(S.year)} season is over. The summer transfer window is open.`, true, "transfer");
}

function ageAndContracts() {
  for (const p of Object.values(S.players)) {
    const c = p.club >= 0 ? C(p.club) : null;
    if (c && p.age <= 20) p.yt[c.country] = (p.yt[c.country] || 0) + 1;
    p.age++;
    if (p.age >= 29) { declineAttrs(p, ri(0, Math.min(4, p.age - 27))); p.pot = p.ovr; }
    else if (p.age <= 24) {
      // Young players who don't play, or are miserable, lose some of their ceiling; a breakout season raises it.
      const avg = p.s.app ? p.s.rt / p.s.app : 6.4;
      let d = ri(-2, 1);
      if (p.age >= 18 && p.pt < .25) d -= ri(1, 3);
      if (p.mood < 35) d -= ri(0, 2);
      if (p.pt > .6 && avg >= 7) d += ri(1, 3);
      p.pot = clamp(p.pot + d, p.ovr, 95);
    }
    p.fit = 100; p.sus = 0; p.inj = Math.max(0, p.inj - 10); p.yc = 0; p.req = p.req && p.mood < 40; p.promise = null;
    if (p.retiring || p.age >= 41) {
      if (c) { c.squad = c.squad.filter(id => id !== p.id); if (isUser(c)) news(p.retiring === 1 ? `${p.name} retires, as he told you he would, aged ${p.age}.` : `${p.name} surprises the club by announcing his retirement, aged ${p.age}.`, true, "squad"); }
      retirePlayer(p); continue;
    }
    if (!c) continue;
    if (p.am) { p.am.left--; if (p.am.left <= 0) p.am = null; }
    p.yrs--;
    if (p.yrs <= 0) {
      if (isUser(c)) { c.squad = c.squad.filter(id => id !== p.id); toFreeAgent(p); news(`${p.name}'s contract has expired and he has left the club.`, false, "squad"); }
      else if (p.age < 32 && p.ovr >= clubLevel(c) - 9 && R() < .8 && !p.req) { p.yrs = ri(1, 4); p.wage = wageDemand(p, c.rep); }
      else { c.squad = c.squad.filter(id => id !== p.id); toFreeAgent(p); }
    }
  }
  S.fa = S.fa.filter(id => S.players[id]);
  if (S.fa.length > 300) { const drop = S.fa.map(P).sort((a, b) => value(a) - value(b)).slice(0, S.fa.length - 300); for (const p of drop) retirePlayer(p); }
  for (const id of S.lineup) if (id != null && !S.players[id]) S.lineup = S.lineup.map(x => x === id ? null : x);
}
/* AI clubs refill thin positions, stay inside the registration rules, and trim costs their owner won't carry. */
function aiMaintain(c) {
  const need = { GK: 2, CB: 4, FB: 3, DM: 2, CM: 3, AM: 2, W: 3, ST: 3 };
  for (const [pos, n] of Object.entries(need)) {
    let have = c.squad.filter(id => P(id).pos === pos && P(id).age >= 18).length;
    while (have++ < n) {
      bumpTick(); const lvl = clubLevel(c);
      const fa = S.fa.map(P).filter(p => p.pos === pos && p.ovr >= lvl - 10 && p.ovr <= lvl + 2).sort((a, b) => b.ovr - a.ovr)[0];
      if (fa) { S.fa = S.fa.filter(id => id !== fa.id); fa.club = c.id; fa.yrs = ri(1, 3); fa.wage = wageDemand(fa, c.rep); fa.joined = S.year; c.squad.push(fa.id); }
      // Fillers are journeymen a little below the club's level; generating young ones here fed a ratings spiral.
      // Anchored to reputation, not current level, so divisions neither spiral up nor drain away over decades.
      else { const age = ri(21, 29), p = makePlayer({ pos, base: lvlForRep(c.rep) - 3, age, nat: R() < .7 ? c.country : pick(ALL_NATS), club: c.id, rep: c.rep }); p.pot = p.ovr + (age <= 24 ? ri(0, 3) : 0); if (p.nat === c.country) p.yt[c.country] = 3; c.squad.push(p.id); }
    }
  }
  const cap = c.owner === "reckless" ? 1.18 : OWNER[c.owner].target[1] + .06;
  let guard = 0;
  while (scr(c) > cap && c.squad.length > 22 && guard++ < 8) {
    const p = c.squad.map(P).filter(isSenior).sort((a, b) => b.wage / Math.max(1, b.ovr - 40) - a.wage / Math.max(1, a.ovr - 40))[0];
    if (!p) break; c.squad = c.squad.filter(id => id !== p.id); toFreeAgent(p);
  }
  trimSquad(c, false);
}

/* ---------- summer ---------- */
function summerStep() {
  aiTransferDay(.5);
  if (S.summerDay === 2) aiLoans();
  S.summerDay++;
  if (S.summerDay >= CAL.summerDays) newSeasonStart();
}
function newSeasonStart() {
  for (const c of activeClubs()) { const n = (isUser(c) ? 1 : ri(1, 2)) + (c.academy >= 15 ? 1 : 0); for (let i = 0; i < n; i++) { const p = academyPlayer(c, 16); p.yt[c.country] = 1; if (isUser(c)) news(`Local academy graduate ${p.name} (${p.pos}) joins the youth squad.`, false, "youth"); } if (!isUser(c)) trimSquad(c, false); }
  S.year++;
  S.seasonOver = null;
  startSeason();
  fixUserLineup();
  // Promotion and relegation can bring a derby back into the fixture list, or take it away.
  for (const id of Object.keys(me().rivals || {}).map(Number)) {
    const o = C(id); if (o.gone) continue;
    const was = (o.hist[o.hist.length - 1] || {}).lg, mineWas = (me().hist[me().hist.length - 1] || {}).lg;
    if (o.lg === me().lg && was !== mineWas) news(rivalry(S.club, id) >= 2 ? `${rivalName(S.club, id).replace(/^the /, "The ")} is back: you and ${o.name} are in the same division again.` : `You and rivals ${o.name} are in the same division again.`, true, "league");
    else if (o.lg !== me().lg && was === mineWas) news(`No league meetings with ${rivalry(S.club, id) >= 2 ? "derby rivals " : "rivals "}${o.name} this season: they're now in the ${leagueName(o.lg)}. Only a cup draw can bring you together.`, false, "league");
  }
  news(`The ${seasonLabel(S.year)} season begins. The board's target: ${expText(S.expPos, me().lg).toLowerCase()}.`, true, "board");
}
