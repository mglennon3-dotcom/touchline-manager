"use strict";
/* Rendering. Every page is a function returning HTML; actions are wired by data-a attributes in main.js. */
const UI = { page: "home", sel: null, modal: null, sort: {}, menu: false, busy: false, toastT: 0,
  lg: null, cupK: "FA", tab: "search", tf: { pos: "ALL", age: 40, min: 0, fee: 0, lg: "ALL" }, sqf: "ALL",
  yf: { reg: "ENG", pos: "ALL", st: "OPEN" }, nf: "ALL", startL: "E1", confirm: null, bid: null, histN: 5 };
const PAGES = [["home", "Home"], ["manager", "Manager"], ["squad", "Squad"], ["tactics", "Tactics"], ["fixtures", "Fixtures"], ["league", "Leagues"], ["cups", "Cups"], ["transfers", "Transfers"], ["youth", "Youth"], ["finances", "Finances"], ["news", "News"], ["history", "History"]];

/* ---------- atoms ---------- */
function crest(c, sz = 40) {
  return `<svg class="crest" width="${sz}" height="${Math.round(sz * 1.15)}" viewBox="0 0 40 46" aria-hidden="true"><path d="M20 1.5 L38 7 V22 C38 34 30 41 20 44.5 C10 41 2 34 2 22 V7 Z" fill="${c.color}" stroke="var(--crest-edge)" stroke-width="1.5"/>${sz >= 24 ? `<path d="M9 33 L20 38 L31 33" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/><text x="20" y="25" text-anchor="middle" font-family="Saira Condensed,Arial Narrow,sans-serif" font-weight="800" font-size="13" fill="#fff">${c.short}</text>` : ""}</svg>`;
}
const clubA = (id, opt = {}) => { if (id == null) return "—"; const c = C(id); return `<span class="club-in">${opt.crest !== false ? crest(c, 16) : ""}<button class="lnk" data-a="club" data-v="${id}">${esc(opt.short ? c.short : c.name)}</button>${opt.flag && c.country !== HOME ? ` <span class="tiny muted">${c.country}</span>` : ""}</span>`; };
const playerA = p => `<button class="lnk" data-a="player" data-v="${p.id}">${esc(p.name)}</button>`;
const formChips = f => `<span class="form">${(f || []).slice(-5).map(x => `<i class="${x}">${x}</i>`).join("") || '<span class="muted tiny">—</span>'}</span>`;
const fitColor = f => f >= 85 ? "var(--win)" : f >= 70 ? "var(--accent)" : "var(--loss)";
const fitBar = f => `<span class="fit" title="Fitness ${Math.round(f)}"><i style="width:${f}%;background:${fitColor(f)}"></i></span>`;
const moodWord = m => m >= 70 ? ["Happy", "good"] : m >= 50 ? ["Content", ""] : m >= 30 ? ["Unsettled", "warn"] : ["Unhappy", "bad"];
const moodTag = p => { const [w, k] = moodWord(p.mood); return `<span class="${k}">${w}</span>`; };
const starHtml = (lo, hi) => `<span class="stars" title="${lo === hi ? lo : lo + "–" + hi} stars">${"★".repeat(lo)}${"<span class='muted'>★</span>".repeat(hi - lo)}<span class="un">${"★".repeat(5 - hi)}</span></span>`;
const trophyName = t => LG[t] ? leagueName(t) : t === "FA" ? CUPS.FA.name : t === "LC" ? CUPS.LC.name : CONT[t] ? CONT[t].name : t;
/* Ratings out of 20. Exact for players you know; a range for everyone else until scouted. */
const aCls = v => v >= 17 ? "a4" : v >= 13 ? "a3" : v >= 8 ? "a2" : "a1";
function ratingHtml(p) { const [lo, hi] = ratingView(p); return lo === hi ? `<b class="rt ${aCls(lo)}">${lo}</b>` : `<span class="rt rng" title="Not fully scouted">${lo}–${hi}</span>`; }
function attrStrip(p) {
  const lvl = scoutLevel(p);
  if (lvl === 0) return '<span class="muted tiny">Scout to see</span>';
  return `<span class="atts">${attrKeys(p.pos).map(k => { const [lo, hi] = attrView(p, k); return `<span class="at ${aCls((lo + hi) / 2)}" title="${ATTRS[p.pos === "GK" ? "gk" : "out"].find(a => a[0] === k)[1]}">${k.toUpperCase()} ${lo === hi ? lo : lo + "–" + hi}</span>`; }).join("")}</span>`;
}
// Estimates of hidden ratings. For injury risk a high number is bad, so the colours run the other way.
function rangeHtml(v, risk) {
  if (!v) return '<span class="muted tiny" title="Scout him to find out">?</span>';
  const mid = (v[0] + v[1]) / 2, cls = aCls(risk ? 21 - mid : mid);
  return `<span class="rt est ${cls}" title="Scouts' estimate">${v[0] === v[1] ? v[0] : v[0] + "–" + v[1]}</span>`;
}
const potHtml = p => rangeHtml(potView(p)), injHtml = p => rangeHtml(injView(p), true);
const formOpts = sel => FORM_KEYS.map(f => `<option value="${f}" ${f === sel ? "selected" : ""}>${f}${S && S.me && S.me.form === f ? ", preferred" : ""}</option>`).join("");
function statusChips(p, c) {
  let s = "";
  if (p.inj) s += `<span class="chip inj" title="${esc(p.injT || "Injured")}">${p.inj >= 30 ? "OUT FOR SEASON" : p.inj >= 8 ? "INJ " + Math.round(p.inj / 4.3) + "m" : "INJ " + p.inj + "w"}</span> `;
  if (p.retiring === 1) s += `<span class="chip hg" title="Retiring at the end of the season">RETIRING</span> `;
  if (p.sus) s += `<span class="chip sus">BAN ${p.sus}</span> `;
  if (p.loan) s += `<span class="chip list" title="On loan from ${esc(C(p.loan.from).name)}">LOAN</span> `;
  if (p.req) s += `<span class="chip req">WANTS OUT</span> `;
  else if (p.listed) s += `<span class="chip list">LISTED</span> `;
  if (c && isHG(p, c.country)) s += `<span class="chip hg" title="Homegrown">HG</span> `;
  return s;
}
const lgOpts = (sel, keys = Object.keys(LG)) => keys.map(k => `<option value="${k}" ${k === sel ? "selected" : ""}>${LG[k].foreign ? COUNTRY[LG[k].c].name + " · " : ""}${leagueName(k)}</option>`).join("");

