"use strict";
/* Transfers, contracts and the Squad Cost Ratio. */
function squadRank(p, c) { return c.squad.map(P).filter(x => x.id !== p.id && x.ovr > p.ovr).length; }
function askingPrice(p, buyer) {
  if (p.club < 0) return 0;
  const c = C(p.club);
  buyer = buyer || (S.club != null ? me() : null);
  let v = value(p) * (squadRank(p, c) < 3 ? 1.4 : squadRank(p, c) < 11 ? 1.15 : 1);
  if (buyer) v *= 1 + .25 * rivalry(c.id, buyer.id);  // nobody sells cheaply to a rival
  if (p.req || p.listed) v *= .8;
  if (p.joined === S.year && !p.req && !p.listed) v *= 1.3;   // clubs rarely sell someone they just signed
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
  return Math.round(v / mag) * mag;
}
/* Would this player move to club b? 0 (never) – 1 (desperate). Not just money: stature, minutes, Europe, mood. */
function willingness(p, b) {
  const cur = p.club >= 0 ? C(p.club) : null;
  let w = .5;
  if (cur) w += (b.rep - cur.rep) / 50; else w += .25;
  const rivals = b.squad.map(P).filter(x => x.pos === p.pos && x.ovr > p.ovr).length, slots = Math.max(1, roleSlots(b.formation, p.pos));
  w += rivals < slots ? .18 : rivals < slots * 2 ? 0 : -.22;
  if (roleSlots(b.formation, p.pos) === 0 && p.pos !== "GK") w -= .15;
  if (S.cont.CC && S.cont.CC.groups.flat().includes(b.id)) w += .08;
  w -= Math.max(0, p.ovr - clubLevel(b) - 5) * .05;  // good players won't drop far below their level
  if (cur && (p.req || p.mood < 35)) w += .25;
  if (cur && p.loy > .75 && !p.req) w -= .15;
  if (cur && !p.req) w -= .12 * rivalry(cur.id, b.id);  // crossing the divide is a big step for a player
  return clamp(w, 0, 1);
}
const willingLabel = w => w >= .7 ? ["Keen", "good"] : w >= .45 ? ["Open", "ok"] : w >= .3 ? ["Reluctant", "warn"] : ["Not interested", "bad"];
function contractDemand(p, b, w) { return Math.round(wageDemand(p, b.rep) * (1.2 - w * .3) / 1000) * 1000; }

function scr(c, extraCost = 0, extraRev = 0) {
  // Season-to-date ratio, projected to a full year where the season is still running.
  const f = c.fin; if (!f) return 0;
  const cost = sum(c.squad, id => P(id).wage + (P(id).am ? P(id).am.per : 0)) + extraCost;
  const rev = annualIncome(c) + f.prize + f.merit + f.scheme + Math.max(0, f.sales) + extraRev;
  return cost / Math.max(1, rev);
}
function transfer(p, to, fee, wage, yrs) {
  const from = p.club >= 0 ? C(p.club) : null;
  if (from) {
    from.squad = from.squad.filter(id => id !== p.id);
    const book = p.am ? p.am.per * p.am.left : 0;
    from.cash += fee; from.fin.sales += fee - book; from.fin.sold += fee;
    if (isUser(from)) S.lineup = S.lineup.map(id => id === p.id ? null : id);
  } else S.fa = S.fa.filter(id => id !== p.id);
  to.cash -= fee * 1.05; to.fin.bought += fee; to.fin.agent += fee * .05;
  to.squad.push(p.id);
  p.club = to.id; p.yrs = yrs; p.wage = wage; p.am = fee > 0 ? { per: Math.round(fee / yrs), left: yrs } : null;
  p.req = false; p.listed = false; p.promise = null; p.mood = 72; p.joined = S.year; p.pt = .5;
  refreshRegistration(to); if (from) refreshRegistration(from);
  const big = fee >= 15e6 || isUser(to) || (from && isUser(from));
  S.tlog.unshift({ y: S.year, w: whenLabel(), pid: p.id, name: p.name, from: from ? from.id : -1, to: to.id, fee });
  if (S.tlog.length > 300) S.tlog.length = 300;
  if (big) news(`${p.name} (${p.pos}, ${p.ovr}) ${from ? `moves from ${from.name}` : "signs as a free agent"} to ${to.name}${fee ? ` for ${money(fee)}` : ""}.`, isUser(to) || (from && isUser(from)), "transfer");
}

