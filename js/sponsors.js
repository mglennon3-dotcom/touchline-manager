"use strict";
/* Sponsorship. Each club has a shirt sponsor and a kit supplier. A deal's worth depends on what the club
   could command when it was signed: prestige, fan engagement, recent trophies and European football. So
   deals renewed after success pay more, and the clauses move them with promotion and relegation.
   At the start, sponsorship is carved out of each club's existing income, so it rebalances rather than inflates. */
const SPONSOR_SHARE = .15;
const BRAND = [["Apex", "Northwind", "Halcyon", "Brightline", "Vantage", "Crestmark", "Silverleaf", "Ironclad", "Bluewater", "Summit", "Kestrel", "Meridian", "Lumen", "Orbis", "Granite", "Harbourline", "Redstone", "Clearpath", "Evergreen", "Polaris"],
  ["Insurance", "Bank", "Telecom", "Motors", "Air", "Energy", "Logistics", "Foods", "Brewing", "Holdings", "Mobile", "Software", "Building Society", "Travel", "Homes"]];
const KIT = ["Strider", "Volta", "Kinetic", "Arcus", "Tempo", "Fieldcraft", "Nova Sport", "Pulse", "Sprintline", "Ridge"];
const DEAL_STYLE = {
  std: { l: "Standard", base: 1, yrs: [2, 3], bonus: 1 },
  long: { l: "Long and secure", base: .9, yrs: [4, 5], bonus: .8 },
  short: { l: "Short, top rate", base: 1.08, yrs: [1, 1], bonus: 1 },
  perf: { l: "Performance-based", base: .72, yrs: [3, 3], bonus: 2.6 },
};
function sponsorRaw(c) {
  const recent = c.trophies.filter(t => t.y >= S.year - 3).length, europe = (S.contIds || []).includes(c.id) ? 1.15 : 1;
  return Math.pow(1.06, c.rep) * (.85 + .3 * (c.fans ?? 60) / 100) * (1 + .08 * Math.min(4, recent)) * europe;
}
const sponsorMarket = (c, kind) => (S.spK[c.lg] || 1) * sponsorRaw(c) * (kind === "kit" ? .4 : .6);
function newDeal(c, kind, style = "std") {
  const st = DEAL_STYLE[style], amt = Math.round(sponsorMarket(c, kind) * st.base * rf(.95, 1.05) / 1000) * 1000;
  const name = kind === "kit" ? pick(KIT) : pick(BRAND[0]) + " " + pick(BRAND[1]);
  return { kind, name, amt, yrs: ri(st.yrs[0], st.yrs[1]), style, start: S.year,
    bonus: { title: Math.round(amt * .3 * st.bonus), up: Math.round(amt * .25 * st.bonus), europe: Math.round(amt * .15 * st.bonus), cup: Math.round(amt * .12 * st.bonus) } };
}
const sponsorTotal = c => sum(c.deals || [], d => d.amt);
/* Per-division scale, set once so that sponsorship starts at about 15% of each club's income. */
function calibrateSponsors(clubs) {
  S.spK = S.spK || {};
  for (const key of Object.keys(LG)) {
    if (S.spK[key]) continue;
    const ks = S.leagues[key].clubs.map(C).map(c => SPONSOR_SHARE * c.revBase / sponsorRaw(c)).sort((a, b) => a - b);
    S.spK[key] = ks[Math.floor(ks.length / 2)];
  }
  for (const c of clubs) initSponsors(c);
}
function initSponsors(c) {
  c.deals = [newDeal(c, "shirt"), newDeal(c, "kit")];
  for (const d of c.deals) d.yrs = ri(1, 4);
  c.revBase = Math.round(c.revBase - sponsorTotal(c));
}
/* Weekly payments (the summer share is paid at the end of the season with the rest of the summer income). */
function sponsorPay(c, share) {
  const amt = sponsorTotal(c) * share; if (!amt) return;
  c.cash += amt; c.fin.rev += amt; c.fin.spons = (c.fin.spons || 0) + amt;
}
/* Clauses: promotion lifts a deal, relegation cuts it. */
function sponsorClause(c, dir) {
  const k = dir === "up" ? 1.2 : .75;
  for (const d of c.deals || []) { d.amt = Math.round(d.amt * k); for (const b in d.bonus) d.bonus[b] = Math.round(d.bonus[b] * k); }
  if (isUser(c)) news(`Sponsorship clauses: your deals are ${dir === "up" ? "raised by 20% after promotion" : "cut by 25% after relegation"}.`, true, "finance");
}
/* End of season: bonuses for what the club achieved, then renewals. */
function sponsorSeason(c, achieved) {
  let paid = 0; const why = [];
  for (const d of c.deals || []) for (const k of Object.keys(achieved)) if (achieved[k]) { paid += d.bonus[k]; }
  for (const k of Object.keys(achieved)) if (achieved[k]) why.push({ title: "the title", up: "promotion", europe: "European qualification", cup: "a cup win" }[k]);
  if (paid) { c.cash += paid; c.fin.rev += paid; c.fin.spons = (c.fin.spons || 0) + paid; if (isUser(c)) news(`Sponsors pay ${money(paid)} in bonuses for ${why.join(" and ")}.`, true, "finance"); }
  for (const d of c.deals || []) d.yrs--;
  for (let i = 0; i < c.deals.length; i++) {
    const d = c.deals[i]; if (d.yrs > 0) continue;
    if (isUser(c)) offerSponsors(c, d.kind, d);
    else c.deals[i] = newDeal(c, d.kind, pick(["std", "std", "long", "short", "perf"]));
  }
}
function offerSponsors(c, kind, old) {
  const offers = ["long", "short", "perf"].map(s => newDeal(c, kind, s));
  const label = kind === "kit" ? "kit supplier" : "shirt sponsor";
  addDecision({ type: "sponsor", kind, offers, title: `Your ${label} deal has ended`,
    body: `${old.name} paid ${money(old.amt)} a year. Your market value today is about ${money(sponsorMarket(c, kind))} a year, based on prestige, fan engagement, recent trophies and European football. Three offers are on the table. Bonuses are paid each season for the title, promotion, European qualification and cup wins.`,
    opts: offers.map((o, i) => [String(i), `${o.name}: ${money(o.amt)} a year for ${o.yrs} year${o.yrs > 1 ? "s" : ""}${o.style === "perf" ? `, big bonuses (title ${money(o.bonus.title)})` : o.style === "long" ? ", secure" : ", re-sign next summer"}`]) });
}
function takeSponsor(m, choice) {
  const c = me(), o = m.offers[+choice]; if (!o) return "";
  const i = c.deals.findIndex(d => d.kind === m.kind && d.yrs <= 0);
  if (i >= 0) c.deals[i] = o; else c.deals.push(o);
  return `${o.name} signed: ${money(o.amt)} a year for ${o.yrs} year${o.yrs > 1 ? "s" : ""}.`;
}
/* Saves made before sponsorship existed get it now. */
function ensureSponsors() { calibrateSponsors(activeClubs().filter(c => !c.deals)); S.sponsors = true; }