/* Sortable table. cols: {k,l,v:row=>sortValue,f:row=>html,r:bool,cls}. */
function table(id, cols, rows, opt = {}) {
  const st = UI.sort[id] || opt.sort || null;
  if (st) { const col = cols.find(c => c.k === st.k); if (col && col.v) rows = rows.slice().sort((a, b) => { const x = col.v(a), y = col.v(b); return (x < y ? -1 : x > y ? 1 : 0) * (st.d); }); }
  if (opt.limit) rows = rows.slice(0, opt.limit);
  return `<div class="tbl-wrap"><table><thead><tr>${cols.map(c => `<th class="${c.r ? "r" : ""} ${c.cls || ""}" ${st && st.k === c.k ? `aria-sort="${st.d > 0 ? "ascending" : "descending"}"` : ""}>${c.v ? `<button data-a="sort" data-v="${id}|${c.k}">${c.l}${st && st.k === c.k ? (st.d > 0 ? " ▲" : " ▼") : ""}</button>` : c.l}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(r => `<tr class="${opt.rowCls ? opt.rowCls(r) : ""}">${cols.map(c => `<td class="${c.r ? "r num" : ""} ${c.cls || ""}">${c.f(r)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="muted">${opt.empty || "Nothing to show."}</td></tr>`}</tbody></table></div>`;
}

/* ---------- shell ---------- */
function render() {
  const app = document.getElementById("app");
  if (S) bumpTick();
  if (!S || S.club == null) { app.innerHTML = viewStart(); renderModal(); return; }
  if (S.sacked) { app.innerHTML = viewSacked(); renderModal(); return; }
  const c = me(), L = S.leagues[c.lg], pos = S.phase === "season" ? posIn(L, c.id) : S.lastPos[c.id];
  const when = S.phase === "summer" ? `Summer window · day ${S.summerDay + 1} of ${CAL.summerDays}` : `Week ${S.week + 1}${CAL.jan.includes(S.week) ? " · window open" : ""}`;
  const ratio = scr(c), dec = openDecisions().length;
  app.innerHTML = `<header class="mast" style="--club:${c.color}"><div class="wrap gut">
    <div class="mast-in"><div class="ident">${crest(c, 34)}<div><div class="eyebrow">${seasonLabel(S.year)} · ${leagueName(c.lg)} · ${when}</div><h1>${esc(c.name)}</h1></div></div>
    <div class="mast-r"><dl class="kpis"><div><dt>Cash</dt><dd class="${c.cash < 0 ? "bad" : ""}">${money(c.cash)}</dd></div>
      <div><dt>Cost ratio</dt><dd class="${ratio > RULES.scrSporting ? "bad" : ratio > RULES.scrLimit ? "warn" : ""}" title="Squad Cost Ratio, projected">${pct(ratio)}</dd></div>
      <div><dt>Position</dt><dd>${pos ? ord(pos) : "—"}</dd></div>
      <div><dt>Board</dt><dd>${S.board}<span class="meter ${S.board < 30 ? "low" : ""}"><i style="width:${S.board}%"></i></span></dd></div></dl>
      ${LIVE ? "" : playControl()}</div></div>
    ${LIVE ? "" : `<nav class="tabs" aria-label="Sections">${PAGES.map(([k, l]) => `<button data-a="go" data-v="${k}" ${UI.page === k ? 'aria-current="page"' : ""}>${l}${k === "home" && dec ? `<span class="dot">${dec}</span>` : ""}</button>`).join("")}</nav>`}
  </div></header><main class="wrap gut">${LIVE ? viewLive() : (VIEWS[UI.page] || viewHome)()}</main>`;
  renderModal();
}
function playControl() {
  const dec = openDecisions().length;
  if (dec) return `<div class="playbox"><div class="playbtn block"><button data-a="go" data-v="home">Decide (${dec})</button></div></div>`;
  let label = "Play", items = [];
  if (S.phase === "summer") { label = "Next day"; items = [["day", "Next window day", `${CAL.summerDays - S.summerDay} left before the season starts`], ["newseason", "Start the new season", "AI clubs finish their summer business"]]; }
  else {
    const nx = peekUserFixture();
    label = nx && nx.di === S.di ? "Play match" : "Next day";
    items = [["day", "Next day", S.days[S.di] ? dayLabel(S.days[S.di]) : ""], ["match", "Until my next match", nx ? `${compLabel(nx.fx)}, week ${nx.day.w + 1}` : "No more matches"], ["week", "One week", ""]];
    if (CAL.jan.includes(S.week)) items.push(["window", "Until the window closes", ""]);
    items.push(["month", "Four weeks", ""], ["season", "Until the end of the season", "Your matches are simulated"]);
  }
  return `<div class="playbox"><div class="playbtn"><button data-a="play" data-v="${S.phase === "summer" ? "day" : "match"}">${label}</button><button data-a="menu" aria-label="More play options" aria-expanded="${UI.menu}">▾</button></div>
    ${UI.menu ? `<div class="playmenu">${items.map(([k, l, s]) => `<button data-a="play" data-v="${k}">${l}${s ? `<small>${esc(s)}</small>` : ""}</button>`).join("")}
      ${S.phase === "season" ? `<label><input type="checkbox" id="opt-live" data-c="live" ${S.set.live ? "checked" : ""}> Watch my matches live</label>` : ""}</div>` : ""}</div>`;
}
function dayLabel(d) {
  if (d.k === "lg") return d.mid ? "Midweek league round" : "League round";
  if (d.k === "grp") return `${CONT[d.comp].name} · group matchday ${d.md + 1}`;
  const comp = S.ko[d.comp], rd = comp.rounds[d.r]; return `${comp.name} · ${rd.name}${rd.legs === 2 ? (d.leg === 1 ? ", 1st leg" : ", 2nd leg") : ""}`;
}
function peekUserFixture() {
  for (let i = S.di; i < S.days.length; i++) {
    const d = S.days[i];
    if (d.k === "lg" && d.rounds[me().lg] == null) continue;
    const fx = userFixture(dayFixtures(d));
    if (fx) return { di: i, day: d, fx };
  }
  return null;
}

/* ---------- start ---------- */
function viewStart() {
  if (!DRAFT) { newWorld(); DRAFT = S; S = null; }
  const keep = S; S = DRAFT; bumpTick();
  const key = UI.startL, L = S.leagues[key];
  const rows = L.clubs.map(C).map(c => ({ c, lvl: clubLevel(c) })).sort((a, b) => b.lvl - a.lvl);
  rows.forEach((r, i) => r.exp = i + 1);
  const html = `<div class="wrap gut"><section class="hero"><div class="eyebrow">Seven English divisions · 164 clubs · seven foreign countries with three divisions each</div>
    <h1>Touchline <span>Manager</span></h1>
    <p>Take any club in the English pyramid, from the Premier Division down to the National Division North and South. Win promotion, survive the cost rules, recruit fifteen-year-olds against academies across Europe, and keep the board on side for fifty seasons.</p></section>
    <div class="card"><div class="card-h"><h2>Choose your club</h2>
      <label class="row small">Division <select id="start-lg" data-c="startl">${lgOpts(key, ENG_LGS)}</select></label></div>
      <p class="small muted" style="margin-bottom:10px">${leagueRules(key)}</p>
      ${table("start-" + key, [
        { k: "n", l: "Club", v: r => r.c.name, f: r => `<span class="club-in">${crest(r.c, 18)} <b>${esc(r.c.name)}</b></span>` },
        { k: "reg", l: "Region", f: r => r.c.region, cls: "hide-sm" },
        { k: "lvl", l: "Squad", r: 1, v: r => r.lvl, f: r => r20(r.lvl).toFixed(1) },
        { k: "co", l: "Coach", f: r => esc(ARCH[r.c.coach.arch].l), cls: "hide-sm" },
        { k: "rep", l: "Prestige", r: 1, v: r => r.c.rep, f: r => r.c.rep },
        { k: "cash", l: "Cash", r: 1, v: r => r.c.cash, f: r => money(r.c.cash), cls: "hide-sm" },
        { k: "acad", l: "Academy", r: 1, v: r => r.c.academy, f: r => r.c.academy + "/10", cls: "hide-sm" },
        { k: "own", l: "Owner", f: r => OWNER[r.c.owner].l, cls: "hide-sm" },
        { k: "exp", l: "Board target", f: r => expText(r.exp, key) },
        { k: "go", l: "", f: r => `<button class="btn sm" data-a="choose" data-v="${r.c.id}">Manage</button>` },
      ], rows)}
      <p class="small muted" style="margin-top:10px">All clubs and players are fictional. Your career saves in this browser; export a save file from the History page to keep a backup.</p></div></div>`;
  S = keep; return html;
}
function leagueRules(key) {
  const L = LG[key];
  if (L.foreign) return `${L.size} clubs, simulated from club strength. ` + (L.tier === 1 ? "Top four reach the Champions Cup, 5th and 6th the Continental Shield, 7th and 8th the Continental Trophy; bottom three relegated." : L.tier === 2 ? "Top three promoted, bottom three relegated." : "Top three promoted.");
  const po = L.po ? { c: `${ord(3)} and ${ord(4)} go straight to two-legged semi-finals; ${ord(5)}–${ord(8)} play one-off quarter-finals`, std: `${ord(L.po.from)}–${ord(L.po.to)} play two-legged semi-finals`, nl: `${ord(2)} and ${ord(3)} host one-off semi-finals; ${ord(4)}–${ord(7)} play one-off quarter-finals` }[L.po.type] + ", final at a neutral ground" : "";
  return `${L.size} clubs, ${roundsOf(key)} matches. ` + (L.tier === 1 ? `Top four reach the Champions Cup; bottom ${L.down} relegated.` : `Top ${L.up} promoted automatically; ${po}. Bottom ${L.down} ${L.tier === 6 ? "drop out to the regional leagues" : "relegated"}.`);
}
function viewSacked() {
  const offers = jobOffers();
  return `<div class="wrap gut"><section class="hero"><div class="eyebrow">${esc(me().name)} · ${seasonLabel(S.year)}</div><h1>You have been <span>sacked</span></h1>
    <p>${esc(S.sackReason || "Board confidence reached zero.")} ${S.career.length ? `Your best finish was ${ord(Math.min(...S.career.filter(x => x.lg === "E1").map(x => x.pos), 99)) !== "99th" ? ord(Math.min(...S.career.filter(x => x.lg === "E1").map(x => x.pos))) + " in the Premier Division" : ord(Math.min(...S.career.map(x => x.pos))) + " in the " + leagueName(S.career.slice().sort((a, b) => a.pos - b.pos)[0].lg)}.` : ""}</p></section>
    <div class="card"><div class="card-h"><h2>Clubs willing to talk</h2></div>
    ${offers.map(c => `<div class="row between" style="padding:8px 0;border-top:1px solid var(--line)"><span>${crest(c, 22)} <b>${esc(c.name)}</b> <span class="muted small">${leagueName(c.lg)}</span></span><button class="btn sm" data-a="takejob" data-v="${c.id}">Take the job</button></div>`).join("")}
    <div class="row" style="margin-top:12px"><button class="btn" data-a="reset">Start a new career</button></div></div></div>`;
}
function jobOffers() {
  if (S._offers && S._offers.y === S.year) return S._offers.ids.map(C);
  const myTier = me().tier;
  const ids = shuffle(activeClubs().filter(c => !isUser(c) && !isForeign(c) && c.tier >= Math.min(6, myTier + 1) && c.tier <= Math.min(6, myTier + 2)).map(c => c.id)).slice(0, 3);
  S._offers = { y: S.year, ids }; return ids.map(C);
}

/* ---------- home ---------- */
function viewHome() {
  const c = me(), parts = [];
  for (const m of openDecisions()) parts.push(`<section class="decision"><div class="eyebrow">Decision needed · ${m.w}</div><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p><div class="row">${m.opts.map(([k, l], i) => `<button class="btn ${i === 0 ? "primary" : ""}" data-a="decide" data-v="${m.id}|${k}">${l}</button>`).join("")}</div></section>`);
  if (S.phase === "summer" && S.seasonOver && !S.seasonOverSeen) parts.push(seasonReview());
  if (S.phase === "season") parts.push(nextMatchCard()); else parts.push(summerCard());
  const recent = (S.myRes || []).slice(-6).reverse();
  if (recent.length) parts.push(`<section class="card"><div class="card-h"><h2>Recent results</h2><button class="lnk small" data-a="go" data-v="fixtures">All fixtures</button></div>${recent.map(resultRow).join("")}</section>`);
  const L = S.leagues[c.lg], t = standings(L), i = t.findIndex(r => r.id === c.id), lo = clamp(i - 3, 0, t.length - 7);
  const side = `<section class="card"><div class="card-h"><h2>${leagueName(L.key)}</h2><button class="lnk small" data-a="go" data-v="league">Full table</button></div>
      ${miniTable(L, t.slice(lo, lo + 7), lo)}</section>
    <section class="card"><div class="card-h"><h2>Board</h2><span class="num">${S.board}/100</span></div><p>Target: <b>${expText(S.expPos, c.lg)}</b> (${ord(S.expPos)} or better).</p><p class="small muted" style="margin-top:6px">Each league result is judged against what the board expected from that fixture. Relegation, cost-rule breaches and early cup exits to weaker sides hurt. At zero you are dismissed.</p></section>
    <section class="card"><div class="card-h"><h2>News</h2><button class="lnk small" data-a="go" data-v="news">All news</button></div><ul class="news">${S.news.slice(0, 10).map(newsItem).join("")}</ul></section>`;
  return `<div class="grid2"><div class="stack">${parts.join("")}</div><div class="stack">${side}</div></div>`;
}
const newsItem = n => `<li class="${n.hi ? "hi" : ""}">${esc(n.t)}<small>${seasonLabel(n.y)} · ${n.w}</small></li>`;
function resultRow(r) {
  const mine = r.h === S.club ? r.hg : r.ag, th = r.h === S.club ? r.ag : r.hg;
  let x = mine > th ? "W" : mine < th ? "L" : "D"; if (r.pens) { const mp = r.h === S.club ? r.pens[0] : r.pens[1], tp = r.h === S.club ? r.pens[1] : r.pens[0]; x = mp > tp ? "W" : "L"; }
  return `<div class="res"><span class="h">${clubA(r.h, { flag: 1 })}</span><span class="sc">${r.hg}–${r.ag}${r.et ? " aet" : ""}</span><span>${clubA(r.a, { flag: 1 })}</span>
    <span class="tiny muted" style="grid-column:1/-1;text-align:center"><span class="form"><i class="${x}">${x}</i></span> ${esc(r.label)}${r.pens ? ` · ${r.pens[0]}–${r.pens[1]} pens` : ""}${r.sc.length ? " · " + r.sc.map(([s, n, m]) => `${esc(n)} ${m}′`).join(", ") : ""}</span></div>`;
}
function miniTable(L, rows, offset) {
  return `<div class="tbl-wrap"><table><thead><tr><th class="r">#</th><th>Club</th><th class="r">P</th><th class="r">GD</th><th class="r">Pts</th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.id === S.club ? "me" : ""} ${zoneCls(L.key, offset + i + 1)}"><td class="r num">${offset + i + 1}</td><td>${clubA(r.id)}${r.ded ? ` <span class="chip req" title="Points deducted">−${r.ded}</span>` : ""}</td><td class="r num">${r.p}</td><td class="r num">${r.gf - r.ga > 0 ? "+" : ""}${r.gf - r.ga}</td><td class="r num"><b>${r.pts}</b></td></tr>`).join("")}</tbody></table></div>`;
}
function zoneCls(key, pos) {
  const L = LG[key];
  if (L.tier === 1) return pos <= 4 ? "z-cc" : pos <= (L.foreign ? 8 : 6) ? "z-cs" : pos > L.size - L.down ? "z-down" : "";
  return pos <= L.up ? "z-cc" : L.po && pos >= L.po.from && pos <= L.po.to ? "z-po" : pos > L.size - L.down ? "z-down" : "";
}
function zoneLegend(key) {
  const L = LG[key];
  if (L.tier === 1) return `<span><i style="background:var(--zone-cc)"></i>Champions Cup</span><span><i style="background:var(--zone-cs)"></i>Shield and Trophy${L.foreign ? "" : " (the two cup winners also qualify)"}</span><span><i style="background:var(--zone-down)"></i>Relegation</span>`;
  return `<span><i style="background:var(--zone-cc)"></i>Automatic promotion</span><span><i style="background:var(--zone-po)"></i>Play-offs (one more promoted)</span><span><i style="background:var(--zone-down)"></i>${L.tier === 6 ? "Drop out of the game" : "Relegation"}</span>`;
}
function nextMatchCard() {
  const nx = peekUserFixture(), c = me();
  if (!nx) return `<section class="card"><h2>No more matches this season</h2><p class="muted" style="margin-top:6px">Play on to the end of the season.</p></section>`;
  const fx = nx.fx, H = C(fx.h), A = C(fx.a), opp = fx.h === S.club ? A : H;
  const formOf = id => { const r = standings(S.leagues[C(id).lg]).find(x => x.id === id); return r ? r.form : []; };
  const mr = previewRatings(c, opp, fx.h === S.club), orr = previewRatings(opp, c, fx.a === S.club);
  const cmp = (l, x, y) => `<div class="cmp-row"><span class="lab eyebrow">${l}</span><span class="num">${r20(x).toFixed(1)}</span><span class="split"><span class="a" style="width:${x / (x + y) * 100}%"></span><span class="b" style="width:${y / (x + y) * 100}%"></span></span><span class="num" style="text-align:right">${r20(y).toFixed(1)}</span></div>`;
  fixUserLineup();
  const xi = S.lineup.map(id => S.players[id]).filter(Boolean), sl = slotsOf(S.formation);
  const tired = xi.filter(p => p.fit < 70).length, oop = S.lineup.filter((id, i) => id != null && FAM[P(id).pos][sl[i]] < .9).length, reg = regInfo(c);
  const team = T => `<div class="team">${crest(T, 46)}<b>${esc(T.name)}</b><span class="tiny muted">${T.country !== HOME ? COUNTRY[T.country].name + " · " : ""}${leagueName(T.lg)}</span>${formChips(formOf(T.id))}</div>`;
  return `<section class="card" style="--club:${c.color}"><div class="card-h"><h2>Next match</h2><span class="eyebrow">${esc(compLabel(fx))} · Week ${nx.day.w + 1}${fx.neutral ? " · Neutral venue" : fx.h === S.club ? " · Home" : " · Away"}</span></div>
    ${fx.ko ? `<p class="small muted" style="text-align:center">First leg: ${C(fx.a).short} ${fx.ko.aggA}–${fx.ko.aggH} ${C(fx.h).short}</p>` : ""}
    <div class="fixture">${team(H)}<div class="vs">v</div>${team(A)}</div>
    <div class="row small muted between"><span>Your XI · ${ARCH[S.me.arch].l}</span><span>${esc(opp.short)}'s likely XI · ${esc(coachOf(opp).name)}, ${ARCH[coachOf(opp).arch].l.toLowerCase()}</span></div>
    <div class="cmp">${cmp("Attack", mr.att, orr.att)}${cmp("Midfield", mr.mid, orr.mid)}${cmp("Defence", mr.def, orr.def)}</div>
    <div class="row between" style="margin-bottom:10px"><label class="row small">Formation <select id="nx-form" data-c="form">${formOpts(S.formation)}</select></label>
      <span class="seg" role="group" aria-label="Mentality">${Object.entries(MENT).map(([k, v]) => `<button data-a="ment" data-v="${k}" aria-pressed="${S.mentality === k}">${v.l}</button>`).join("")}</span></div>
    ${!reg.ok ? `<p class="bad small">Squad registration is invalid: ${reg.seniors}/${RULES.squadMax} senior players, ${reg.nonHG}/${RULES.nonHGMax} non-homegrown, ${reg.total} in total (16 minimum). Fix it before you can play.</p>` : ""}
    ${tired ? `<p class="warn small">${tired} of your XI ${tired > 1 ? "are" : "is"} below 70 fitness.</p>` : ""}${oop ? `<p class="warn small">${oop} player${oop > 1 ? "s are" : " is"} out of position.</p>` : ""}
    <div class="row" style="margin-top:6px"><button class="btn primary" data-a="play" data-v="match">${nx.di === S.di ? (S.set.live ? "Kick off" : "Play match") : "Play to match day"}</button><button class="btn" data-a="go" data-v="tactics">Pick the team</button></div></section>`;
}
function previewRatings(c, opp, home) { const s = makeSide(c, opp, home, true); return sideRatings(s.on, s.ment, s.form, s.co); }
function seasonReview() {
  const o = S.seasonOver, c = me();
  const tro = o.won.map(trophyName);
  return `<section class="card summary"><div class="eyebrow">${seasonLabel(S.year)} review</div>
    <div class="big" style="margin:8px 0 6px">${ord(o.pos)} in the ${leagueName(o.lg)}</div>
    <div class="prose"><p>The board's target was ${expText(o.exp, o.lg).toLowerCase()} (${ord(o.exp)}). ${tro.length ? `Trophies: <b>${tro.join(", ")}</b>.` : ""}</p>
    ${o.moved === "up" ? `<p class="good"><b>Promoted!</b> Next season you play in the ${leagueName(o.to)}. Income rises sharply.</p>` : o.moved === "down" ? `<p class="bad"><b>Relegated</b> to the ${leagueName(o.to)}. Income falls; relegation clauses cut some wages.</p>` : ""}
    <p>Board reaction: <b class="${o.board >= 0 ? "good" : "bad"}">${o.board >= 0 ? "+" : ""}${o.board}</b>. You earned <b>${o.earned || 1} coaching point${(o.earned || 1) > 1 ? "s" : ""}</b> to spend on the Manager page. ${S.qual.CC.includes(S.club) ? "You qualify for the Champions Cup." : S.qual.CS.includes(S.club) ? "You qualify for the Continental Shield." : S.qual.CT.includes(S.club) ? "You qualify for the Continental Trophy." : ""}</p>
    <p class="small muted">Over the summer players aged a year, veterans retired, loans ended and your youth recruits joined the academy. Contracts that ran out have ended.</p></div>
    <div class="row" style="margin-top:12px"><button class="btn" data-a="seenreview">Got it</button><button class="btn" data-a="go" data-v="history">History</button></div></section>`;
}
function summerCard() {
  const c = me(), reg = regInfo(c), newKids = c.squad.map(P).filter(p => p.age === 16), gks = c.squad.filter(id => P(id).pos === "GK").length;
  return `<section class="card"><div class="card-h"><h2>Summer transfer window</h2><span class="eyebrow">Day ${S.summerDay + 1} of ${CAL.summerDays}</span></div>
    <div class="prose"><p>Buy, sell, loan and renew contracts before the new season. Each day, AI clubs do business of their own.</p>
    <p>Registration for next season: <b class="${reg.seniors > RULES.squadMax ? "bad" : ""}">${reg.seniors}/${RULES.squadMax}</b> seniors, <b class="${reg.nonHG > RULES.nonHGMax ? "bad" : ""}">${reg.nonHG}/${RULES.nonHGMax}</b> non-homegrown, ${reg.u21} under-21s.</p>
    ${reg.total < 20 || gks < 2 ? `<p class="bad">Your squad is thin: ${reg.total} players, ${gks} goalkeeper${gks === 1 ? "" : "s"}. Free agents cost no fee.</p>` : ""}
    ${newKids.length ? `<p>New in the academy: ${newKids.map(p => playerA(p) + ` <span class="muted small">${p.pos}</span>`).join(", ")}.</p>` : ""}</div>
    <div class="row" style="margin-top:10px"><button class="btn" data-a="go" data-v="transfers">Transfer market</button><button class="btn" data-a="go" data-v="squad">Contracts and loans</button><button class="btn primary" data-a="play" data-v="newseason">Start the season</button></div></section>`;
}

/* ---------- squad ---------- */
function viewSquad() {
  const c = me(), reg = regInfo(c);
  let ps = c.squad.map(P);
  if (UI.sqf === "SEN") ps = ps.filter(isSenior); if (UI.sqf === "U21") ps = ps.filter(p => !isSenior(p));
  const xi = new Set(S.lineup), out = Object.values(S.players).filter(p => p.loan && p.loan.from === c.id);
  const cols = [
    { k: "n", l: "Name", v: p => p.name, f: p => `${playerA(p)} ${statusChips(p, c)}` },
    { k: "pos", l: "Pos", v: p => ROLE_ORDER[p.pos], f: p => `<span class="pos">${p.pos}</span>${xi.has(p.id) ? ' <span class="chip xi">XI</span>' : ""}` },
    { k: "age", l: "Age", r: 1, v: p => p.age, f: p => p.age },
    { k: "nat", l: "Nat", v: p => p.nat, f: p => p.nat, cls: "hide-sm" },
    { k: "ovr", l: "Rating", r: 1, v: p => p.ovr, f: p => ratingHtml(p) },
    { k: "pot", l: "Potential", v: p => viewMid(potView(p)), f: p => potHtml(p), cls: "hide-sm" },
    { k: "ir", l: "Injury risk", v: p => viewMid(injView(p)), f: p => injHtml(p), cls: "hide-sm" },
    { k: "att", l: "Attributes", f: p => attrStrip(p), cls: "hide-sm" },
    { k: "fit", l: "Fit", v: p => p.fit, f: p => fitBar(p.fit) },
    { k: "mood", l: "Mood", v: p => p.mood, f: p => moodTag(p) },
    { k: "app", l: "Apps", r: 1, v: p => p.s.app, f: p => p.s.app },
    { k: "g", l: "G", r: 1, v: p => p.s.g, f: p => p.s.g },
    { k: "a", l: "A", r: 1, v: p => p.s.a, f: p => p.s.a, cls: "hide-sm" },
    { k: "rt", l: "Avg", r: 1, v: p => p.s.app ? p.s.rt / p.s.app : 0, f: p => p.s.app ? (p.s.rt / p.s.app).toFixed(2) : "—", cls: "hide-sm" },
    { k: "yrs", l: "Contract", r: 1, v: p => p.yrs, f: p => p.loan ? '<span class="muted">loan</span>' : `<span class="${p.yrs <= 1 ? "warn" : ""}">${p.yrs} yr${p.yrs === 1 ? "" : "s"}</span>` },
    { k: "wage", l: "Wage", r: 1, v: p => p.wage, f: p => perWeek(p.wage), cls: "hide-sm" },
    { k: "val", l: "Value", r: 1, v: p => value(p), f: p => money(value(p)), cls: "hide-sm" },
  ];
  return `<div class="stack"><section class="card"><div class="card-h"><h2>Squad</h2>
    <span class="chips" role="group" aria-label="Filter">${[["ALL", "Everyone"], ["SEN", "Seniors (21+)"], ["U21", "Under-21"]].map(([k, l]) => `<button data-a="sqf" data-v="${k}" aria-pressed="${UI.sqf === k}">${l}</button>`).join("")}</span></div>
    <div class="reg" style="margin-bottom:10px"><span>Registered seniors <b class="${reg.seniors > RULES.squadMax ? "bad" : ""}">${reg.seniors}/${RULES.squadMax}</b></span><span>Non-homegrown <b class="${reg.nonHG > RULES.nonHGMax ? "bad" : ""}">${reg.nonHG}/${RULES.nonHGMax}</b></span><span>Under-21s <b>${reg.u21}</b> (no limit)</span><span>Loans in <b>${reg.loansIn}/${RULES.loansIn}</b></span><span>Wage bill <b>${perWeek(sum(c.squad, id => P(id).wage))}</b></span></div>
    ${table("squad", cols, ps, { sort: { k: "pos", d: 1 } })}
    <p class="hint" style="margin-top:8px">Ratings are out of 20: 10 is average, 20 world class. Potential is your scouts' estimate, not a promise: it depends on minutes, form, happiness and your Development rating. Homegrown (HG) means three seasons at an English club before turning 21.</p></section>
    <section class="card"><div class="card-h"><h2>Out on loan</h2></div>${table("loanout", [{ k: "n", l: "Player", f: p => playerA(p) }, { k: "pos", l: "Pos", f: p => `<span class="pos">${p.pos}</span>` }, { k: "age", l: "Age", r: 1, f: p => p.age }, { k: "ovr", l: "Rating", r: 1, f: p => ratingHtml(p) }, { k: "c", l: "At", f: p => clubA(p.club, { flag: 1 }) }, { k: "app", l: "Apps", r: 1, f: p => p.s.app }, { k: "g", l: "Goals", r: 1, f: p => p.s.g }, { k: "pt", l: "Minutes", f: p => `<span class="bar"><i style="width:${p.pt * 100}%"></i></span>` }], out, { empty: "Nobody is out on loan. Young players develop faster when they play: loan them out from their profile during a window." })}</section></div>`;
}

/* ---------- tactics ---------- */
function viewTactics() {
  const c = me(); fixUserLineup();
  const F = FORMATIONS[S.formation];
  const slotsHtml = F.map(([role, x, y], i) => {
    const p = S.players[S.lineup[i]], sel = UI.sel && UI.sel.slot === i;
    if (!p) return `<button class="slot empty ${sel ? "sel" : ""}" style="left:${x}%;top:${y}%" data-a="slot" data-v="${i}"><span class="disc">${role}</span><span class="nm">Empty</span></button>`;
    const f = FAM[p.pos][role];
    return `<button class="slot ${f < .9 ? "oop" : ""} ${sel ? "sel" : ""}" style="left:${x}%;top:${y}%" data-a="slot" data-v="${i}" title="${esc(p.name)}, ${p.pos} playing ${role}"><span class="disc">${Math.round(slotRating(p, role))}</span><span class="nm">${esc(sur(p))}</span><span class="fb"><i style="width:${p.fit}%;background:${fitColor(p.fit)}"></i></span></button>`;
  }).join("");
  const lines = `<svg class="lines" viewBox="0 0 68 96" preserveAspectRatio="none" aria-hidden="true" fill="none" stroke="var(--chalk)" stroke-width=".4"><rect x="2" y="2" width="64" height="92"/><line x1="2" y1="48" x2="66" y2="48"/><circle cx="34" cy="48" r="7"/><rect x="16" y="2" width="36" height="14"/><rect x="26" y="2" width="16" height="5"/><rect x="16" y="80" width="36" height="14"/><rect x="26" y="89" width="16" height="5"/></svg>`;
  const ps = c.squad.map(P).sort((a, b) => ROLE_ORDER[a.pos] - ROLE_ORDER[b.pos] || b.ovr - a.ovr), xi = new Set(S.lineup), bench = new Set(benchFor(c, S.lineup.filter(x => x != null)));
  return `<div class="squad" style="--club:${c.color}"><div class="stack" style="gap:10px">
    <div class="row between"><label class="row small">Formation <select id="tc-form" data-c="form">${formOpts(S.formation)}</select></label><button class="btn sm" data-a="autopick">Pick best XI</button></div>
    <div class="pitch">${lines}${slotsHtml}</div>
    ${S.formation !== S.me.form ? `<p class="hint warn">You prefer the ${S.me.form}. Teams play about 2% better in their coach's own system.</p>` : `<p class="hint good">Your preferred system: about 2% better across the pitch.</p>`}
    <p class="hint">Tap a shirt, then a player, to swap. The number is his rating in that role; a dashed ring means he's out of position. Your formation also matters in youth recruitment: prospects want a position your shape actually uses.</p>
    <div class="card"><h3 style="margin-bottom:8px">Mentality</h3><span class="seg" role="group">${Object.entries(MENT).map(([k, v]) => `<button data-a="ment" data-v="${k}" aria-pressed="${S.mentality === k}">${v.l}</button>`).join("")}</span></div>
    <div class="card"><h3 style="margin-bottom:8px">Training focus</h3><div class="train">${Object.entries(TRAIN).map(([k, t]) => `<button data-a="train" data-v="${k}" aria-pressed="${S.training === k}"><b>${t.l}</b><span class="tiny muted">${t.d}</span></button>`).join("")}</div>
      <p class="hint" style="margin-top:8px">A full match costs an outfield player about 18 fitness. Midweek rounds and cup ties mean rotating.</p></div></div>
    <section class="card"><div class="card-h"><h2>Selection</h2><span class="small muted">XI, then the nine on the bench (5 substitutions allowed)</span></div>
    <div class="tbl-wrap"><table><thead><tr><th></th><th>Pos</th><th>Name</th><th class="r">Age</th><th class="r">Rating</th><th>Fit</th><th>Mood</th></tr></thead><tbody>
    ${ps.map(p => `<tr class="click ${UI.sel && UI.sel.pid === p.id ? "sel" : ""}" data-a="pick-p" data-v="${p.id}"><td>${xi.has(p.id) ? '<span class="chip xi">XI</span>' : bench.has(p.id) ? '<span class="chip hg">SUB</span>' : ""}</td><td><span class="pos">${p.pos}</span></td><td>${esc(p.name)} ${statusChips(p)}</td><td class="r num">${p.age}</td><td class="r num">${ratingHtml(p)}</td><td>${fitBar(p.fit)} <span class="tiny num">${Math.round(p.fit)}</span></td><td>${moodTag(p)}</td></tr>`).join("")}
    </tbody></table></div></section></div>`;
}

/* ---------- fixtures ---------- */
function viewFixtures() {
  const played = (S.myRes || []).slice().reverse(), up = [];
  if (S.phase === "season") for (let i = S.di; i < S.days.length && up.length < 14; i++) {
    const d = S.days[i];
    if (d.k === "lg") { const r = d.rounds[me().lg]; if (r == null) continue; const pr = S.leagues[me().lg].fixtures[r].find(([h, a]) => h === S.club || a === S.club); if (pr) up.push({ d, h: pr[0], a: pr[1], label: leagueName(me().lg) + (d.mid ? " · midweek" : "") }); }
    else if (d.k === "grp" || (d.k === "ko" && S.ko[d.comp].rounds[d.r].ties)) { const fx = userFixture(dayFixtures(d)); if (fx) up.push({ d, h: fx.h, a: fx.a, label: compLabel(fx) }); }
  }
  return `<div class="grid2"><section class="card"><div class="card-h"><h2>Results</h2><span class="small muted">${seasonLabel(S.year)}</span></div>${played.length ? played.map(resultRow).join("") : '<p class="muted">No matches played yet.</p>'}</section>
    <section class="card"><div class="card-h"><h2>Coming up</h2></div>${up.length ? up.map(u => `<div class="res" style="grid-template-columns:52px 1fr"><span class="num muted">Wk ${u.d.w + 1}</span><span>${u.h === S.club ? "v" : "@"} ${clubA(u.h === S.club ? u.a : u.h, { flag: 1 })}<br><span class="tiny muted">${esc(u.label)}</span></span></div>`).join("") : '<p class="muted">Nothing scheduled.</p>'}
    <p class="hint" style="margin-top:8px">Cup and knockout opponents appear once they're drawn.</p></section></div>`;
}

