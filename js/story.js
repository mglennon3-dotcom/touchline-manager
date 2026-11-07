"use strict";
/* Player mood, transfer requests, and the league's running storylines. */
function addDecision(m) { m.id = S.nextMsg++; m.done = false; m.y = S.year; m.w = whenLabel(); S.inbox.unshift(m); if (S.inbox.length > 60) S.inbox.length = 60; }
const openDecisions = () => S.inbox.filter(m => !m.done);

function expectedShare(p, c) {
  const rank = c.squad.map(P).filter(x => x.id !== p.id && FAM[x.pos][p.pos] >= .9 && x.ovr > p.ovr).length;
  const slots = Math.max(1, roleSlots(c.formation, p.pos));
  const e = rank < slots ? .8 : rank < slots * 2 ? .4 : .15;
  return p.age <= 20 ? e * .5 : e;
}
function moodReasons(p) {
  if (p.club < 0) return [];
  const c = C(p.club), out = [], e = expectedShare(p, c);
  if (p.pt < e - .2) out.push(["Wants more playing time", -1]); else if (p.pt > e + .1) out.push(["Happy with his minutes", 1]);
  if (p.ovr > clubLevel(c) + 6 && p.amb > .6) out.push(["Feels he has outgrown the club", -1]);
  if (p.promise) out.push([`Promised regular football until week ${p.promise.until + 1}`, 0]);
  if (p.req) out.push(["Has asked to leave", -1]);
  if (!isReg(p, c)) out.push(["Left out of the registered squad", -1]);
  if (p.loy > .75) out.push(["Loyal to the club", 1]);
  return out;
}
function weeklyMood() {
  const userRes = S.myRes && S.myRes.length ? S.myRes[S.myRes.length - 1] : null;
  for (const c of activeClubs()) {
    const lvl = clubLevel(c);
    for (const id of c.squad) {
      const p = P(id), e = expectedShare(p, c);
      let d = (p.pt - e) * 6;
      if (p.ovr > lvl + 6 && p.amb > .6) d -= .8;
      // Left out of the registered 25: it stings more for good, ambitious players.
      if (!isReg(p, c)) d -= 1.2 + Math.max(0, p.ovr - lvl + 6) * .12 + p.amb;
      if (isUser(c) && userRes && userRes.w === S.week) { const won = (userRes.h === c.id) === (userRes.hg > userRes.ag) && userRes.hg !== userRes.ag; const lost = userRes.hg !== userRes.ag && !won; d += won ? .8 : lost ? -.8 * (1 + p.amb * .5) : 0; }
      d += (64 - p.mood) * .05;
      p.mood = clamp(p.mood + d, 0, 100);
      if (p.promise && S.week >= p.promise.until) {
        if (p.pt >= .5) { p.mood = Math.min(100, p.mood + 12); news(`${p.name} is happy you kept your word on playing time.`, false, "squad"); }
        else { p.mood = Math.max(0, p.mood - 25); p.req = true; news(`${p.name} says you broke your promise of more football and wants out.`, true, "squad"); squadUnrest(c, 3); }
        p.promise = null;
      }
      if (!p.loan && !p.req && p.age >= 19 && p.mood < 26 && R() < .05 + p.amb * .06 + (isReg(p, c) ? 0 : .08) && !p.promise) transferRequest(p, c);
    }
    registrationUnrest(c);
  }
}
/* When several unregistered players are miserable, the mood spreads through the dressing room. */
function registrationUnrest(c) {
  const sulking = c.squad.map(P).filter(p => !isReg(p, c) && p.mood < 35);
  if (sulking.length < 2) return;
  for (const id of c.squad) { const p = P(id); if (isReg(p, c)) p.mood = Math.max(0, p.mood - .3 * sulking.length * (1 - p.loy * .5)); }
  if (isUser(c) && (!c.unrestNews || S.week - c.unrestNews >= 6 || c.unrestNews > S.week)) { c.unrestNews = S.week; news(`Unrest in the dressing room: ${sulking.map(p => p.name).join(", ")} ${sulking.length > 1 ? "are" : "is"} unhappy at being left out of the registered squad, and it's affecting the others.`, true, "squad"); }
}
function squadUnrest(c, n) { for (const id of c.squad) { const p = P(id); p.mood = Math.max(0, p.mood - n * (1 - p.loy * .5)); } }
function transferRequest(p, c) {
  p.req = true;
  if (isUser(c)) {
    const why = moodReasons(p).filter(r => r[1] < 0).map(r => r[0].toLowerCase()).join("; ") || "he is unsettled";
    addDecision({ type: "req", pid: p.id, title: `${p.name} hands in a transfer request`, body: `${p.name} (${p.pos}, ${p.ovr}) has asked to leave: ${why}. How do you respond?`,
      opts: [["list", "Accept and put him on the transfer list"], ["promise", "Promise him more football"], ["refuse", "Refuse and tell him to get on with it"]] });
  } else {
    p.listed = true;
    if (!isForeign(c) && (c.lg === me().lg || (c.lg === "E1" && p.ovr >= 76))) news(`${p.name} has handed in a transfer request at ${c.name}.`, false, "transfer");
  }
}

