"use strict";
/* Calendar, competitions, standings, the weekly cycle and the end of season. */
const whenLabel = () => S.phase === "summer" ? "Pre-wk " + (S.summerDay + 1) : "Wk " + (S.week + 1);
function news(t, hi, tag) { S.news.unshift({ t, hi: !!hi, tag: tag || "", y: S.year, w: whenLabel() }); if (S.news.length > 160) S.news.length = 160; }
const seasonLabel = y => `${y}–${String((y + 1) % 100).padStart(2, "0")}`;

/* A double round robin where home and away alternate (the standard "canonical" schedule): round r pairs the last club
   with club r (home in even rounds) and clubs r+k and r-k (mod n-1), the first at home when k is odd, so as a club's
   k changes by one each round its venue flips. The old rotation kept most pairs'
   orientation fixed while clubs moved along the circle: one club played 19 away games in a row, then 23 at home. */
function roundRobin(ids) {
  const n = ids.length, m = n - 1, rounds = [];
  for (let r = 0; r < m; r++) {
    const rd = [r % 2 ? [ids[r], ids[m]] : [ids[m], ids[r]]];
    for (let k = 1; k < n / 2; k++) { const a = ids[(r + k) % m], b = ids[(r - k + m) % m]; rd.push(k % 2 ? [a, b] : [b, a]); }
    rounds.push(rd);
  }
  // The second half mirrors the first starting from its second round, so nobody gets three home or away games in a
  // row at the turn (mirroring in order gave two clubs a run of three; never more than two this way).
  return rounds.concat(rounds.slice(1).concat(rounds.slice(0, 1)).map(rd => rd.map(([a, b]) => [b, a])));
}
/* Re-arrange the rest of a season drawn with the old generator (long home/away runs), keeping what's been played. Two
   moves keep the fixture list valid: reorder the remaining rounds, and swap the legs of a pairing neither of whose
   games has been played (A hosts B in one round, B hosts A in another). A search (simulated annealing) on those moves
   minimises runs of home or away games (two in a row costs 1, three 10, longer far more), counting the last two
   games already played, and keeps a pair's two meetings at least four rounds apart. */
function rebalanceFixtures(L, iters = 15000) {
  const done = (L.results || []).length, rest = L.fixtures.slice(done).map(rd => rd.map(m => m.slice())); if (rest.length < 4) return null;
  const teams = L.clubs, idx = new Map(teams.map((t, i) => [t, i])), T = teams.length, Rn = rest.length;
  // venue[r][t]: +1 home, -1 away in remaining round r (rounds are reordered, not rewritten, so this only changes on a flip)
  const venue = rest.map(rd => { const v = new Int8Array(T); for (const [h, a] of rd) { v[idx.get(h)] = 1; v[idx.get(a)] = -1; } return v; });
  const tail = teams.map(t => L.fixtures.slice(Math.max(0, done - 2), done).map(rd => { const m = rd.find(x => x[0] === t || x[1] === t); return m ? (m[0] === t ? 1 : -1) : 0; }));
  const lastMeet = {}; L.fixtures.slice(0, done).forEach((rd, r) => { for (const [h, a] of rd) lastMeet[Math.min(h, a) + "-" + Math.max(h, a)] = r - done; });
  const legs = {}; rest.forEach((rd, r) => rd.forEach((m, i) => { const key = Math.min(m[0], m[1]) + "-" + Math.max(m[0], m[1]); (legs[key] ||= []).push([r, i]); }));
  const legList = Object.entries(legs).map(([k, l]) => ({ l, last: lastMeet[k] })), both = legList.filter(x => x.l.length === 2).map(x => x.l);
  const order = rest.map((_, i) => i), pos = new Int32Array(Rn);
  const cost = () => {
    let c = 0; for (let p = 0; p < Rn; p++) pos[order[p]] = p;
    for (let t = 0; t < T; t++) {
      let prev = 0, run = 0;
      for (const v of tail[t]) { if (v && v === prev) run++; else { run = v ? 1 : 0; prev = v; } }
      for (let p = 0; p < Rn; p++) { const v = venue[order[p]][t]; if (v && v === prev) { run++; c += run === 2 ? 1 : run === 3 ? 10 : 30 * (run - 2); } else { run = v ? 1 : 0; prev = v; } }
    }
    for (const { l, last } of legList) {
      if (l.length === 2) { if (Math.abs(pos[l[0][0]] - pos[l[1][0]]) < 4) c += 5; }
      else if (last != null && pos[l[0][0]] - last < 4) c += 5;
    }
    return c;
  };
  const flip = l => { for (const [r, i] of l) { const m = rest[r][i]; rest[r][i] = [m[1], m[0]]; venue[r][idx.get(m[0])] *= -1; venue[r][idx.get(m[1])] *= -1; } };
  let cur = cost(); const start = cur;
  for (let it = 0; it < iters; it++) {
    const temp = 4 * Math.pow(.002, it / iters);
    if (R() < .5 || !both.length) { const a = Math.floor(R() * Rn), b = Math.floor(R() * Rn); [order[a], order[b]] = [order[b], order[a]]; const nc = cost(); if (nc <= cur || R() < Math.exp((cur - nc) / temp)) cur = nc; else [order[a], order[b]] = [order[b], order[a]]; }
    else { const l = both[Math.floor(R() * both.length)]; flip(l); const nc = cost(); if (nc <= cur || R() < Math.exp((cur - nc) / temp)) cur = nc; else flip(l); }
  }
  L.fixtures = L.fixtures.slice(0, done).concat(Array.from(order, r => rest[r])); L._st = null;
  return { start, end: cur };
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
    if (c.pre) { for (const k of ["sales", "sold", "bought", "agent"]) c.fin[k] += c.pre[k] || 0; c.pre = null; }  // this summer's transfers (acct)
    c.revSeason = c.revBase; c.ym = 0; c.tm = 0; c.wkMatches = 0; c.xs = { xg: 0, xga: 0 };
  }
  for (const p of Object.values(S.players)) { p.s = newStats(); p.yc = 0; if (p.as) p.as = null; }
  S.acadRes = [];
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
  // Pre-season predictions for every English club, used for Manager of the Season.
  S.expAll = {}; for (const k of ENG_LGS) S.leagues[k].clubs.forEach(id => S.expAll[id] = expectedPos(C(id)));
}

