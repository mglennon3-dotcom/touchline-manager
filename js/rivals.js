"use strict";
/* Club rivalries. Every club's nearest neighbour is a rival, as is its nearest club in the same division
   (so there are derbies every season); a second close neighbour often is too, and some clubs also have a
   rival of similar standing.
   Intensity runs 1 (rivalry) to 3 (fierce derby) and is stored on both clubs. */
const RIVAL_WORD = { 3: "Fierce derby", 2: "Local derby", 1: "Rivalry" };
const rivalry = (a, b) => (a == null || b == null) ? 0 : ((C(a).rivals || {})[b] || 0);
function linkRivals(a, b, n) {
  if (a.id === b.id) return;
  a.rivals ||= {}; b.rivals ||= {}; a.h2h ||= {}; b.h2h ||= {};
  const v = Math.max(a.rivals[b.id] || 0, n);
  a.rivals[b.id] = v; b.rivals[a.id] = v;
  a.h2h[b.id] ||= [0, 0, 0]; b.h2h[a.id] ||= [0, 0, 0];
}
const rivalCount = c => Object.keys(c.rivals || {}).length;
const heat = d => d < 12 ? 3 : d < 45 ? 2 : 1;  // only near neighbours make a fierce derby
function assignRivals(c) {
  const others = activeClubs().filter(o => o.id !== c.id && o.country === c.country);
  const near = others.map(o => ({ o, d: km(c, o) })).sort((x, y) => x.d - y.d);
  const [n1, n2] = near;
  if (n1 && rivalCount(n1.o) < 4) linkRivals(c, n1.o, heat(n1.d));
  const inLeague = near.find(x => x.o.lg === c.lg);
  if (inLeague && inLeague.d < 160 && !(c.rivals || {})[inLeague.o.id] && rivalCount(c) < 3 && rivalCount(inLeague.o) < 4) linkRivals(c, inLeague.o, heat(inLeague.d));
  if (n2 && n2.d < 30 && rivalCount(c) < 3 && rivalCount(n2.o) < 4 && R() < .5) linkRivals(c, n2.o, heat(n2.d));
  if (rivalCount(c) < 3 && R() < .35) {
    const peer = pick(others.filter(o => o.lg === c.lg && Math.abs(o.rep - c.rep) <= 4 && !(c.rivals || {})[o.id] && rivalCount(o) < 3));
    if (peer) linkRivals(c, peer, 1);
  }
}
function dropRivals(c) { for (const id of Object.keys(c.rivals || {})) { const o = C(+id); if (o.rivals) delete o.rivals[c.id]; } }
function rivalName(a, b) {
  const A = C(a), B = C(b);
  if (rivalry(a, b) >= 2) return A.region === B.region ? `the ${A.region} derby` : `the ${[A.town, B.town].sort().join("–")} derby`;
  return `${A.short} v ${B.short}`;
}
/* Head-to-head record in every competition, kept from each side's point of view as [won, drawn, lost]. */
function recordRivalry(h, a, hg, ag) {
  if (!rivalry(h, a)) return;
  const rh = (C(h).h2h ||= {})[a] ||= [0, 0, 0], ra = (C(a).h2h ||= {})[h] ||= [0, 0, 0];
  if (hg > ag) { rh[0]++; ra[2]++; } else if (hg < ag) { rh[2]++; ra[0]++; } else { rh[1]++; ra[1]++; }
}
const h2hOf = (c, o) => ((c.h2h || {})[o] || [0, 0, 0]);
/* Derby results move the board, the fans' money and the dressing room further than ordinary ones. */
function derbyAftermath(fx, M, pts) {
  const opp = M.h.club === S.club ? M.a.club : M.h.club, n = rivalry(S.club, opp); if (!n) return 0;
  const delta = pts === 3 ? 2 * n : pts === 0 ? -2 * n : 0;
  for (const id of me().squad) { const p = P(id); p.mood = clamp(p.mood + (pts === 3 ? 2 : pts === 0 ? -2 : 0) * n, 0, 100); }
  if (M.h.club === S.club) { const gate = Math.round(me().revSeason * .004 * n); me().cash += gate; me().fin.rev += gate; }
  const [w, d, l] = h2hOf(me(), opp);
  news(pts === 3 ? `Bragging rights: you win ${rivalName(S.club, opp)}. The fans will remember this one.` : pts === 0 ? `Defeat in ${rivalName(S.club, opp)} stings. The supporters are not happy.` : `Honours even in ${rivalName(S.club, opp)}.`, true, "result");
  news(`Record against ${C(opp).name}: won ${w}, drawn ${d}, lost ${l}.`, false, "result");
  return delta;
}
/* Ensure every club has rivals: for new worlds, new clubs, and saves from before rivalries existed. */
function ensureRivals() { for (const c of activeClubs()) if (!c.rivals || !rivalCount(c)) assignRivals(c); S.rivalsDone = true; }