/* ---------- league storylines ---------- */
function weeklyStories() {
  if (S.phase !== "season") return;
  // hearings on financial charges
  for (const k of S.cases) {
    if (k.status === "charged" && k.y === S.year && S.week >= k.hearing) {
      const c = C(k.club), L = S.leagues[leagueKey(c)];
      L.ded[c.id] = (L.ded[c.id] || 0) + k.pts; k.status = "deducted"; k.appeal = S.week + ri(4, 8);
      news(`${c.name} are deducted ${k.pts} points for breaching the Squad Cost Ratio rules.`, true, "finance");
      if (isUser(c)) S.board = clamp(S.board - 12, 0, 100);
    } else if (k.status === "deducted" && k.y === S.year && S.week >= k.appeal) {
      const c = C(k.club), L = S.leagues[leagueKey(c)];
      if (R() < .4) { const back = Math.min(k.pts - 2, ri(1, 3)); L.ded[c.id] -= back; news(`${c.name} win part of their appeal: ${back} of the ${k.pts} points are restored.`, isUser(c), "finance"); }
      else news(`${c.name}'s appeal against their points deduction is dismissed.`, isUser(c), "finance");
      k.status = "closed";
    }
  }
  // AI clubs under financial pressure try to dress up their accounts
  if (S.week === 16 || S.week === 30) for (const c of activeClubs()) {
    if (isUser(c) || c.schemes.some(s => s.y === S.year)) continue;
    const ratio = scr(c);
    if (ratio > .95 && (c.owner === "reckless" || c.owner === "ambitious") && R() < .55) {
      const what = pick(["sale of their training ground to a company owned by the chairman", "sponsorship deal with a firm linked to the owner", "sale of youth players to an affiliated club", "sale of the women's team to the club's parent company"]);
      const amt = Math.round(c.revBase * rf(.12, .3));
      c.schemes.push({ y: S.year, what, amt, risk: .45 }); c.fin.scheme += amt; c.cash += amt;
      if (!isForeign(c) && c.tier <= 2) news(`Questions raised over ${c.name}'s ${what}, worth ${money(amt)}. Rivals have written to the league.`, c.lg === me().lg, "finance");
    }
  }
  // the user's owner has ideas of his own
  if ((S.week === 15 || S.week === 29) && !me().schemes.some(s => s.y === S.year) && scr(me()) > .82 && !openDecisions().some(m => m.type === "scheme")) {
    const amt = Math.round(me().revBase * rf(.12, .25));
    const what = pick(["sell the training ground to his holding company and lease it back", "sign a sponsorship deal with one of his own companies"]);
    addDecision({ type: "scheme", amt, what, title: "The owner has a plan for the accounts",
      body: `Your projected Squad Cost Ratio is ${pct(scr(me()))}. The owner wants to ${what} for ${money(amt)}, which would count as income this season. The league reviews deals between connected parties, and if it decides the price was inflated the income is struck out and a charge may follow.`,
      opts: [["accept", "Go ahead"], ["decline", "Decline: keep the books clean"]] });
  }
  // takeovers: one or two every few seasons across the game, more often at struggling or stretched clubs
  if (R() < .012) {
    const c = wpick(activeClubs().filter(x => !isUser(x)), x => {
      const L = S.leagues[x.lg], pos = posIn(L, x.id) / L.clubs.length, strain = squadCost(x) / Math.max(1, x.revBase);
      return (x.rep < 80 ? 1 : .3) * (1 + pos) * (strain > .9 ? 2 : 1);
    });
    if (c) takeover(c);
  }
  if (R() < .00025) takeover(me());  // about a 1% chance a season for your own club
  // managerial changes bring new formations, which changes who wants to join
  if (S.week % 4 === 3) for (const L of Object.values(S.leagues)) {
    const t = standings(L);
    for (let i = 0; i < t.length; i++) {
      const c = C(t[i].id); if (isUser(c)) continue;
      const exp = expectedPos(c);
      if (i + 1 - exp >= 7 && R() < .12) {
        const old = c.formation, gone = c.coach.name; c.coach = genCoach(c.rep + ri(-5, 8), R() < .7 ? c.country : pick(Object.keys(COUNTRY))); c.formation = c.coach.form;
        if (L.key === "E1" || L.key === me().lg) news(`${c.name} sack ${gone} with the club ${ord(i + 1)}. ${c.coach.name} (${ARCH[c.coach.arch].l.toLowerCase()}) takes over and ${old === c.formation ? `keeps the ${old}` : `brings his preferred ${c.formation} in place of the ${old}`}.`, false, "club");
      }
    }
  }
  // the user's stars get restless when bigger clubs circle
  if (windowOpen() && R() < .25) {
    const star = me().squad.map(P).filter(p => p.amb > .65 && !p.req && !p.loan && p.age >= 20).sort((a, b) => b.ovr - a.ovr)[0];
    const suitor = star && pick(activeClubs().filter(c => c.rep > me().rep + 6 && !isUser(c)));
    if (star && suitor && R() < .5) { star.mood = Math.max(0, star.mood - 12); news(`${star.name}'s agent says his client "would be honoured" to play for ${suitor.name}. His mood has dipped.`, true, "squad"); }
  }
  // expiring contracts: one decision so nobody walks out by accident
  if (S.week === 26) {
    const ex = me().squad.map(P).filter(p => p.yrs <= 1 && !p.loan);
    if (ex.length) {
      const willing = ex.filter(p => renewTerms(p).happy);
      addDecision({ type: "renew", ids: ex.map(p => p.id), title: `${ex.length} contract${ex.length > 1 ? "s" : ""} expire this summer`,
        body: `${ex.map(p => `${p.name} (${p.pos}, ${p.age}, ${p.ovr})`).join(", ")}. ${willing.length} of them would sign a new four-year deal now, adding ${perWeek(sum(willing, p => renewTerms(p).wage - p.wage))} to the wage bill. Anyone not renewed leaves for nothing at the end of the season.`,
        opts: [["all", `Offer new deals to the ${willing.length} willing`], ["none", "I'll decide one by one"]] });
    }
  }
}