/* ---------- continental ---------- */
function setupContinental() {
  let q = S.qual;
  if (!q) {
    q = { CC: [], CS: [], CT: [] };
    for (const key of TOP_LGS) { const ids = S.leagues[key].clubs.slice().sort((a, b) => S.lastPos[a] - S.lastPos[b]); q.CC.push(...ids.slice(0, 4)); q.CS.push(...ids.slice(4, 6)); q.CT.push(...ids.slice(6, 8)); }
  }
  S.cont = {};
  for (const key of ["CS", "CT"]) { S.cont[key] = { key, entrants: q[key].slice() }; for (const id of q[key]) pay(id, CONT[key].prize[0], key); }
  for (const key of ["CC"]) {
    const byC = {}; for (const id of q[key]) (byC[C(id).country] ||= []).push(id);
    const codes = shuffle(Object.keys(byC)), n = codes.length, groups = Array.from({ length: 8 }, () => []);
    // Pot k holds each country's k-th qualifier; the offsets keep every group to four different countries.
    for (let pot = 0; pot < 4; pot++) for (let g = 0; g < 8; g++) { const id = (byC[codes[(g + 2 * pot) % n]] || [])[pot]; if (id != null && !groups.flat().includes(id)) groups[g].push(id); }
    const placed = new Set(groups.flat()), extra = q[key].filter(id => !placed.has(id));
    for (const g of groups) while (g.length < 4 && extra.length) g.push(extra.shift());
    S.cont[key] = { key, groups, gfix: groups.map(() => roundRobin([0, 1, 2, 3])), gres: [] };
    for (const id of groups.flat()) pay(id, CONT[key].prize[0], key);
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
  if (fx.comp === "F") return "Preseason friendly";
  if (fx.comp === "L") return leagueName(fx.key);
  if (fx.comp === "G") return `${CONT[fx.key].name} · Group ${"ABCDEFGH"[fx.g]}`;
  const comp = S.ko[fx.key], rd = comp.rounds[fx.r];
  return `${comp.name} · ${rd.name}${rd.legs === 2 ? (fx.leg === 1 ? ", 1st leg" : ", 2nd leg") : ""}`;
}

/* ---------- recording results ---------- */
const FA_PRIZE = [25e3, 50e3, 85e3, 150e3, 250e3, 400e3, 800e3, 1.5e6, 3e6].map(x => x * MONEY), LC_PRIZE = [50e3, 75e3, 100e3, 200e3, 400e3, 800e3, 2e6].map(x => x * MONEY);
// Prize money, filed under the competition it came from (fin.cups[key]) for the Finances page.
function pay(id, amt, key) { const c = C(id); c.cash += amt; c.fin.prize += amt; if (key) { const e = ((c.fin.cups ||= {})[key] ||= { gate: 0, prize: 0 }); e.prize += amt; } }
/* Gate receipts for cup ties (only league matches sold tickets before 5.19.1). Domestic cups: the gate is
   shared equally; the crowd grows round by round (75% of a league crowd early on, 125% by the final), with
   more for a bigger visitor or a derby, never above capacity. Neutral-venue semi-finals and finals draw on
   both clubs' support (up to 45,000, or 75,000 for a final) at premium prices, shared equally. European
   ties and play-offs: the home club keeps its gate, Europe at bigger crowds and dearer seats. Returns the
   crowd and what each club took. */
function cupGate(fx) {
  const H = C(fx.h), A = C(fx.a), comp = fx.comp === "K" ? S.ko[fx.key] : null, cont = fx.comp === "G" || (comp && comp.kind === "cont");
  const late = comp ? fx.r / Math.max(1, comp.rounds.length - 1) : .3, credit = (c, x) => { x = Math.round(x); c.cash += x; if (c.fin) { c.fin.rev += x; c.fin.gate = (c.fin.gate || 0) + x; c.fin.cupGate = (c.fin.cupGate || 0) + x; const e = ((c.fin.cups ||= {})[fx.key] ||= { gate: 0, prize: 0 }); e.gate += x; } return x; };
  if (fx.neutral) {
    const cap = comp && fx.r === comp.rounds.length - 1 ? 75000 : 45000;
    const att = Math.round(Math.min(cap, (demandOf(H) + demandOf(A)) * (1 + late * .6) * rf(.92, 1.05)));
    const half = att * (H.price + A.price) / 2 * 1.5 / 2;
    return { att, h: credit(H, half), a: credit(A, half) };
  }
  const pm = H.tkt || 1, pull = clamp((A.rep - H.rep) / 100, -.2, .25), derby = rivalry(fx.h, fx.a) ? 1.12 : 1;
  const att = Math.round(Math.min(capacityNow(H), demandOf(H) * (cont ? 1.15 + .15 * late : .75 + .5 * late) * (1 + pull) * derby * rf(.92, 1.05) * Math.pow(1 / pm, .9)));
  const gate = att * H.price * pm * (cont ? 1.3 : 1);
  if (cont || (comp && comp.kind === "po")) return { att, h: credit(H, gate), a: 0 };
  return { att, h: credit(H, gate / 2), a: credit(A, gate / 2) };
}
function recordResult(fx, M) {
  const hg = M.h.goals, ag = M.a.goals;
  let att = null;
  if (fx.comp === "L") { const L = S.leagues[fx.key]; (L.results[fx.round] ||= []).push({ h: fx.h, a: fx.a, hg, ag }); L.n++; att = gateFor(C(fx.h), fx.a); fansAfterMatch(C(fx.h), hg, ag, fx.a); fansAfterMatch(C(fx.a), ag, hg, fx.h); }
  let cg = null;
  if (fx.comp === "G" || fx.comp === "K") { cg = cupGate(fx); att = cg.att; }
  if (fx.comp === "G") { S.cont[fx.key].gres.push({ g: fx.g, h: fx.h, a: fx.a, hg, ag }); if (hg !== ag) pay(hg > ag ? fx.h : fx.a, CONT[fx.key].prize[1], fx.key); }
  if (fx.comp === "K") {
    const comp = S.ko[fx.key], rd = comp.rounds[fx.r], t = rd.ties[fx.tie];
    if (t.legs === 1) { t.g1 = [hg, ag]; t.pens = M.pens; t.w = tieWinner(M); }
    else if (fx.leg === 1) t.g1 = [ag, hg];
    else { t.g2 = [hg, ag]; t.pens = M.pens; t.w = tieWinner(M); }
    if (t.w != null) {
      if (comp.key === "FA") pay(t.w, FA_PRIZE[fx.r], "FA"); else if (comp.key === "LC") pay(t.w, LC_PRIZE[fx.r], "LC"); else if (comp.kind === "cont") pay(t.w, CONT[comp.key].prize[1] * (fx.r + 2), comp.key);
      if (fx.r === comp.rounds.length - 1) {
        comp.w = t.w; comp.ru = t.w === t.h ? t.a : t.h; const W = C(t.w);
        if (comp.kind === "po") news(`${W.name} beat ${C(comp.ru).name} in the ${comp.name} final and are promoted.`, Math.abs(LG[comp.lg].tier - me().tier) <= 1, "league");
        else {
          W.trophies.push({ y: S.year, t: comp.key });
          if (comp.kind === "cont") { pay(t.w, CONT[comp.key].prize[2], comp.key); W.rep = Math.min(99, W.rep + 2); }
          news(`${W.name} win the ${comp.name}, beating ${C(comp.ru).name}${M.pens ? " on penalties" : ""}.`, true, comp.kind === "cont" ? "cont" : "cup");
        }
      }
    }
  }
  recordRivalry(fx.h, fx.a, hg, ag);
  if (fx.h === S.club || fx.a === S.club) {
    S.myRes.push({ w: S.week, label: compLabel(fx), comp: fx.comp, h: fx.h, a: fx.a, hg, ag, pens: M.pens, et: M.et, att, sc: M.goals.map(g => [g.side, g.n, g.min]) });
    if (cg) { const mine = fx.h === S.club ? cg.h : cg.a; if (mine) news(`${compLabel(fx)}: crowd ${cg.att.toLocaleString()}${fx.neutral ? " at a neutral venue" : ""}. Your share of the gate: ${money(mine)}.`, false, fx.comp === "G" || S.ko[fx.key]?.kind === "cont" ? "cont" : "cup"); }
    afterUserMatch(fx, M);
  }
}

/* ---------- foreign leagues: quick results from club strength ---------- */
function quickLeagueRound(key, r) {
  const L = S.leagues[key], rd = (L.results[r] ||= []);
  const pois = l => { let k = 0, p = Math.exp(-l), s = p; const u = R(); while (u > s && k < 9) { k++; p *= l / k; s += p; } return k; };
  for (const [h, a] of L.fixtures[r]) {
    const H = C(h), A = C(a), d = (clubLevel(H) - clubLevel(A)) * .085;
    // 1.32 gave the quick-simmed leagues 2.8-3.0 goals a game against 2.2 in England; matched to the engine now.
    const hg = pois(1.22 * Math.exp(d) * 1.1), ag = pois(1.22 * Math.exp(-d) / 1.1);
    rd.push({ h, a, hg, ag }); L.n++; recordRivalry(h, a, hg, ag); gateFor(H, a); fansAfterMatch(H, hg, ag, a); fansAfterMatch(A, ag, hg, h);
    for (const [c, gf, ga] of [[H, hg, ag], [A, ag, hg]]) {
      const xi = autoPick(eligibleIds(c), c.formation).filter(x => x != null).map(P), won = gf > ga, lost = gf < ga;
      // Ratings as matchRating, without the detail these quick-simmed games don't have (goals add 1.3 below).
      for (const p of xi) { p.s.app++; p.s.min += 90; p.wm += 90; p.s.rt += clamp(6.1 + (won ? .3 : lost ? -.3 : 0) + gauss() * .35, 3, 10); if (R() < .009 * injMult(p)) injure(p); }
      for (let g = 0; g < gf; g++) { const s = wpick(xi, p => ({ GK: 0, CB: .5, FB: .5, DM: .8, CM: 1.6, AM: 3, W: 4, ST: 6 })[p.pos] * p.ovr); s.s.g++; s.s.lg++; s.s.rt += 1.3; }
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
/* Fitness recovers day by day between fixtures. It used to come as one weekly top-up of +17 (balanced
   training) against 18-22 for a full match, so a player starting every week ended each one a little worse
   off and midweek rounds sank him: starters averaged 87-90% at kick-off, with one or two under 75% in most
   matches. Each fixture slot has a weekday (European and cup ties midweek, league midweek on Tuesday, league
   weekends on Saturday) and recovery is per day elapsed. */
const SLOT_DAY = [2, 3, 2, 6];  // ord 0 European, 1 cup, 2 midweek league, 3 weekend league
const dayNo = d => d.w * 7 + SLOT_DAY[d.ord ?? 3];
// Each day a player wins back a share of what he's lost, so the more tired he is the faster he recovers.
// A flat daily amount (the first version of this) let fatigue snowball: an unrotated XI on Intense fell to
// about 50% by week 13, lowest player 33%. Stamina speeds recovery: 20 recovers 40% faster than 0.
const recoverRate = (p, k) => k * (.8 + .4 * (p.at.sta ?? 10) / 20);
function recoverDays(days) {
  if (days <= 0) return;
  for (const c of activeClubs()) { const k = TRAIN[isUser(c) ? S.training : "bal"].rk; for (const id of c.squad) { const p = P(id); if (p && p.fit < 100) p.fit = Math.min(100, Math.round((100 - (100 - p.fit) * Math.pow(1 - recoverRate(p, k), days)) * 10) / 10); } }
}
function finishDay() {
  const cur = S.days[S.di], nxt = S.days[S.di + 1];
  recoverDays(nxt ? dayNo(nxt) - dayNo(cur) : 7);
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
    if (isUser(c)) academyWeek(c);
    const possible = Math.max(1, c.wkMatches) * 90;
    for (const id of c.squad) {
      const p = P(id);
      if (isUser(c)) p.seen = (p.seen || 0) + 1;  // weeks your coaches have watched him (gsHint)
      p.pt = .75 * p.pt + .25 * Math.min(1, p.wm / (p.acad ? 90 : possible)); p.wm = 0;  // academy minutes count against an academy match a week
      if (p.inj > 0) p.inj--;
      // Potential is a ceiling, not a promise: minutes, form, happiness and the coach decide how close a player gets.
      if (p.ovr < p.pot) {
        // Match ratings, on their own scale (6 an average game, 7 good, 8 great), the same for every age: a season
        // averaging 5 or less x0.85, 6 x1.0, 7 x1.15, 8+ x1.25. Fewer than 3 appearances counts as average.
        const avgR = p.s.app >= 3 ? p.s.rt / p.s.app : 6, formMult = avgR <= 7 ? clamp(1 + .15 * (avgR - 6), .85, 1.15) : 1.15 + .1 * Math.min(1, avgR - 7);
        const ch = (p.age <= 18 ? .085 : p.age <= 21 ? .07 : p.age <= 24 ? .04 : p.age <= 27 ? .015 : 0) * 1.12 * t.grow * (p.age <= 21 ? acad : 1)
          * coachDev * (.6 + .6 * p.pt) * (.8 + .4 * p.mood / 100) * formMult * gsMult(p);
        if (R() < ch) growAttrs(p, 1);
      }
      if (isUser(c) && S.training === "int" && !p.inj && R() < .006 * injMult(p)) injure(p, true);
    }
    c.wkMatches = 0;
  }
  for (const c of activeClubs()) { stadiumWeek(c); sponsorPay(c, 1 / 52); if (windowOpen() && !isUser(c)) refreshRegistration(c); }
  for (const id of S.fa) { const p = P(id); p.fit = 100; if (p.inj) p.inj--; }
  weeklyMood();
  autoScout();  // spends this week's leftover hours before they refill
  weeklyRecruiting();
  weeklyStories();
  aiTransferDay(CAL.jan.includes(S.week + 1) || CAL.jan.includes(S.week) ? .1 : 0);  // AI clubs scout every week, as you can; they bid only in the window
  if (S.week === CAL.jan[0] - 1) news(`The January transfer window is now open. Until it closes after week ${CAL.jan[CAL.jan.length - 1] + 1} you can buy, sell and loan players, and change which 25 seniors are registered.`, true, "transfer");
  if (S.week === CAL.jan[CAL.jan.length - 1]) news("The January transfer window has closed. Registrations are locked until preseason.", true, "transfer");
}
const scoutCost = () => [0, 4e5, 2.5e5, 1.2e5, 6e4, 4e4, 4e4][me().tier] * MONEY;

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
/* End-of-season awards. English divisions get the full set; foreign top flights the headline three. */
function awardsFor(key) {
  const L = S.leagues[key], ps = L.clubs.flatMap(id => C(id).squad.map(P)).filter(p => p.club >= 0), full = !LG[key].foreign;
  const avg = p => p.s.app ? p.s.rt / p.s.app : 0, n = roundsOf(key), regular = p => p.s.app >= n * .5;
  const tag = (p, v, what, mood = 6) => {
    if (!p) return null;
    (p.awards ||= []).push(`${what}, ${leagueName(key)} ${seasonLabel(S.year)}`); p.mood = Math.min(100, p.mood + mood);
    if (p.club === S.club) news(`${p.name} wins ${what} in the ${leagueName(key)}.`, true, "squad");
    return [p.id, p.name, C(p.club).short, v];
  };
  const best = (list, f) => list.sort((a, b) => f(b) - f(a))[0];
  const top = best(ps.slice(), p => p.s.lg * 100 - p.s.app);
  const out = {
    top: top && top.s.lg ? tag(top, top.s.lg, "the Golden Boot") : null,
    poty: tag(best(ps.filter(regular), avg), null, "Player of the Season", 8),
    ypoty: tag(best(ps.filter(p => p.s.app >= n * .3 && p.age <= 21), avg), null, "Young Player of the Season", 8),
  };
  if (out.poty) out.poty[3] = +avg(P(out.poty[0])).toFixed(2);
  if (out.ypoty) out.ypoty[3] = +avg(P(out.ypoty[0])).toFixed(2);
  if (!full) return out;
  const glove = best(ps.filter(p => p.pos === "GK" && p.s.app >= n * .4), p => p.s.cs * 100 + avg(p));
  out.glove = glove && glove.s.cs ? tag(glove, glove.s.cs, "the Golden Glove") : null;
  const pm = best(ps.slice(), p => p.s.a * 100 + avg(p));
  out.assists = pm && pm.s.a ? tag(pm, pm.s.a, "the Playmaker award") : null;
  // Team of the season: the best-rated regulars in a 4-3-3 shape.
  const lines = [["GK", ["GK"], 1], ["CB", ["CB"], 2], ["FB", ["FB"], 2], ["MID", ["DM", "CM", "AM"], 3], ["ATT", ["W", "ST"], 3]], used = new Set();
  out.tots = [];
  for (const [, roles, k] of lines) for (const p of ps.filter(p => regular(p) && roles.includes(p.pos)).sort((a, b) => avg(b) - avg(a)).slice(0, k)) {
    used.add(p.id); out.tots.push([p.id, p.name, C(p.club).short, p.pos, +avg(p).toFixed(2)]);
    (p.awards ||= []).push(`Team of the Season, ${leagueName(key)} ${seasonLabel(S.year)}`); p.mood = Math.min(100, p.mood + 3);
  }
  // Manager of the season: who most beat expectations, with a bonus for the title and promotion.
  const t = standings(L).map(r => r.id), po = S.ko["PO" + key];
  const score = id => ((S.expAll || {})[id] || t.indexOf(id) + 1) - (t.indexOf(id) + 1) + (t[0] === id ? 4 : 0) + ((LG[key].up && t.indexOf(id) < LG[key].up) || (po && po.w === id) ? 2 : 0);
  const mid = t.slice().sort((a, b) => score(b) - score(a))[0], mc = C(mid), mco = coachOf(mc);
  out.manager = [mid, mco.name, mc.short, `${ord(t.indexOf(mid) + 1)}, tipped ${ord((S.expAll || {})[mid] || t.indexOf(mid) + 1)}`];
  if (isUser(mc)) { S.board = clamp(S.board + 5, 0, 100); S.me.pts += 1; (S.me.awards ||= []).push(`Manager of the Season, ${leagueName(key)} ${seasonLabel(S.year)}`); news(`You are the ${leagueName(key)} Manager of the Season! Board +5 and an extra coaching point.`, true, "board"); }
  return out;
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
    // Ticket prices follow the new division (setTicketPrice); S.revK runs lower in the second and third tiers than
    // the fifth and sixth, so scaling them by it could cut a promoted club's prices.
    const ratio = Math.pow(S.revK[to] / S.revK[from], .7); c.revBase = Math.round(c.revBase * ratio); setTicketPrice(c); c.movedY = S.year; sponsorClause(c, dir);
    // Relegation clauses: wages fall roughly in line with income.
    if (dir === "down") { c.rep = Math.max(8, c.rep - 4); for (const pid of c.squad) P(pid).wage = Math.round(P(pid).wage * clamp(ratio * 1.1, .55, .95)); if (isUser(c)) news("Relegation clauses cut the squad's wages.", true, "finance"); }
    else c.rep = Math.min(90, c.rep + 4);
    settleIncome(c, dir);
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
  const floors = Object.fromEntries(Object.keys(S.leagues).map(k => [k, divFloor(k)]));  // shared broadcast money (settleIncome)
  // Ticket prices are reset each summer from the division and demand (setTicketPrice).
  for (const c of activeClubs()) { const fair = Math.max(S.revK[c.lg] * Math.pow(1.061, c.rep), floors[c.lg] || 0), old = c.revBase; c.revBase = Math.round(c.revBase * .8 + fair * .2); setTicketPrice(c); c.lastAtt = c.att[1] ? Math.round(c.att[0] / c.att[1]) : c.lastAtt; c.att = [0, 0]; aiStadium(c); }

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
  graduateIntakes();
  for (const c of activeClubs()) if (!isUser(c)) aiMaintain(c);
  S.phase = "summer"; S.summerDay = 0; S.seasonOverSeen = false; S.friendlies = []; S.friNo = [];
  news(`The ${seasonLabel(S.year)} season is over. Five weeks of preseason follow, with the transfer window open.`, true, "transfer");
}

function ageAndContracts() {
  // Anyone turning 21 moves up from the academy as the season ends, so he can be registered in preseason
  // (moving up at the next kick-off, with the window shut, left him unregistered and unable to play).
  const up = [];
  for (const p of Object.values(S.players)) {
    const c = p.club >= 0 ? C(p.club) : null;
    if (c && p.age <= 20) p.yt[c.country] = (p.yt[c.country] || 0) + 1;
    p.age++;
    if (p.acad && p.age > ACAD_MAX_AGE) { p.acad = false; if (c && isUser(c)) up.push(p); }
    if (p.age >= 29) { declineAttrs(p, ri(0, Math.min(4, p.age - 27))); p.pot = p.ovr; }
    else if (p.age <= 24) {
      // Young players who don't play, or are miserable, lose some of their ceiling; a breakout season raises it.
      const avg = p.s.app ? p.s.rt / p.s.app : 6;
      let d = ri(-2, 1);
      if (p.age >= 18 && p.pt < .25) d -= ri(1, 3);
      if (p.mood < 35) d -= ri(0, 2);
      if (p.pt > .6 && avg >= 8) d += ri(2, 4); else if (p.pt > .6 && avg >= 7) d += ri(1, 3);  // a breakout season on the rating scale: good (7+) raises his ceiling, great (8+) more
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
      // The player has a say too, on the same terms as yours (renewTerms): one who has asked to leave or is unhappy
      // (mood under 45) won't sign again and goes into free agency. Before 5.45 only a transfer request stopped it.
      else if (p.age < 32 && p.ovr >= clubLevel(c) - 9 && R() < .8 && !p.req && p.mood >= 45) { p.yrs = ri(1, 4); p.wage = renewWage(p, c); }
      else { c.squad = c.squad.filter(id => id !== p.id); toFreeAgent(p); }
    }
  }
  S.fa = S.fa.filter(id => S.players[id]);
  // Three years unsigned and he's out of the game: at the end of the third season after he went free (p.faY).
  for (const p of S.fa.map(id => S.players[id]).filter(Boolean)) if (S.year - (p.faY ?? S.year) >= FA_YEARS) retirePlayer(p);
  S.fa = S.fa.filter(id => S.players[id]);
  if (S.fa.length > 300) { const drop = S.fa.map(P).sort((a, b) => value(a) - value(b)).slice(0, S.fa.length - 300); for (const p of drop) retirePlayer(p); }
  for (const id of S.lineup) if (id != null && !S.players[id]) S.lineup = S.lineup.map(x => x === id ? null : x);
  if (up.length) news(`${up.map(p => p.name).join(", ")} ${up.length > 1 ? "have" : "has"} turned 21 and moved up from the academy to the first-team squad. Register ${up.length > 1 ? "them" : "him"} on the Squad page before the season starts.`, true, "youth");
}
const FA_YEARS = 3;  // free agents unsigned this many seasons leave the game
/* A club that changes division lands near the new division's money straight away. Broadcast income differs between
   divisions mostly through reputation (S.revK is only 1.65x higher in the second tier than the third), so scaling by
   the ratio and closing 20% of the gap a season left a promoted club on third-tier money for years: one earned
   2.03M a year in the second division, where the poorest club earned 3.1M, and ran a 150% cost ratio. So broadcast
   money is treated as largely shared: promoted, a club's base income is at least 90% of the division's lower
   quartile (divFloor), and the season-end drift never pulls it back below that; relegated, at most 110% of the
   upper quartile. Sponsorship follows (sponsorClause). The floor sits below the quartile it's taken from, so it
   doesn't ratchet the division's money up. */
function divQuart(lg, f, q) { const v = S.leagues[lg].clubs.map(C).filter(c => !c.gone).map(f).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) * q)] : 0; }
const divFloor = lg => divQuart(lg, c => c.revBase, .25) * .9;
function settleIncome(c, dir) {
  const old = c.revBase;
  if (dir === "up") c.revBase = Math.max(c.revBase, Math.round(divFloor(c.lg)));
  else c.revBase = Math.min(c.revBase, Math.round(divQuart(c.lg, x => x.revBase, .75) * 1.1));
  // (ticket prices follow the division: setTicketPrice in move())
}
/* Graduate intake, at the end of every season. Your academy puts up a pool of five local 16-year-olds (academyPlayer:
   potential from its Youth development rating); they wait on the Academy page (S.intake) until the end of preseason
   week 2 (INTAKE_DEADLINE), which leaves three weeks of the window for other clubs to sign the ones you release. Only
   those you tick by then join (up to three, within the academy's 15 places, ACAD_CAP); nobody is chosen for you, so
   ticking none releases all five. AI clubs get one or two graduates, as before, and keep each unless he's well
   below the club's level or they have no room; the ones they let go join the free agents if they're worth a contract
   (potential 9+), otherwise they leave the game. Unkept graduates become free agents, so anyone can sign them in the
   window. Before 5.50 every club simply got 1-2 graduates (yours 1). 5.50-5.51.1 gave AI clubs pools of five too,
   which lifted every division 0.3-0.8 points in six seasons however they were tuned. */