/* AI clubs buy where their squad is thin for the shape they play. */
function findNeed(c, minGap = 5) {
  const lvl = clubLevel(c), ps = c.squad.map(P);
  let worst = null, gap = 0;
  for (const role of new Set(slotsOf(c.formation))) {
    const n = roleSlots(c.formation, role), have = ps.filter(p => FAM[p.pos][role] >= .9 && p.age >= 18).sort((a, b) => b.ovr - a.ovr);
    const starterGap = have.length < n ? 20 : lvl - have[n - 1].ovr;
    const depthGap = have.length < n * 2 ? 6 : 0;
    const g = Math.max(starterGap, 0) + depthGap;
    if (g > gap) { gap = g; worst = role; }
  }
  return gap >= minGap ? worst : null;
}
function aiTransferDay(intensity) {
  const all = Object.values(S.players).filter(p => p.age >= 18 && !p.loan);
  for (const c of activeClubs()) {
    if (isUser(c)) continue;
    const ratio = scr(c), rich = c.cash > c.revBase * .6;
    // Clubs over the cost line try to shift their biggest earner instead of buying.
    if (ratio > 1.05 && c.owner !== "reckless" && R() < .5) { const top = c.squad.map(P).filter(p => !p.listed).sort((a, b) => b.wage - a.wage)[0]; if (top) top.listed = true; }
    if (ratio > (c.owner === "reckless" ? 1.18 : .97)) continue;
    if (R() > intensity * (rich ? 2 : 1)) continue;
    const role = findNeed(c, rich ? 1 : 5); if (!role) continue;
    const lvl = clubLevel(c), budget = c.cash + (c.owner === "reckless" ? c.revBase * .3 : 0);
    let best = null, bs = -1e9;
    for (let i = 0; i < 90; i++) {
      const p = all[Math.floor(R() * all.length)];
      if (!p || p.club === c.id || FAM[p.pos][role] < .9 || p.age > 31 || p.ovr < lvl - 1 || p.ovr > lvl + 8 || hasNamesake(c, p.name)) continue;
      if (p.club >= 0 && C(p.club).rep > c.rep + 8 && !p.req) continue;
      const fee = askingPrice(p, c); if (fee > budget * .6) continue;
      const sc = p.ovr - fee / 4e6 + (p.req || p.listed ? 3 : 0) + (p.club < 0 ? 2 : 0) + (30 - p.age) * .1;
      if (sc > bs) { bs = sc; best = p; }
    }
    if (!best) continue;
    const fee = askingPrice(best, c), w = willingness(best, c);
    if (w < .3) continue;
    if (best.club === S.club) { if (best.listed || best.req || R() < .25) offerToUser(best, c, Math.round(fee * rf(.85, 1.05) / 1e5) * 1e5); continue; }
    if (best.club >= 0) { const seller = C(best.club); if (seller.squad.filter(id => FAM[P(id).pos][best.pos] >= .9).length <= 2 || rivalry(seller.id, c.id) >= 2) continue; }
    transfer(best, c, fee, contractDemand(best, c, w), ri(2, 5));
    if (regInfo(c).seniors > RULES.aiSeniorCap) trimSquad(c, false);
  }
}
function offerToUser(p, from, fee) {
  if (S.inbox.some(m => !m.done && m.type === "bid" && m.pid === p.id)) return;
  addDecision({ type: "bid", pid: p.id, from: from.id, fee, title: `${from.name} bid ${money(fee)} for ${p.name}`,
    body: `${from.name} (${leagueName(leagueKey(from))}) have offered ${money(fee)} for ${p.name}, ${p.age}, ${p.pos} rated ${p.ovr}. His market value is ${money(value(p))}.${p.req ? " He has asked to leave." : ""}${from.rep > me().rep && p.amb > .6 ? " He is ambitious and would like the move." : ""}`,
    opts: [["accept", "Accept the bid"], ["reject", "Reject"]] });
}

/* User-facing transfer actions */
function canBuy(p) {
  if (!windowOpen()) return "The transfer window is closed. It opens in preseason and in January (weeks 19–22).";
  if (p.club === S.club) return "He is already your player.";
  if (p.loan) return `He is on loan at ${C(p.club).name} from ${C(p.loan.from).name}.`;
  if (S.tried && S.tried[p.id] === S.year + ":" + S.week + ":" + S.phase + S.summerDay) return "His club has already turned you down this week.";
  return null;
}
/* Every offer you make that gets an answer is kept for the Offers tab: the fee, the asking price then, and the
   outcome (club rejected the fee, player refused, or signed). Refusals before an answer (no cash, window shut)
   aren't offers. */