/* ---------- resolving decisions ---------- */
function resolveDecision(m, choice) {
  m.done = true; m.choice = choice;
  const p = m.pid != null ? S.players[m.pid] : null;
  if (m.type === "bid") {
    if (!p || p.club !== S.club) return "That player has already left.";
    const from = C(m.from);
    if (choice === "accept") { const n = rivalry(from.id, S.club); transfer(p, from, m.fee, contractDemand(p, from, willingness(p, from)), ri(2, 5)); fixUserLineup(); if (n) { S.board = clamp(S.board - 2 * n, 0, 100); return `${p.name} sold to ${from.name} for ${money(m.fee)}. Selling to your rivals has angered the supporters (board −${2 * n}).`; } return `${p.name} sold to ${from.name} for ${money(m.fee)}.`; }
    if (p.amb > .6 && from.rep > me().rep) { p.mood = Math.max(0, p.mood - 18); return `Bid rejected. ${p.name} is upset to miss the move.`; }
    return "Bid rejected.";
  }
  if (m.type === "auction") {
    if (!p || p.club !== S.club) return "That player has already left.";
    if (choice.startsWith("acc:")) {
      const b = m.bids.find(x => x.from === +choice.slice(4)), to = C(b.from), n = rivalry(to.id, S.club);
      transfer(p, to, b.fee, contractDemand(p, to, willingness(p, to)), ri(2, 5)); fixUserLineup();
      if (n) S.board = clamp(S.board - 2 * n, 0, 100);
      return `${p.name} sold to ${to.name} for ${money(b.fee)}${b.fee < m.bids[0].fee ? `, not the highest bid (${money(m.bids[0].fee)})` : ""}.${n ? " Selling to a rival didn't go down well." : ""}`;
    }
    if (p.amb > .6 && m.bids.some(x => C(x.from).rep > me().rep)) { p.mood = Math.max(0, p.mood - 18); return `All bids rejected. ${p.name} is upset to miss the move.`; }
    return "All bids rejected.";
  }
  if (m.type === "req") {
    if (!p) return "";
    if (choice === "list") { p.listed = true; return `${p.name} is on the transfer list. Clubs will be told he's available.`; }
    if (choice === "promise") { p.req = false; p.mood = Math.min(100, p.mood + 18); p.promise = { until: S.phase === "summer" ? 6 : Math.min(37, S.week + 6) }; return `You promise ${p.name} regular football. Keep him playing for the next six weeks.`; }
    p.req = true; p.mood = Math.max(0, p.mood - 10); squadUnrest(me(), 2); return `${p.name} is told he's staying. The dressing room noticed.`;
  }
  if (m.type === "renew") {
    if (choice !== "all") return "Open a player from the Squad page to renew him.";
    let n = 0; for (const id of m.ids) { const q = S.players[id]; if (!q || q.club !== S.club) continue; const t = renewTerms(q); if (t.happy) { q.yrs = 4; q.wage = t.wage; n++; } }
    return `${n} player${n === 1 ? "" : "s"} signed new contracts.`;
  }
  if (m.type === "sponsor") return takeSponsor(m, choice);
  if (m.type === "scheme") {
    if (choice === "accept") { const c = me(); c.schemes.push({ y: S.year, what: m.what.replace(/^sell/, "sale of").replace(/^sign/, "signing of"), amt: m.amt, risk: .45 }); c.fin.scheme += m.amt; c.cash += m.amt; return `Done. ${money(m.amt)} goes through the books this season.`; }
    S.board = clamp(S.board + 2, 0, 100); return "You decline. The board approves of your caution.";
  }
  return "";
}