/* ---------- leagues ---------- */
function viewLeague() {
  const key = UI.lg || me().lg, L = S.leagues[key], t = standings(L);
  const rows = t.map((r, i) => ({ ...r, pos: i + 1 }));
  const cols = [
    { k: "pos", l: "#", r: 1, v: r => r.pos, f: r => r.pos },
    { k: "n", l: "Club", v: r => C(r.id).name, f: r => clubA(r.id) + (r.ded ? ` <span class="chip req" title="Points deducted">−${r.ded}</span>` : "") },
    { k: "p", l: "P", r: 1, v: r => r.p, f: r => r.p }, { k: "w", l: "W", r: 1, v: r => r.w, f: r => r.w }, { k: "d", l: "D", r: 1, v: r => r.d, f: r => r.d }, { k: "l", l: "L", r: 1, v: r => r.l, f: r => r.l },
    { k: "gf", l: "GF", r: 1, v: r => r.gf, f: r => r.gf, cls: "hide-sm" }, { k: "ga", l: "GA", r: 1, v: r => r.ga, f: r => r.ga, cls: "hide-sm" },
    { k: "gd", l: "GD", r: 1, v: r => r.gf - r.ga, f: r => (r.gf - r.ga > 0 ? "+" : "") + (r.gf - r.ga) },
    { k: "pts", l: "Pts", r: 1, v: r => r.pts, f: r => `<b>${r.pts}</b>` },
    { k: "form", l: "Form", f: r => formChips(r.form), cls: "hide-sm" },
  ];
  const ps = L.clubs.flatMap(id => C(id).squad.map(P));
  const scorers = ps.filter(p => p.s.lg > 0).sort((a, b) => b.s.lg - a.s.lg).slice(0, 10);
  const rated = ps.filter(p => p.s.app >= 5).sort((a, b) => b.s.rt / b.s.app - a.s.rt / a.s.app).slice(0, 10);
  const last = (L.results || []).filter(Boolean).length - 1;
  return `<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>${leagueName(key)}</h2><select id="lg-sel" data-c="lg" aria-label="League">${lgOpts(key)}</select></div>
    <p class="small muted" style="margin-bottom:8px">${leagueRules(key)}</p>
    ${table("league-" + key, cols, rows, { rowCls: r => `${r.id === S.club ? "me" : ""} ${zoneCls(key, r.pos)}` })}
    <div class="legend">${zoneLegend(key)}</div><p class="tiny muted" style="margin-top:6px">Ties are split by goal difference, goals scored, then head-to-head points.</p></section>
    ${last >= 0 ? `<section class="card"><div class="card-h"><h2>Round ${last + 1} results</h2></div>${L.results[last].map(r => `<div class="res"><span class="h">${clubA(r.h)}</span><span class="sc">${r.hg}–${r.ag}</span><span>${clubA(r.a)}</span></div>`).join("")}</section>` : ""}</div>
    <div class="stack"><section class="card"><div class="card-h"><h2>Golden boot</h2></div>${table("ts-" + key, [{ k: "n", l: "Player", f: p => playerA(p) }, { k: "c", l: "Club", f: p => clubA(p.club, { short: true }) }, { k: "g", l: "Goals", r: 1, f: p => `<b>${p.s.lg}</b>` }], scorers, { empty: "No goals yet." })}</section>
    <section class="card"><div class="card-h"><h2>Best rated</h2><span class="tiny muted">min. 5 apps</span></div>${table("tr-" + key, [{ k: "n", l: "Player", f: p => playerA(p) }, { k: "c", l: "Club", f: p => clubA(p.club, { short: true }) }, { k: "r", l: "Avg", r: 1, f: p => (p.s.rt / p.s.app).toFixed(2) }], rated, { empty: "Not enough games yet." })}</section></div></div>`;
}