function logBid(p, fee, yrs, res, msg) { (S.bids ||= {})[p.id] = { y: S.year, w: S.phase === "season" ? S.week : -1, fee, ask: p.club >= 0 ? askingPrice(p) : 0, yrs, res, msg, club: p.club }; }
function userBid(p, fee, yrs) {
  const r = userBidInner(p, fee, yrs);
  if (r.res) logBid(p, fee, yrs, r.res, r.msg);
  return r;
}
function userBidInner(p, fee, yrs) {
  const err = canBuy(p); if (err) return { ok: false, msg: err };
  const c = me(), ask = askingPrice(p), w = willingness(p, c);
  if (fee * 1.05 > c.cash) return { ok: false, msg: `You can't cover ${money(fee)} plus agent fees with ${money(c.cash)} in the bank.` };
  if (p.club >= 0 && fee < ask) {
    const ok = fee >= ask * .88 && R() < .45;
    if (!ok) { (S.tried ||= {})[p.id] = S.year + ":" + S.week + ":" + S.phase + S.summerDay; return { ok: false, res: "rejected", msg: `${C(p.club).name} reject ${money(fee)}. They want around ${money(ask)}.` }; }
  }
  if (w < .3) return { ok: false, res: "refused", msg: `${p.name} doesn't want to join. ${whyNot(p, c)}` };
  const wage = contractDemand(p, c, w), fromRival = p.club >= 0 ? rivalry(p.club, c.id) : 0, rivalClub = p.club >= 0 ? C(p.club) : null;
  transfer(p, c, fee, wage, yrs);
  if (fromRival) { S.board = clamp(S.board - fromRival, 0, 100); news(`Signing ${p.name} from ${rivalClub.name} divides opinion. Some supporters will never accept a player from across the divide.`, true, "transfer"); }
  fixUserLineup();
  return { ok: true, res: "signed", msg: `${p.name} signs a ${yrs}-year deal on ${perWeek(wage)}.` };
}
function whyNot(p, b) {
  const cur = p.club >= 0 ? C(p.club) : null, out = [];
  if (cur && cur.rep > b.rep + 5) out.push("he'd be stepping down to a smaller club");
  const rivals = b.squad.map(P).filter(x => x.pos === p.pos && x.ovr > p.ovr).length;
  if (rivals >= Math.max(1, roleSlots(b.formation, p.pos))) out.push("he'd struggle for minutes behind your current " + ROLE_NAME[p.pos].toLowerCase() + "s");
  if (roleSlots(b.formation, p.pos) === 0 && p.pos !== "GK") out.push(`your ${b.formation} has no ${ROLE_NAME[p.pos].toLowerCase()} role`);
  if (p.ovr - clubLevel(b) > 8) out.push(`he's too good to drop to the ${leagueName(b.lg)}`);
  return out.length ? "He thinks " + out.join(", and ") + "." : "";
}
function sellToAbroad(p) {
  const c = me(), fee = Math.round(value(p) * .8 / 1e4) * 1e4;
  c.squad = c.squad.filter(id => id !== p.id); const book = p.am ? p.am.per * p.am.left : 0;
  c.cash += fee; c.fin.sales += fee - book; c.fin.sold += fee; S.lineup = S.lineup.map(id => id === p.id ? null : id);
  news(`${p.name} sold to a club abroad for ${money(fee)}.`, false, "transfer");
  delete S.players[p.id]; fixUserLineup();
  return fee;
}
function releasePlayer(p) {
  const c = me(), pay = Math.round(p.wage * Math.max(0, p.yrs) * .5);
  c.cash -= pay; c.fin.wages += pay; c.squad = c.squad.filter(id => id !== p.id); S.lineup = S.lineup.map(id => id === p.id ? null : id);
  toFreeAgent(p); fixUserLineup();
  news(`${p.name} released. Settlement: ${money(pay)}.`, false, "squad");
}
function renewTerms(p) {
  const c = me();
  if (p.retiring === 1) return { happy: false, wage: p.wage, reason: "He has decided to retire at the end of the season." };
  const happy = p.mood >= 45 && !p.req;
  const wage = Math.round(wageDemand(p, c.rep) * (p.mood < 60 ? 1.25 : 1.05) / 1000) * 1000;
  return { happy, wage, reason: happy ? "" : p.req ? "He has asked to leave and won't discuss a new deal." : "He is unhappy and won't commit his future right now. More minutes or better results might change that." };
}