/* A change of ownership. Investors put money in and want more; cost-cutters and leveraged buyers take money out. */
function takeover(c, kind) {
  kind = kind || (R() < .55 ? "invest" : "cut");
  const before = c.owner, who = pick(kind === "invest" ? ["A consortium", "An overseas investment group", "A local billionaire", "A sports investment fund"] : ["A private equity firm", "A property developer", "A leveraged buyout group", "A cost-conscious local businessman"]);
  let detail;
  if (kind === "invest") {
    const war = Math.round(c.revBase * rf(.8, 2.5));
    c.owner = R() < .55 ? "ambitious" : "reckless"; c.cash += war; c.revBase = Math.round(c.revBase * 1.08); c.rep = Math.min(90, c.rep + 3);
    const acad = R() < .5 ? ri(1, 3) : 0; c.academy = Math.min(20, c.academy + acad);
    moveFans(c, 6, "New owners investing");
    detail = `promises ${money(war)} for new players${acad ? ` and a bigger academy (youth development +${acad})` : ""}`;
  } else {
    const drain = Math.round(c.revBase * rf(.2, .6));
    c.owner = "prudent"; c.cash -= drain;
    const acad = R() < .4 ? ri(1, 2) : 0; c.academy = Math.max(1, c.academy - acad);
    if (!isUser(c)) for (const p of c.squad.map(P).sort((a, b) => b.wage - a.wage).slice(0, 2)) p.listed = true;  // high earners up for sale
    moveFans(c, -8, "New owners cutting costs");
    detail = `loads ${money(drain)} of costs onto the club and orders spending cuts${acad ? `, trimming the academy (youth development −${acad})` : ""}`;
  }
  (c.takeovers ||= []).push({ y: S.year, kind, who, from: before, to: c.owner });
  if (isUser(c)) {
    if (kind === "invest") { S.expPos = Math.max(1, S.expPos - ri(1, 3)); S.board = Math.max(S.board, 55); }
    else S.expPos = Math.min(S.leagues[c.lg].clubs.length, S.expPos + 1);
    news(`${who} has bought ${c.name} and ${detail}. ${kind === "invest" ? `They expect more: the new target is to ${expText(S.expPos, c.lg).toLowerCase()}.` : `Expectations ease a little: the target is now to ${expText(S.expPos, c.lg).toLowerCase()}.`}`, true, "club");
  } else if (!isForeign(c) && (c.lg === me().lg || c.tier === 1 || rivalry(c.id, S.club))) news(`${who} completes a takeover of ${c.name} (${leagueName(c.lg)}) and ${detail}.`, c.lg === me().lg || rivalry(c.id, S.club) > 0, "club");
}