/* ---------- cups ---------- */
function tieHtml(t) {
  if (t.bye) return `<div class="tie"><span class="${t.h === S.club ? "me" : ""}">${clubA(t.h, { flag: 1 })}</span><span class="tiny muted">bye</span></div>`;
  const agg = t.g1 ? [t.g1[0] + (t.g2 ? t.g2[0] : 0), t.g1[1] + (t.g2 ? t.g2[1] : 0)] : null;
  const extra = t.legs === 2 && t.g1 ? `1st leg ${C(t.a).short} ${t.g1[1]}–${t.g1[0]} ${C(t.h).short}${t.g2 ? ` · 2nd leg ${t.g2[0]}–${t.g2[1]}` : ""}` : "";
  const pens = t.pens ? `${extra ? " · " : ""}${C(t.pens[0] > t.pens[1] ? t.h : t.a).short} win ${Math.max(...t.pens)}–${Math.min(...t.pens)} on penalties` : "";
  return `<div class="tie"><span class="${t.w === t.h ? "w" : ""} ${t.h === S.club ? "me" : ""}">${clubA(t.h, { flag: 1 })}</span><span class="num">${agg ? agg[0] : ""}</span><span class="${t.w === t.a ? "w" : ""} ${t.a === S.club ? "me" : ""}">${clubA(t.a, { flag: 1 })}</span><span class="num">${agg ? agg[1] : ""}</span>${extra || pens ? `<span class="tiny muted" style="grid-column:1/-1">${extra}${pens}</span>` : ""}</div>`;
}
function koRounds(comp) {
  return comp.rounds.map(rd => rd.ties ? `<div><h3 style="margin-bottom:6px">${rd.name}${rd.legs === 2 ? ' <span class="tiny muted">two legs</span>' : ""}</h3><div class="ties">${rd.ties.map(tieHtml).join("")}</div></div>` : "").join("") || '<p class="muted">Not drawn yet.</p>';
}
function viewCups() {
  const keys = ["FA", "LC", "CC", "CS", "CT", ...Object.keys(S.ko).filter(k => k.startsWith("PO"))];
  const k = keys.includes(UI.cupK) ? UI.cupK : "FA", comp = S.ko[k];
  const about = { FA: "All seven divisions. Non-league clubs start in the fourth qualifying round, the Second and Third Divisions join in the first round, and the top two divisions in the third. One match per tie, extra time and penalties, neutral final. The winner earns a Continental Shield place, passing to the runner-up if the winner already qualifies.", LC: "The top four divisions. Clubs in Europe join in the third round. Two-legged semi-finals. The winner earns a Continental Shield place if not already qualified.", CC: "The top four from England and seven other leagues. Eight groups of four, no two clubs from the same country in a group. Group winners meet runners-up in a two-legged round of 16; one-off final.", CS: "Sixteen clubs: 5th and 6th from each top division, with England's 5th-place spot going to the National Cup winner (or runner-up, if the winner already qualifies). Two-legged knockout rounds, one-off final.", CT: "The third tier of European football: 7th and 8th from each top division, with England's spot going to the League Cup winner (or runner-up). Two-legged knockout rounds, one-off final." }[k] || leagueRules(comp.lg);
  let body = "";
  if (k === "CC") { const K = S.cont[k]; body = `<div class="rounds">${K.groups.map((g, gi) => `<div><h3 style="margin-bottom:6px">Group ${"ABCDEFGH"[gi]}</h3>${table(`g${k}${gi}`, [{ k: "n", l: "Club", f: r => clubA(r.id, { flag: 1 }) }, { k: "p", l: "P", r: 1, f: r => r.p }, { k: "gd", l: "GD", r: 1, f: r => r.gf - r.ga }, { k: "pts", l: "Pts", r: 1, f: r => `<b>${r.pts}</b>` }], groupTable(k, gi), { rowCls: r => r.id === S.club ? "me" : "" })}</div>`).join("")}</div><div class="rounds" style="margin-top:14px">${comp.rounds.some(r => r.ties) ? koRounds(comp) : ""}</div>`; }
  else body = `${comp.kind === "cont" && !comp.rounds[0].ties ? `<p class="small" style="margin-bottom:8px">Entrants: ${S.cont[k].entrants.map(id => clubA(id, { flag: 1 })).join(", ")}</p>` : ""}<div class="rounds">${koRounds(comp)}</div>`;
  return `<section class="card"><div class="card-h"><h2>${esc(comp.name)}</h2><select id="cup-sel" data-c="cup" aria-label="Competition">${keys.map(x => `<option value="${x}" ${x === k ? "selected" : ""}>${esc(S.ko[x].name)}</option>`).join("")}</select></div>
    <p class="small muted" style="margin-bottom:12px">${about}</p>${body}${comp.w != null ? `<p style="margin-top:12px">Winner: <b>${clubA(comp.w, { flag: 1 })}</b></p>` : ""}</section>`;
}