/* ---------- Squad Cost Ratio ---------- */
/* Before the accounts close, an AI club heading for a charge sells whoever books the biggest profit,
   as real clubs do, until it is back under the line or can't find a buyer. */
function deadlineSales(c, ratio) {
  const lvl = clubLevel(c), buyers = activeClubs().filter(b => b.id !== c.id && !isUser(b) && b.squad.length < 32 && clubLevel(b) >= lvl - 2 && rivalry(b.id, c.id) < 2);
  const book = p => p.am ? p.am.per * p.am.left : 0;
  const list = c.squad.map(P).filter(p => !p.loan && p.age >= 18).sort((a, b) => (value(b) - book(b)) - (value(a) - book(a)));
  let sold = 0;
  if (R() < .06) { c.missedDeadline = S.year; return; }  // sometimes no deal gets done before the accounts close
  for (const p of list.slice(0, 8)) {
    if (ratio() <= RULES.scrSporting - .05 || sold >= 5) break;
    if (R() < .12) continue;  // this deal falls through; try the next player
    const buyer = pick(buyers.filter(b => b.cash > value(p) && !hasNamesake(b, p.name))); if (!buyer) continue;
    const fee = Math.round(value(p) * rf(.85, 1.05) / 1e4) * 1e4;
    transfer(p, buyer, fee, contractDemand(p, buyer, .6), ri(2, 5)); sold++; trimSquad(buyer, false);
    if (!isForeign(c) && (c.lg === me().lg || c.lg === "E1" || rivalry(c.id, S.club))) news(`${c.name} sell ${p.name} to ${buyer.name} for ${money(fee)} to stay inside the cost rules.`, false, "finance");
  }
}
function assessSCR() {
  for (const c of activeClubs()) {
    if (!c.fin || c.fin.rev < 1 || c.newcomer === S.year) continue;  // clubs that joined this summer have no season to judge
    const f = c.fin, costOf = () => f.wages + f.amort + f.agent, revOf = () => f.rev + f.prize + f.merit + f.scheme + Math.max(0, f.sales);
    // Clubs plan as if any connected-party income might be struck out, since the review comes after the deadline.
    const risky = sum(c.schemes.filter(s => s.y === S.year), s => s.amt), safeRatio = () => costOf() / Math.max(1, revOf() - risky);
    if (!isUser(c) && safeRatio() > RULES.scrSporting - .03) deadlineSales(c, safeRatio);
    const cost = costOf(), rev = revOf(), ratio = cost / Math.max(1, rev); c.lastSCR = ratio;
    let schemeBad = false;
    for (const s of c.schemes.filter(s => s.y === S.year)) {
      if (R() < s.risk) { schemeBad = true; s.found = true; news(`The league rules ${c.name}'s ${s.what} was not at fair market value. ${money(s.amt)} is struck from their accounts.`, isUser(c) || c.lg === me().lg || c.lg === "E1", "finance"); }
    }
    const adj = schemeBad ? cost / Math.max(1, rev - sum(c.schemes.filter(s => s.y === S.year && s.found), s => s.amt)) : ratio;
    // Points deductions are an English-league sanction; foreign clubs only pay the levy.
    if (adj > RULES.scrSporting && !isForeign(c)) {
      const pts = Math.min(15, 6 + Math.floor((adj - RULES.scrSporting) / .05) + (schemeBad ? 2 : 0));
      S.cases.push({ club: c.id, ratio: adj, pts, hearing: ri(6, 20), status: "charged", y: S.year + 1 });
      if (!isForeign(c)) news(`${c.missedDeadline === S.year ? `${c.name} failed to sell in time. ` : ""}${c.name} charged with breaching the Squad Cost Ratio (${pct(adj)} against a ${pct(RULES.scrLimit)} limit). A hearing will follow next season.`, true, "finance");
    } else if (adj > RULES.scrLimit) {
      const levy = Math.round((adj - RULES.scrLimit) * rev * .5); c.cash -= levy; c.fin.levy += levy;
      if (isUser(c) || c.lg === "E1") news(`${c.name} pay a ${money(levy)} levy after a Squad Cost Ratio of ${pct(adj)}.`, isUser(c), "finance");
    }
  }
}