const INTAKE_POOL = 5, INTAKE_KEEP = 3, INTAKE_DEADLINE = 2;  // decide by the end of preseason week 2
const ACAD_CAP = 15;  // academy places: graduates and players sent down need a free one
const acadCount = c => c.squad.filter(id => P(id).acad).length;
const intakeRoom = () => Math.max(0, Math.min(INTAKE_KEEP, ACAD_CAP - acadCount(me())));
function graduateIntakes() {
  for (const c of activeClubs()) {
    const make = () => { const p = academyPlayer(c, 16); p.yt[c.country] = 1; return p; };
    if (isUser(c)) {
      const pool = Array.from({ length: INTAKE_POOL }, make);
      for (const p of pool) { c.squad = c.squad.filter(id => id !== p.id); p.club = -1; p.intake = true; S.scout[p.id] = 2; }
      S.intake = { ids: pool.map(p => p.id), pick: [] };
      news(`Your academy has ${INTAKE_POOL} local 16-year-olds ready to join. Choose up to ${INTAKE_KEEP} (or none) on the Academy page by the end of preseason week ${INTAKE_DEADLINE}; the rest are released as free agents. Academy places: ${acadCount(c)}/${ACAD_CAP} used.`, true, "youth");
      continue;
    }
    // The same 15 places: an AI club counts its 20-and-unders (it has no separate academy).
    const lvl = clubLevel(c), grads = Array.from({ length: ri(1, 2) }, make);
    for (const p of grads) {
      const young = c.squad.filter(id => P(id).age <= ACAD_MAX_AGE && id !== p.id).length;
      if (young < ACAD_CAP && p.pot >= lvl - 9) continue;  // kept: room for him, and he could reach about the club's level
      c.squad = c.squad.filter(id => id !== p.id);
      if (p.pot >= o100(9)) toFreeAgent(p); else delete S.players[p.id];
    }
  }
  S.intakeY = S.year;
}
/* Your choice (at the deadline, or at kick-off if it was somehow missed, the best three by potential). */
function settleIntake(auto) {
  const it = S.intake; if (!it) return;
  const c = me(), kids = it.ids.map(id => S.players[id]).filter(Boolean);
  // Only the ones you ticked: at the deadline (auto) nobody is picked for you, and anyone unticked is released.
  const keep = new Set(it.pick.slice(0, intakeRoom()));
  const joined = [];
  for (const p of kids) {
    p.intake = false;
    if (keep.has(p.id)) { p.club = c.id; p.acad = true; p.joined = S.year; c.squad.push(p.id); joined.push(p); }
    else toFreeAgent(p);
  }
  S.intake = null;
  const names = joined.map(p => `${p.name} (${p.pos})`).join(", ");
  news(joined.length ? `${auto ? "The graduate deadline has passed. " : ""}Joining your academy: ${names}. ${kids.length - joined.length} released as free agents.` : `${auto ? "The graduate deadline passed with nobody chosen: all" : "All"} ${kids.length} of this year's graduates were released as free agents.`, auto, "youth");
  return joined.length;
}
/* AI clubs refill thin positions, stay inside the registration rules, and trim costs their owner won't carry. */
function aiMaintain(c) {
  const need = { GK: 2, CB: 4, FB: 3, DM: 2, CM: 3, AM: 2, W: 3, ST: 3 };
  for (const [pos, n] of Object.entries(need)) {
    let have = c.squad.filter(id => P(id).pos === pos && P(id).age >= 18).length;
    while (have++ < n) {
      bumpTick(); const lvl = clubLevel(c);
      const fa = S.fa.map(P).map(p => [p, aiRating(p, c)]).filter(([p, e]) => p.pos === pos && e != null && e >= lvl - 10 && e <= lvl + 2 && !hasNamesake(c, p.name)).sort((a, b) => b[1] - a[1]).map(x => x[0]).find(p => (c.sc || {})[p.id] >= 1);  // only free agents it has scouted (aiTransferDay); otherwise a journeyman filler. Before 5.46 clubs took the best free agents unseen the moment the season ended, leaving 7 in the pool by preseason
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
/* Preseason: five weeks before every season, the first included, with the transfer window open. AI clubs
   do business each week, more as the window goes on. */
function summerStep() {
  // Business builds through preseason rather than landing in week one (it was a flat .6 a week). With scouting
  // all season, clubs start the window with reports in hand, and the flat rate front-loaded the market.
  aiTransferDay([.3, .45, .6, .75, .9][S.summerDay] ?? .6);
  if (S.summerDay === 1) aiLoans();
  // Preseason weeks recover like the season's days (a week of them, for every club). It was a flat +10 a
  // week for your squad only, against 18-25 for a friendly, so a side with a friendly a week started the
  // season at 72% (97, 92, 86, 80, 76 through the weeks) while the rested squad sat at 100%.
  recoverDays(7);
  if (S.intake && S.summerDay + 1 >= INTAKE_DEADLINE) settleIntake(true);  // the graduate deadline: end of preseason week 2
  autoScout(); S.rec.hours = recHours();  // scouting hours are weekly in preseason too; only the season's weekly() refilled them
  S.summerDay++;
  if (S.summerDay < CAL.summerDays) return;
  if (S.firstPre) {  // a new career: the season was drawn when you took the job, so just open it
    delete S.firstPre; S.phase = "season"; fixUserLineup();
    news(`Preseason is over. The ${seasonLabel(S.year)} season begins. The board's target: ${expText(S.expPos, me().lg).toLowerCase()}.`, true, "board");
  } else newSeasonStart();
}
function newSeasonStart() {
  for (const c of activeClubs()) if (!isUser(c)) dedupeNames(c);
  if (S.intake) settleIntake(true);  // missed the deadline somehow: only those ticked join, the rest are released
  for (const c of activeClubs()) if (!isUser(c)) trimSquad(c, false);
  S.year++;
  S.seasonOver = null;
  startSeason();
  payDues();  // deferred transfer fees: this season's instalments, in this season's accounts
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

/* ---------- preseason friendlies ----------
   One a week at most, booked from the Preseason card: home or away, against any English club or a top-flight
   side abroad. Smaller clubs always agree; a much bigger club may not visit, though it will usually host you.
   Home: a friendly crowd (about a third of a league one, more for a big-name visitor, never above capacity)
   at 60% of your ticket price, minus an appearance fee of 30% if the visitors are much bigger. Away at a
   bigger club: they pay you 15% of their gate. Played like any match (live or simulated), but nothing goes
   on the record: no table, appearances, goals, cards, bans or ratings. Fitness and injuries are real. */
const friendlyAt = wk => (S.friendlies || []).find(f => f.wk === wk);
const friendlyPull = (host, guest) => clamp(.35 + (guest.rep - host.rep) / 60, .25, 1.1);
function friendlyGate(host, guest) { const att = Math.round(Math.min(capacityNow(host), demandOf(host) * friendlyPull(host, guest))); return { att, gate: Math.round(att * host.price * .6) }; }
function friendlyMoney(c, opp, home) {
  if (home) { const g = friendlyGate(c, opp), fee = opp.rep > c.rep + 10 ? Math.round(g.gate * .3) : 0; return { att: g.att, gate: g.gate, fee: -fee, net: g.gate - fee }; }
  const g = friendlyGate(opp, c), fee = opp.rep > c.rep + 5 ? Math.round(g.gate * .15) : 0; return { att: g.att, gate: 0, fee, net: fee };
}
function friendlyOptions() {
  const c = me(), t = LG[c.lg].tier, eng = ENG_LGS.filter(k => Math.abs(LG[k].tier - t) <= 1 || LG[k].tier === 1);
  return [...eng, ...TOP_LGS.slice(1)].flatMap(k => S.leagues[k].clubs).map(C).filter(o => o.id !== c.id && !o.gone && !(S.friendlies || []).some(f => f.opp === o.id) && !(S.friNo || []).includes(o.id));
}
function bookFriendly(wk, oppId, home) {
  const c = me(), opp = C(oppId);
  if (S.phase !== "summer") return "Friendlies are played in preseason.";
  if (wk < S.summerDay || wk >= CAL.summerDays) return "That week has gone.";
  if (friendlyAt(wk)) return "You already have a friendly that week.";
  const gap = opp.rep - c.rep;
  // A much bigger club may not come to you; most will host you (it's their gate).
  const yes = home ? gap <= 12 || R() < clamp(1 - (gap - 12) / 25, .15, 1) : gap >= -30 || R() < .7;
  if (!yes) { (S.friNo ||= []).push(opp.id); return `${opp.name} turned down ${home ? "a visit" : "your request"}. Try someone else.`; }
  (S.friendlies ||= []).push({ wk, opp: opp.id, home, played: false });
  news(`Preseason friendly arranged: ${home ? `${opp.name} visit you` : `away at ${opp.name}`} in week ${wk + 1}.`, false, "club");
  return `${opp.name} agreed: ${home ? "home" : "away"} friendly in preseason week ${wk + 1}.`;
}
function cancelFriendly(wk) { const f = friendlyAt(wk); if (!f || f.played || wk === S.summerDay && LIVE) return "That friendly can't be cancelled."; S.friendlies = S.friendlies.filter(x => x !== f); return `Friendly against ${C(f.opp).name} cancelled.`; }
function friendlyFixture(f) { return f.home ? { comp: "F", h: S.club, a: f.opp, neutral: false } : { comp: "F", h: f.opp, a: S.club, neutral: false }; }
// After the final whistle: fitness and injuries are real, the money is paid, nothing else is recorded.
function settleFriendly(M, f) {
  const c = me(), opp = C(f.opp), mine = M.fx.h === S.club ? M.h : M.a, theirs = mine === M.h ? M.a : M.h;
  for (const s of [M.h, M.a]) { for (const o of s.on) M.fit[o.p.id] = o.fit; for (const id of s.used) { const p = P(id); if (p && M.fit[id] != null) p.fit = Math.round(M.fit[id]); } }
  for (const id of M.inj) { const p = P(id); if (p) injure(p); }
  const m = friendlyMoney(c, opp, f.home); c.cash += m.net; if (c.fin) c.fin.rev += Math.max(0, m.net);
  Object.assign(f, { played: true, gf: mine.goals, ga: theirs.goals, att: m.att, gate: m.gate, fee: m.fee, net: m.net });
  news(`Friendly: ${C(M.fx.h).name} ${M.h.goals}–${M.a.goals} ${C(M.fx.a).name}.${f.home ? ` Crowd ${m.att.toLocaleString()}, gate ${money(m.gate)}${m.fee ? `, appearance fee ${money(-m.fee)}` : ""}.` : m.fee ? ` Appearance fee received: ${money(m.fee)}.` : ""}`, false, "result");
}
// Preseason week by week: this week's friendly first (simulated here), then the rest of the week.
function playFriendlySim() {
  const f = friendlyAt(S.summerDay); if (!f || f.played) return;
  const M = runToEnd(makeMatch(friendlyFixture(f), true)); settleFriendly(M, f);
}

/* How far your club has got in a cup this season, for the Finances page. */
function cupProgress(key) {
  const comp = S.ko[key], me_ = S.club;
  if (comp) {
    if (comp.w === me_) return { t: "Winners", cls: "good" };
    let last = null; comp.rounds.forEach((rd, r) => (rd.ties || []).forEach(t => { if (t.h === me_ || t.a === me_) last = { rd, t, r }; }));
    if (last) {
      if (last.t.w == null) return { t: `In the ${last.rd.name.toLowerCase()}`, cls: "" };
      if (last.t.w === me_) return { t: `Through the ${last.rd.name.toLowerCase()}`, cls: "" };
      return last.r === comp.rounds.length - 1 ? { t: "Runners-up", cls: "" } : { t: `Out in the ${last.rd.name.toLowerCase()}`, cls: "muted" };
    }
  }
  const cont = S.cont && S.cont[key];
  if (cont && cont.groups && cont.groups.flat().includes(me_)) return comp && comp.rounds[0].ties && comp.rounds[0].ties.length ? { t: "Out in the group stage", cls: "muted" } : { t: "Group stage", cls: "" };
  if (cont && cont.entrants && cont.entrants.includes(me_)) return { t: "Qualified", cls: "" };
  return null;
}

/* ---------- your academy ---------- */
/* Each season week the academy plays an unofficial under-18 match against another club's academy. It counts
   as playing time for development (an academy player's weekly minutes are measured against one match, not
   the first team's fixtures), and keeps its own appearances, goals and ratings (p.as). */
function academyWeek(c) {
  if (S.phase !== "season") return;
  // Anyone who played for the first team this week (p.wm holds his senior minutes so far) misses the academy
  // match: he can't play both. An unused substitute still plays for the academy.
  const kids = c.squad.map(P).filter(p => p.acad && avail(p) && !p.loan && !(p.wm > 0));
  if (!kids.length) return;
  const xi = autoPick(kids.map(p => p.id), "4-3-3").filter(x => x != null).map(P), inXI = new Set(xi.map(p => p.id));
  const st = p => p.as || (p.as = { app: 0, g: 0, a: 0, rt: 0 });
  // The rest of the side are unnamed trialists and schoolboys, as good as your youth development rating
  // makes them (a new career starts with only two or three academy players).
  const trial = 44 + c.academy * .8, opps = activeClubs().filter(o => o.id !== c.id && !isForeign(o) && o.tier <= 6), opp = pick(opps);
  const ours = (sum(xi, p => p.ovr) + trial * (11 - xi.length)) / 11, theirs = 44 + opp.academy * .8 + rf(-3, 3), d = (ours - theirs) * .06;
  const pois = l => { let k = 0, q = Math.exp(-l), t = q; const u = R(); while (u > t && k < 9) { k++; q *= l / k; t += q; } return k; };
  const gf = pois(1.4 * Math.exp(d)), ga = pois(1.4 * Math.exp(-d)), scorers = [];
  for (let g = 0; g < gf; g++) {
    const s = wpick(xi, p => ({ GK: 0, CB: .5, FB: .5, DM: .8, CM: 1.6, AM: 3, W: 4, ST: 6 })[p.pos] * p.ovr); st(s).g++; scorers.push(s.id);
    const others = xi.filter(p => p !== s); if (others.length && R() < .7) st(wpick(others, p => ({ GK: .1, CB: .6, FB: 1.6, DM: 1.2, CM: 2.4, AM: 4, W: 3.4, ST: 2 })[p.pos])).a++;
  }
  for (const p of xi) { const x = st(p); x.app++; p.wm += 80; x.rt += clamp(6.4 + (gf > ga ? .35 : gf < ga ? -.35 : 0) + (p.ovr - ours) / 25 + scorers.filter(id => id === p.id).length * .9 - (["GK", "CB", "FB"].includes(p.pos) ? ga * .14 : 0) + gauss() * .3, 3, 10); }
  for (const p of kids) if (!inXI.has(p.id)) p.wm += 20;  // the rest come off the bench or train
  (S.acadRes ||= []).unshift({ y: S.year, w: S.week, opp: opp.id, gf, ga, sc: scorers });
  if (S.acadRes.length > 12) S.acadRes.length = 12;
}
/* How ready an academy player is for the first team, against the senior players at his position in your
   formation: good enough to start, to make the matchday squad (two per place), close, or not yet. */
function acadReadiness(p, c) {
  const slots = Math.max(1, roleSlots(S.formation, p.pos)), sen = c.squad.map(P).filter(x => !x.acad && x.id !== p.id && !x.loan && FAM[x.pos][p.pos] >= .9).map(x => x.ovr).sort((a, b) => b - a);
  const starter = sen[slots - 1] ?? 0, squad = sen[slots * 2 - 1] ?? 0;
  if (p.ovr >= starter) return ["Ready to start", "good", starter];
  if (p.ovr >= squad) return ["Ready", "good", squad];
  if (p.ovr >= squad - 4.5) return ["Close", "warn", squad];
  return ["Not yet", "muted", squad];
}