/* ---------- transfers ---------- */
function viewTransfers() {
  const c = me(), tabs = [["search", "Search players"], ["fa", "Free agents"], ["listed", "Available"], ["loans", "Loan targets"], ["mine", "Your listed players"], ["log", "Activity"]];
  const open = windowOpen();
  let body;
  if (UI.tab === "log") body = table("tlog", [{ k: "w", l: "When", f: t => `${seasonLabel(t.y)} · ${t.w}` }, { k: "n", l: "Player", f: t => S.players[t.pid] ? playerA(S.players[t.pid]) : esc(t.name) }, { k: "f", l: "From", f: t => t.from >= 0 ? clubA(t.from, { flag: 1 }) : "Free agent" }, { k: "t", l: "To", f: t => clubA(t.to, { flag: 1 }) }, { k: "fee", l: "Fee", r: 1, v: t => t.fee, f: t => t.fee ? money(t.fee) : "Free" }], S.tlog, { limit: 150, empty: "No transfers yet." });
  else if (UI.tab === "mine") body = table("tmine", [{ k: "n", l: "Player", f: p => playerA(p) + " " + statusChips(p, c) }, { k: "pos", l: "Pos", f: p => p.pos }, { k: "ovr", l: "Rating", r: 1, f: p => ratingHtml(p) }, { k: "v", l: "Value", r: 1, f: p => money(value(p)) }], c.squad.map(P).filter(p => p.listed || p.req), { empty: "None of your players are listed. List a player from his profile and clubs will start bidding during transfer windows." });
  else {
    const f = UI.tf;
    let pool = UI.tab === "fa" ? S.fa.map(P) : Object.values(S.players).filter(p => p.club >= 0 && p.club !== S.club && p.age >= 17 && !p.loan);
    if (UI.tab === "listed") pool = pool.filter(p => p.listed || p.req);
    if (UI.tab === "loans") pool = pool.filter(p => loanable(p) && !wouldStart(p, C(p.club)));
    pool = pool.filter(p => (f.pos === "ALL" || p.pos === f.pos) && p.age <= f.age && ratingMid(p) >= f.min && (f.lg === "ALL" || (p.club >= 0 && (C(p.club).lg === f.lg || (f.lg === "ABROAD" && isForeign(C(p.club)))))));
    if (f.fee && UI.tab !== "loans") pool = pool.filter(p => askingPrice(p) <= f.fee);
    pool.sort((a, b) => ratingMid(b) - ratingMid(a)); pool = pool.slice(0, 200);
    const loans = UI.tab === "loans";
    body = `<div class="filters"><label class="f">Position<select id="tf-pos" data-c="tf-pos"><option value="ALL">Any</option>${ROLES.map(r => `<option value="${r}" ${f.pos === r ? "selected" : ""}>${ROLE_NAME[r]}</option>`).join("")}</select></label>
      <label class="f">Max age<select id="tf-age" data-c="tf-age">${[40, 30, 27, 24, 21].map(a => `<option value="${a}" ${f.age === a ? "selected" : ""}>${a === 40 ? "Any" : a}</option>`).join("")}</select></label>
      <label class="f">Min rating<select id="tf-min" data-c="tf-min">${[0, 6, 8, 10, 12, 14, 16].map(a => `<option value="${a}" ${f.min === a ? "selected" : ""}>${a ? a + "+" : "Any"}</option>`).join("")}</select></label>
      ${loans ? "" : `<label class="f">Max fee<select id="tf-fee" data-c="tf-fee">${[0, 2e5, 1e6, 3e6, 8e6, 15e6, 30e6].map(a => `<option value="${a}" ${f.fee === a ? "selected" : ""}>${a ? money(a) : "Any"}</option>`).join("")}</select></label>`}
      ${UI.tab !== "fa" ? `<label class="f">League<select id="tf-lg" data-c="tf-lg"><option value="ALL">All leagues</option><option value="ABROAD" ${f.lg === "ABROAD" ? "selected" : ""}>All foreign leagues</option>${lgOpts(f.lg)}</select></label>` : ""}</div>
      ${table("t-" + UI.tab, [
        { k: "n", l: "Player", v: p => p.name, f: p => playerA(p) + " " + statusChips(p) },
        { k: "pos", l: "Pos", v: p => ROLE_ORDER[p.pos], f: p => `<span class="pos">${p.pos}</span>` },
        { k: "age", l: "Age", r: 1, v: p => p.age, f: p => p.age },
        { k: "ovr", l: "Rating", r: 1, v: p => ratingMid(p), f: p => ratingHtml(p) },
        { k: "sc", l: "Scouted", v: p => scoutLevel(p), f: p => ["—", "Partly", "Fully"][scoutLevel(p)], cls: "hide-sm" },
        { k: "club", l: "Club", v: p => p.club >= 0 ? C(p.club).name : "", f: p => p.club >= 0 ? clubA(p.club, { short: true, flag: 1 }) : '<span class="muted">Free</span>' },
        loans ? { k: "wage", l: "Wage", r: 1, v: p => p.wage, f: p => perWeek(p.wage) } : { k: "ask", l: "Asking", r: 1, v: p => askingPrice(p), f: p => p.club >= 0 ? money(askingPrice(p)) : "Free" },
        { k: "w", l: "Interest", v: p => willingness(p, c), f: p => { const [l, k] = willingLabel(willingness(p, c)); return `<span class="${k === "ok" ? "" : k}">${l}</span>`; } },
        { k: "b", l: "", f: p => loans ? `<button class="btn sm" data-a="loanin" data-v="${p.id}" ${open ? "" : "disabled"}>Ask to loan</button>` : `<button class="btn sm" data-a="bid" data-v="${p.id}" ${open ? "" : "disabled"}>${p.club >= 0 ? "Bid" : "Sign"}</button>` },
      ], pool, { empty: "No players match these filters." })}`;
  }
  return `<section class="card"><div class="card-h"><h2>Transfers</h2><span class="small">${open ? '<b class="good">Window open</b>' : '<b class="muted">Window closed</b> · opens in January (weeks 19–22) and summer'} · Cash <b class="num">${money(c.cash)}</b> · Cost ratio <b class="num">${pct(scr(c))}</b></span></div>
    <div class="row" style="margin-bottom:12px"><span class="seg" role="group">${tabs.map(([k, l]) => `<button data-a="ttab" data-v="${k}" aria-pressed="${UI.tab === k}">${l}</button>`).join("")}</span></div>
    ${body}<p class="hint" style="margin-top:10px">${UI.tab === "loans" ? `Young players (${RULES.loanMaxAge} and under) who aren't starting for their clubs. Parent clubs lend them only where they'll play, and want them at a level that tests them. You pay the wages; up to ${RULES.loansIn} loans at once.` : `Ratings outside your division are estimates until you scout a player (open him, 2 hours). Interest reflects more than money: your standing against his current club, whether he'd start in your ${S.formation}, European football, his mood and loyalty.`}</p></section>`;
}