/* ---------- loans ---------- */
// A loanee sits in the borrowing club's squad and counts towards its registration; the parent keeps the contract.
function startLoan(p, to) {
  const from = C(p.club);
  from.squad = from.squad.filter(id => id !== p.id); to.squad.push(p.id);
  p.loan = { from: from.id, y: S.year }; p.club = to.id; p.pt = .5; p.listed = false;
  refreshRegistration(to); refreshRegistration(from);
  if (isUser(from)) S.lineup = S.lineup.map(id => id === p.id ? null : id);
  bumpTick();
  if (isUser(from) || isUser(to)) news(`${p.name} joins ${to.name} on a season-long loan from ${from.name}.`, true, "transfer");
}
function endLoan(p) {
  const from = C(p.loan.from), cur = p.club >= 0 ? C(p.club) : null;
  if (cur) cur.squad = cur.squad.filter(id => id !== p.id);
  if (isUser(cur)) S.lineup = S.lineup.map(id => id === p.id ? null : id);
  p.loan = null;
  if (from && !from.gone) { from.squad.push(p.id); p.club = from.id; } else toFreeAgent(p);
  bumpTick();
}
const loanable = p => p.club >= 0 && !p.loan && p.age <= RULES.loanMaxAge && !p.inj;
function wouldStart(p, c) { return c.squad.map(P).filter(x => x.id !== p.id && FAM[x.pos][p.pos] >= .9 && x.ovr >= p.ovr).length < Math.max(1, roleSlots(c.formation, p.pos)); }
function canTakeLoan(c, p) { const r = regInfo(c); return r.loansIn < RULES.loansIn && (!isSenior(p) || r.registered < RULES.squadMax) && (!isSenior(p) || isHG(p, c.country) || r.nonHG < RULES.nonHGMax); }
/* Where should a young player go to play? Clubs a little below his level that would start him. */
function loanDestinations(p, opts = {}) {
  const fit = c => Math.abs(clubLevel(c) - p.ovr - 1);
  const ok = activeClubs().filter(c => c.id !== p.club && !isUser(c) && clubLevel(c) <= p.ovr + 3 && clubLevel(c) >= p.ovr - 9 && wouldStart(p, c) && canTakeLoan(c, p) && !hasNamesake(c, p.name)).sort((a, b) => fit(a) - fit(b));
  if (!opts.mix) return ok.slice(0, 4);
  // For you: a choice at home and abroad.
  return [...ok.filter(c => !isForeign(c)).slice(0, 4), ...ok.filter(c => isForeign(c)).slice(0, 4)];
}
function userLoanIn(p) {
  const c = me();
  if (!windowOpen()) return { ok: false, msg: "Loans can only be agreed while the transfer window is open." };
  if (!loanable(p) || p.club < 0) return { ok: false, msg: "He isn't available for loan." };
  if (!canTakeLoan(c, p)) return { ok: false, msg: `You can have ${RULES.loansIn} loan players at most, and he must fit your registration.` };
  const parent = C(p.club);
  if (wouldStart(p, parent)) return { ok: false, msg: `${parent.name} see him as a starter and won't loan him out.` };
  const rank = c.squad.map(P).filter(x => FAM[x.pos][p.pos] >= .9 && x.ovr >= p.ovr).length, slots = Math.max(1, roleSlots(c.formation, p.pos));
  if (rank >= slots * 2) return { ok: false, msg: `${parent.name} want him playing regularly, and he'd be behind ${rank} players at your club.` };
  if (clubLevel(c) < p.ovr - 10) return { ok: false, msg: `${parent.name} want him tested at a higher level than the ${leagueName(c.lg)}.` };
  startLoan(p, c); fixUserLineup();
  return { ok: true, msg: `${p.name} joins on loan for the season. You pay his wages.` };
}
function aiLoans() {
  for (const c of activeClubs()) {
    if (isUser(c) || c.tier > 4) continue;
    let n = 0;
    for (const p of c.squad.map(P)) {
      if (n >= 2 || !loanable(p) || p.age > 22 || p.pot < clubLevel(c) - 4 || wouldStart(p, c) || R() > .3) continue;
      const d = loanDestinations(p)[0]; if (!d) continue;
      startLoan(p, d); n++;
    }
  }
}