/* ---------- youth recruitment ---------- */
function viewYouth() {
  const c = me(), f = UI.yf;
  let ys = S.prospects.slice();
  if (f.reg === "ENG") ys = ys.filter(y => y.country === "ENG"); else if (f.reg === "ABR") ys = ys.filter(y => y.country !== "ENG"); else if (f.reg !== "ALL") ys = ys.filter(y => y.country === f.reg || (f.reg === "ROW" && y.country == null));
  if (f.pos !== "ALL") ys = ys.filter(y => y.pos === f.pos);
  if (f.st === "OPEN") ys = ys.filter(y => y.commit == null); else if (f.st === "MINE") ys = ys.filter(y => y.offers.includes(c.id) || y.rel[c.id] || y.commit === c.id); else if (f.st === "DONE") ys = ys.filter(y => y.commit != null);
  const commits = S.prospects.filter(y => y.commit === c.id);
  const cols = [
    { k: "n", l: "Prospect", v: y => y.name, f: y => `<button class="lnk" data-a="prospect" data-v="${y.id}">${esc(y.name)}</button>` },
    { k: "pos", l: "Pos", v: y => ROLE_ORDER[y.pos], f: y => `<span class="pos">${y.pos}</span>` },
    { k: "from", l: "From", v: y => km(y, c), f: y => `${esc(y.region)} <span class="tiny muted">${Math.round(km(y, c))} km</span>` },
    { k: "st", l: "Potential", v: y => viewMid(prospectPot(y)), f: y => rangeHtml(prospectPot(y)) },
    { k: "you", l: "Your pitch", v: y => clubScore(y, c), f: y => { const s = clubScore(y, c); return `<span class="bar" title="${Math.round(s * 100)}"><i style="width:${clamp(s, 0, 1) * 100}%"></i></span>`; } },
    { k: "rank", l: "Standing", v: y => yourRank(y), f: y => y.commit != null ? (y.commit === c.id ? '<b class="good">Committed to you</b>' : `<span class="muted">Committed to</span> ${clubA(y.commit, { short: true })}`) : rankLabel(y) },
    { k: "act", l: "Actions", f: y => y.commit === c.id ? "" : `<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-a="rec" data-v="${y.id}|scout" ${y.sc >= 3 ? "disabled" : ""} title="3 hours">Scout</button><button class="btn sm" data-a="rec" data-v="${y.id}|call" title="1 hour">Call</button><button class="btn sm" data-a="rec" data-v="${y.id}|visit" ${y.visit ? "disabled" : ""} title="5 hours">Visit</button><button class="btn sm ${y.offers.includes(c.id) ? "danger" : ""}" data-a="rec" data-v="${y.id}|offer">${y.offers.includes(c.id) ? "Withdraw" : "Offer"}</button></span>` },
  ];
  const regs = [["ENG", "England"], ...COUNTRIES.filter(K => K.code !== "ENG").map(K => [K.code, K.name]), ["ROW", "Brazil, Argentina, West Africa, Scandinavia"], ["ABR", "Everywhere outside England"], ["ALL", "Everywhere"]];
  return `<div class="stack"><section class="card"><div class="card-h"><h2>Youth recruitment · class of ${S.year + 1}</h2>
    <span class="small">Hours this week <b class="num">${S.rec.hours}/${recHours()}</b> · Places offered <b class="num">${S.rec.offers}/${offerCap()}</b> · Academy <b class="num">${c.academy}/10</b></span></div>
    <div class="prose small" style="margin-bottom:12px"><p>Fifteen-year-olds from England and abroad choose an academy this season and join next summer. Each weighs six things differently: distance from home, a route to first-team minutes, whether your formation uses his position, squad dynamics, prestige and academy quality. Scouting narrows his rating and reveals what he cares about; calls and visits build the relationship. Commitments start from week 9 and aren't binding until signing day, so a better offer can still flip a prospect, yours included.</p></div>
    <div class="filters"><label class="f">Region<select id="yf-reg" data-c="yf-reg">${regs.map(([k, l]) => `<option value="${k}" ${f.reg === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="f">Position<select id="yf-pos" data-c="yf-pos"><option value="ALL">Any</option>${ROLES.map(r => `<option value="${r}" ${f.pos === r ? "selected" : ""}>${ROLE_NAME[r]}</option>`).join("")}</select></label>
      <label class="f">Show<select id="yf-st" data-c="yf-st">${[["OPEN", "Undecided"], ["MINE", "Your targets"], ["DONE", "Committed"], ["ALL", "Everyone"]].map(([k, l]) => `<option value="${k}" ${f.st === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    ${table("youth", cols, ys, { sort: { k: "st", d: -1 }, empty: "No prospects match." })}</section>
    <section class="card"><div class="card-h"><h2>Committed to you</h2></div>${commits.length ? commits.map(y => `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span><button class="lnk" data-a="prospect" data-v="${y.id}">${esc(y.name)}</button> <span class="pos">${y.pos}</span> <span class="muted small">${esc(y.region)}</span></span>${rangeHtml(prospectPot(y))}</div>`).join("") : '<p class="muted">No commitments yet.</p>'}</section></div>`;
}
function yourRank(y) { const cs = contenders(y); const i = cs.findIndex(x => x.c.id === S.club); return i < 0 ? 99 : i; }
function rankLabel(y) {
  const cs = contenders(y), i = cs.findIndex(x => x.c.id === S.club), n = cs.length;
  if (i < 0) return `<span class="muted">${n ? n + " club" + (n > 1 ? "s" : "") + " in for him" : "Nobody yet"}</span>`;
  return `<span class="${i === 0 ? "good" : i <= 2 ? "" : "warn"}">${ord(i + 1)} of ${n}</span>`;
}

/* ---------- finances ---------- */
function viewFinances() {
  const c = me(), f = c.fin, ratio = scr(c);
  const mk = v => clamp(v / 1.5 * 100, 0, 100);
  const cases = S.cases.filter(k => !isForeign(C(k.club))).slice(-12).reverse();
  const acadCost = Math.round((c.academy + 1) * 3e6 * [0, 1, .4, .2, .1, .06, .05][c.tier]);
  return `<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>Squad Cost Ratio</h2><span class="eyebrow">${seasonLabel(S.year)}</span></div>
    <div class="prose"><p>Wages, transfer amortisation and agent fees, as a share of football revenue plus profit on player sales. Above <b>${pct(RULES.scrLimit)}</b> you pay a levy at the end of the season; above <b>${pct(RULES.scrSporting)}</b> you are charged and face a points deduction the following season.</p></div>
    <div class="gauge" role="img" aria-label="Projected ratio ${pct(ratio)}"><span class="tick" style="left:${mk(.85)}%">85%</span><span class="tick" style="left:${mk(1.15)}%">115%</span><span class="mk" style="left:${mk(ratio)}%"><span>${pct(ratio)}</span></span></div>
    <p class="small muted">Projected for the full season at today's wage bill and income. ${c.lastSCR ? `Last season: ${pct(c.lastSCR)}.` : ""}</p></section>
    <section class="card"><div class="card-h"><h2>This season so far</h2></div><dl class="ledger">
      <dt>Broadcast, matchday and commercial</dt><dd>${money(f.rev)}</dd><dt>Prize money</dt><dd>${money(f.prize + f.merit)}</dd><dt>Player sales (fees received)</dt><dd>${money(f.sold)}</dd>${f.scheme ? `<dt>Connected-party income</dt><dd>${money(f.scheme)}</dd>` : ""}
      <dt>Wages</dt><dd class="bad">${money(-f.wages)}</dd><dt>Staff and running costs</dt><dd class="bad">${money(-f.ops)}</dd><dt>Transfer fees paid</dt><dd class="bad">${money(-f.bought)}</dd><dt>Agent fees</dt><dd class="bad">${money(-f.agent)}</dd><dt>Scouting network</dt><dd class="bad">${money(-f.scouting)}</dd>${f.levy ? `<dt>Cost-ratio levy</dt><dd class="bad">${money(-f.levy)}</dd>` : ""}
      <dt class="tot">Cash in the bank</dt><dd class="tot">${money(c.cash)}</dd></dl>
      <p class="small muted" style="margin-top:8px">Annual income at this level: about ${money(c.revSeason)}. Transfer fees are spread over the contract (amortisation: ${money(sum(c.squad, id => P(id).am ? P(id).am.per : 0))} a year).</p></section></div>
    <div class="stack"><section class="card"><div class="card-h"><h2>Scouting & academy</h2></div>
      <div class="prose"><p>Scouting network: <b>level ${S.rec.scoutLvl}</b> (${money(S.rec.scoutLvl * scoutCost())} a year) gives ${recHours()} recruiting hours a week.</p>
      <div class="row"><button class="btn sm" data-a="scout" data-v="-1" ${S.rec.scoutLvl <= 1 ? "disabled" : ""}>Reduce</button><button class="btn sm" data-a="scout" data-v="1" ${S.rec.scoutLvl >= 5 ? "disabled" : ""}>Expand</button></div>
      <p>Academy rating: <b>${c.academy}/10</b>. A better academy attracts prospects, develops under-21s faster and lets you offer more places.</p>
      <div class="row"><button class="btn sm" data-a="academy" data-v="${acadCost}" ${c.academy >= 10 || c.cash < acadCost ? "disabled" : ""}>Upgrade for ${money(acadCost)}</button></div></div></section>
    <section class="card"><div class="card-h"><h2>Owner</h2></div><p>${OWNER[c.owner].l}. ${c.schemes.length ? `Connected-party deals: ${c.schemes.map(s => `${esc(s.what)} (${money(s.amt)}, ${seasonLabel(s.y)}${s.found ? ", struck out" : ""})`).join("; ")}.` : "No connected-party deals on record."}</p></section>
    <section class="card"><div class="card-h"><h2>League cases</h2></div>${cases.length ? cases.map(k => `<div style="padding:6px 0;border-top:1px solid var(--line)">${clubA(k.club)} <span class="small muted">· ratio ${pct(k.ratio)} · ${k.status === "charged" ? `hearing in week ${k.hearing + 1} of ${seasonLabel(k.y)}` : k.status === "deducted" ? `${k.pts} points deducted, appeal pending` : `closed (${k.pts} pts)`}</span></div>`).join("") : '<p class="muted">No English clubs are currently charged.</p>'}</section></div></div>`;
}

/* ---------- news & history ---------- */
function viewNews() {
  const tags = [["ALL", "Everything"], ["result", "Your results"], ["transfer", "Transfers"], ["finance", "Finance"], ["squad", "Squad"], ["youth", "Youth"], ["club", "Clubs"], ["league", "Leagues"], ["cup", "Cups"], ["cont", "Continental"]];
  const list = S.news.filter(n => UI.nf === "ALL" || n.tag === UI.nf);
  const past = S.inbox.filter(m => m.done).slice(0, 12);
  return `<div class="grid2"><section class="card"><div class="card-h"><h2>News</h2></div><div class="chips" style="margin-bottom:12px">${tags.map(([k, l]) => `<button data-a="nf" data-v="${k}" aria-pressed="${UI.nf === k}">${l}</button>`).join("")}</div><ul class="news">${list.slice(0, 120).map(newsItem).join("") || '<li class="muted">Nothing here yet.</li>'}</ul></section>
    <section class="card"><div class="card-h"><h2>Past decisions</h2></div>${past.length ? past.map(m => `<div style="padding:6px 0;border-top:1px solid var(--line)"><b>${esc(m.title)}</b><div class="small muted">${seasonLabel(m.y)} · ${m.w} · you chose: ${esc((m.opts.find(o => o[0] === m.choice) || [0, ""])[1])}</div></div>`).join("") : '<p class="muted">None yet.</p>'}</section></div>`;
}
function viewHistory() {
  const c = me(), award = a => a ? `${S.players[a[0]] ? playerA(S.players[a[0]]) : esc(a[1])} <span class="tiny muted">${esc(a[2])} · ${a[3]}</span>` : "—";
  const seasons = S.history.slice(0, UI.histN).map(h => `<section class="card"><div class="card-h"><h2>${seasonLabel(h.year)}</h2></div><div class="tbl-wrap"><table><thead><tr><th>League</th><th>Champions</th><th>Promoted / relegated</th><th class="hide-sm">Golden boot</th><th class="hide-sm">Player of the season</th></tr></thead><tbody>
    ${ENG_LGS.map(k => { const l = h.L[k]; if (!l) return ""; return `<tr><td>${leagueName(k)}</td><td>${clubA(l.champ)}</td><td class="small">${l.up && l.up.length ? "↑ " + l.up.map(id => C(id).short).join(", ") : ""} ${l.down && l.down.length ? "↓ " + l.down.map(id => C(id).short).join(", ") : ""}</td><td class="hide-sm">${award(l.top)}</td><td class="hide-sm">${award(l.poty)}</td></tr>`; }).join("")}</tbody></table></div>
    <p class="small" style="margin-top:8px">${["FA", "LC", "CC", "CS", "CT"].filter(k => h.K[k] && h.K[k].w != null).map(k => `${trophyName(k)}: ${clubA(h.K[k].w, { flag: 1 })}`).join(" · ")}</p>
    <p class="small muted" style="margin-top:4px">Abroad: ${TOP_LGS.slice(1).filter(k => h.L[k]).map(k => `${COUNTRY[LG[k].c].name} ${C(h.L[k].champ).short}`).join(" · ")}</p></section>`).join("");
  const hof = S.hof.slice(0, 40);
  return `<div class="stack"><section class="card"><div class="card-h"><h2>Your career</h2></div>${S.career.length ? table("career", [{ k: "y", l: "Season", f: r => seasonLabel(r.year) }, { k: "c", l: "Club", f: r => clubA(r.club) }, { k: "l", l: "League", f: r => leagueName(r.lg) }, { k: "p", l: "Finish", r: 1, f: r => ord(r.pos) }, { k: "e", l: "Target", r: 1, f: r => ord(r.exp) }, { k: "t", l: "Trophies", f: r => r.trophies.map(trophyName).join(", ") || "—" }], S.career) : '<p class="muted">Finish a season to start your record.</p>'}
    <p class="small" style="margin-top:8px">${esc(c.name)} honours: ${c.trophies.length ? c.trophies.map(t => `${trophyName(t.t)} ${seasonLabel(t.y)}`).join(", ") : "none yet"}.</p></section>
    ${seasons || '<section class="card"><p class="muted">League history fills in at the end of each season.</p></section>'}
    ${S.history.length > UI.histN ? `<button class="btn" data-a="morehist">Show older seasons</button>` : ""}
    <section class="card"><div class="card-h"><h2>Hall of fame</h2><span class="small muted">Retired players with long or decorated careers</span></div>${hof.length ? table("hof", [{ k: "n", l: "Player", f: h => `<b>${esc(h.name)}</b> <span class="tiny muted">${h.nat}</span>` }, { k: "pos", l: "Pos", f: h => h.pos }, { k: "y", l: "Career", f: h => `${h.y0}–${h.y1}` }, { k: "a", l: "Apps", r: 1, f: h => h.apps }, { k: "g", l: "Goals", r: 1, f: h => h.goals }, { k: "pk", l: "Peak", r: 1, f: h => h.peak }, { k: "c", l: "Clubs", f: h => h.clubs.join(", "), cls: "hide-sm" }, { k: "aw", l: "Awards", r: 1, f: h => h.awards.length }], hof) : '<p class="muted">Nobody has retired with a hall-of-fame career yet.</p>'}</section>
    <section class="card"><div class="card-h"><h2>Save file</h2></div><p class="small" style="margin-bottom:8px">Your career saves automatically in this browser. Export a copy to back it up or move it to another device, then import it there.</p>
    <div class="row"><button class="btn" data-a="export">Export save</button><label class="btn" for="import-file" style="cursor:pointer">Import save</label><input type="file" id="import-file" accept=".json,application/json" data-c="import" hidden></div><p class="tiny muted" style="margin-top:6px">Exporting doesn't work inside the Claude preview; use the installed or GitHub Pages version.</p></section></div>`;
}

/* ---------- modals ---------- */
function renderModal() {
  const el = document.getElementById("modal"); if (!el) return;
  if (!UI.modal || (!S && UI.modal.t !== "coach")) { el.innerHTML = ""; return; }
  const m = UI.modal; let html = "";
  if (m.t === "player" && S.players[m.id]) html = modalPlayer(S.players[m.id]);
  else if (m.t === "club") html = modalClub(C(m.id));
  else if (m.t === "prospect") html = modalProspect(S.prospects.find(y => y.id === m.id));
  else if (m.t === "bid" && S.players[m.id]) html = modalBid(S.players[m.id]);
  else if (m.t === "coach") html = modalCoach(m);
  else { UI.modal = null; el.innerHTML = ""; return; }
  el.innerHTML = `<div class="scrim" data-a="closemodal"><div class="modal" role="dialog" aria-modal="true" data-stop="1">${html}</div></div>`;
}
const mHead = (title, sub, color, extra = "") => `<div class="modal-h" style="--mc:${color}">${extra}<div><div class="eyebrow">${sub}</div><h2>${title}</h2></div><button class="btn sm modal-x" data-a="closemodal" aria-label="Close">Close</button></div>`;
function modalPlayer(p) {
  const c = p.club >= 0 ? C(p.club) : null, mine = c && isUser(c) && !p.loan, onLoanFromMe = p.loan && p.loan.from === S.club, loanedIn = p.loan && isUser(c);
  const avg = p.s.app ? (p.s.rt / p.s.app).toFixed(2) : "—";
  const reasons = moodReasons(p);
  let actions = "";
  const cf = UI.confirm;
  if (cf && cf.id === p.id) actions = `<div class="row"><span class="small">${esc(cf.msg)}</span><button class="btn sm danger" data-a="confirm-yes">${cf.yes}</button><button class="btn sm" data-a="confirm-no">Cancel</button></div>`;
  else if (mine) {
    const r = renewTerms(p);
    actions = `<div class="row">${p.yrs <= 2 ? `<button class="btn sm" data-a="renew" data-v="${p.id}" ${r.happy ? "" : "disabled"} title="${esc(r.reason)}">Renew (${perWeek(r.wage)}, 4 yrs)</button>` : ""}
      ${loanable(p) ? `<button class="btn sm" data-a="ask-loan" data-v="${p.id}" ${windowOpen() ? "" : "disabled"}>Loan out</button>` : ""}
      <button class="btn sm" data-a="list" data-v="${p.id}">${p.listed ? "Remove from transfer list" : "Put on transfer list"}</button>
      <button class="btn sm" data-a="ask-sell" data-v="${p.id}" ${windowOpen() ? "" : "disabled"}>Sell abroad (${money(Math.round(value(p) * .8 / 1e4) * 1e4)})</button>
      <button class="btn sm danger" data-a="ask-release" data-v="${p.id}">Release</button></div>${!r.happy && p.yrs <= 2 ? `<p class="small warn">${esc(r.reason)}</p>` : ""}`;
  } else if (onLoanFromMe) actions = `<p class="small">On loan at ${clubA(p.club)} until the end of the season.</p>`;
  else if (loanedIn) actions = `<p class="small">On loan from ${clubA(p.loan.from)} until the end of the season.</p>`;
  else if (S.club != null && p.age >= 17 && !p.loan) {
    const [l, k] = willingLabel(willingness(p, me()));
    actions = `<div class="row"><button class="btn sm" data-a="bid" data-v="${p.id}" ${windowOpen() ? "" : "disabled"}>${c ? `Make an offer (asking ${money(askingPrice(p))})` : "Offer a contract"}</button>${c && loanable(p) && !wouldStart(p, c) ? `<button class="btn sm" data-a="loanin" data-v="${p.id}" ${windowOpen() ? "" : "disabled"}>Ask to loan</button>` : ""}<span class="small">Interest in joining you: <b class="${k === "ok" ? "" : k}">${l}</b></span></div>`;
  }
  return mHead(esc(p.name), `${ROLE_NAME[p.pos]} · ${NAT_NAME[p.nat] || p.nat} · ${p.age}`, c ? c.color : "var(--muted)", c ? crest(c, 36) : "") + `<div class="modal-b">
    <dl class="facts"><div><dt>Rating</dt><dd class="num">${ratingHtml(p)} <span class="muted tiny">/ 20</span></dd></div><div><dt>Potential</dt><dd>${potHtml(p)} <span class="muted tiny">/ 20</span></dd></div><div><dt>Injury proneness</dt><dd>${injHtml(p)} <span class="muted tiny">/ 20</span></dd></div><div><dt>Club</dt><dd>${c ? clubA(c.id, { flag: 1 }) : "Free agent"}</dd></div>
      <div><dt>Value</dt><dd class="num">${money(value(p))}</dd></div><div><dt>Wage</dt><dd class="num">${p.club >= 0 ? perWeek(p.wage) : "—"}</dd></div><div><dt>Contract</dt><dd>${c ? p.yrs + " yr" + (p.yrs === 1 ? "" : "s") : "—"}</dd></div>
      <div><dt>Fitness</dt><dd>${fitBar(p.fit)} ${Math.round(p.fit)}</dd></div><div><dt>Mood</dt><dd>${moodTag(p)}</dd></div><div><dt>Homegrown</dt><dd>${Object.entries(p.yt).filter(([, v]) => v >= RULES.hgYears).map(([k]) => COUNTRY[k] ? COUNTRY[k].name : k).join(", ") || "No"}</dd></div>
      <div><dt>Season</dt><dd class="num">${p.s.app} apps · ${p.s.g} g · ${p.s.a} a</dd></div><div><dt>Avg rating</dt><dd class="num">${avg}</dd></div><div><dt>Career</dt><dd class="num">${p.tot[0] + p.s.app} apps · ${p.tot[1] + p.s.g} g</dd></div></dl>
    ${attrPanel(p)}
    ${p.inj ? `<p class="small bad">${esc(p.injT ? p.injT.charAt(0).toUpperCase() + p.injT.slice(1) : "Injured")}: out for ${injLength(p.inj)}.</p>` : ""}
    ${statusChips(p, c) ? `<div>${statusChips(p, c)}</div>` : ""}
    ${reasons.length ? `<div class="small">${reasons.map(([t, s]) => `<span class="${s > 0 ? "good" : s < 0 ? "bad" : ""}">● ${esc(t)}</span>`).join("&nbsp;&nbsp; ")}</div>` : ""}
    ${(p.awards || []).length ? `<p class="small"><b>Honours:</b> ${p.awards.map(esc).join("; ")}</p>` : ""}
    ${actions}
    <div><h3 style="margin-bottom:6px">Career</h3>${table("hist-" + p.id, [{ k: "y", l: "Season", f: h => seasonLabel(h[0]) }, { k: "c", l: "Club", f: h => (S.clubs[h[2]] ? clubA(h[2], { short: true }) : h[1]) + (h[7] ? ' <span class="tiny muted">loan</span>' : "") }, { k: "a", l: "Apps", r: 1, f: h => h[3] }, { k: "g", l: "Goals", r: 1, f: h => h[4] }, { k: "as", l: "Assists", r: 1, f: h => h[5] }, { k: "r", l: "Avg", r: 1, f: h => h[6].toFixed(2) }], p.hist.slice().reverse(), { empty: "No completed seasons yet." })}</div></div>`;
}
function attrPanel(p) {
  const lvl = scoutLevel(p), names = ATTRS[p.pos === "GK" ? "gk" : "out"];
  const rows = names.map(([k, l]) => { const v = attrView(p, k); return `<div class="attr"><span>${l}</span><span class="abar">${v ? `<i style="left:${(v[0] - 1) / 19 * 100}%;width:${Math.max(2, (v[1] - v[0]) / 19 * 100)}%" class="${aCls((v[0] + v[1]) / 2)}"></i>` : ""}</span><b class="num">${v ? (v[0] === v[1] ? v[0] : v[0] + "–" + v[1]) : "?"}</b></div>`; }).join("");
  const need = lvl < 2 ? `<div class="row" style="margin-top:6px"><span class="small muted">${lvl === 0 ? "Not scouted: attributes unknown, rating is a rough guess." : "Partly scouted: attributes are ranges."}</span><button class="btn sm" data-a="scoutp" data-v="${p.id}">Scout him (2 hours, ${S.rec.hours} left)</button></div>` : "";
  return `<div><h3 style="margin-bottom:6px">Attributes <span class="tiny muted">out of 20</span></h3><div class="attrs">${rows}</div>${need}</div>`;
}
function modalClub(c) {
  const L = S.leagues[c.lg], ps = c.squad.map(P).sort((a, b) => ROLE_ORDER[a.pos] - ROLE_ORDER[b.pos] || b.ovr - a.ovr);
  return mHead(esc(c.name), `${leagueName(c.lg)} · ${esc(c.region)}, ${COUNTRY[c.country].name}${c.gone ? ` · dropped out ${seasonLabel(c.goneYear)}` : ""}`, c.color, crest(c, 40)) + `<div class="modal-b">
    <dl class="facts">${c.gone ? "" : `<div><dt>Position</dt><dd>${ord(posIn(L, c.id))}</dd></div>`}<div><dt>Squad level</dt><dd class="num">${r20(clubLevel(c)).toFixed(1)} / 20</dd></div><div><dt>Prestige</dt><dd class="num">${c.rep}</dd></div>
      <div><dt>Formation</dt><dd>${c.formation}</dd></div><div><dt>Academy</dt><dd>${c.academy}/10</dd></div><div><dt>Owner</dt><dd>${OWNER[c.owner].l}</dd></div>
      <div><dt>Coach</dt><dd>${esc(coachOf(c).name)}<br><span class="tiny muted">${ARCH[coachOf(c).arch].l} · prefers ${coachOf(c).form} · ${COACH_KEYS.map(([k, l]) => l.slice(0, 3) + " " + coachOf(c)[k]).join(" · ")}</span></dd></div>
      <div><dt>Cost ratio</dt><dd class="num">${pct(scr(c))}</dd></div><div><dt>Trophies</dt><dd>${c.trophies.length}</dd></div></dl>
    ${c.hist.length ? `<p class="small">Recent finishes: ${c.hist.slice(-6).reverse().map(h => `${seasonLabel(h.y)} ${ord(h.pos)} in ${leagueName(h.lg)}`).join(" · ")}</p>` : ""}
    ${c.trophies.length ? `<p class="small">Honours: ${c.trophies.slice(-12).reverse().map(t => `${trophyName(t.t)} ${seasonLabel(t.y)}`).join(", ")}</p>` : ""}
    ${table("club-" + c.id, [{ k: "n", l: "Player", f: p => playerA(p) + " " + statusChips(p, c) }, { k: "pos", l: "Pos", f: p => `<span class="pos">${p.pos}</span>` }, { k: "age", l: "Age", r: 1, f: p => p.age }, { k: "ovr", l: "Rating", r: 1, f: p => ratingHtml(p) }, { k: "g", l: "Goals", r: 1, f: p => p.s.g }, { k: "v", l: "Value", r: 1, f: p => money(value(p)) }], ps)}</div>`;
}
function modalProspect(y) {
  if (!y) return "";
  const c = me(), f = factors(y, c), cs = contenders(y).slice(0, 5);
  const best = cs[0] ? cs[0].s : 1;
  return mHead(esc(y.name), `${ROLE_NAME[y.pos]} · age 15 · ${esc(y.region)}${y.country === "ENG" ? "" : " (abroad)"}`, "var(--accent)") + `<div class="modal-b">
    <dl class="facts"><div><dt>Potential</dt><dd>${rangeHtml(prospectPot(y))} <span class="muted tiny">/ 20</span></dd></div><div><dt>Injury proneness</dt><dd>${rangeHtml(prospectInj(y), true)}</dd></div><div><dt>Scouted</dt><dd>${["Not yet", "Once", "Twice", "Fully"][y.sc]}</dd></div>
      ${y.sc >= 3 ? `<div><dt>Current rating</dt><dd class="num">${Math.round(r20(y.ovr))} / 20</dd></div>` : ""}<div><dt>Distance</dt><dd class="num">${Math.round(f.d)} km</dd></div>
      <div><dt>Open to moving</dt><dd>${y.known ? (y.open > .66 ? "Very" : y.open > .4 ? "Somewhat" : "Prefers to stay near home") : "Unknown"}</dd></div><div><dt>Status</dt><dd>${y.commit != null ? "Committed to " + clubA(y.commit) : y.offers.length + " offer" + (y.offers.length === 1 ? "" : "s")}</dd></div></dl>
    ${y.commit != null && y.commit !== c.id ? `<p class="small">He has committed elsewhere, but nothing is signed until the end of the season. Make an offer and keep building the relationship: if your club clearly suits him better, he may change his mind.</p>` : ""}
    <div><h3 style="margin-bottom:4px">How your club looks to him</h3>
      ${FACTORS.map(([k, l]) => `<div class="factor"><span><b>${l}</b>${y.known && y.top.includes(k) ? ' <span class="chip list">matters most</span>' : ""}<br><span class="tiny muted">${FACTOR_HELP[k]}</span></span><span class="grade ${grade(f[k])}">${grade(f[k])}</span><span class="bar"><i style="width:${(y.known ? y.pri[k] / .4 : .5) * 100}%;${y.known ? "" : "opacity:.25"}"></i></span></div>`).join("")}
      <p class="tiny muted" style="margin-top:6px">${y.known ? "Bars show how much each factor weighs with him." : "Call his family or scout him twice to learn what he cares about."} ${f.slots === 0 && y.pos !== "GK" ? `Your ${S.formation} has no ${ROLE_NAME[y.pos].toLowerCase()} role.` : ""} ${f.ahead ? `${f.ahead} young player${f.ahead > 1 ? "s" : ""} already ahead of him at his position.` : ""}</p></div>
    <div><h3 style="margin-bottom:4px">Clubs in the running</h3>${cs.length ? cs.map(x => `<div class="row between" style="padding:4px 0;border-top:1px solid var(--line)"><span>${clubA(x.c.id, { flag: 1 })} ${x.offer ? '<span class="chip hg">offer made</span>' : ""}${y.commit === x.c.id ? ' <span class="chip xi">committed</span>' : ""}</span><span class="bar"><i style="width:${clamp(x.s / best, 0, 1) * 100}%"></i></span></div>`).join("") : '<p class="muted small">Nobody has approached him yet.</p>'}</div>
    ${y.commit !== c.id && !y.signed ? `<div class="row"><button class="btn sm" data-a="rec" data-v="${y.id}|scout" ${y.sc >= 3 ? "disabled" : ""}>Scout (3h)</button><button class="btn sm" data-a="rec" data-v="${y.id}|call">Call family (1h)</button><button class="btn sm" data-a="rec" data-v="${y.id}|visit" ${y.visit ? "disabled" : ""}>Host a visit (5h)</button><button class="btn sm" data-a="rec" data-v="${y.id}|offer">${y.offers.includes(c.id) ? "Withdraw offer" : "Offer a place"}</button><span class="small muted">${S.rec.hours}h left this week</span></div>` : ""}</div>`;
}
function modalCoach(m) {
  const c = DRAFT.clubs[m.club], arch = m.arch || "bal", co = newManager("", arch), form = m.form || "4-3-3";
  return mHead("Your manager", `Taking over ${esc(c.name)} · ${leagueName(c.lg)}`, c.color, crest(c, 36)) + `<div class="modal-b">
    <label class="f">Name<input type="text" id="coach-name" maxlength="28" value="${esc(m.name || "")}" placeholder="Your name"></label>
    <div><h3 style="margin-bottom:6px">Style</h3><div class="train arch">${Object.entries(ARCH).map(([k, a]) => `<button data-a="arch" data-v="${k}" aria-pressed="${arch === k}"><b>${a.l}</b><span class="tiny muted">${a.d}</span></button>`).join("")}</div></div>
    <div class="attrs">${COACH_KEYS.map(([k, l]) => `<div class="attr"><span>${l}</span><span class="abar"><i style="left:0;width:${co[k] / 20 * 100}%" class="${aCls(co[k])}"></i></span><b class="num">${co[k]}</b></div>`).join("")}</div>
    <label class="f">Preferred formation<select id="coach-form" data-c="cform">${FORM_KEYS.map(f => `<option ${f === form ? "selected" : ""}>${f}</option>`).join("")}</select><span class="tiny muted" style="font-weight:400">Your teams play about 2% better in it. ${esc(c.name)} currently play ${c.formation}.</span></label>
    <p class="small muted">You start as an average coach: 40 points across four ratings out of 20. A specialist puts 14 in one area and gives a point up elsewhere. You earn more points every season, and extra for beating the board's target, winning trophies and promotion.</p>
    <div class="row"><button class="btn primary" data-a="startcareer">Start the career</button><button class="btn" data-a="closemodal">Back</button></div></div>`;
}
function modalBid(p) {
  const c = me(), ask = askingPrice(p), w = willingness(p, c), [wl, wk] = willingLabel(w), wage = contractDemand(p, c, w);
  const b = UI.bid && UI.bid.id === p.id ? UI.bid : (UI.bid = { id: p.id, fee: ask, yrs: p.age >= 31 ? 2 : 4, msg: "" });
  const after = scr(c, wage + (b.fee ? b.fee / b.yrs : 0) + b.fee * .05);
  const fees = p.club >= 0 ? [.85, .95, 1, 1.1, 1.25].map(k => Math.round(ask * k / 1e4) * 1e4) : [0];
  return mHead(esc(p.name), `${p.club >= 0 ? "Offer to " + esc(C(p.club).name) : "Free agent"} · ${ROLE_NAME[p.pos]} · ${p.age} · rated ${ratingView(p).join("–").replace(/^(\d+)–\1$/, "$1")}`, p.club >= 0 ? C(p.club).color : "var(--muted)") + `<div class="modal-b">
    <dl class="facts"><div><dt>Asking price</dt><dd class="num">${p.club >= 0 ? money(ask) : "None"}</dd></div><div><dt>His interest</dt><dd class="${wk === "ok" ? "" : wk}">${wl}</dd></div><div><dt>Wants</dt><dd class="num">${perWeek(wage)}</dd></div><div><dt>Your cash</dt><dd class="num">${money(c.cash)}</dd></div></dl>
    ${w < .45 ? `<p class="small">${esc(whyNot(p, c) || "He isn't convinced by the move.")}</p>` : ""}
    <div class="filters">${p.club >= 0 ? `<label class="f">Transfer fee<select id="bid-fee" data-c="bid-fee">${fees.map(v => `<option value="${v}" ${v === b.fee ? "selected" : ""}>${money(v)}${v === ask ? " (asking)" : ""}</option>`).join("")}</select></label>` : ""}
      <label class="f">Contract length<select id="bid-yrs" data-c="bid-yrs">${[1, 2, 3, 4, 5].map(y => `<option value="${y}" ${y === b.yrs ? "selected" : ""}>${y} year${y > 1 ? "s" : ""}</option>`).join("")}</select></label></div>
    <p class="small">With agent fees (5%) this costs <b>${money(b.fee * 1.05)}</b> now. Your projected cost ratio would move from ${pct(scr(c))} to <b class="${after > RULES.scrSporting ? "bad" : after > RULES.scrLimit ? "warn" : ""}">${pct(after)}</b>. Registration after signing: ${regInfo(c).seniors + (isSenior(p) ? 1 : 0)}/${RULES.squadMax} seniors.</p>
    ${b.msg ? `<p class="small ${b.ok ? "good" : "bad"}"><b>${esc(b.msg)}</b></p>` : ""}
    <div class="row"><button class="btn primary" data-a="submitbid" data-v="${p.id}" ${windowOpen() && !b.ok ? "" : "disabled"}>${p.club >= 0 ? "Submit offer" : "Offer contract"}</button>${windowOpen() ? "" : '<span class="small muted">The transfer window is closed.</span>'}</div></div>`;
}

/* ---------- live match ---------- */
function viewLive() {
  const M = LIVE.M, H = C(M.h.club), A = C(M.a.club), tp = (M.h.poss + M.a.poss) || 1, hp = Math.round(M.h.poss / tp * 100);
  const k = LIVE.k, mine = k ? M.a : M.h;
  const cl = e => e.side < 0 ? "var(--muted)" : C((e.side ? M.a : M.h).club).color;
  const stat = (l, x, y) => `<tr><td class="num">${x}</td><td class="eyebrow">${l}</td><td class="num">${y}</td></tr>`;
  let ctrl;
  if (M.done) { const w = tieWinner(M); ctrl = `<p><b>Full time.</b> ${w === S.club ? (M.fx.ko ? "Through to the next round." : "A win.") : w == null ? "A draw." : (M.fx.ko ? "Knocked out." : "A defeat.")}</p><button class="btn primary" data-a="livecont">Continue</button>`; }
  else {
    const b = benchAvail(M, k);
    ctrl = `<div class="row">${LIVE.paused ? `<button class="btn primary" data-a="liveresume">${M.min === 0 ? "Kick off" : M.min === 45 ? "Second half" : M.min === 90 ? "Extra time" : "Resume"}</button>` : `<button class="btn" data-a="livepause">Pause</button>`}<button class="btn" data-a="liveskip">Skip to the end</button></div>
    <label>Speed<span class="seg" role="group">${[["Normal", 300], ["Fast", 80]].map(([l, v]) => `<button data-a="livespeed" data-v="${v}" aria-pressed="${LIVE.speed === v}">${l}</button>`).join("")}</span></label>
    <label>Mentality<span class="seg" role="group">${Object.entries(MENT).map(([x, v]) => `<button data-a="liveme" data-v="${x}" aria-pressed="${mine.ment === x}">${v.l}</button>`).join("")}</span></label>
    ${LIVE.paused ? `<div class="ctrl" style="gap:8px;border-top:1px solid var(--line);padding-top:12px"><span class="eyebrow">Substitutions · ${RULES.subs - mine.subs} left</span>
      ${mine.subs < RULES.subs && b.length ? `<label>Off<select id="sub-off">${mine.on.map((o, i) => `<option value="${i}">${o.slot} · ${esc(o.p.name)} · fit ${Math.round(o.fit)}</option>`).join("")}</select></label>
      <label>On<select id="sub-on">${b.map(p => `<option value="${p.id}">${p.pos} · ${esc(p.name)} · ${Math.round(r20(p.ovr))} · fit ${Math.round(p.fit)}</option>`).join("")}</select></label>
      <button class="btn" data-a="livesub">Make substitution</button>` : '<span class="small muted">No substitutions left.</span>'}</div>` : '<p class="small muted">Pause to make substitutions.</p>'}`;
  }
  return `<section style="--hc:${H.color};--ac:${A.color}"><div class="board"><span class="comp eyebrow">${esc(compLabel(M.fx))}${M.fx.ko ? ` · 1st leg ${M.fx.ko.aggA}–${M.fx.ko.aggH}` : ""}</span><div class="t">${crest(H, 40)}<b>${esc(H.name)}</b></div>
    <div class="score">${M.h.goals}–${M.a.goals}<span class="clock">${M.done ? (M.pens ? `pens ${M.pens[0]}–${M.pens[1]}` : M.et ? "AET" : "FT") : M.min === 45 && LIVE.paused ? "HT" : M.min + "′"}</span></div><div class="t away"><b>${esc(A.name)}</b>${crest(A, 40)}</div></div>
    <div class="poss"><span class="h" style="width:${hp}%"></span><span class="a" style="width:${100 - hp}%"></span></div>
    <div class="row small muted between"><span>Possession ${hp}%</span><span>${100 - hp}%</span></div>
    <div class="live-grid"><div class="card"><div class="card-h"><h2>Commentary</h2></div><ul class="feed" aria-live="polite">${M.log.slice().reverse().map((e, i) => `<li class="${e.type === "goal" ? "goal" : ""} ${i === 0 && !M.done ? "new" : ""}"><span class="m">${e.m}′</span><span><span class="tag" style="background:${cl(e)}"></span>${esc(e.text)}</span></li>`).join("") || '<li><span class="m">0′</span><span>The teams are out. Press kick off when ready.</span></li>'}</ul></div>
    <div class="stack"><div class="card"><table class="stats"><tbody>${stat("Shots", M.h.shots, M.a.shots)}${stat("On target", M.h.sot, M.a.sot)}${stat("Subs", M.h.subs, M.a.subs)}</tbody></table></div><div class="card ctrl">${ctrl}</div></div></div></section>`;
}

function viewManager() {
  const co = S.me, c = me();
  const row = ([k, l]) => `<div class="attr"><span><b>${l}</b><br><span class="tiny muted">${COACH_EFFECT[k]}</span></span><span class="abar"><i style="left:0;width:${co[k] / 20 * 100}%" class="${aCls(co[k])}"></i></span><b class="num">${co[k]}</b>${co.pts > 0 && co[k] < 20 ? `<button class="btn sm" data-a="coachpt" data-v="${k}">+1</button>` : ""}</div>`;
  const rivals = S.leagues[c.lg].clubs.filter(id => id !== c.id).map(C).sort((a, b) => sum(COACH_KEYS, ([k]) => b.coach[k]) - sum(COACH_KEYS, ([k]) => a.coach[k])).slice(0, 8);
  return `<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>${esc(co.name)}</h2><span class="eyebrow">${ARCH[co.arch].l} · prefers ${co.form} · ${co.seasons} season${co.seasons === 1 ? "" : "s"} · ${esc(c.name)}</span></div>
    <div class="attrs coach">${COACH_KEYS.map(row).join("")}</div>
    <label class="row small" style="margin-top:12px">Preferred formation <select id="mg-pref" data-c="pref">${FORM_KEYS.map(f => `<option ${f === co.form ? "selected" : ""}>${f}</option>`).join("")}</select><span class="tiny muted">Changing it takes a season to bed in: the bonus applies from next season.</span></label>
    <p class="small" style="margin-top:10px">${co.pts ? `<b>${co.pts} point${co.pts > 1 ? "s" : ""} to spend.</b> ` : ""}You earn a point every season, plus one for finishing above the board's target, up to two for trophies, and one for promotion. Ratings are out of 20.</p></section>
    <section class="card"><div class="card-h"><h2>Career</h2></div>${S.career.length ? table("career-m", [{ k: "y", l: "Season", f: r => seasonLabel(r.year) }, { k: "c", l: "Club", f: r => clubA(r.club) }, { k: "l", l: "League", f: r => leagueName(r.lg) }, { k: "p", l: "Finish", r: 1, f: r => ord(r.pos) }, { k: "e", l: "Target", r: 1, f: r => ord(r.exp) }, { k: "t", l: "Trophies", f: r => r.trophies.map(trophyName).join(", ") || "—" }], S.career) : '<p class="muted">Finish a season to start your record.</p>'}</section></div>
    <section class="card"><div class="card-h"><h2>Rival coaches</h2><span class="small muted">${leagueName(c.lg)}</span></div>${table("rivalco", [{ k: "c", l: "Club", f: x => clubA(x.id, { short: true }) }, { k: "n", l: "Coach", f: x => esc(x.coach.name) + `<br><span class="tiny muted">${ARCH[x.coach.arch].l}</span>` }, { k: "f", l: "System", f: x => x.coach.form }, ...COACH_KEYS.map(([k, l]) => ({ k, l: l.slice(0, 3), r: 1, f: x => x.coach[k] }))], rivals)}</section></div>`;
}
const VIEWS = { manager: viewManager, home: viewHome, squad: viewSquad, tactics: viewTactics, fixtures: viewFixtures, league: viewLeague, cups: viewCups, transfers: viewTransfers, youth: viewYouth, finances: viewFinances, news: viewNews, history: viewHistory };
