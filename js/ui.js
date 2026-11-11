"use strict";
/* Rendering. Every page is a function returning HTML; actions are wired by data-a attributes in main.js. */
const UI = { page: "home", sel: null, modal: null, sort: {}, menu: false, busy: false, toastT: 0,
  lg: null, cupK: "FA", tab: "offers", tf: { pos: "ALL", age: 40, min: 0, fee: 0, lg: "ALL" }, sqf: "ALL",
  yf: { pos: "ALL", st: "OPEN" }, nf: "ALL", startL: "E1", confirm: null, bid: null, histN: 5, awY: null, awL: null };
const PAGES = [["home", "Home"], ["manager", "Manager"], ["squad", "Squad"], ["needs", "Team Needs"], ["tactics", "Tactics"], ["fixtures", "Fixtures"], ["league", "Leagues"], ["cups", "Cups"], ["transfers", "Transfers"], ["youth", "Youth"], ["academy", "Academy"], ["finances", "Finances"], ["news", "News"], ["history", "History"]];

/* ---------- atoms ---------- */
function crest(c, sz = 40) {
  return `<svg class="crest" width="${sz}" height="${Math.round(sz * 1.15)}" viewBox="0 0 40 46" aria-hidden="true"><path d="M20 1.5 L38 7 V22 C38 34 30 41 20 44.5 C10 41 2 34 2 22 V7 Z" fill="${c.color}" stroke="var(--crest-edge)" stroke-width="1.5"/>${sz >= 24 ? `<path d="M9 33 L20 38 L31 33" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/><text x="20" y="25" text-anchor="middle" font-family="Saira Condensed,Arial Narrow,sans-serif" font-weight="800" font-size="13" fill="#fff">${c.short}</text>` : ""}</svg>`;
}
const clubA = (id, opt = {}) => { if (id == null) return "—"; const c = C(id); return `<span class="club-in">${opt.crest !== false ? crest(c, 16) : ""}<button class="lnk" data-a="club" data-v="${id}">${esc(opt.short ? c.short : c.name)}</button>${opt.flag && c.country !== HOME ? ` <span class="tiny muted">${c.country}</span>` : ""}</span>`; };
const rivalChip = id => { const n = S && S.club != null && id !== S.club ? rivalry(S.club, id) : 0; return n ? ` <span class="chip rival r${n}" title="${RIVAL_WORD[n]}">${n >= 2 ? "DERBY" : "RIVAL"}</span>` : ""; };
const recStr = r => `W${r[0]} D${r[1]} L${r[2]}`;
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
/* Country toggles (Transfers search: S.set.ctyOff, actions ctytog/ctyall; Youth: S.set.yCtyOff, yctytog/yctyall). */
function ctyTogHtml(off = [], a) {
  return `<div class="cty-tog" role="group" aria-label="Countries to search"><span class="small muted">Countries</span>${KNOW_KEYS.map(k => { const on = !off.includes(k); return `<button class="cty ${on ? "on" : ""}" data-a="${a}tog" data-v="${k}" aria-pressed="${on}" title="${on ? "Searching" : "Not searching"} ${esc(KNOW_NAME(k))}: tap to switch">${k === "ROW" ? "Rest of world" : esc(COUNTRY[k].name)}</button>`; }).join("")}<span class="cty-all"><button class="lnk small" data-a="${a}all" ${off.length ? "" : "disabled"}>Select all</button> · <button class="lnk small" data-a="${a}none" ${off.length >= KNOW_KEYS.length ? "disabled" : ""}>Unselect all</button></span></div>`;
}
/* The favourite star (player cards, prospect cards, Favourites lists): a = "fav" for players, "yfav" for prospects. */
function starBtn(id, a, on) { return `<button class="star ${on ? "on" : ""}" data-a="${a}" data-v="${id}" aria-pressed="${on}" aria-label="${on ? "Remove from favourites" : "Add to favourites"}" title="${on ? "In your favourites: tap to remove" : "Add to your favourites"}">${on ? "★" : "☆"}</button>`; }
function ratingHtml(p) { if (ratingBlank(p)) return '<span class="rt unk muted" title="Not scouted, and you know too little about his league to guess: scout him">?</span>'; const [lo, hi] = ratingView(p); return lo === hi ? `<b class="rt ${aCls(lo)}">${lo}</b>` : `<span class="rt rng" title="${scoutLevel(p) ? "Partly scouted" : "Not scouted: a rough band from his reputation. Scouting narrows it"}">${lo}–${hi}</span>`; }
function attrStrip(p) {
  const lvl = scoutLevel(p);
  if (lvl === 0) return '<span class="muted tiny">Scout to see</span>';
  return `<span class="atts">${attrKeys(p.pos).map(k => { const [lo, hi] = attrView(p, k); return `<span class="at ${aCls((lo + hi) / 2)}" title="${ATTR_NAME[k]}">${k.toUpperCase()} ${lo === hi ? lo : lo + "–" + hi}</span>`; }).join("")}</span>`;
}
// Estimates of hidden ratings. For injury risk a high number is bad, so the colours run the other way.
function rangeHtml(v, risk) {
  if (!v) return '<span class="muted tiny" title="Scout him to find out">?</span>';
  const mid = (v[0] + v[1]) / 2, cls = aCls(risk ? 21 - mid : mid);
  return `<span class="rt est ${cls}" title="Scouts' estimate">${v[0] === v[1] ? v[0] : v[0] + "–" + v[1]}</span>`;
}
const potHtml = p => rangeHtml(potView(p)), injHtml = p => rangeHtml(injView(p), true);
/* Average of an attribute group as you know it (exact for your players, the middle of the scouted range
   otherwise); null when the group is empty or the player isn't scouted. */
function groupAvg(p, g) {
  const keys = ATTR_GROUPS[p.pos === "GK" ? "gk" : "out"][g]; if (!keys.length) return null;
  const vs = keys.map(k => attrView(p, k)); if (vs.some(v => !v)) return null;
  return vs.reduce((t, v) => t + (v[0] + v[1]) / 2, 0) / vs.length;
}
function groupHtml(p, g) {
  const v = groupAvg(p, g), keys = ATTR_GROUPS[p.pos === "GK" ? "gk" : "out"][g];
  if (v == null) return `<span class="muted tiny">${keys.length ? "?" : "—"}</span>`;
  return `<span class="rt ${aCls(v)}" title="${p.pos === "GK" ? (g === "atk" ? "Distribution: " : "Shot-stopping: ") : ""}${keys.map(k => ATTR_NAME[k]).join(", ")}">${v.toFixed(1)}</span>`;
}
// One attribute as a single coloured number (a range if only partly scouted); keepers have no physical ratings.
function attrCell(p, k) {
  if (p.pos === "GK") return '<span class="muted tiny">—</span>';
  const v = attrView(p, k); if (!v) return '<span class="muted tiny">?</span>';
  return `<span class="rt ${aCls((v[0] + v[1]) / 2)}">${v[0] === v[1] ? v[0] : v[0] + "–" + v[1]}</span>`;
}
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
  const cc = c || (p.club >= 0 ? C(p.club) : null);
  if (cc && cc.reg && !isReg(p, cc)) s += `<span class="chip sus" title="Not registered for competitions">NOT REG</span> `;
  return s;
}
const lgOpts = (sel, keys = Object.keys(LG)) => keys.map(k => `<option value="${k}" ${k === sel ? "selected" : ""}>${LG[k].foreign ? COUNTRY[LG[k].c].name + " · " : ""}${leagueName(k)}</option>`).join("");

/* Sortable table. cols: {k,l,v:row=>sortValue,f:row=>html,r:bool,cls}. */
function table(id, cols, rows, opt = {}) {
  const st = UI.sort[id] || opt.sort || null;
  // Each row's sort key is computed once: the transfer market sorts up to 15,000 players by asking price or
  // interest, and calling those inside the comparator took seconds.
  if (st) { const col = cols.find(c => c.k === st.k); if (col && col.v) rows = rows.map(r => [col.v(r), r]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0) * st.d).map(x => x[1]); }
  if (opt.limit) rows = rows.slice(0, opt.limit);
  return `<div class="tbl-wrap${opt.tall ? " tall" : ""}"><table><thead><tr>${cols.map(c => `<th class="${c.r ? "r" : ""} ${c.cls || ""}" ${st && st.k === c.k ? `aria-sort="${st.d > 0 ? "ascending" : "descending"}"` : ""}>${c.v ? `<button data-a="sort" data-v="${id}|${c.k}">${c.l}${st && st.k === c.k ? (st.d > 0 ? " ▲" : " ▼") : ""}</button>` : c.l}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(r => `<tr class="${opt.rowCls ? opt.rowCls(r) : ""}">${cols.map(c => `<td class="${c.r ? "r num" : ""} ${c.cls || ""}">${c.f(r)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="muted">${opt.empty || "Nothing to show."}</td></tr>`}</tbody></table></div>`;
}

/* ---------- shell ---------- */
function render() {
  const app = document.getElementById("app");
  if (S) bumpTick();
  if (!S || S.club == null) { app.innerHTML = UI.screen === "landing" && SAVES.list.length ? viewLanding() : viewStart(); renderModal(); return; }
  if (S.sacked) { app.innerHTML = viewSacked(); renderModal(); return; }
  const c = me(), L = S.leagues[c.lg], pos = S.phase === "season" ? posIn(L, c.id) : S.lastPos[c.id];
  // The transfer window as a badge after the week, so it can't be missed: "Week 20 · Transfer window open
  // to week 22" (it was a plain " · window open" in the same grey as the rest of the line).
  const janEnd = CAL.jan[CAL.jan.length - 1] + 1;
  const winBadge = windowOpen() ? ` <span class="win-badge">Transfer window open${S.phase === "season" ? ` to week ${janEnd}` : ""}</span>` : "";
  const when = (S.phase === "summer" ? `Preseason · week ${S.summerDay + 1} of ${CAL.summerDays}` : `Week ${S.week + 1}`) + winBadge;
  const ratio = scr(c), dec = openDecisions().length;
  // The section links scroll sideways on a phone. render() rebuilds them, which reset the scroll to Home
  // every time: keep where you'd scrolled to (UI.navX, updated as you scroll).
  const navOld = document.querySelector("nav.tabs"); if (navOld && navOld.offsetParent && navOld.scrollLeft > 0) navSave(navOld.scrollLeft);  // not while hidden by the compact masthead
  app.innerHTML = `<header class="mast${UI.mastCompact ? " compact" : ""}" style="--club:${c.color}"><div class="wrap gut">
    <div class="mast-in"><div class="ident">${crest(c, 34)}<div><div class="eyebrow">${seasonLabel(S.year)} · ${leagueName(c.lg)} · ${when}</div><h1>${esc(c.name)}</h1></div></div>
    <div class="mast-r"><dl class="kpis"><div><dt>Cash</dt><dd class="${c.cash < 0 ? "bad" : ""}">${money(c.cash)}</dd></div>
      <div><dt>Cost ratio</dt><dd class="${ratio > RULES.scrSporting ? "bad" : ratio > RULES.scrLimit ? "warn" : ""}" title="Squad Cost Ratio, projected">${pct(ratio)}</dd></div>
      <div><dt>Position</dt><dd>${pos ? ord(pos) : "—"}</dd></div>
      <div><dt>Fans</dt><dd class="${fanWord(c.fans)[1]}" title="Fan engagement: ${fanWord(c.fans)[0]}">${Math.round(c.fans)}</dd></div>
      <div><dt>Board${S.set.unsackable ? ' <span title="Unsackable mode is on">· safe</span>' : ""}</dt><dd>${S.board}<span class="meter ${S.board < 30 ? "low" : ""}"><i style="width:${S.board}%"></i></span></dd></div></dl>
      ${LIVE ? "" : playControl()}</div></div>
    ${LIVE ? "" : `<nav class="tabs" aria-label="Sections">${PAGES.map(([k, l]) => `<button data-a="go" data-v="${k}" ${UI.page === k ? 'aria-current="page"' : ""}>${l}${k === "home" && dec ? `<span class="dot">${dec}</span>` : ""}</button>`).join("")}${DB.db ? `<button data-a="landing" title="Your careers: switch, start a new one or delete">Saves</button>` : ""}</nav>`}
  </div></header><main class="wrap gut">${LIVE ? viewLive() : (VIEWS[UI.page] || viewHome)()}</main>`;
  const nav = document.querySelector("nav.tabs");
  if (nav) {
    // Only a visible row records where it's scrolled: iOS reports 0 while the compact masthead hides it, and
    // again as it reappears, which sent the row back to Home on the next tap.
    nav.addEventListener("scroll", () => { if (nav.offsetParent && !UI.navRestoring) { navSave(nav.scrollLeft); UI.navUser = Date.now(); } }, { passive: true });
    restoreNav();
    // iOS can ignore a scroll position set before the new row is laid out: set it again once it has been,
    // unless you've started swiping it in the meantime.
    const t0 = Date.now(), again = () => { if (!(UI.navUser > t0)) restoreNav(); };
    requestAnimationFrame(again); setTimeout(again, 150);
  }
  renderModal();
}
function navSave(x) { UI.navX = x; try { sessionStorage.setItem("navX", String(Math.round(x))); } catch (e) { /* private mode */ } }
function restoreNav() {
  const nav = document.querySelector("nav.tabs"); if (!nav || !nav.offsetParent) return;
  if (UI.navX == null) { try { UI.navX = +sessionStorage.getItem("navX") || 0; } catch (e) { UI.navX = 0; } }  // after the app reloads itself
  UI.navRestoring = true; nav.scrollLeft = UI.navX;
  // The current section's link must be on screen (opened from a button elsewhere, or after a reload).
  const cur = nav.querySelector('[aria-current="page"]');
  if (cur) { const nr = nav.getBoundingClientRect(), r = cur.getBoundingClientRect(); if (r.left < nr.left || r.right > nr.right) { nav.scrollLeft += r.left - nr.left - 16; UI.navX = nav.scrollLeft; } }
  setTimeout(() => { UI.navRestoring = false; }, 0);
}
function playControl() {
  const dec = openDecisions().length;
  if (dec) return `<div class="playbox"><div class="playbtn block"><button data-a="go" data-v="home">Decide (${dec})</button></div></div>`;
  let label = "Play", items = [];
  if (S.phase === "summer") { const fw = friendlyAt(S.summerDay); label = fw && !fw.played ? "Play friendly" : "Next week"; items = [["day", fw && !fw.played ? `Play the friendly, then next week` : "Next preseason week", `${CAL.summerDays - S.summerDay} week${CAL.summerDays - S.summerDay === 1 ? "" : "s"} before the season starts`], ["newseason", "Start the season", (S.friendlies || []).some(f => !f.played) ? "Skips ahead; booked friendlies are simulated" : "AI clubs finish their summer business"]]; }
  else {
    const nx = peekUserFixture();
    label = nx && nx.di === S.di ? "Play match" : nx ? "To match day" : "Next day";
    items = [["day", "Next day", S.days[S.di] ? dayLabel(S.days[S.di]) : ""], ["match", "To my next match day", nx ? `Stops before ${compLabel(nx.fx)}, week ${nx.day.w + 1}, so you can set your team` : "No more matches"], ["week", "One week", "Your match is simulated"]];
    if (CAL.jan.includes(S.week)) items.push(["window", "Until the window closes", ""]);
    items.push(["month", "Four weeks", ""], ["season", "Until the end of the season", "Your matches are simulated"]);
  }
  return `<div class="playbox"><div class="playbtn"><button data-a="play" data-v="${S.phase === "summer" ? "day" : label === "To match day" ? "match" : label === "Play match" ? "play" : "day"}">${label}</button><button data-a="menu" aria-label="More play options" aria-expanded="${UI.menu}">▾</button></div>
    ${UI.menu ? `<div class="playmenu">${items.map(([k, l, s]) => `<button data-a="play" data-v="${k}">${l}${s ? `<small>${esc(s)}</small>` : ""}</button>`).join("")}
      <label><input type="checkbox" id="opt-live" data-c="live" ${S.set.live ? "checked" : ""}> Watch my matches live${S.phase === "summer" ? " (friendlies too)" : ""}</label></div>` : ""}</div>`;
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
/* The first screen when you open the app: your careers, newest first, to continue or delete, and the way
   to start a new one. */
function viewLanding() {
  const list = SAVES.list.slice().sort((a, b) => b.updated - a.updated);
  const when = t => { const d = new Date(t), days = Math.floor((Date.now() - t) / 864e5); return days < 1 ? "today" : days < 2 ? "yesterday" : days < 7 ? `${days} days ago` : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); };
  const row = m => {
    const ask = UI.delAsk === m.id;
    return `<div class="save-row${ask ? " asking" : ""}" style="--c:${m.color}">
      <div class="save-id">${crest(m, 36)}<div><b>${esc(m.club)}</b><div class="small muted">${esc(m.manager)} · ${seasonLabel(m.year)} · ${leagueName(m.lg)} · ${m.sacked ? '<span class="bad">sacked</span>' : m.phase === "summer" ? "summer window" : `week ${m.week + 1}`}</div><div class="tiny muted">Last played ${when(m.updated)}</div></div></div>
      ${ask ? `<div class="save-ask"><span class="small">Delete this career? This can't be undone.</span><div class="row"><button class="btn sm danger" data-a="delsave" data-v="${m.id}">Delete</button><button class="btn sm" data-a="delcancel">Keep it</button></div></div>`
        : `<div class="row save-act"><button class="btn primary" data-a="loadsave" data-v="${m.id}">Continue</button><button class="btn sm" data-a="delask" data-v="${m.id}" aria-label="Delete ${esc(m.club)} career">Delete</button></div>`}
    </div>`;
  };
  return `<div class="wrap gut"><section class="hero"><div class="eyebrow">Football management in the English pyramid</div><h1>Touchline <span>Manager</span></h1></section>
    <div class="card"><div class="card-h"><h2>Your careers</h2><span class="small muted">${list.length} saved</span></div>
      <div class="saves">${list.map(row).join("")}</div>
      <div class="row" style="margin-top:14px"><button class="btn" data-a="newcareer">Start a new career</button><label class="btn" for="import-file" style="cursor:pointer">Import a save file</label><input type="file" id="import-file" accept=".json,application/json" data-c="import" hidden></div>
      <p class="tiny muted" style="margin-top:10px">Careers save in this browser on this device. Export one from its History page to back it up or move it. Version ${APP_VERSION}.</p></div></div>`;
}
function viewStart() {
  if (!DRAFT) { newWorld(); DRAFT = S; S = null; }
  const keep = S; S = DRAFT; bumpTick();
  const key = UI.startL, L = S.leagues[key];
  const rows = L.clubs.map(C).map(c => ({ c, lvl: clubLevel(c), fin: finHealth(c), inc: annualIncome(c), sty: baseStyle(c) })).sort((a, b) => b.lvl - a.lvl);
  rows.forEach((r, i) => r.exp = i + 1);
  /* Every column sorts, on the table's headers or the "Sort by" menu (the only way on a phone, where clubs
     show as cards). One sort is shared by both layouts and kept when you switch division. */
  const OWN_ORDER = { prudent: 0, balanced: 1, ambitious: 2, reckless: 3 };
  const cols = [
    { k: "n", l: "Club", v: r => r.c.name, f: r => `<span class="club-in">${crest(r.c, 18)} <b>${esc(r.c.name)}</b></span>` },
    { k: "reg", l: "Region", v: r => r.c.region, f: r => `${r.c.region}<br><span class="tiny muted">${OWNER[r.c.owner].l}</span>`, cls: "hide-sm" },
    { k: "lvl", l: "Squad", r: 1, v: r => r.lvl, f: r => r20(r.lvl).toFixed(1) },
    { k: "co", l: "Coach", v: r => ARCH[r.c.coach.arch].l, f: r => `${esc(ARCH[r.c.coach.arch].l)}<br><span class="tiny muted">${MENT[r.sty].l}</span>`, cls: "hide-sm" },
    { k: "sty", l: "Style", v: r => MENT[r.sty].ag, f: r => MENT[r.sty].l, hide: 1 },  // shown under the coach
    { k: "rep", l: "Prestige", r: 1, v: r => r.c.rep, f: r => r.c.rep },
    { k: "acad", l: "Youth dev", r: 1, v: r => r.c.academy, f: r => `<b class="rt ${aCls(r.c.academy)}">${r.c.academy}</b>` },
    { k: "fin", l: "Finances", v: r => -r.fin.ratio, f: r => `<b class="${r.fin.cls}">${r.fin.label}</b><br><span class="tiny muted">${money(r.c.cash)} cash · ${money(r.inc)} a year</span>` },
    { k: "cash", l: "Cash", r: 1, v: r => r.c.cash, f: r => money(r.c.cash), hide: 1 },
    { k: "inc", l: "Income", r: 1, v: r => r.inc, f: r => money(r.inc), hide: 1 },
    { k: "cap", l: "Ground", r: 1, v: r => r.c.cap, f: r => r.c.cap.toLocaleString() },
    { k: "sup", l: "Support", r: 1, v: r => r.c.support, f: r => `<span class="rt ${aCls(r.c.support)}">${r.c.support}</span>` },
    { k: "own", l: "Owner", v: r => OWN_ORDER[r.c.owner], f: r => OWNER[r.c.owner].l, hide: 1 },  // shown under the region
    { k: "exp", l: "Board target", v: r => -r.exp, f: r => expText(r.exp, key) },
    { k: "go", l: "", f: r => `<button class="btn sm" data-a="choose" data-v="${r.c.id}">Manage</button>` },
  ];
  const st = UI.sort.start || { k: "lvl", d: -1 }, sc = cols.find(x => x.k === st.k) || cols[2];
  rows.sort((a, b) => { const x = sc.v(a), y = sc.v(b); return (x < y ? -1 : x > y ? 1 : 0) * st.d || b.lvl - a.lvl; });
  const SORT_HELP = { fin: ["healthiest first", "most stretched first"], exp: ["highest target first", "lowest target first"], own: ["biggest spenders first", "most prudent first"], sty: ["most attacking first", "most defensive first"], n: ["Z to A", "A to Z"], reg: ["Z to A", "A to Z"], co: ["Z to A", "A to Z"] };
  const dirWord = (k, d) => (SORT_HELP[k] || ["highest first", "lowest first"])[d > 0 ? 1 : 0];
  const sortBar = `<div class="row small" style="margin-bottom:10px;gap:8px"><label class="row">Sort by <select data-c="startsort" aria-label="Sort clubs by">${cols.filter(x => x.v).map(x => `<option value="${x.k}" ${x.k === sc.k ? "selected" : ""}>${x.l}</option>`).join("")}</select></label>
      <button class="btn sm" data-a="sort" data-v="start|${sc.k}" title="Reverse the order">${dirWord(sc.k, st.d)} ⇅</button></div>`;
  const html = `<div class="wrap gut"><section class="hero"><div class="eyebrow">Seven English divisions · 164 clubs · seven foreign countries with three divisions each</div>
    <h1>Touchline <span>Manager</span></h1>
    <p>Take any club in the English pyramid, from the Premier Division down to the National Division North and South. Win promotion, survive the cost rules, recruit fifteen-year-olds against academies across Europe, and keep the board on side for fifty seasons.</p></section>
    <div class="card"><div class="card-h"><h2>Choose your club</h2>
      ${SAVES.list.length ? `<button class="lnk small" data-a="tolanding">← Your careers</button>` : ""}
      <label class="row small">Division <select id="start-lg" data-c="startl">${lgOpts(key, ENG_LGS)}</select></label></div>
      <p class="small muted" style="margin-bottom:10px">${leagueRules(key)}</p>
      ${sortBar}
      <div class="pick-cards only-narrow">${rows.map(r => { const c = r.c, h = r.fin; return `<div class="pick-card" style="--c:${c.color}">
        <div class="row between"><span class="club-in">${crest(c, 26)} <span><b>${esc(c.name)}</b><br><span class="tiny muted">${esc(c.region)} · ${OWNER[c.owner].l}</span></span></span><button class="btn sm" data-a="choose" data-v="${c.id}">Manage</button></div>
        <dl class="pick-stats"><div><dt>Squad</dt><dd>${r20(r.lvl).toFixed(1)}</dd></div><div><dt>Prestige</dt><dd>${c.rep}</dd></div><div><dt>Youth dev</dt><dd><b class="rt ${aCls(c.academy)}">${c.academy}</b></dd></div>
          <div><dt>Ground</dt><dd>${c.cap.toLocaleString()}</dd></div><div><dt>Support</dt><dd><span class="rt ${aCls(c.support)}">${c.support}</span></dd></div><div><dt>Coach</dt><dd class="tiny">${esc(ARCH[c.coach.arch].l)}</dd></div><div><dt>Style</dt><dd class="tiny">${MENT[r.sty].l}</dd></div></dl>
        <p class="small"><b class="${h.cls}">${h.label}</b> <span class="tiny muted">· ${money(c.cash)} cash · ${money(r.inc)} a year</span></p>
        <p class="small">Board target: <b>${expText(r.exp, key)}</b></p></div>`; }).join("")}</div>
      <div class="only-wide">${table("start", cols.filter(x => !x.hide), rows, { sort: st })}</div>
      <p class="small muted" style="margin-top:10px"><b>Youth dev</b> is the academy's rating out of 20: it sets how good each summer's graduates can become and helps attract young prospects. <b>Finances</b> compare the wage bill and transfer costs with annual income: <span class="good">Healthy</span> under 75%, <span class="ok">Comfortable</span> under 85%, <span class="warn">Stretched</span> up to 100%, <span class="bad">Over the limit</span> above that, where the cost rules start to bite.</p>
      <p class="small muted" style="margin-top:6px">All clubs and players are fictional. Your career saves in this browser; export a save file from the History page to keep a backup. Version ${APP_VERSION}.</p></div></div>`;
  S = keep; return html;
}
/* A club's finances at a glance: squad costs (wages plus transfer amortisation) against annual income. */
function sponsorCard(c) {
  const row = d => { const mkt = sponsorMarket(c, d.kind); return `<div style="padding:8px 0;border-top:1px solid var(--line)"><div class="row between"><span><b>${esc(d.name)}</b> <span class="tiny muted">${d.kind === "kit" ? "kit supplier" : "shirt sponsor"} · ${DEAL_STYLE[d.style].l.toLowerCase()}</span></span><b class="num">${money(d.amt)}/yr</b></div>
    <div class="tiny muted">${d.yrs} season${d.yrs === 1 ? "" : "s"} left · bonuses: title ${money(d.bonus.title)}, promotion ${money(d.bonus.up)}, Europe ${money(d.bonus.europe)}, cup ${money(d.bonus.cup)} · market value now ~${money(mkt)}/yr <span class="${mkt > d.amt * 1.05 ? "good" : mkt < d.amt * .95 ? "warn" : ""}">(${mkt >= d.amt ? "+" : ""}${pct(mkt / d.amt - 1)})</span></div></div>`; };
  return `<section class="card"><div class="card-h"><h2>Sponsorship</h2><span class="small num">${money(sponsorTotal(c))} a year</span></div>${(c.deals || []).map(row).join("")}
    <p class="tiny muted" style="margin-top:6px">What sponsors will pay grows with your prestige, fan engagement, recent trophies and European football. When a deal ends you choose between a long secure deal, a short one at a higher rate, or a performance deal with big bonuses. Promotion lifts current deals by 20%; relegation cuts them by 25%.</p></section>`;
}
function stadiumCard(c) {
  const avg = c.att[1] ? Math.round(c.att[0] / c.att[1]) : (c.lastAtt || 0), full = c.cap ? avg / capacityNow(c) : 0, [fw, fk] = fanWord(c.fans);
  const prices = [.6, .7, .8, .9, 1, 1.1, 1.2, 1.35, 1.5, 1.6];
  const fc = ticketForecast(c, c.tkt || 1), cf = UI.confirmBuild;
  const b = c.build;
  const log = (c.fanLog || []).slice(0, 4);
  return `<section class="card"><div class="card-h"><h2>Stadium & supporters</h2></div>
    <dl class="facts"><div><dt>Capacity</dt><dd class="num">${c.cap.toLocaleString()}</dd></div><div><dt>Average crowd</dt><dd class="num">${avg ? avg.toLocaleString() : "—"} <span class="tiny muted">${avg ? pct(full) + " full" : ""}</span></dd></div>
      <div><dt>Demand</dt><dd class="num">~${(Math.round(demandOf(c) / 100) * 100).toLocaleString()}</dd></div><div><dt>Support base</dt><dd><span class="rt ${aCls(c.support)}">${c.support}</span> <span class="tiny muted">/ 20</span></dd></div></dl>
    <div style="margin-top:10px"><div class="attr"><span><b>Fan engagement</b> <span class="${fk}">${fw}</span></span><span class="abar"><i style="left:0;width:${c.fans}%" class="${aCls(c.fans / 5)}"></i></span><b class="num">${Math.round(c.fans)}</b></div>
      <p class="tiny muted" style="margin-top:4px">Engagement drifts toward a level set by your support base and league position, and moves with results, derbies, ticket prices, full grounds, the season as a whole and changes of owner. Higher engagement fills more seats.${log.length ? " Recent: " + log.map(l => `${esc(l.why)} ${l.d > 0 ? "+" : ""}${l.d}`).join(" · ") + "." : ""}</p></div>
    <label class="row small" style="margin-top:10px">Ticket price <select id="ticket" data-c="ticket">${prices.map(m => `<option value="${m}" ${Math.abs((c.tkt || 1) - m) < .01 ? "selected" : ""}>€${(c.price * m).toFixed(0)}${m === 1 ? " (standard)" : ` (${m > 1 ? "+" : ""}${Math.round((m - 1) * 100)}%)`}</option>`).join("")}</select></label>
    <p class="tiny muted">At this price: about ${fc.att.toLocaleString()} a game and ${money(fc.income)} in ticket income. Dearer tickets earn more per seat but sell fewer and cost goodwill every home game; cheaper ones fill the ground and lift engagement.</p>
    <div style="margin-top:10px">${b ? `<p class="small"><b>${esc(b.label)}</b>: +${b.add.toLocaleString()} seats, ${seasonsText(b.left)} left (${b.left} of ${b.weeks} match weeks). ${money(b.perWeek)} a week comes out of your cash until it's done (${money(b.paid)} of ${money(b.cost)} paid). ${b.kind === "new" ? "You play at the old ground until the new one opens." : "Capacity is reduced while work goes on."}</p>`
      : cf ? (() => { const q = expansionQuote(c, cf); return `<p class="small">${esc(q.label)}: +${q.add.toLocaleString()} seats for ${money(q.cost)}, taking ${seasonsText(q.weeks)} (${money(q.perWeek)} a week out of cash for ${q.weeks} match weeks). ${q.kind === "new" ? "You keep playing at the old ground until it opens." : "Capacity drops 8% while work goes on."} Start now?</p><div class="row"><button class="btn sm primary" data-a="build" data-v="${cf}">Start building</button><button class="btn sm" data-a="buildcancel">Cancel</button></div>`; })()
      : `<p class="small" style="margin-bottom:6px">Expand the ground. ${demandOf(c) > c.cap ? "Demand is above capacity, so new seats should sell." : "Demand is below capacity right now, so new seats would mostly sit empty."}</p><div class="row">${EXPANSIONS.map(([k, l]) => { const q = expansionQuote(c, k); return `<button class="btn sm" data-a="buildask" data-v="${k}" title="${money(q.cost)}, ${seasonsText(q.weeks)}">${l} (+${q.add.toLocaleString()}, ${seasonsText(q.weeks).replace("about ", "~")})</button>`; }).join("")}</div>`}</div></section>`;
}
function finHealth(c) {
  const ratio = squadCost(c) / Math.max(1, annualIncome(c));
  const [label, cls] = ratio < .75 ? ["Healthy", "good"] : ratio < .85 ? ["Comfortable", "ok"] : ratio <= 1 ? ["Stretched", "warn"] : ["Over the limit", "bad"];
  return { ratio, label, cls };
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
/* Home: academy places, and this year's graduate pool while it's waiting on you. */
function academyHomeCard(c) {
  const n = acadCount(c), it = S.intake, left = INTAKE_DEADLINE - S.summerDay;
  return `<section class="card"><div class="card-h"><h2>Academy</h2><button class="lnk small" data-a="go" data-v="academy">Academy page</button></div>
    <p>Places used <b class="num ${n >= ACAD_CAP ? "warn" : ""}">${n}/${ACAD_CAP}</b>${n >= ACAD_CAP ? ' <span class="small warn">full: promote or release to make room</span>' : ` <span class="small muted">· ${ACAD_CAP - n} free</span>`}</p>
    ${it ? `<p class="small" style="margin-top:6px"><b>Graduate intake:</b> ${it.ids.length} waiting, <b>${it.pick.length}</b> ticked (up to ${intakeRoom()}). Choose by the end of preseason week ${INTAKE_DEADLINE} (${left <= 1 ? "this week" : `${left} weeks left`}); anyone not ticked is released.</p>` : ""}</section>`;
}
function viewHome() {
  const c = me(), parts = [];
  for (const m of openDecisions()) parts.push(`<section class="decision"><div class="eyebrow">Decision needed · ${m.w}</div><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p><div class="row">${m.opts.map(([k, l], i) => `<button class="btn ${i === 0 ? "primary" : ""}" data-a="decide" data-v="${m.id}|${k}">${l}</button>`).join("")}</div></section>`);
  if (S.phase === "summer" && S.seasonOver && !S.seasonOverSeen) parts.push(seasonReview());
  if (S.phase === "season") { if (CAL.jan.includes(S.week)) parts.push(janCard()); parts.push(nextMatchCard());
    // The fixtures after the next match (that one has its own card above).
    const up = upcomingFixtures(6).slice(1);
    if (up.length) parts.push(`<section class="card"><div class="card-h"><h2>Coming up</h2><button class="lnk small" data-a="go" data-v="fixtures">All fixtures</button></div>${up.map(upcomingRow).join("")}</section>`);
  } else parts.push(summerCard());
  const recent = (S.myRes || []).slice(-6).reverse();
  if (recent.length) parts.push(`<section class="card"><div class="card-h"><h2>Recent results</h2><button class="lnk small" data-a="go" data-v="fixtures">All fixtures</button></div>${recent.map(resultRow).join("")}</section>`);
  const L = S.leagues[c.lg], t = standings(L), i = t.findIndex(r => r.id === c.id), lo = clamp(i - 3, 0, t.length - 7);
  const side = `<section class="card"><div class="card-h"><h2>${leagueName(L.key)}</h2><button class="lnk small" data-a="go" data-v="league">Full table</button></div>
      ${miniTable(L, t.slice(lo, lo + 7), lo)}</section>
    ${rivalsCard()}
    ${academyHomeCard(c)}
    <section class="card"><div class="card-h"><h2>Board</h2><span class="num">${S.board}/100</span></div><p>Target: <b>${expText(S.expPos, c.lg)}</b> (${ord(S.expPos)} or better).</p><p class="small muted" style="margin-top:6px">Each league result is judged against what the board expected from that fixture. Relegation, cost-rule breaches and early cup exits to weaker sides hurt. ${S.set.unsackable ? "Unsackable mode is on, so you keep your job whatever happens." : "At zero you are dismissed."}</p></section>
    <section class="card"><div class="card-h"><h2>News</h2><button class="lnk small" data-a="go" data-v="news">All news</button></div><ul class="news">${S.news.slice(0, 10).map(newsItem).join("")}</ul></section>`;
  return `<div class="grid2"><div class="stack">${parts.join("")}</div><div class="stack">${side}</div></div>`;
}
function rivalsCard() {
  const c = me(), ids = Object.keys(c.rivals || {}).map(Number).filter(id => !C(id).gone).sort((a, b) => rivalry(S.club, b) - rivalry(S.club, a));
  if (!ids.length) return "";
  return `<section class="card"><div class="card-h"><h2>Rivals</h2></div>${ids.map(id => { const o = C(id), n = rivalry(S.club, id); return `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span>${clubA(id)} <span class="chip rival r${n}">${RIVAL_WORD[n]}</span><br><span class="tiny muted">${leagueName(o.lg)}${o.lg === c.lg && S.phase === "season" ? " · " + ord(posIn(S.leagues[o.lg], id)) : ""}</span></span><span class="num small">${recStr(h2hOf(c, id))}</span></div>`; }).join("")}<p class="tiny muted" style="margin-top:6px">Head-to-head in all competitions since this save began. Derby results move the board, the fans and the dressing room more than other games. Rival clubs charge you more and won't sell to a fierce rival at all.</p></section>`;
}
const newsItem = n => `<li class="${n.hi ? "hi" : ""}">${esc(n.t)}<small>${seasonLabel(n.y)} · ${n.w}</small></li>`;
function resultRow(r) {
  const mine = r.h === S.club ? r.hg : r.ag, th = r.h === S.club ? r.ag : r.hg;
  let x = mine > th ? "W" : mine < th ? "L" : "D"; if (r.pens) { const mp = r.h === S.club ? r.pens[0] : r.pens[1], tp = r.h === S.club ? r.pens[1] : r.pens[0]; x = mp > tp ? "W" : "L"; }
  return `<div class="res ct ct-${compType(r)}"><span class="h">${clubA(r.h, { flag: 1 })}</span><span class="sc">${r.hg}–${r.ag}${r.et ? " aet" : ""}</span><span>${clubA(r.a, { flag: 1 })}</span>
    <span class="tiny muted" style="grid-column:1/-1;text-align:center"><span class="form"><i class="${x}">${x}</i></span>${rivalry(r.h, r.a) ? ` <b>${rivalry(r.h, r.a) >= 2 ? "Derby" : "Rivalry"}</b> ·` : ""} ${r.ord != null ? dayName(r.ord, true) + " · " : ""}${esc(r.label)}${r.pens ? ` · ${r.pens[0]}–${r.pens[1]} pens` : ""}${r.sc.length ? " · " + r.sc.map(([s, n, m]) => `${esc(n)} ${m}′`).join(", ") : ""}${r.att ? ` · crowd ${r.att.toLocaleString()}` : ""}</span></div>`;
}
function miniTable(L, rows, offset) {
  return `<div class="tbl-wrap"><table><thead><tr><th class="r">#</th><th>Club</th><th class="r">P</th><th class="r">GD</th><th class="r">Pts</th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.id === S.club ? "me" : ""} ${zoneCls(L.key, offset + i + 1)}"><td class="r num">${offset + i + 1}</td><td>${clubA(r.id)}${rivalChip(r.id)}${r.ded ? ` <span class="chip req" title="Points deducted">−${r.ded}</span>` : ""}</td><td class="r num">${r.p}</td><td class="r num">${r.gf - r.ga > 0 ? "+" : ""}${r.gf - r.ga}</td><td class="r num"><b>${r.pts}</b></td></tr>`).join("")}</tbody></table></div>`;
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
/* Your XI and bench for the next match, on the match card: drop a sub with ×, add one from the menu. */
function matchSquadHtml(c) {
  const sl = slotsOf(S.formation), xi = S.lineup.map((id, i) => id == null ? null : { p: P(id), slot: sl[i] }).filter(Boolean), bench = benchFor(c, S.lineup).map(P), mine = new Set(S.bench || []);
  const pool = eligibleIds(c).map(P).filter(p => avail(p) && !S.lineup.includes(p.id) && !bench.includes(p)).sort((a, b) => ROLE_ORDER[a.pos] - ROLE_ORDER[b.pos] || b.ovr - a.ovr);
  return `<div class="msq"><div><span class="eyebrow">Starting XI</span> <button class="lnk tiny" data-a="go" data-v="tactics">change</button> <button class="lnk tiny" data-a="freshpick">pick fresh XI</button>${S.set.rotate ? ' <span class="tiny muted">· rotating automatically</span>' : ""}<div class="msq-list">${xi.map(o => `<span class="msq-p"><span class="pos">${o.slot}</span> ${esc(sur(o.p))}</span>`).join("")}</div></div>
    <div><span class="eyebrow">Bench (${bench.length})</span><div class="msq-list">${bench.map(p => `<span class="msq-p ${mine.has(p.id) ? "" : "auto"}" title="${mine.has(p.id) ? "Your pick" : "Filled automatically"}"><span class="pos">${p.pos}</span> ${esc(sur(p))}<button class="x" data-a="benchdrop" data-v="${p.id}" aria-label="Drop ${esc(p.name)} from the bench">×</button></span>`).join("")}</div>
      <div class="row" style="margin-top:6px;gap:4px 12px;flex-wrap:wrap"><label class="row tiny" style="gap:6px"><input type="checkbox" data-c="benchgk" ${S.set.benchGK !== false ? "checked" : ""}> Always include a substitute goalkeeper</label>${S.set.benchGK === false && !benchFor(me(), S.lineup).some(id => P(id).pos === "GK") ? '<span class="tiny warn">No keeper on the bench: if yours is injured or sent off, an outfielder goes in goal.</span>' : ""}</div>
      ${pool.length ? `<label class="row small" style="margin-top:6px">Add a sub <select data-c="benchadd"><option value="">Choose a player…</option>${pool.map(p => `<option value="${p.id}">${p.pos} · ${esc(p.name)} · ${Math.round(r20(p.ovr))} · fit ${Math.round(p.fit)}</option>`).join("")}</select></label>` : ""}</div></div>`;
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
  // Each club's league standing: position, points, goals for and against (last season's finish before a ball is kicked).
  const standLine = T => { const rows = standings(S.leagues[T.lg]), i = rows.findIndex(x => x.id === T.id), r = rows[i];
    if (S.phase === "season" && r && r.p > 0) return `<span class="stand"><span><b>${ord(i + 1)}</b> · ${r.pts} pts</span><span class="muted">GF ${r.gf} · GA ${r.ga}</span></span>`;
    const last = S.lastPos[T.id]; return `<span class="stand muted">${last ? `Last season: ${ord(last)}` : "No league games yet"}</span>`; };
  const team = T => `<div class="team">${crest(T, 46)}<b>${esc(T.name)}</b><span class="tiny muted">${T.country !== HOME ? COUNTRY[T.country].name + " · " : ""}${leagueName(T.lg)}</span>${standLine(T)}${formChips(formOf(T.id))}</div>`;
  return `<section class="card ct ct-${compType(fx)}" style="--club:${c.color}"><div class="card-h"><h2>Next match</h2><span class="eyebrow">${esc(compLabel(fx))} · ${dayName(nx.day.ord)} · Week ${nx.day.w + 1}${fx.neutral ? " · Neutral venue" : fx.h === S.club ? " · Home" : " · Away"}</span></div>
    ${rivalry(S.club, opp.id) ? `<p class="derby"><span class="chip rival r${rivalry(S.club, opp.id)}">${RIVAL_WORD[rivalry(S.club, opp.id)].toUpperCase()}</span> ${esc(rivalName(S.club, opp.id).replace(/^the /, "The "))} · your record ${recStr(h2hOf(c, opp.id))}. Win and the board, the fans and the dressing room will love it; lose and they won't forget.</p>` : ""}
    ${fx.ko ? `<p class="small muted" style="text-align:center">First leg: ${C(fx.a).short} ${fx.ko.aggA}–${fx.ko.aggH} ${C(fx.h).short}</p>` : ""}
    <div class="fixture">${team(H)}<div class="vs">v</div>${team(A)}</div>
    ${(() => { // left and right follow the fixture above: home club on the left (it was always your XI on the left, even away)
      const meL = fx.h === S.club, L = meL ? mr : orr, Rr = meL ? orr : mr;
      const mine = `<span>Your XI · ${ARCH[S.me.arch].l}</span>`, theirs = `<span>${esc(opp.short)}'s likely XI · ${esc(coachOf(opp).name)}, ${ARCH[coachOf(opp).arch].l.toLowerCase()}</span>`;
      return `<div class="cmp-labels small muted">${meL ? mine + theirs : theirs + mine}</div>
    <div class="cmp${meL ? "" : " away"}">${cmp("Attack", L.att, Rr.att)}${cmp("Midfield", L.mid, Rr.mid)}${cmp("Defence", L.def, Rr.def)}</div>`; })()}
    <p class="tiny muted" style="margin:4px 0 10px">Team strength out of 20 from each XI's ratings in position, fitness, style and coach. Midfield decides who has the ball; your Attack against their Defence decides how good your chances are, and theirs against yours how good theirs are. Home advantage (about 3.5%) isn't included.</p>
    <div class="row between" style="margin-bottom:10px"><label class="row small">Formation <select id="nx-form" data-c="form">${formOpts(S.formation)}</select></label>
      <label class="row small">Tackling <select data-c="tackle" aria-label="Tackling">${Object.entries(TACKLE).map(([k, v]) => `<option value="${k}" ${(S.tackling || "normal") === k ? "selected" : ""}>${v.l}</option>`).join("")}</select></label>
      ${(() => { const on = userOn(); return INSTR.map(I => { const sel = I.set[S[I.s]] || I.set.normal, f = sel.keys ? instrFit(on, sel) : 0;
        // Shaded like the live Tactics tab: green when the chosen option suits this XI, red when it doesn't.
        return `<label class="row small">${I.h} <select class="${f >= .12 ? "fit-g" : f <= -.12 ? "fit-b" : ""}" data-c="instr" data-k="${I.s}" aria-label="${I.h}">${Object.entries(I.set).map(([k, v]) => `<option value="${k}" ${(S[I.s] || "normal") === k ? "selected" : ""}>${v.l}${v.keys ? " · " + fitWord(instrFit(on, v))[1].toLowerCase() : ""}</option>`).join("")}</select></label>`; }).join(""); })()}</div>
    <p class="tiny muted" style="margin:-4px 0 6px"><span class="fit-key fit-g"></span> the chosen instruction suits this XI <span class="fit-key fit-b"></span> it doesn't</p>
    <p class="small muted" style="margin:-4px 0 10px">${(() => { if (isUser(opp)) return ""; const u = clubForms(opp).usual, f = aiForm(opp, c, fx.h === opp.id && !fx.neutral); return f !== u ? `${esc(opp.short)} usually line up ${u}; expect a ${f} against you. ` : `${esc(opp.short)} line up ${u}. `; })()}${esc(opp.short)} usually play ${MENT[baseStyle(opp)].l.toLowerCase()}${aiStyle(opp, c, fx.h === opp.id && !fx.neutral) !== baseStyle(opp) ? `; expect ${MENT[aiStyle(opp, c, fx.h === opp.id && !fx.neutral)].l.toLowerCase()} against you` : ""}.</p>
    ${matchSquadHtml(c)}
    ${!reg.ok ? `<p class="bad small">Registration is invalid: ${reg.registered}/${RULES.squadMax} seniors registered, ${reg.nonHG}/${RULES.nonHGMax} non-homegrown, ${reg.eligible} eligible players (16 minimum). Fix it on the Squad page before you can play.</p>` : ""}
    ${tired ? `<p class="warn small">${tired} of your XI ${tired > 1 ? "are" : "is"} below 70 fitness.</p>` : ""}${oop ? `<p class="warn small">${oop} player${oop > 1 ? "s are" : " is"} out of position.</p>` : ""}
    <div class="row" style="margin-top:6px"><button class="btn primary" data-a="play" data-v="${nx.di === S.di ? "play" : "match"}">${nx.di === S.di ? (S.set.live ? "Kick off" : "Play match") : "Go to match day"}</button><button class="btn" data-a="go" data-v="tactics">Pick the team</button></div></section>`;
}
function previewRatings(c, opp, home) { const s = makeSide(c, opp, home, true); return sideRatings(s.on, s.ment, s.form, s.co, undefined, s); }
/* ---------- awards ---------- */
const AWARD_ROWS = [["poty", "Player of the Season", "avg"], ["ypoty", "Young Player of the Season", "avg"], ["top", "Golden Boot", "goals"], ["glove", "Golden Glove", "clean sheets"], ["assists", "Playmaker", "assists"]];
function awardWho(a) { return `${S.players[a[0]] ? playerA(S.players[a[0]]) : esc(a[1])}`; }
function awardsHtml(l, compact) {
  if (!l) return '<p class="muted small">No awards recorded.</p>';
  const mine = a => a && S.players[a[0]] && S.players[a[0]].club === S.club && !S.players[a[0]].loan;
  const rows = AWARD_ROWS.filter(([k]) => l[k]).map(([k, label, unit]) => { const a = l[k];
    return `<tr${mine(a) ? ' class="me"' : ""}><td class="small">${label}</td><td>${awardWho(a)} <span class="tiny muted">${esc(a[2])}</span></td><td class="r mono small">${a[3] != null ? a[3] + " " + unit : ""}</td></tr>`; });
  if (l.manager) rows.push(`<tr${l.manager[0] === S.club ? ' class="me"' : ""}><td class="small">Manager of the Season</td><td><b>${esc(l.manager[1])}</b> <span class="tiny muted">${clubA(l.manager[0])}</span></td><td class="r small muted">${esc(l.manager[3])}</td></tr>`);
  let out = `<div class="tbl-wrap"><table><tbody>${rows.join("") || '<tr><td class="muted">No awards recorded.</td></tr>'}</tbody></table></div>`;
  if (!compact && l.tots && l.tots.length) {
    const lines = [["Goalkeeper", ["GK"]], ["Defence", ["CB", "FB"]], ["Midfield", ["DM", "CM", "AM"]], ["Attack", ["W", "ST"]]];
    out += `<h3 style="margin:14px 0 6px">Team of the Season</h3><div class="tots">${lines.map(([n, roles]) => `<div class="tots-line"><span class="eyebrow">${n}</span>${l.tots.filter(t => roles.includes(t[3])).map(t => `<span class="tots-p${mine(t) ? " me" : ""}">${awardWho(t)} <span class="tiny muted">${t[3]} · ${esc(t[2])} · ${t[4]}</span></span>`).join("")}</div>`).join("")}</div>`;
  }
  return out;
}
function seasonReview() {
  const o = S.seasonOver, c = me();
  const tro = o.won.map(trophyName);
  return `<section class="card summary"><div class="eyebrow">${seasonLabel(S.year)} review</div>
    <div class="big" style="margin:8px 0 6px">${ord(o.pos)} in the ${leagueName(o.lg)}</div>
    <div class="prose"><p>The board's target was ${expText(o.exp, o.lg).toLowerCase()} (${ord(o.exp)}). ${tro.length ? `Trophies: <b>${tro.join(", ")}</b>.` : ""}</p>
    ${o.moved === "up" ? `<p class="good"><b>Promoted!</b> Next season you play in the ${leagueName(o.to)}. Income rises sharply.</p>` : o.moved === "down" ? `<p class="bad"><b>Relegated</b> to the ${leagueName(o.to)}. Income falls; relegation clauses cut some wages.</p>` : ""}
    <p>Board reaction: <b class="${o.board >= 0 ? "good" : "bad"}">${o.board >= 0 ? "+" : ""}${o.board}</b>. You earned <b>${o.earned || 1} coaching point${(o.earned || 1) > 1 ? "s" : ""}</b> to spend on the Manager page. ${S.qual.CC.includes(S.club) ? "You qualify for the Champions Cup." : S.qual.CS.includes(S.club) ? "You qualify for the Continental Shield." : S.qual.CT.includes(S.club) ? "You qualify for the Continental Trophy." : ""}</p>
    ${(() => { const h = S.history[0], l = h && h.L[o.lg]; if (!l) return ""; const yours = c.squad.map(P).flatMap(p => (p.awards || []).filter(a => a.endsWith(seasonLabel(h.year))).map(a => `${esc(p.name)}: ${esc(a.split(",")[0])}`));
      return `<h3 style="margin:10px 0 6px">${leagueName(o.lg)} awards</h3>${awardsHtml(l, true)}${yours.length ? `<p class="small good" style="margin-top:6px">Your honours: ${[...new Set(yours)].join("; ")}</p>` : ""}`; })()}
    <p class="small muted">Over the summer players aged a year, veterans retired, loans ended and your youth recruits joined the academy. Contracts that ran out have ended.</p></div>
    <div class="row" style="margin-top:12px"><button class="btn" data-a="seenreview">Got it</button><button class="btn" data-a="go" data-v="history">History</button></div></section>`;
}
// The mid-season window is the one chance to rethink the registered 25 before the summer.
function janCard() {
  const c = me(), reg = regInfo(c), last = S.week === CAL.jan[CAL.jan.length - 1];
  const out = c.squad.map(P).filter(p => isSenior(p) && !isReg(p, c) && !p.loan), sulky = out.filter(p => p.mood < 45);
  return `<section class="card"><div class="card-h"><h2>January transfer window</h2><span class="eyebrow">${last ? "Final week" : `Closes after week ${CAL.jan[CAL.jan.length - 1] + 1}`}</span></div>
    <div class="prose"><p>Buy, sell and loan players, and change your registered 25 for the rest of the season.</p>
    <p>Registered: <b>${reg.registered}/${RULES.squadMax}</b> seniors (${reg.nonHG}/${RULES.nonHGMax} non-homegrown), ${reg.u21} under-21s always eligible.${out.length ? ` Left out: ${out.map(p => playerA(p)).join(", ")}${sulky.length ? ` <span class="warn">(${sulky.length} unhappy about it)</span>` : ""}.` : ""}</p>
    ${!reg.ok ? `<p class="bad">Your registration is invalid. Fix it before the next match.</p>` : ""}
    ${last ? `<p class="warn">Registration locks when this week ends and stays locked until preseason.</p>` : ""}</div>
    <div class="row" style="margin-top:10px"><button class="btn" data-a="go" data-v="squad">Change registrations</button><button class="btn" data-a="go" data-v="transfers">Transfer market</button></div></section>`;
}
/* Preseason friendlies: this preseason's bookings and results, and the form to book one. */
function friendliesHtml() {
  const c = me(), list = (S.friendlies || []).slice().sort((a, b) => a.wk - b.wk), u = UI.fri || {};
  const openWks = []; for (let w = S.summerDay; w < CAL.summerDays; w++) if (!friendlyAt(w)) openWks.push(w);
  const wk = openWks.includes(u.wk) ? u.wk : openWks[0], home = u.home !== false, opts = friendlyOptions();
  const groups = {}; for (const o of opts) (groups[o.lg] ||= []).push(o);
  // "Most money first": what the friendly is expected to bring in at the chosen venue (home: gate less any
  // appearance fee you pay; away: the fee they pay you), so the list re-sorts when you switch Home/Away.
  const byMoney = u.sort === "money";
  const sel = opts.find(o => o.id === u.opp), est = sel ? friendlyMoney(c, sel, home) : null;
  const row = f => { const o = C(f.opp); return `<div class="need-row"><span><b>Week ${f.wk + 1}</b> · ${f.home ? "vs" : "at"} ${clubA(o.id)} <span class="tiny muted">${leagueName(o.lg)}${o.country !== c.country ? " · " + COUNTRY[o.country].name : ""}</span></span>
    ${f.played ? `<span class="small">${f.gf}–${f.ga} <span class="muted">· ${f.home ? `crowd ${f.att.toLocaleString()}, ` : ""}${f.net >= 0 ? "+" : ""}${money(f.net)}</span></span>` : `<span class="row" style="gap:6px"><span class="small muted">${f.wk === S.summerDay ? "this week" : "upcoming"}</span><button class="btn sm" data-a="fricancel" data-v="${f.wk}">Cancel</button></span>`}</div>`; };
  return `<div class="fri"><h3 style="margin:12px 0 6px">Friendlies</h3>
    ${list.length ? list.map(row).join("") : '<p class="small muted">None booked. A friendly gets minutes into legs, lets you try a formation or a new signing, and a home one brings in a gate.</p>'}
    ${openWks.length ? `<div class="fri-book row small"><label class="row">Week <select data-c="fri-wk">${openWks.map(w => `<option value="${w}" ${w === wk ? "selected" : ""}>${w + 1}${w === S.summerDay ? " (this week)" : ""}</option>`).join("")}</select></label>
      <label class="row">Venue <select data-c="fri-home"><option value="H" ${home ? "selected" : ""}>Home</option><option value="A" ${home ? "" : "selected"}>Away</option></select></label>
      <label class="row">Sort <select data-c="fri-sort"><option value="lg">By league</option><option value="money" ${byMoney ? "selected" : ""}>Most money first</option></select></label>
      <label class="row">Opponent <select data-c="fri-opp"><option value="">Choose a club…</option>${byMoney
        ? opts.map(o => [o, friendlyMoney(c, o, home).net]).sort((a, b) => b[1] - a[1] || b[0].rep - a[0].rep).map(([o, net]) => `<option value="${o.id}" ${o.id === u.opp ? "selected" : ""}>${net >= 0 ? "+" : ""}${money(net)} · ${esc(o.name)} (${esc(leagueName(o.lg))})</option>`).join("")
        : Object.entries(groups).map(([k, os]) => `<optgroup label="${esc((LG[k].foreign ? COUNTRY[LG[k].c].name + ": " : "") + leagueName(k))}">${os.sort((a, b) => b.rep - a.rep).map(o => `<option value="${o.id}" ${o.id === u.opp ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</optgroup>`).join("")}</select></label>
      <button class="btn sm primary" data-a="friask">Ask them</button></div>
      ${est ? `<p class="tiny muted" style="margin-top:4px">${home ? `Expected crowd about ${est.att.toLocaleString()} at friendly prices: gate ~${money(est.gate)}${est.fee ? `, less a ${money(-est.fee)} appearance fee (they're the bigger club)` : ""}.` : est.fee ? `They pay you an appearance fee of about ${money(est.fee)}.` : "No fee: they're no bigger than you."}${sel.rep > c.rep + 12 && home ? " A club this much bigger may not want to visit." : ""}</p>` : ""}` : '<p class="small muted">No weeks left to book.</p>'}</div>`;
}
function summerCard() {
  const c = me(), reg = regInfo(c), newKids = c.squad.map(P).filter(p => p.age === 16), gks = c.squad.filter(id => P(id).pos === "GK").length;
  const left = CAL.summerDays - S.summerDay;
  return `<section class="card"><div class="card-h"><h2>Preseason</h2><span class="eyebrow">Week ${S.summerDay + 1} of ${CAL.summerDays} · window open</span></div>
    <div class="prose"><p>${S.firstPre ? "Your first preseason: get to know the squad, and buy, sell and loan before the opening game." : "Buy, sell, loan and renew contracts before the new season."} Each week AI clubs do business of their own, and training brings everyone up to full fitness. The season starts in ${left} week${left === 1 ? "" : "s"}.</p>
    <p>Registration for next season: <b>${reg.registered}/${RULES.squadMax}</b> seniors registered (${reg.nonHG}/${RULES.nonHGMax} non-homegrown), ${reg.unregistered ? `<b class="warn">${reg.unregistered} left out</b>, ` : ""}${reg.u21} under-21s. Choose who's registered on the Squad page; it locks when the window closes.</p>
    ${reg.total < 20 || gks < 2 ? `<p class="bad">Your squad is thin: ${reg.total} players, ${gks} goalkeeper${gks === 1 ? "" : "s"}. Free agents cost no fee.</p>` : ""}
    ${friendliesHtml()}
    ${newKids.length ? `<p>New in the academy: ${newKids.map(p => playerA(p) + ` <span class="muted small">${p.pos}</span>`).join(", ")}.</p>` : ""}</div>
    <div class="row" style="margin-top:10px"><button class="btn" data-a="go" data-v="transfers">Transfer market</button><button class="btn" data-a="go" data-v="squad">Contracts and loans</button><button class="btn primary" data-a="play" data-v="newseason">Start the season</button></div></section>`;
}

/* ---------- squad ---------- */
/* Team needs, outside its own page. Squad: a summary (biggest needs, strong roles, the XI's stand-out and
   short-on attributes, best style) linking to the Team Needs tab. Transfers: the roles to fix. Both use
   teamNeeds() for positions, so they always agree with the tab. */
function bestStyleLine() {
  // Your side has no style of play: the instructions that suit this XI best, one per axis.
  const on = userOn(), best = INSTR.map(I => Object.values(I.set).filter(t => t.keys).map(t => [t, instrFit(on, t)]).sort((a, b) => b[1] - a[1])[0]).filter(([, f]) => f >= .12).sort((a, b) => b[1] - a[1]);
  return best.length ? best.map(([t, f]) => `${t.l} <span class="small muted">(${fitWord(f)[1].toLowerCase()})</span>`).join(", ") : "none stands out, so Neutral is the safe choice";
}
function needsCard(compact) {
  const c = me(), N = teamNeeds(), pri = N.filter(n => n.status[1] !== "good"), strong = N.filter(n => n.status[1] === "good");
  if (compact) return `<section class="card"><div class="card-h"><h2>Your needs</h2><button class="lnk small" data-a="go" data-v="needs">Team Needs</button></div>
    ${pri.length ? pri.map(n => `<div class="need-row"><span><span class="chip need-chip ${n.status[1]}"><span>${n.role}</span> ${n.status[0]}</span> <span class="small muted">weakest starter ${n.weakest.toFixed(1)}, top-four standard ${n.topStd.toFixed(1)}</span></span><span class="row" style="gap:6px"><button class="btn sm" data-a="go" data-v="needs">Upgrades</button><button class="btn sm" data-a="needfind" data-v="${n.role}">Search</button></span></div>`).join("") : `<p class="small muted">Every role in your ${S.formation} matches the strongest teams in the ${leagueName(c.lg)}, with cover.</p>`}</section>`;
  const X = xiProfile(c), list = a => a.length ? a.join(", ") : "none stand out";
  return `<section class="card"><div class="card-h"><h2>Team needs</h2><button class="btn sm" data-a="go" data-v="needs">Full breakdown and upgrades</button></div>
    <div class="need-overview"><p><b class="bad">Needs:</b> ${pri.length ? pri.slice(0, 4).map(n => `<span class="chip need-chip ${n.status[1]}"><span>${n.role}</span> ${n.status[0]}</span>`).join(" ") : "none: every role matches the division's top four"}</p>
      <p><b class="good">Strong:</b> ${list(strong.map(n => ROLE_NAME[n.role]))}${X.standout.length ? `; stand-out ${X.standout.map(a => a.l.toLowerCase()).join(" and ")}` : ""}</p>
      ${X.lacking.length ? `<p><b class="warn">Short on:</b> ${X.lacking.map(a => a.l.toLowerCase()).join(" and ")}</p>` : ""}
      <p><b>Instructions that suit this XI:</b> ${bestStyleLine()}.</p></div></section>`;
}
// The XI's attribute profile, for the Team Needs page.
function needsAttrCard() {
  const c = me(), X = xiProfile(c), lgN = leagueName(c.lg), f1 = v => { const t = (Math.abs(v) < .05 ? 0 : v).toFixed(1); return (t[0] === "-" ? "" : "+") + t; };
  return `<section class="card"><div class="card-h"><h2>Your best XI's attributes</h2><span class="small muted">against the ${lgN} average XI</span></div>
    <div class="need-overview"><p>${X.standout.length ? `Stand-out: <b class="good">${X.standout.map(a => a.l.toLowerCase()).join(" and ")}</b>. ` : ""}${X.lacking.length ? `Short on: <b class="bad">${X.lacking.map(a => a.l.toLowerCase()).join(" and ")}</b>. ` : ""}Overall ${Math.abs(X.mean) < .3 ? "about level with" : `${Math.abs(X.mean).toFixed(1)} ${X.mean > 0 ? "above" : "below"}`} the division average.</p>
      <p><b>Instructions that suit this XI:</b> ${bestStyleLine()}.</p></div>
    <div class="need-attrs" style="margin-top:8px">${X.attrs.map(a => { const w = Math.min(50, Math.abs(a.diff) / 3 * 50); return `<div class="need-attr"><span>${a.l}</span><span class="dbar"><i class="${a.diff >= 0 ? "pos" : "neg"}" style="${a.diff >= 0 ? "left:50%" : `left:${50 - w}%`};width:${w}%"></i></span><b class="num ${a.rel >= .4 ? "good" : a.rel <= -.4 ? "bad" : ""}">${a.v.toFixed(1)} <span class="tiny muted">(${f1(a.diff)})</span></b></div>`; }).join("")}</div>
    <p class="hint" style="margin-top:8px">Bars compare your XI with the division's average XI; stand-out and short-on are measured against the rest of your own side.</p></section>`;
}
function viewSquad() {
  const c = me(), reg = regInfo(c), acadN = c.squad.filter(id => P(id).acad).length;
  let ps = c.squad.map(P).filter(p => !p.acad);  // academy players have their own page
  if (UI.sqf === "SEN") ps = ps.filter(isSenior); if (UI.sqf === "U21") ps = ps.filter(p => !isSenior(p));
  const xi = new Set(S.lineup), out = Object.values(S.players).filter(p => p.loan && p.loan.from === c.id);
  const cols = [
    { k: "n", l: "Name", v: p => p.name, f: p => `${playerA(p)} ${statusChips(p, c)}` },
    { k: "pos", l: "Pos", v: p => ROLE_ORDER[p.pos], f: p => `<span class="pos">${p.pos}</span>${xi.has(p.id) ? ' <span class="chip xi">XI</span>' : ""}` },
    // What you judge a player on comes first, next to his name: on a phone the rest is a sideways scroll away.
    { k: "ovr", l: "Rating", r: 1, v: p => ratingSort(p), f: p => ratingHtml(p) },
    { k: "pot", l: "Potential", r: 1, v: p => viewMid(potView(p)), f: p => potHtml(p) },
    { k: "atk", l: "Attack", r: 1, v: p => groupAvg(p, "atk") ?? -1, f: p => groupHtml(p, "atk") },
    { k: "dfn", l: "Defence", r: 1, v: p => groupAvg(p, "dfn") ?? -1, f: p => groupHtml(p, "dfn") },
    ...ATTR_GROUPS.out.phy.map(a => ({ k: a, l: ATTR_NAME[a], r: 1, v: p => p.pos === "GK" ? -1 : viewMid(attrView(p, a)), f: p => attrCell(p, a) })),
    // Money next to ability, at every width: value, weekly wage and years left.
    { k: "val", l: "Value", r: 1, v: p => value(p), f: p => money(value(p)) },
    { k: "wage", l: "Wage /wk", r: 1, v: p => p.wage, f: p => perWeek(p.wage).replace("/wk", "") },
    { k: "yrs", l: "Contract", r: 1, v: p => p.yrs, f: p => p.loan ? '<span class="muted">loan</span>' : `<span class="${p.yrs <= 1 ? "warn" : ""}">${p.yrs} yr${p.yrs === 1 ? "" : "s"}</span>` },
    { k: "age", l: "Age", r: 1, v: p => p.age, f: p => p.age },
    { k: "reg", l: "Registration", v: p => isSenior(p) ? (isReg(p, c) ? 1 : 0) : 2, f: p => !isSenior(p) ? '<span class="tiny muted">Under-21</span>' : `<button class="btn sm ${isReg(p, c) ? "" : "danger"}" data-a="regtoggle" data-v="${p.id}" ${windowOpen() && !p.loan ? "" : "disabled"}>${isReg(p, c) ? "Registered" : "Not registered"}</button>` },
    { k: "nat", l: "Nat", v: p => p.nat, f: p => p.nat, cls: "hide-sm" },
    { k: "ir", l: "Injury risk", v: p => viewMid(injView(p)), f: p => injHtml(p), cls: "hide-sm" },
    { k: "att", l: "Attributes", f: p => attrStrip(p), cls: "hide-sm" },
    { k: "fit", l: "Fit", v: p => p.fit, f: p => fitBar(p.fit) },
    { k: "mood", l: "Mood", v: p => p.mood, f: p => moodTag(p) },
    { k: "app", l: "Apps", r: 1, v: p => p.s.app, f: p => p.s.app },
    { k: "g", l: "G", r: 1, v: p => p.s.g, f: p => p.s.g },
    { k: "a", l: "A", r: 1, v: p => p.s.a, f: p => p.s.a, cls: "hide-sm" },
    { k: "rt", l: "Avg rating", r: 1, v: p => p.s.app ? p.s.rt / p.s.app : 0, f: p => p.s.app ? `<span class="mr ${mrCls(p.s.rt / p.s.app)}">${(p.s.rt / p.s.app).toFixed(2)}</span>` : "—" },
    ...(S.set.sqAdv ? ADV_COLS : []),  // off by default: nine more columns made the squad page heavy
  ];
  return `<div class="stack">${needsCard(false)}<section class="card"><div class="card-h"><h2>Squad</h2>
    <span class="chips" role="group" aria-label="Filter">${[["ALL", "Everyone"], ["SEN", "Seniors (21+)"], ["U21", "Under-21"]].map(([k, l]) => `<button data-a="sqf" data-v="${k}" aria-pressed="${UI.sqf === k}">${l}</button>`).join("")}<button data-a="sqadv" aria-pressed="${!!S.set.sqAdv}" title="Shots, xG, G−xG, xG/90, key passes, xA, saves and clean sheets">Advanced stats</button></span></div>
    <div class="reg" style="margin-bottom:10px"><span>Registered seniors <b class="${reg.registered > RULES.squadMax ? "bad" : ""}">${reg.registered}/${RULES.squadMax}</b></span><span>Non-homegrown registered <b class="${reg.nonHG > RULES.nonHGMax ? "bad" : ""}">${reg.nonHG}/${RULES.nonHGMax}</b></span><span>Unregistered <b class="${reg.unregistered ? "warn" : ""}">${reg.unregistered}</b></span><span>Under-21s <b>${reg.u21}</b> (no limit)</span><span>Loans in <b>${reg.loansIn}/${RULES.loansIn}</b></span><span>Wage bill <b>${perWeek(sum(c.squad, id => P(id).wage))}</b></span></div>
    <div class="row" style="margin-bottom:10px">${windowOpen() ? `<button class="btn sm" data-a="regbest">Register my best 25</button><span class="small muted">Tap Registered / Not registered on a player to change it.</span>` : `<span class="small muted">Registration is locked until the transfer window opens (January, weeks 19–22, and the summer).</span>`}</div>
    ${acadN ? `<p class="small muted" style="margin:0 0 8px">${acadN} more in the academy, not listed here: <button class="lnk" data-a="go" data-v="academy">Academy</button>.</p>` : ""}
    ${table("squad", cols, ps, { sort: { k: "pos", d: 1 }, tall: true })}
    <p class="hint" style="margin-top:8px"><b>Attack</b> averages Finishing, Dribbling, Technique, Vision, Passing and Composure; <b>Defence</b> Tackling, Marking and Heading; Pace, Stamina and Strength are shown as they are. For keepers, Attack is distribution and Defence is shot-stopping.</p>
    <p class="hint" style="margin-top:6px">Squads can be any size, but only 25 seniors (21 and over, at most 17 not homegrown) can be registered; under-21s are always eligible. Unregistered players can't play, grow unhappy, may ask to leave, and several of them sulking unsettles the dressing room. Ratings are out of 20: 10 is average, 20 world class. Potential is your scouts' estimate, not a promise: it depends on minutes, form, happiness and your Development rating. Homegrown (HG) means three seasons at an English club before turning 21.</p></section>
    <section class="card"><div class="card-h"><h2>Out on loan</h2></div>${table("loanout", [{ k: "n", l: "Player", f: p => playerA(p) }, { k: "pos", l: "Pos", f: p => `<span class="pos">${p.pos}</span>` }, { k: "age", l: "Age", r: 1, f: p => p.age }, { k: "ovr", l: "Rating", r: 1, f: p => ratingHtml(p) }, { k: "c", l: "At", f: p => clubA(p.club, { flag: 1 }) }, { k: "app", l: "Apps", r: 1, f: p => p.s.app }, { k: "g", l: "Goals", r: 1, f: p => p.s.g }, { k: "pt", l: "Minutes", f: p => `<span class="bar"><i style="width:${p.pt * 100}%"></i></span>` }], out, { empty: "Nobody is out on loan. Young players develop faster when they play: loan them out from their profile during a window." })}</section></div>`;
}

/* ---------- team needs ---------- */
/* For each role in your shape: how your best XI compares with the strongest sides in your division,
   whether there's cover behind them, and who on the market would be a real upgrade. */
function bestAt(c, role, n, skip) {
  return c.squad.map(P).filter(p => !(skip && skip.has(p.id)) && !p.inj && FAM[p.pos][role] >= .62).map(p => ({ p, r: slotRating(p, role) })).sort((a, b) => b.r - a.r).slice(0, n);
}
function teamNeeds() {
  const c = me(), f = S.formation, sl = slotsOf(f), lg = S.leagues[c.lg];
  const others = lg.clubs.map(C).filter(x => x.id !== c.id && !x.gone).sort((a, b) => clubLevel(b) - clubLevel(a));
  // Judged on your best XI in this shape (ratings in position, ignoring fitness and form; injured players and the
  // academy left out), not the side you've picked: rotation or a youngster given a game used to read as a weakness.
  const best = bestXI(c);
  const top = others.slice(0, 4), xiIds = new Set(best.filter(id => id != null));
  const avgOf = (clubs, role, n) => sum(clubs, x => { const b = bestAt(x, role, n); return b.length ? sum(b, y => y.r) / b.length : 0; }) / Math.max(1, clubs.length);
  const out = [];
  for (const role of [...new Set(sl)].sort((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b])) {
    const n = roleSlots(f, role);
    // Starters: your best XI's players in those slots, filled from the squad if a slot is empty.
    let st = best.map((id, i) => id != null && sl[i] === role ? P(id) : null).filter(Boolean).map(p => ({ p, r: slotRating(p, role) }));
    if (st.length < n) st = st.concat(bestAt(c, role, n - st.length, new Set([...xiIds, ...st.map(s => s.p.id)])));
    st.sort((a, b) => b.r - a.r);
    const used = new Set([...xiIds, ...st.map(s => s.p.id)]);
    const weakest = st.length ? st[st.length - 1].r : 0, avg = st.length ? sum(st, s => s.r) / st.length : 0;
    const bench = bestAt(c, role, 4, used), coverNeed = Math.max(1, Math.ceil(n / 2));
    const cover = bench.filter(b => b.r >= weakest - 2.5), topStd = avgOf(top, role, n), lgStd = avgOf(others, role, n);
    const flags = [];
    if (st.length < n) flags.push(["Not enough players for this role", "bad"]);
    for (const s of st) {
      if (s.p.age >= 31) flags.push([`${s.p.name} is ${s.p.age}`, "warn"]);
      if (s.p.yrs <= 1 && !s.p.loan) flags.push([`${s.p.name}'s contract ends this season`, "warn"]);
      if (s.p.loan) flags.push([`${s.p.name} is only here on loan`, "warn"]);
      if (s.p.req) flags.push([`${s.p.name} wants to leave`, "bad"]);
      if (s.p.pos !== role && FAM[s.p.pos][role] < .9) flags.push([`${s.p.name} is playing out of position`, "warn"]);
    }
    if (cover.length < coverNeed) flags.push([cover.length ? "Thin cover behind the starters" : "No real cover if a starter is out", "warn"]);
    const gap = topStd - weakest;
    const score = Math.max(0, gap) * 1.6 + Math.max(0, lgStd - weakest) + (coverNeed - Math.min(cover.length, coverNeed)) * 1.2 + flags.filter(x => x[1] === "warn").length * .5 + flags.filter(x => x[1] === "bad").length * 2;
    const status = gap >= 2 || flags.some(x => x[1] === "bad") ? ["Upgrade needed", "bad"] : gap >= .8 ? ["Worth strengthening", "warn"] : cover.length < coverNeed ? ["Needs depth", "warn"] : ["Strong", "good"];
    out.push({ role, n, st, bench, cover, coverNeed, weakest, avg, topStd, lgStd, gap, flags, score, status });
  }
  return out.sort((a, b) => b.score - a.score);
}
function needTargets(role, floor, k = 3) {
  const c = me(), budget = c.cash / 1.05, picks = [];
  for (const p of Object.values(S.players)) {
    if (p.club === S.club || p.loan || p.age < 18 || p.age > 31 || FAM[p.pos][role] < .9 || p.retiring === 1) continue;
    const k = p.pos === role ? 1 : .97, rm = ratingMid(p) * k;
    if (ratingBlank(p) || ratingView(p)[0] * k < floor + 1) continue;  // even the cautious end of the estimate must be an upgrade
    const fee = p.club >= 0 ? askingPrice(p) : 0;
    if (fee > budget) continue;
    picks.push({ p, rm, fee });
  }
  picks.sort((a, b) => b.rm - a.rm || a.fee - b.fee);
  const res = [];
  for (const x of picks) { if (res.length >= k) break; const w = willingness(x.p, c); if (w < .45) continue; x.w = w; res.push(x); }
  return res;
}
function viewNeeds() {
  const c = me(), needs = teamNeeds(), open = windowOpen(), r1 = v => v.toFixed(1);
  const pri = needs.filter(n => n.status[1] !== "good");
  const lead = pri.length ? `Biggest need: <b>${ROLE_NAME[pri[0].role]}</b>${pri[1] ? `, then ${ROLE_NAME[pri[1].role].toLowerCase()}` : ""}${pri[2] ? ` and ${ROLE_NAME[pri[2].role].toLowerCase()}` : ""}.` : "Every role in your side matches the strongest teams in your division.";
  const scale = 20, pctOf = v => clamp(v / scale * 100, 0, 100);
  const card = (n, i) => {
    const showTargets = n.status[1] !== "good", t = showTargets ? needTargets(n.role, n.weakest) : [];
    return `<section class="card need ${n.status[1]}"><div class="card-h"><h2><span class="pos">${n.role}</span> ${ROLE_NAME[n.role]}${n.n > 1 ? ` <span class="small muted">× ${n.n}</span>` : ""}</h2><b class="${n.status[1]}">${i < 3 && n.status[1] !== "good" ? `#${i + 1} · ` : ""}${n.status[0]}</b></div>
      <div class="need-bars">
        <div><span class="small">Your weakest starter</span><span class="nbar"><i class="you" style="width:${pctOf(n.weakest)}%"></i><b class="tick" style="left:${pctOf(n.topStd)}%" title="Top-4 standard"></b></span><b class="num">${r1(n.weakest)}</b></div>
        <div><span class="small muted">Top-4 standard</span><span class="nbar"><i class="ref" style="width:${pctOf(n.topStd)}%"></i></span><b class="num">${r1(n.topStd)}</b></div>
        <div><span class="small muted">Division average</span><span class="nbar"><i class="ref lo" style="width:${pctOf(n.lgStd)}%"></i></span><b class="num">${r1(n.lgStd)}</b></div>
      </div>
      <p class="small" style="margin-top:8px"><b>Starting:</b> ${n.st.map(s => `${playerA(s.p)} <span class="num muted">${r1(s.r)}</span>`).join(", ") || '<span class="bad">nobody</span>'}<br>
        <b>Cover:</b> ${n.bench.length ? n.bench.slice(0, 3).map(s => `${playerA(s.p)} <span class="num ${n.cover.includes(s) ? "muted" : "bad"}">${r1(s.r)}</span>`).join(", ") : '<span class="bad">none</span>'}</p>
      ${n.flags.length ? `<ul class="need-flags">${n.flags.map(([t, k]) => `<li class="${k}">${esc(t)}</li>`).join("")}</ul>` : ""}
      ${showTargets ? `<div class="need-t"><div class="eyebrow">Upgrades you can afford who'd come</div>${t.length ? table("nt-" + n.role, [
        { k: "n", l: "Player", f: x => playerA(x.p) },
        { k: "age", l: "Age", r: 1, f: x => x.p.age },
        { k: "ovr", l: "Rating", r: 1, f: x => ratingHtml(x.p) },
        { k: "club", l: "Club", f: x => x.p.club >= 0 ? clubA(x.p.club, { short: true, flag: 1 }) : '<span class="muted">Free</span>' },
        { k: "ask", l: "Asking", r: 1, f: x => x.p.club >= 0 ? money(x.fee) : "Free" },
        { k: "w", l: "Interest", f: x => { const [l, k] = willingLabel(x.w); return `<span class="${k === "ok" ? "" : k}">${l}</span>`; } },
        { k: "b", l: "", f: x => `<button class="btn sm" data-a="bid" data-v="${x.p.id}" ${open ? "" : "disabled"}>${x.p.club >= 0 ? "Bid" : "Sign"}</button>` },
      ], t) : `<p class="small muted">No affordable player rated above ${r1(n.weakest + 1)} is interested right now. Scouting abroad widens the pool.</p>`}
      <button class="lnk small" data-a="needfind" data-v="${n.role}">Search all ${ROLE_NAME[n.role].toLowerCase()}s</button></div>` : ""}</section>`;
  };
  return `<div class="stack"><section class="card"><div class="card-h"><h2>Team needs</h2><span class="small">${S.formation} · Cash <b class="num">${money(c.cash)}</b> · ${open ? '<b class="good">Window open</b>' : '<b class="muted">Window closed</b>'}</span></div>
      <p>${lead}</p>
      <div class="need-sum">${needs.map(n => `<span class="chip need-chip ${n.status[1]}"><span>${n.role}</span> ${n.status[0]}</span>`).join("")}</div>
      <p class="hint" style="margin-top:8px">Each role compares the weakest player in your current XI there with the best players at that role in your division's four strongest squads, out of 20. Ratings use the player's fit for the slot, so someone out of position counts for less. Targets are players whose rating, even at the low end of your scouts' estimate, is at least one point above your weakest starter, within your cash, and at least open to joining.</p></section>
    ${needsAttrCard()}
    <div class="grid2 needs">${needs.map(card).join("")}</div></div>`;
}

/* ---------- tactics ---------- */
const PITCH_LINES = `<svg class="lines" viewBox="0 0 68 96" preserveAspectRatio="none" aria-hidden="true" fill="none" stroke="var(--chalk)" stroke-width=".4"><rect x="2" y="2" width="64" height="92"/><line x1="2" y1="48" x2="66" y2="48"/><circle cx="34" cy="48" r="7"/><rect x="16" y="2" width="36" height="14"/><rect x="26" y="2" width="16" height="5"/><rect x="16" y="80" width="36" height="14"/><rect x="26" y="89" width="16" height="5"/></svg>`;
function viewTactics() {
  const c = me(); fixUserLineup();
  const F = FORMATIONS[S.formation];
  const slotsHtml = F.map(([role, x, y], i) => {
    const p = S.players[S.lineup[i]], sel = UI.sel && UI.sel.slot === i;
    if (!p) return `<button class="slot empty ${sel ? "sel" : ""}" style="left:${x}%;top:${y}%" data-a="slot" data-v="${i}"><span class="disc">${role}</span><span class="nm">Empty</span></button>`;
    const f = FAM[p.pos][role];
    return `<button class="slot ${f < .9 ? "oop" : ""} ${sel ? "sel" : ""}" style="left:${x}%;top:${y}%" data-a="slot" data-v="${i}" title="${esc(p.name)}, ${p.pos} playing ${role}"><span class="disc">${Math.round(slotRating(p, role))}</span><span class="nm">${esc(pitchName(p, S.lineup.map(id => S.players[id])))}</span><span class="fpct" style="--fc:${fitColor(p.fit)}">${Math.round(p.fit)}%</span></button>`;
  }).join("");
  const lines = PITCH_LINES;
  const ps = c.squad.map(P).filter(p => !p.acad || S.set.acadSel || (S.acadPick || []).includes(p.id)).sort((a, b) => ROLE_ORDER[a.pos] - ROLE_ORDER[b.pos] || b.ovr - a.ovr), xi = new Set(S.lineup), bench = new Set(benchFor(c, S.lineup.filter(x => x != null)));
  /* Substitutes under the pitch: tap one to swap him for anyone not in the matchday squad. Your choices
     stick; any spot you haven't chosen is filled automatically (marked "auto"). */
  const benchIds = benchFor(c, S.lineup.filter(x => x != null)), mineB = new Set(S.bench || []);
  const subSel = UI.sel && UI.sel.sub != null ? UI.sel.sub : null;
  const outside = ps.filter(p => !xi.has(p.id) && !bench.has(p.id) && avail(p) && isReg(p, c));
  const subsHtml = `<div class="card subs-card"><div class="card-h"><h3>Substitutes</h3><span class="tiny muted">tap one to change him${S.bench && S.bench.length ? ' · <button class="lnk tiny" data-a="benchauto">automatic bench</button>' : ""}</span></div>
    <div class="bench">${benchIds.map((id, i) => { const p = P(id); return `<button class="bench-p ${subSel === i ? "sel" : ""}" data-a="subslot" data-v="${i}"><span class="pos">${p.pos}</span><span class="nm">${esc(p.name)}${mineB.has(id) ? "" : ' <span class="tiny muted">auto</span>'}${opaLine(p)}</span><b class="rt ${aCls(r20(p.ovr))}">${Math.round(r20(p.ovr))}</b><span class="tiny num" style="color:${fitColor(p.fit)}">${Math.round(p.fit)}%</span></button>`; }).join("")}</div>
    ${subSel != null && benchIds[subSel] != null ? `<div class="tac-pick sub-pick" style="margin-top:10px"><div class="row between"><b class="small">Replace ${esc(P(benchIds[subSel]).name)} with…</b><button class="lnk tiny" data-a="subslot" data-v="${subSel}">cancel</button></div>
      <div class="bench" style="margin-top:6px">${outside.length ? outside.map(p => `<button class="bench-p" data-a="subpick" data-v="${p.id}"><span class="pos">${p.pos}</span><span class="nm">${esc(p.name)}${p.acad ? ' <span class="chip acad">ACA</span>' : ""}${opaLine(p)}</span><b class="rt ${aCls(r20(p.ovr))}">${Math.round(r20(p.ovr))}</b><span class="tiny num" style="color:${fitColor(p.fit)}">${Math.round(p.fit)}%</span></button>`).join("") : '<p class="small muted">Everyone available is already in the matchday squad.</p>'}</div></div>` : ""}</div>`;
  /* Tabs, as on the Youth and Transfers pages: the pitch, the squad list, style and training each on their
     own. Tapping a shirt on the Line-up tab lists who could play there, best first, so a change never needs
     the Selection tab. */
  const tab = UI.tacTab || "lineup", TABS = [["lineup", "Line-up"], ["squad", "Selection"], ["style", "Instructions"], ["training", "Training"]];
  const parts = {
    lineup: `<div class="stack" style="gap:10px">
    <div class="row between"><label class="row small">Formation <select id="tc-form" data-c="form">${formOpts(S.formation)}</select></label><span class="row" style="gap:6px"><button class="btn sm" data-a="autopick">Pick best XI</button><button class="btn sm" data-a="freshpick" title="Best side from players at ${FRESH_FIT}%+ fitness">Pick fresh XI</button><button class="btn sm" data-a="potpick" title="Favours players 23 and under with room to grow; academy players who are ready can start or sit on the bench">Pick high-potential XI</button></span></div>
    <div class="pitch">${lines}${slotsHtml}</div>
    ${subsHtml}
    ${S.formation !== S.me.form ? `<p class="hint warn">You prefer the ${S.me.form}. Teams play about 2% better in their coach's own system.</p>` : `<p class="hint good">Your preferred system: about 2% better across the pitch.</p>`}
    ${(n => n ? `<label class="row small" style="gap:6px"><input type="checkbox" data-c="acadsel" ${S.set.acadSel ? "checked" : ""}> Include academy players in selection <span class="tiny muted">(${n} in the academy · <button class="lnk tiny" data-a="go" data-v="academy">academy</button>)</span></label>` : "")(c.squad.filter(id => P(id).acad).length)}
    <label class="row small" style="gap:6px"><input type="checkbox" data-c="rotate" ${S.set.rotate ? "checked" : ""}> Assistant picks a fresh XI before every match <span class="tiny muted">(players at ${FRESH_FIT}%+ fitness first; your changes on match day stick)</span></label>
    <p class="hint">Tap a shirt, then a player, to swap. The number is his rating in that role; a dashed ring means he's out of position. Your formation also matters in youth recruitment: prospects want a position your shape actually uses.</p>
    ${UI.sel && UI.sel.slot != null && F[UI.sel.slot] ? (() => { const role = F[UI.sel.slot][0], cur = S.lineup[UI.sel.slot];
      const opts = ps.filter(p => p.id !== cur && avail(p)).sort((a, b) => slotRating(b, role) - slotRating(a, role));
      return `<div class="card tac-pick"><div class="card-h"><h3>Who plays ${role}? <button class="lnk tiny" data-a="slot" data-v="${UI.sel.slot}">cancel</button></h3><span class="tiny muted">rating at ${role} · tap to put him in</span></div><div class="bench">${opts.map(p => { const r = slotRating(p, role), oop = p.pos !== role;
        return `<button class="bench-p" data-a="pick-p" data-v="${p.id}"><span class="pos">${p.pos}</span><span class="nm">${esc(p.name)} ${xi.has(p.id) ? '<span class="chip xi">XI</span>' : bench.has(p.id) ? '<span class="chip hg">SUB</span>' : ""}${p.acad ? ' <span class="chip acad">ACA</span>' : ""}${opaLine(p)}</span><span class="rt-pair"><b class="rt ${aCls(r)}">${Math.round(r)}</b>${oop ? `<span class="tiny muted">${Math.round(r20(p.ovr))} as ${p.pos}</span>` : ""}</span><span class="tiny num" style="color:${fitColor(p.fit)}">${Math.round(p.fit)}%</span></button>`; }).join("")}</div></div>`; })() : ""}
</div>`,
    style: `<div class="card"><h3 style="margin-bottom:4px">Team instructions</h3><p class="small muted" style="margin:0 0 8px">Each one is judged against your XI: fit compares the key attributes of the players who carry it out with what's usual for their positions and ratings. A good fit brings an instruction's benefits and softens its costs; a poor one does the reverse, so an instruction your players can't carry out is worse than Neutral.</p>
      ${(() => { const on = userOn(); return INSTR.map(I => `<h3 style="margin:14px 0 8px">${I.h}</h3><div class="train styles">${Object.entries(I.set).map(([k, t]) => { const f = instrFit(on, t), [, w, cls] = fitWord(f);
        return `<button data-a="instr" data-v="${I.s}|${k}" aria-pressed="${(S[I.s] || "normal") === k}"><span><b>${t.l}</b>${t.keys ? `<br><span class="tiny ${cls}">${w} (${f >= 0 ? "+" : ""}${f.toFixed(1)})</span>` : ""}</span><span class="tiny muted">${t.d}${t.keys ? `<br><span class="muted">Needs: ${[...new Set(Object.values(t.keys).flat())].map(x => ATTR_NAME[x]).join(", ")}${t.noW ? "; wingers in the formation" : ""}</span>` : ""}</span></button>`; }).join("")}</div>`).join(""); })()}
      <p class="hint" style="margin-top:8px">One instruction that suits your players is worth a point or two a season; setting all five to suit them, about five. Pushing forward leaves you open to counter-attacks, a fast tempo makes your own breaks deadlier, and a high line with slow defenders gets caught out.</p>
      <h3 style="margin:14px 0 8px">Tackling</h3><div class="train">${Object.entries(TACKLE).map(([k, t]) => `<button data-a="tackle" data-v="${k}" aria-pressed="${(S.tackling || "normal") === k}"><b>${t.l}</b><span class="tiny muted">${t.d}${k !== "normal" ? ` Cards ${k === "soft" ? "−40%" : "+50%"}; your opponents' chances ${k === "soft" ? "about 8% better" : "about 7.5% worse"}.` : ""}</span></button>`).join("")}</div>
      <label class="row small" style="margin-top:8px"><input type="checkbox" data-c="autostyle" ${S.set.autoStyle !== false ? "checked" : ""}> In matches you don't watch live, your assistant pushes players forward when chasing a game and keeps them back to protect a lead</label></div>`,
    training: `<div class="card"><h3 style="margin-bottom:8px">Training focus</h3><div class="train">${Object.entries(TRAIN).map(([k, t]) => `<button data-a="train" data-v="${k}" aria-pressed="${S.training === k}"><b>${t.l}</b><span class="tiny muted">${t.d}</span></button>`).join("")}</div>
      <p class="hint" style="margin-top:8px">A full match costs an outfield player about 18 fitness. Midweek rounds and cup ties mean rotating.</p></div>`,
    squad: `<section class="card"><div class="card-h"><h2>Selection</h2><span class="small muted">XI, then the nine on the bench (5 substitutions allowed)</span></div>
    ${(() => { const picked = (S.bench || []).filter(id => bench.has(id)).length; return `<div class="row small" style="margin-bottom:8px;gap:10px"><span>Bench: <b>${picked}</b> chosen by you${picked < RULES.benchSize ? `, <b>${RULES.benchSize - picked}</b> filled automatically` : ""}.</span>${S.bench && S.bench.length ? '<button class="btn sm" data-a="benchauto">Reset to automatic</button>' : ""}<span class="tiny muted">Use Bench on a player to add or remove him.</span><label class="row tiny" style="gap:6px"><input type="checkbox" data-c="benchgk" ${S.set.benchGK !== false ? "checked" : ""}> Always include a substitute goalkeeper</label>${S.set.benchGK === false && !benchFor(me(), S.lineup).some(id => P(id).pos === "GK") ? '<span class="tiny warn">No keeper on the bench: if yours is injured or sent off, an outfielder goes in goal.</span>' : ""}</div>`; })()}
    <div class="tbl-wrap"><table><thead><tr><th></th><th>Pos</th><th>Name</th><th class="r">Age</th><th class="r">Rating</th><th class="r">Potential</th><th>Fit</th><th>Mood</th><th></th></tr></thead><tbody>
    ${ps.map(p => `<tr class="click ${UI.sel && UI.sel.pid === p.id ? "sel" : ""}" data-a="pick-p" data-v="${p.id}"><td>${xi.has(p.id) ? '<span class="chip xi">XI</span>' : bench.has(p.id) ? ((S.bench || []).includes(p.id) ? '<span class="chip hg">SUB</span>' : '<span class="chip hg" style="opacity:.6" title="Filled automatically">SUB auto</span>') : ""}</td><td><span class="pos">${p.pos}</span></td><td>${esc(p.name)} ${statusChips(p)}</td><td class="r num">${p.age}</td><td class="r num">${ratingHtml(p)}</td><td class="r">${potHtml(p)}</td><td><b class="num" style="color:${fitColor(p.fit)}">${Math.round(p.fit)}%</b></td><td>${moodTag(p)}</td><td>${xi.has(p.id) || !avail(p) || !eligibleIds(c).includes(p.id) ? "" : `<button class="btn sm ${(S.bench || []).includes(p.id) ? "primary" : ""}" data-a="benchtoggle" data-v="${p.id}">${(S.bench || []).includes(p.id) ? "On bench ✓" : "Bench"}</button>`}</td></tr>`).join("")}
    </tbody></table></div></section>`,
  };
  return `<div class="stack" style="--club:${c.color}"><div class="seg lv-tabs y-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-a="tactab" data-v="${k}" aria-pressed="${tab === k}" aria-selected="${tab === k}">${l}</button>`).join("")}</div>
    <div class="squad tac-one">${parts[tab] || parts.lineup}</div></div>`;
}

/* ---------- fixtures ---------- */
/* Your next n fixtures (league rounds, and cup or European ties once drawn), for the Fixtures page and Home. */
function upcomingFixtures(n) {
  const up = [];
  if (S.phase === "season") for (let i = S.di; i < S.days.length && up.length < n; i++) {
    const d = S.days[i];
    if (d.k === "lg") { const r = d.rounds[me().lg]; if (r == null) continue; const pr = S.leagues[me().lg].fixtures[r].find(([h, a]) => h === S.club || a === S.club); if (pr) up.push({ d, h: pr[0], a: pr[1], label: leagueName(me().lg) + (d.mid ? " · midweek" : "") }); }
    else if (d.k === "grp") { const fx = userFixture(dayFixtures(d)); if (fx) up.push({ d, h: fx.h, a: fx.a, label: compLabel(fx) }); }
    else if (d.k === "ko" && S.ko[d.comp].rounds[d.r].ties) {
      // Read the tie itself: dayFixtures only makes a second leg once the first has a score, so a two-legged tie
      // showed one leg until the first was played.
      const t = S.ko[d.comp].rounds[d.r].ties.find(t => !t.bye && (t.h === S.club || t.a === S.club)); if (!t || t.w != null) continue;
      const [h, a] = t.legs === 2 && d.leg === 1 ? [t.a, t.h] : [t.h, t.a], fx = { comp: "K", key: d.comp, r: d.r, leg: d.leg, h, a, neutral: t.neutral };
      up.push({ d, h, a, label: compLabel(fx) + (t.neutral ? " · neutral" : "") }); }
  }
  return up;
}
const upcomingRow = u => `<div class="res ct ct-${compType(u.d)}" style="grid-template-columns:auto 1fr;column-gap:10px"><span class="num muted" style="white-space:nowrap">${dayName(u.d.ord, true)} · Wk ${u.d.w + 1}</span><span>${u.h === S.club ? "v" : "@"} ${clubA(u.h === S.club ? u.a : u.h, { flag: 1 })}<br><span class="tiny muted">${esc(u.label)}</span></span></div>`;
function viewFixtures() {
  const played = (S.myRes || []).slice().reverse(), up = upcomingFixtures(14);
  return `<div class="grid2"><section class="card"><div class="card-h"><h2>Results</h2><span class="small muted">${seasonLabel(S.year)}</span></div>${played.length ? played.map(resultRow).join("") : '<p class="muted">No matches played yet.</p>'}</section>
    <section class="card"><div class="card-h"><h2>Coming up</h2></div>${up.length ? up.map(upcomingRow).join("") : '<p class="muted">Nothing scheduled.</p>'}
    <p class="hint" style="margin-top:8px">Cup and knockout opponents appear once they're drawn.</p>
    <div class="ct-key">${COMP_TYPES.map(([k, l]) => `<span class="ct ct-${k}">${l}</span>`).join("")}</div></section></div>`;
}

/* ---------- leagues ---------- */
function viewLeague() {
  const key = UI.lg || me().lg, L = S.leagues[key], t = standings(L);
  const rows = t.map((r, i) => ({ ...r, pos: i + 1 }));
  const cols = [
    { k: "pos", l: "#", r: 1, v: r => r.pos, f: r => r.pos },
    { k: "n", l: "Club", v: r => C(r.id).name, f: r => clubA(r.id) + rivalChip(r.id) + (r.ded ? ` <span class="chip req" title="Points deducted">−${r.ded}</span>` : "") },
    { k: "p", l: "P", r: 1, v: r => r.p, f: r => r.p }, { k: "w", l: "W", r: 1, v: r => r.w, f: r => r.w }, { k: "d", l: "D", r: 1, v: r => r.d, f: r => r.d }, { k: "l", l: "L", r: 1, v: r => r.l, f: r => r.l },
    { k: "gf", l: "GF", r: 1, v: r => r.gf, f: r => r.gf, cls: "hide-sm" }, { k: "ga", l: "GA", r: 1, v: r => r.ga, f: r => r.ga, cls: "hide-sm" },
    { k: "gd", l: "GD", r: 1, v: r => r.gf - r.ga, f: r => (r.gf - r.ga > 0 ? "+" : "") + (r.gf - r.ga) },
    { k: "pts", l: "Pts", r: 1, v: r => r.pts, f: r => `<b>${r.pts}</b>` },
    ...(LG[key].foreign ? [] : [{ k: "xg", l: "xGF", r: 1, v: r => (C(r.id).xs || {}).xg || 0, f: r => ((C(r.id).xs || {}).xg || 0).toFixed(1), cls: "hide-sm" }, { k: "xga", l: "xGA", r: 1, v: r => (C(r.id).xs || {}).xga || 0, f: r => ((C(r.id).xs || {}).xga || 0).toFixed(1), cls: "hide-sm" }]),
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
    ${LG[key].foreign ? "" : (() => { const xgL = ps.filter(p => p.s.xg > 0).sort((a, b) => b.s.xg - a.s.xg).slice(0, 10), xaL = ps.filter(p => p.s.xa > 0).sort((a, b) => b.s.xa - a.s.xa).slice(0, 10);
      return `<section class="card"><div class="card-h"><h2>Expected goals</h2><span class="tiny muted">all competitions</span></div>${table("txg-" + key, [{ k: "n", l: "Player", f: p => playerA(p) }, { k: "c", l: "Club", f: p => clubA(p.club, { short: true }) }, { k: "g", l: "G", r: 1, f: p => p.s.g }, { k: "x", l: "xG", r: 1, f: p => `<b>${p.s.xg.toFixed(1)}</b>` }, { k: "d", l: "G−xG", r: 1, f: p => (d => `<span class="${d >= 1 ? "good" : d <= -1 ? "bad" : ""}">${d > 0 ? "+" : ""}${d.toFixed(1)}</span>`)(p.s.g - p.s.xg) }], xgL, { empty: "No shots yet." })}</section>
      <section class="card"><div class="card-h"><h2>Chance creators</h2><span class="tiny muted">all competitions</span></div>${table("txa-" + key, [{ k: "n", l: "Player", f: p => playerA(p) }, { k: "c", l: "Club", f: p => clubA(p.club, { short: true }) }, { k: "k", l: "Key passes", r: 1, f: p => p.s.kp || 0 }, { k: "a", l: "A", r: 1, f: p => p.s.a }, { k: "x", l: "xA", r: 1, f: p => `<b>${p.s.xa.toFixed(1)}</b>` }], xaL, { empty: "No chances created yet." })}</section>`; })()}
    <section class="card"><div class="card-h"><h2>Best rated</h2><span class="tiny muted">min. 5 apps</span></div>${table("tr-" + key, [{ k: "n", l: "Player", f: p => playerA(p) }, { k: "c", l: "Club", f: p => clubA(p.club, { short: true }) }, { k: "r", l: "Avg", r: 1, f: p => (p.s.rt / p.s.app).toFixed(2) }], rated, { empty: "Not enough games yet." })}</section></div></div>`;
}

/* ---------- cups ---------- */
function tieHtml(t) {
  // Your own ties stand out in the draw: a round of 32 ties is a lot of club names to scan for your own.
  const mine = t.h === S.club || t.a === S.club ? " mine" : "";
  if (t.bye) return `<div class="tie${mine}"><span class="${t.h === S.club ? "me" : ""}">${clubA(t.h, { flag: 1 })}</span><span class="tiny muted">bye</span></div>`;
  const agg = t.g1 ? [t.g1[0] + (t.g2 ? t.g2[0] : 0), t.g1[1] + (t.g2 ? t.g2[1] : 0)] : null;
  const extra = t.legs === 2 && t.g1 ? `1st leg ${C(t.a).short} ${t.g1[1]}–${t.g1[0]} ${C(t.h).short}${t.g2 ? ` · 2nd leg ${t.g2[0]}–${t.g2[1]}` : ""}` : "";
  const pens = t.pens ? `${extra ? " · " : ""}${C(t.pens[0] > t.pens[1] ? t.h : t.a).short} win ${Math.max(...t.pens)}–${Math.min(...t.pens)} on penalties` : "";
  return `<div class="tie${mine}"><span class="${t.w === t.h ? "w" : ""} ${t.h === S.club ? "me" : ""}">${clubA(t.h, { flag: 1 })}</span><span class="num">${agg ? agg[0] : ""}</span><span class="${t.w === t.a ? "w" : ""} ${t.a === S.club ? "me" : ""}">${clubA(t.a, { flag: 1 })}</span><span class="num">${agg ? agg[1] : ""}</span>${extra || pens ? `<span class="tiny muted" style="grid-column:1/-1">${extra}${pens}</span>` : ""}</div>`;
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
  else body = `${comp.kind === "cont" && !comp.rounds[0].ties ? `<p class="small" style="margin-bottom:8px">Entrants: ${S.cont[k].entrants.map(id => id === S.club ? `<b class="me-name">${clubA(id, { flag: 1 })}</b>` : clubA(id, { flag: 1 })).join(", ")}</p>` : ""}<div class="rounds">${koRounds(comp)}</div>`;
  return `<section class="card"><div class="card-h"><h2>${esc(comp.name)}</h2><select id="cup-sel" data-c="cup" aria-label="Competition">${keys.map(x => `<option value="${x}" ${x === k ? "selected" : ""}>${esc(S.ko[x].name)}</option>`).join("")}</select></div>
    <p class="small muted" style="margin-bottom:12px">${about}</p>${body}${comp.w != null ? `<p style="margin-top:12px">Winner: <b class="${comp.w === S.club ? "me-name" : ""}">${clubA(comp.w, { flag: 1 })}</b></p>` : ""}</section>`;
}

/* ---------- transfers ---------- */
function viewTransfers() {
  // Scouted: everyone your scouts have filed a report on, wherever he plays now (players you've signed drop off).
  // Players you've removed (S.scoutHide) keep their report but leave the list; "Show removed" lists them to restore.
  const scoutedAll = Object.keys(S.scout || {}).map(id => S.players[id]).filter(p => p && S.scout[p.id] > 0 && p.club !== S.club && !(p.loan && p.loan.from === S.club));
  const hide = S.scoutHide || {}, removedN = scoutedAll.filter(p => hide[p.id]).length;
  if (!removedN) UI.showRemoved = false;
  const scouted = scoutedAll.filter(p => !hide[p.id] === !UI.showRemoved);
  const c = me();
  // Laid out like the Youth page: tabs with counts instead of one long page. Offers is your working list of
  // players you've bid for who haven't joined; Search holds the four ways of browsing the market.
  const offers = Object.entries(S.bids || {}).map(([id, b]) => ({ p: S.players[id], b })).filter(o => o.p && o.b.res !== "signed" && o.p.club !== S.club && o.b.y >= S.year - 1);
  const SEARCH = [["search", "All players"], ["fa", "Free agents"], ["listed", "Transfer listed"], ["loans", "Loan targets"]];
  const group = SEARCH.some(([k]) => k === UI.tab) ? "search" : UI.tab;
  const listedMine = c.squad.map(P).filter(p => p.listed || p.req).length;
  // Favourites: players you've starred on their card (S.fav), wherever they play; ones you've signed drop off.
  const favs = Object.keys(S.fav || {}).map(id => S.players[id]).filter(p => p && p.club !== S.club && !(p.loan && p.loan.from === S.club));
  const tabs = [["offers", "Offers", offers.length + S.inbox.filter(m => !m.done && (m.type === "bid" || m.type === "auction")).length], ["scouted", "Scouted", scoutedAll.length - removedN], ["fav", "Favourites", favs.length], ["search", "Search", null], ["mine", "Selling", listedMine], ["log", "Activity", null]];
  const open = windowOpen();
  let body;
  if (UI.tab === "offers") {
    const t = transferBudget(c);
    // Bids received for your players (kept in the inbox, newest first): open ones with their buttons, then outcomes.
    const recv = S.inbox.filter(m => m.type === "bid" || m.type === "auction").slice(0, 20);
    const bidsOf = m => m.type === "auction" ? m.bids : [{ from: m.from, fee: m.fee }];
    const outcome = m => { if (!m.done) return ""; const ch = m.choice || "";
      if (m.reopened) return '<span class="warn">Agreed, then rivals stepped in (see the bidding war above)</span>';
      if (ch === "accept" || ch.startsWith("acc:")) { const b = ch === "accept" ? bidsOf(m)[0] : bidsOf(m).find(x => x.from === +ch.slice(4)); return b ? `<span class="good">Sold to ${clubA(b.from, { short: true })} for ${money(b.fee)}</span>` : '<span class="good">Sold</span>'; }
      return '<span class="muted">Rejected</span>'; };
    const recvHtml = `<h3 style="margin:4px 0 6px">Bids received</h3>${recv.length ? recv.map(m => { const p = S.players[m.pid];
      return `<div class="need-row" style="display:block"><div class="row between"><b>${p ? playerA(p) : "A former player"}</b><span class="tiny muted">${seasonLabel(m.y)} · ${m.w}${m.type === "auction" ? " · bidding war" : ""}</span></div>
        <div class="small">${bidsOf(m).map(b => `${clubA(b.from, { short: true })} <b class="num">${money(b.fee)}</b>`).join(" · ")}</div>
        ${m.done ? `<div class="small">${outcome(m)}</div>` : `<div class="row" style="gap:6px;margin-top:6px">${m.opts.map(([k, l], i) => `<button class="btn sm ${i === 0 ? "primary" : ""}" data-a="decide" data-v="${m.id}|${k}">${esc(l)}</button>`).join("")}</div>`}</div>`; }).join("") : '<p class="small muted">No bids for your players yet. List a player (Selling tab) to tell clubs he is available.</p>'}
      <h3 style="margin:14px 0 6px">Your offers</h3>`;
    body = recvHtml + `<div class="small" style="margin-bottom:8px">Budget about <b class="num">${money(Math.round(t.budget / 1e5) * 1e5)}</b> for a player on ${perWeek(t.wage)} · <button class="lnk" data-a="go" data-v="finances">details</button></div>` + table("toffers", [
      { k: "n", l: "Player", v: o => o.p.name, f: o => playerA(o.p) },
      { k: "pos", l: "Pos", v: o => ROLE_ORDER[o.p.pos], f: o => `<span class="pos">${o.p.pos}</span>` },
      { k: "age", l: "Age", r: 1, v: o => o.p.age, f: o => o.p.age },
      { k: "ovr", l: "Rating", r: 1, v: o => ratingSort(o.p), f: o => ratingHtml(o.p) },
      { k: "club", l: "Club", v: o => o.p.club, f: o => o.p.club >= 0 ? clubA(o.p.club, { flag: 1 }) : "Free agent" },
      { k: "fee", l: "Your offer", r: 1, v: o => o.b.fee, f: o => o.b.fee ? money(o.b.fee) : "Contract" },
      { k: "ask", l: "Asking now", r: 1, v: o => o.p.club >= 0 ? askingPrice(o.p) : 0, f: o => o.p.club >= 0 ? money(askingPrice(o.p)) : "—" },
      { k: "res", l: "Answer", v: o => o.b.res, f: o => o.p.club !== o.b.club ? `<span class="muted">Moved to</span> ${o.p.club >= 0 ? clubA(o.p.club, { short: true }) : "free agency"}` : o.b.res === "refused" ? '<span class="bad">He refused</span>' : '<span class="warn">Club rejected the fee</span>' },
      { k: "when", l: "When", v: o => o.b.y * 100 + o.b.w, f: o => `${seasonLabel(o.b.y)}${o.b.w >= 0 ? ` · wk ${o.b.w + 1}` : " · summer"}` },
      { k: "w", l: "Interest now", v: o => willingness(o.p, c), f: o => { const [l, k] = willingLabel(willingness(o.p, c)); return `<span class="${k === "ok" ? "" : k}">${l}</span>`; } },
      { k: "act", l: "", f: o => `<button class="btn sm" data-a="bid" data-v="${o.p.id}" ${windowOpen() && o.p.club !== S.club ? "" : "disabled"}>New offer</button>` },
    ], offers, { sort: { k: "when", d: -1 }, empty: "No open offers. Players you bid for who turn you down are kept here, with your offer, today's asking price and how keen they are now, so you can come back with a better one. Those who sign drop off." });
  } else if (UI.tab === "log") body = table("tlog", [{ k: "w", l: "When", f: t => `${seasonLabel(t.y)} · ${t.w}` }, { k: "n", l: "Player", f: t => S.players[t.pid] ? playerA(S.players[t.pid]) : esc(t.name) }, { k: "f", l: "From", f: t => t.from >= 0 ? clubA(t.from, { flag: 1 }) : "Free agent" }, { k: "t", l: "To", f: t => clubA(t.to, { flag: 1 }) }, { k: "fee", l: "Fee", r: 1, v: t => t.fee, f: t => t.fee ? money(t.fee) : "Free" }], S.tlog, { limit: 150, empty: "No transfers yet." });
  else if (UI.tab === "mine") body = table("tmine", [{ k: "n", l: "Player", f: p => { const n = listInterest(p), [w, k] = interestWord(n); return `${playerA(p)} ${statusChips(p, c)}<br><span class="small">${p.listed ? "Listed at" : "Asking"} <b class="num">${money(askingPrice(p))}</b> <span class="tiny muted">${p.listed ? `${Math.round((p.listPct || 1) * 100)}% of his ${money(value(p))} value` : `not listed · value ${money(value(p))}`}</span></span><br><span class="tiny">Interest: <b class="${k}">${w}</b> <span class="muted">(${n} club${n === 1 ? "" : "s"} could bid)</span></span>`; } }, { k: "ovr", l: "Rating", r: 1, f: p => ratingHtml(p) },], c.squad.map(P).filter(p => p.listed || p.req), { empty: "None of your players are listed. List a player from his profile and clubs will start bidding during transfer windows." });
  else {
    const f = UI.tf;
    const listTab = UI.tab === "scouted" || UI.tab === "fav";  // your own lists: every country, extra report columns
    let pool = UI.tab === "scouted" ? scouted : UI.tab === "fav" ? favs : UI.tab === "fa" ? S.fa.map(P) : Object.values(S.players).filter(p => p.club >= 0 && p.club !== S.club && p.age >= 17 && !p.loan);
    if (UI.tab === "listed") pool = pool.filter(p => p.listed || p.req);
    if (UI.tab === "loans") pool = pool.filter(p => loanable(p) && !wouldStart(p, C(p.club)));
    // Countries you've switched off (S.set.ctyOff) drop out of every search tab; the Scouted list keeps everyone.
    const ctyOff = new Set(!listTab ? S.set.ctyOff || [] : []);
    if (ctyOff.size) pool = pool.filter(p => !ctyOff.has(playerCountry(p)));
    pool = pool.filter(p => (f.pos === "ALL" || p.pos === f.pos) && p.age <= f.age && (!f.min || (!ratingBlank(p) && ratingMid(p) >= f.min)) && (f.lg === "ALL" || (p.club >= 0 && (C(p.club).lg === f.lg || (f.lg === "ABROAD" && isForeign(C(p.club)))))));
    if (f.fee && UI.tab !== "loans") pool = pool.filter(p => askingPrice(p) <= f.fee);
    // Interest, using the same bands as the Interest column: "would sign" is everyone but Not interested,
    // since a player below .3 turns any offer down.
    const INT = { keen: w => w >= .7, open: w => w >= .45, sign: w => w >= .3, no: w => w < .3 };
    if (INT[f.int]) pool = pool.filter(p => INT[f.int](willingness(p, c)));
    // The whole filtered market goes to the table, which sorts it and then shows the first 200. It used to be
    // cut to the 200 best-rated first, so sorting by asking price only reordered those 200: "All players"
    // sorted cheapest-first showed dearer players than the Max fee 200k filter did.
    pool.sort((a, b) => ratingSort(b) - ratingSort(a)); const poolN = pool.length;
    const loans = UI.tab === "loans";
    body = `${UI.tab === "scouted" ? scoutAssistHtml() : ""}<div class="filters"><label class="f">Position<select id="tf-pos" data-c="tf-pos"><option value="ALL">Any</option>${ROLES.map(r => `<option value="${r}" ${f.pos === r ? "selected" : ""}>${ROLE_NAME[r]}</option>`).join("")}</select></label>
      <label class="f">Max age<select id="tf-age" data-c="tf-age">${[40, 30, 27, 24, 21].map(a => `<option value="${a}" ${f.age === a ? "selected" : ""}>${a === 40 ? "Any" : a}</option>`).join("")}</select></label>
      <label class="f">Min rating<select id="tf-min" data-c="tf-min">${[0, 6, 8, 10, 12, 14, 16].map(a => `<option value="${a}" ${f.min === a ? "selected" : ""}>${a ? a + "+" : "Any"}</option>`).join("")}</select></label>
      <label class="f">Interest<select id="tf-int" data-c="tf-int">${[["ALL", "Any"], ["keen", "Keen"], ["open", "Open or keen"], ["sign", "Would sign (not Not interested)"], ["no", "Not interested"]].map(([k, l]) => `<option value="${k}" ${(f.int || "ALL") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      ${loans ? "" : `<label class="f">Max fee<select id="tf-fee" data-c="tf-fee">${[0, 2e5, 1e6, 3e6, 8e6, 15e6, 30e6].map(a => a * MONEY).map(a => `<option value="${a}" ${f.fee === a ? "selected" : ""}>${a ? money(a) : "Any"}</option>`).join("")}</select></label>`}
      ${UI.tab !== "fa" ? `<label class="f">League<select id="tf-lg" data-c="tf-lg"><option value="ALL">All leagues</option><option value="ABROAD" ${f.lg === "ABROAD" ? "selected" : ""}>All foreign leagues</option>${lgOpts(f.lg)}</select></label>` : ""}</div>
      ${!listTab ? ctyTogHtml(S.set.ctyOff, "cty") : ""}
      ${poolN > 200 ? `<p class="tiny muted" style="margin:0 0 6px">${poolN.toLocaleString()} players match: showing the first 200 in the order you sort by.</p>` : ""}
      ${table("t-" + UI.tab, [
        { k: "n", l: "Player", v: p => p.name, f: p => playerA(p) + " " + statusChips(p) },
        { k: "pos", l: "Pos", v: p => ROLE_ORDER[p.pos], f: p => `<span class="pos">${p.pos}</span>` },
        { k: "age", l: "Age", r: 1, v: p => p.age, f: p => p.age },
        { k: "ovr", l: "Rating", r: 1, v: p => ratingSort(p), f: p => ratingHtml(p) },
        { k: "pot", l: "Potential", r: 1, v: p => viewMid(potView(p)), f: p => potHtml(p) },
        ...(listTab ? [
          { k: "ir", l: "Injury risk", r: 1, v: p => viewMid(injView(p)), f: p => injHtml(p), cls: "hide-sm" },
          { k: "rep", l: "Report", v: p => scoutLevel(p) * 1e13 + ((S.scoutT || {})[p.id] || {}).t || 0, f: p => { const t = (S.scoutT || {})[p.id]; return `${scoutLevel(p) >= 2 ? '<b class="good">Full</b>' : '<span class="warn">Partial</span>'}${t ? `<br><span class="tiny muted">${seasonLabel(t.y)} · ${t.w}</span>` : ""}`; } },
        ] : [{ k: "sc", l: "Scouted", v: p => scoutLevel(p), f: p => ["—", "Partly", "Fully"][scoutLevel(p)], cls: "hide-sm" }]),
        { k: "club", l: "Club", v: p => p.club >= 0 ? C(p.club).name : "", f: p => p.club >= 0 ? clubA(p.club, { short: true, flag: 1 }) : '<span class="muted">Free</span>' },
        loans ? { k: "wage", l: "Wage", r: 1, v: p => p.wage, f: p => perWeek(p.wage) } : { k: "ask", l: "Asking", r: 1, v: p => askingPrice(p), f: p => p.club >= 0 ? money(askingPrice(p)) : "Free" },
        { k: "w", l: "Interest", v: p => willingness(p, c), f: p => { const [l, k] = willingLabel(willingness(p, c)); return `<span class="${k === "ok" ? "" : k}">${l}</span>`; } },
        { k: "b", l: "", f: p => (loans ? `<button class="btn sm" data-a="loanin" data-v="${p.id}" ${open ? "" : "disabled"} title="You pay his wage while he's with you">Loan · ${perWeek(p.wage)}</button>` : `<button class="btn sm" data-a="bid" data-v="${p.id}" ${open ? "" : "disabled"}>${p.club >= 0 ? "Bid" : "Sign"}</button>`)
          + (UI.tab === "fav" ? ` ${starBtn(p.id, "fav", true)}` : "")
          + (UI.tab === "scouted" ? (UI.showRemoved ? ` <button class="btn sm" data-a="unhide" data-v="${p.id}">Restore</button>` : ` <button class="btn sm" data-a="unscout" data-v="${p.id}" title="Not good enough: take him off your scouted list (his report is kept)" aria-label="Remove ${esc(p.name)} from the scouted list">✕</button>`) : "") },
      ], pool, { limit: 200,  empty: UI.tab === "fav" && !favs.length ? "No favourites yet. Open a player and tap the ☆ by his name to add him here." : UI.tab === "scouted" && !scouted.length ? (UI.showRemoved ? "Nobody removed." : removedN ? "Everyone you've scouted has been removed from this list." : "You haven't scouted anyone yet. Open a player from another division (or abroad) and tap Scout him: his report will be kept here.") : (S.set.ctyOff || []).length >= KNOW_KEYS.length ? "No countries selected." : "No players match these filters." })}
      ${UI.tab === "scouted" && removedN ? `<p class="small muted" style="margin-top:8px">${UI.showRemoved ? `Showing the ${removedN} you removed. Restore puts a player back on your list.` : `${removedN} removed from this list.`} <button class="lnk" data-a="showremoved">${UI.showRemoved ? "Back to your list" : "Show removed"}</button></p>` : ""}`;
  }
  const title = { offers: "Offers", scouted: "Scouted players", fav: "Favourites", search: "Search the market", mine: "Selling", log: "Activity" }[group];
  return `<div class="stack">${hoursStrip()}<div class="seg lv-tabs y-tabs" role="tablist">${tabs.map(([k, l, n]) => `<button role="tab" data-a="ttab" data-v="${k}" aria-pressed="${group === k}" aria-selected="${group === k}">${l}${n != null ? ` <span class="tab-n">${n}</span>` : ""}</button>`).join("")}</div>
    ${group === "search" ? needsCard(true) : ""}<section class="card"><div class="card-h"><h2>${title}</h2><span class="small">${open ? '<b class="good">Window open</b>' : '<b class="muted">Window closed</b> · opens in January (weeks 19–22) and preseason'} · Cash <b class="num">${money(c.cash)}</b> · Cost ratio <b class="num">${pct(scr(c))}</b></span></div>
    ${group === "search" ? `<div class="chips" role="group" aria-label="Browse" style="margin-bottom:10px">${SEARCH.map(([k, l]) => `<button data-a="ttab" data-v="${k}" aria-pressed="${UI.tab === k}">${l}</button>`).join("")}</div>` : ""}
    ${body}<p class="hint" style="margin-top:10px">${UI.tab === "loans" ? `Young players (${RULES.loanMaxAge} and under) who aren't starting for their clubs. Parent clubs lend them only where they'll play, and want them at a level that tests them. You pay the wages; up to ${RULES.loansIn} loans at once.` : `Ratings outside your division are estimates until you scout a player (open him, 2 hours). Interest reflects more than money: your standing against his current club, whether he'd start in your ${S.formation}, European football, his mood and loyalty.`}</p></section></div>`;
}

/* ---------- youth recruitment ---------- */
/* Scouting hours left this week, shown above the tabs on every Transfers and Youth tab: scouting a player
   or prospect, calls, visits and coach chats all draw on the same weekly pool. */
function hoursStrip() {
  const h = S.rec.hours, max = recHours();
  return `<div class="hours-strip" title="Refills every week. Scouting, calls, visits and coach chats all use it."><span>Scouting hours this week</span><b class="num ${h <= 0 ? "bad" : h < 3 ? "warn" : ""}">${h}/${max}</b><span class="bar"><i style="width:${clamp(h / Math.max(1, max), 0, 1) * 100}%"></i></span></div>`;
}
// The scouting assistant's controls, shown on both Scouted lists (the setting is shared).
function scoutAssistHtml() {
  const on = autoScoutOn(), L = S.autoLast;
  return `<div class="assist row small"><label class="row"><input type="checkbox" data-c="autoscout" ${on ? "checked" : ""}> <b>Scouting assistant</b></label>
    <span class="tiny muted">${on ? `On: your scouts use the hours you leave each week on youth prospects and transfer targets in England. It never travels abroad, so it never costs money.${L ? ` Last time (${L.w}): ${L.y} youth, ${L.p} transfer.` : ""}` : "Off: only the scouting you choose to do."}</span></div>`;
}
function viewYouth() {
  const c = me(), f = UI.yf;
  let ys = S.prospects.slice();
  // Countries are chosen with the toggles below the filters; the old Region select (England by default) was removed
  // because it overrode them: switching Spain on still showed only English prospects.
  const yOff = new Set(S.set.yCtyOff || []); if (yOff.size) ys = ys.filter(y => !yOff.has(prospectCountry(y)));  // country toggles
  if (f.pos !== "ALL") ys = ys.filter(y => y.pos === f.pos);
  if (f.st === "OPEN") ys = ys.filter(y => y.commit == null); else if (f.st === "MINE") ys = ys.filter(y => y.offers.includes(c.id) || y.rel[c.id] || y.commit === c.id); else if (f.st === "DONE") ys = ys.filter(y => y.commit != null);
  const commits = S.prospects.filter(y => y.commit === c.id);
  // Everyone your scouts have watched this year, whatever the filters below say.
  // Two working lists above the full class: prospects you've offered a place (and not yet signed), and those
  // you've scouted but not offered. A prospect moves from the second to the first when you offer.
  const offered = S.prospects.filter(y => y.offers.includes(c.id) && y.commit !== c.id);
  // Prospects you've removed (y.hide) keep their reports but leave the list, as on the Transfers Scouted tab.
  const scoutedAll = S.prospects.filter(y => (y.sc >= 1 || y.coach) && !y.offers.includes(c.id) && y.commit !== c.id), REPORT = ["Coaches' view", "First look", "Detailed", "Complete"];
  const yRemovedN = scoutedAll.filter(y => y.hide).length; if (!yRemovedN) UI.yShowRemoved = false;
  const scouted = scoutedAll.filter(y => !y.hide === !UI.yShowRemoved);
  const cols = [
    { k: "n", l: "Prospect", v: y => y.name, f: y => `<button class="lnk" data-a="prospect" data-v="${y.id}">${esc(y.name)}</button>` },
    { k: "pos", l: "Pos", v: y => ROLE_ORDER[y.pos], f: y => `<span class="pos">${y.pos}</span>` },
    { k: "from", l: "From", v: y => km(y, c), f: y => `${esc(y.region)} <span class="tiny muted">${Math.round(km(y, c))} km</span>` },
    { k: "st", l: "Potential", v: y => viewMid(prospectPot(y)), f: y => rangeHtml(prospectPot(y)) },
    { k: "you", l: "Your pitch", v: y => clubScore(y, c), f: y => { const s = clubScore(y, c); return `<span class="bar" title="${Math.round(s * 100)}"><i style="width:${clamp(s, 0, 1) * 100}%"></i></span>`; } },
    { k: "rank", l: "Standing", v: y => yourRank(y), f: y => y.commit != null ? (y.commit === c.id ? '<b class="good">Committed to you</b>' : `<span class="muted">Committed to</span> ${clubA(y.commit, { short: true })}`) : rankLabel(y) },
    { k: "act", l: "Actions", f: y => y.commit === c.id ? "" : `<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-a="rec" data-v="${y.id}|scout" ${y.sc >= 3 ? "disabled" : ""} title="${scoutHours(3, prospectCountry(y))} hours">Scout ${scoutHours(3, prospectCountry(y))}h</button><button class="btn sm" data-a="rec" data-v="${y.id}|call" title="1 hour">Call</button><button class="btn sm" data-a="rec" data-v="${y.id}|visit" ${y.visit ? "disabled" : ""} title="Host him at your training ground: ${scoutHours(5, prospectCountry(y))} hours${travelCost(prospectCountry(y)) ? ", " + money(travelCost(prospectCountry(y))) + " travel" : ""}">Visit</button><button class="btn sm" data-a="rec" data-v="${y.id}|coach" ${y.coach ? "disabled" : ""} title="Speak to his youth coaches by phone: ${scoutHours(2, prospectCountry(y))} hours, no travel">Coaches</button><button class="btn sm" data-a="rec" data-v="${y.id}|home" ${y.home || y.sc < 1 ? "disabled" : ""} title="${y.sc < 1 ? "Scout him first" : `Visit him and his family at home: ${scoutHours(4, prospectCountry(y))} hours${travelCost(prospectCountry(y)) ? ", " + money(travelCost(prospectCountry(y))) + " travel" : ""}`}">Home</button><button class="btn sm ${y.offers.includes(c.id) ? "danger" : ""}" data-a="rec" data-v="${y.id}|offer">${y.offers.includes(c.id) ? "Withdraw" : "Offer"}</button></span>` },
  ];
  const regs = [["ENG", "England"], ...COUNTRIES.filter(K => K.code !== "ENG").map(K => [K.code, K.name]), ["ROW", "Brazil, Argentina, West Africa, Scandinavia"], ["ABR", "Everywhere outside England"], ["ALL", "Everywhere"]];
  const scoutCols = [cols[0], cols[1], cols[2], cols[3],
    { k: "ir", l: "Injury risk", v: y => viewMid(prospectInj(y)), f: y => prospectInj(y) ? rangeHtml(prospectInj(y), true) : '<span class="tiny muted">scout again</span>' },
    { k: "rep", l: "Report", v: y => y.sc, f: y => `<span class="${y.sc >= 3 ? "good" : y.sc <= 1 ? "warn" : ""}">${REPORT[y.sc]}</span>${y.sc && y.coach ? ' <span class="tiny muted">+ coaches</span>' : ""}${y.scT || y.coachT ? `<br><span class="tiny muted">${y.scT || y.coachT}</span>` : ""}` },
    cols[4], cols[5], cols[6],
    { k: "rm", l: "", f: y => UI.yShowRemoved ? `<button class="btn sm" data-a="yunhide" data-v="${y.id}">Restore</button>` : `<button class="btn sm" data-a="yunscout" data-v="${y.id}" title="Not good enough: take him off your scouted list (his report is kept)" aria-label="Remove ${esc(y.name)} from the scouted list">✕</button>` }];
  const scoutedCard = `<section class="card"><div class="card-h"><h2>Scouted prospects</h2><span class="small">${scouted.length} watched, not offered · ${scouted.filter(y => y.commit == null).length} still undecided · Hours this week <b class="num">${S.rec.hours}/${recHours()}</b></span></div>
    ${scoutAssistHtml()}
    ${table("youth-sc", scoutCols, scouted, { sort: { k: "st", d: -1 }, empty: UI.yShowRemoved ? "Nobody removed." : yRemovedN ? "Everyone you've scouted has been removed from this list." : "You haven't scouted any prospects yet. Use Scout on anyone in the list below: each visit narrows his potential, and a detailed report shows his injury risk and what matters most to him." })}
    ${yRemovedN ? `<p class="small muted" style="margin-top:8px">${UI.yShowRemoved ? `Showing the ${yRemovedN} you removed. Restore puts a prospect back on your list.` : `${yRemovedN} removed from this list.`} <button class="lnk" data-a="yshowremoved">${UI.yShowRemoved ? "Back to your list" : "Show removed"}</button></p>` : ""}</section>`;
  const offerCols = [cols[0], cols[1], cols[2], cols[3], scoutCols[5], cols[4],
    { k: "ost", l: "Offer", v: y => y.commit != null ? 2 : yourRank(y), f: y => y.commit != null ? `<span class="bad">Chose</span> ${clubA(y.commit, { short: true })}` : `${rankLabel(y)}<br><span class="tiny muted">${y.offers[0] === c.id ? '<b class="good">you offered first</b> · ' : `${C(y.offers[0]).short} offered first · `}${y.offers.length - 1 ? `${y.offers.length - 1} other offer${y.offers.length > 2 ? "s" : ""}` : "only offer so far"}</span>` },
    cols[6]];
  const pending = offered.filter(y => y.commit == null).length;
  const offeredCard = `<section class="card"><div class="card-h"><h2>Offered places</h2><span class="small">${pending} waiting on a decision${offered.length > pending ? ` · ${offered.length - pending} chose elsewhere` : ""} · Places offered <b class="num">${S.rec.offers}/${offerCap()}</b></span></div>
    ${table("youth-of", offerCols, offered, { sort: { k: "ost", d: 1 }, empty: "You haven't offered anyone a place yet. Offer from a prospect's Actions: an offer lifts his interest, being the first club to offer gives you an edge over later ones, and he decides during the season. Those who accept move to Committed to you." })}</section>`;
  const classCard = `<section class="card"><div class="card-h"><h2>Youth recruitment · class of ${S.year + 1}</h2>
    <span class="small">Hours this week <b class="num">${S.rec.hours}/${recHours()}</b> · Places offered <b class="num">${S.rec.offers}/${offerCap()}</b> · Youth development <b class="num">${c.academy}/20</b></span></div>
    <div class="prose small" style="margin-bottom:12px"><p>Fifteen-year-olds from England and abroad choose an academy this season and join next summer. Each weighs six things differently, with two that matter most to him: distance from home, a route to first-team minutes, whether your formation uses his position, squad dynamics, prestige and your youth development rating. Scouting narrows his rating and reveals what he cares about; speaking to his youth coaches (a sharper estimate of his potential, his injury history and a small word in his ear), calls, hosting him at your ground and visiting his family at home build the relationship (a home visit counts most with lads who want to stay near home or care about squad dynamics). Commitments start from week 9 and aren't binding until signing day, so a better offer can still flip a prospect, yours included.</p></div>
    <div class="filters"><label class="f">Position<select id="yf-pos" data-c="yf-pos"><option value="ALL">Any</option>${ROLES.map(r => `<option value="${r}" ${f.pos === r ? "selected" : ""}>${ROLE_NAME[r]}</option>`).join("")}</select></label>
      <label class="f">Show<select id="yf-st" data-c="yf-st">${[["OPEN", "Undecided"], ["MINE", "Your targets"], ["DONE", "Committed"], ["ALL", "Everyone"]].map(([k, l]) => `<option value="${k}" ${f.st === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    ${ctyTogHtml(S.set.yCtyOff, "ycty")}
    ${table("youth", cols, ys, { sort: { k: "st", d: -1 }, empty: (S.set.yCtyOff || []).length >= KNOW_KEYS.length ? "No countries selected." : "No prospects match." })}</section>`;
  const commitCard = `<section class="card"><div class="card-h"><h2>Committed to you</h2></div>${commits.length ? commits.map(y => `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span><button class="lnk" data-a="prospect" data-v="${y.id}">${esc(y.name)}</button> <span class="pos">${y.pos}</span> <span class="muted small">${esc(y.region)}</span></span>${rangeHtml(prospectPot(y))}</div>`).join("") : '<p class="muted">No commitments yet.</p>'}</section>`;
  /* Tabs rather than one long page: on a phone the class list sat below two other tables. */
  const yfavs = S.prospects.filter(y => (S.yfav || {})[y.id]);
  const favCard = `<section class="card"><div class="card-h"><h2>Favourite prospects</h2><span class="small">${yfavs.length} starred · Hours this week <b class="num">${S.rec.hours}/${recHours()}</b></span></div>
    ${table("youth-fav", [...scoutCols.slice(0, -1), { k: "fv", l: "", f: y => starBtn(y.id, "yfav", true) }], yfavs, { sort: { k: "st", d: -1 }, empty: "No favourites yet. Open a prospect and tap the ☆ by his name to add him here." })}</section>`;
  const tabs = [["offered", "Offered", offered.filter(y => y.commit == null).length], ["scouted", "Scouted", scoutedAll.length - yRemovedN], ["fav", "Favourites", yfavs.length], ["all", "All prospects", null], ["committed", "Committed", commits.length]];
  const tab = UI.ytab || "offered";
  const body = { offered: offeredCard, scouted: scoutedCard, fav: favCard, all: classCard, committed: commitCard }[tab] || offeredCard;
  return `<div class="stack">${hoursStrip()}<div class="seg lv-tabs y-tabs" role="tablist">${tabs.map(([v, l, n]) => `<button role="tab" data-a="ytab" data-v="${v}" aria-pressed="${tab === v}" aria-selected="${tab === v}">${l}${n != null ? ` <span class="tab-n">${n}</span>` : ""}</button>`).join("")}</div>${body}</div>`;
}
function yourRank(y) { const cs = contenders(y); const i = cs.findIndex(x => x.c.id === S.club); return i < 0 ? 99 : i; }
function rankLabel(y) {
  const cs = contenders(y), i = cs.findIndex(x => x.c.id === S.club), n = cs.length;
  if (i < 0) return `<span class="muted">${n ? n + " club" + (n > 1 ? "s" : "") + " in for him" : "Nobody yet"}</span>`;
  return `<span class="${i === 0 ? "good" : i <= 2 ? "" : "warn"}">${ord(i + 1)} of ${n}</span>`;
}

/* ---------- finances ---------- */
/* Cup income this season: each competition you're in, how far you've got, your share of the gates and the
   prize money (prize money for qualifying for Europe included). */
function cupIncomeCard(c) {
  const f = c.fin || {}, got = f.cups || {}, keys = ["FA", "LC", "CC", "CS", "CT", ...Object.keys(S.ko).filter(k => S.ko[k].kind === "po")];
  const rows = keys.map(k => ({ k, e: got[k] || { gate: 0, prize: 0 }, prog: cupProgress(k) })).filter(r => r.prog || r.e.gate || r.e.prize);
  const name = k => k === "FA" ? CUPS.FA.name : k === "LC" ? CUPS.LC.name : CONT[k] ? CONT[k].name : S.ko[k] ? S.ko[k].name : k;
  const tot = rows.reduce((a, r) => ({ gate: a.gate + r.e.gate, prize: a.prize + r.e.prize }), { gate: 0, prize: 0 });
  return `<section class="card"><div class="card-h"><h2>Cup income</h2><span class="eyebrow">${seasonLabel(S.year)}</span></div>
    ${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Competition</th><th>How far</th><th class="r">Gate share</th><th class="r">Prize money</th><th class="r">Total</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(name(r.k))}</td><td class="small ${r.prog ? r.prog.cls : "muted"}">${r.prog ? r.prog.t : "—"}</td><td class="r num">${money(r.e.gate)}</td><td class="r num">${money(r.e.prize)}</td><td class="r num"><b>${money(r.e.gate + r.e.prize)}</b></td></tr>`).join("")}
      <tr class="tot"><td><b>All cups</b></td><td></td><td class="r num"><b>${money(tot.gate)}</b></td><td class="r num"><b>${money(tot.prize)}</b></td><td class="r num"><b>${money(tot.gate + tot.prize)}</b></td></tr></tbody></table></div>
      <p class="tiny muted" style="margin-top:6px">Domestic cup gates are shared with the other club (finals at a neutral venue too); European and play-off home gates are yours. Cup gates also count in ticket sales above, and prize money (including for qualifying for Europe) in Prize money.</p>`
      : '<p class="small muted">No cup matches yet this season.</p>'}</section>`;
}
/* ---------- season projections ---------- */
/* The full financial year (season start to the summer share paid at season's end), on a cash basis: what has
   come in and gone out so far, plus what the club's settings say will come and go in the weeks left. Known
   flows are projected (broadcast and commercial income, sponsorship, league gates at today's ticket forecast,
   the merit payment for your current position, wages, running costs, scouting, stadium works, the cost-ratio
   levy). Money that depends on what hasn't happened (cup runs, sponsor bonuses, future transfers) counts only
   once it's real. In the summer it projects the coming season from zero, since the accounts reset at kick-off. */
function finProjection(c) {
  const summer = S.phase !== "season", f = summer ? c.pre || {} : c.fin, g = k => f[k] || 0;  // preseason: this summer's transfers
  const lastW = S.days.length ? S.days[S.days.length - 1].w : 41, remWk = summer ? lastW + 1 : Math.max(0, lastW + 1 - S.week);
  const share = (remWk + 10) / 52;  // weekly flows for the rest of the season, plus the ten-week summer share
  const rs = summer ? c.revBase : c.revSeason, wageBill = sum(c.squad, id => P(id).wage);
  const L = S.leagues[c.lg], rounds = summer ? [] : L.fixtures.slice((L.results || []).length);
  const homeLeft = summer ? homeGames(c) : sum(rounds, rd => rd.filter(([h]) => h === c.id).length);
  const perGate = c.cap ? ticketForecast(c, c.tkt || 1).income : 0;
  const n = L.clubs.length, pos = summer ? clamp(S.expPos || Math.ceil(n / 2), 1, n) : standings(L).findIndex(r => r.id === c.id) + 1;
  const merit = c.revBase * (LG[c.lg].tier === 1 ? .2 : .06) * (n - pos) / (n - 1);
  const cupGate = g("cupGate"), lgGate = g("gate") - cupGate, spons = g("spons"), other = g("rev") - g("gate") - spons;
  const inc = [
    ["Broadcast and commercial", other, rs * share],
    ["Sponsorship", spons, sponsorTotal(c) * share],
    ["League ticket sales", lgGate, perGate * homeLeft, `${homeLeft} home game${homeLeft === 1 ? "" : "s"} left at about ${money(perGate)}`],
    ["League merit payment", 0, merit, `paid at the end of the season; ${ord(pos)} ${summer ? "(the board's target)" : "as things stand"}`],
    ["Cups: gates and prize money", cupGate + g("prize"), 0, "only what you've earned: a cup run adds more"],
    ["Player sales", g("sold"), 0, "fees received"],
  ];
  if (g("scheme")) inc.push(["Owner deals", g("scheme"), 0]);
  const b = c.build, cost = [
    ["Wages", g("wages"), wageBill * share, `${perWeek(wageBill)} today`],
    ["Staff and running costs", g("ops"), rs * .2 * share],
    ["Scouting network", g("scouting"), S.rec.scoutLvl * scoutCost() * remWk / 52],
    ["Stadium works", g("stadium"), b ? b.perWeek * Math.min(b.left, remWk) : 0],
    ["Transfer fees paid", g("bought"), 0],
    ...(duesOf(c).list.length && summer ? [["Deferred fee instalments", 0, duesOf(c).next, "due at kick-off on fees you spread over several years"]] : []),
    ["Agent fees", g("agent"), 0],
  ];
  const ratio = scr(c), rev = annualIncome(c) + oneOffs(c);
  const levy = ratio > RULES.scrLimit && ratio <= RULES.scrSporting ? Math.round((ratio - RULES.scrLimit) * rev * .5) : 0;
  const amn = S.amnesty && S.amnesty.y === S.year && S.amnesty.club === c.id && !summer;
  if (amn) cost.push(["Cost-ratio levy", g("levy"), 0, `amnesty this season: no levy, charge or deduction at ${pct(ratio)}`]); else
  cost.push(["Cost-ratio levy", g("levy"), levy, ratio > RULES.scrSporting ? `ratio ${pct(ratio)}: above ${pct(RULES.scrSporting)} that's a charge and a points deduction, not a levy` : levy ? `ratio ${pct(ratio)} against ${pct(RULES.scrLimit)}` : ""]);
  const tot = rows => rows.reduce((a, r) => [a[0] + r[1], a[1] + r[1] + r[2]], [0, 0]);
  const [incSo, incAll] = tot(inc), [costSo, costAll] = tot(cost);
  // The board takes half of any cash above a year's base income at the end of the season: without it the
  // first test overstated a Premier club's closing cash by 13M (94.2M projected, 80.9M actual).
  const pre = c.cash + (incAll - incSo) - (costAll - costSo), invest = Math.max(0, (pre - c.revBase) * .5);
  return { summer, inc, cost, incSo, incAll, costSo, costAll, net: incAll - costAll, endCash: pre - invest, invest, ratio, remWk, wageBill };
}
function projectionCard(c) {
  const P_ = finProjection(c), row = r => `<tr><td>${r[0]}${r[3] ? `<br><span class="tiny muted">${r[3]}</span>` : ""}</td>${P_.summer ? "" : `<td class="num">${money(r[1])}</td>`}<td class="num">${r[1] + r[2] ? money(r[1] + r[2]) : "—"}</td></tr>`;
  const cols = P_.summer ? "<th></th><th class=\"num\">Projected</th>" : "<th></th><th class=\"num\">So far</th><th class=\"num\">Full season</th>";
  const sub = (l, a, b2, cls) => `<tr class="tot"><td>${l}</td>${P_.summer ? "" : `<td class="num">${money(a)}</td>`}<td class="num ${cls || ""}">${money(b2)}</td></tr>`;
  return `<section class="card"><div class="card-h"><h2>Season projection</h2><span class="eyebrow">${P_.summer ? `${seasonLabel(S.year + (S.phase === "summer" ? 0 : 1))} ahead` : `${P_.remWk} weeks left`}</span></div>
    <div class="proj-head"><span>Projected ${P_.net >= 0 ? "profit" : "loss"}</span><b class="${P_.net >= 0 ? "good" : "bad"}">${P_.net >= 0 ? "+" : "−"}${money(Math.abs(P_.net))}</b><span class="small muted">Cash at the end of the season: about <b>${money(P_.endCash)}</b>${P_.invest ? ` (after the board invests ${money(P_.invest)} of surplus)` : ""}</span></div>
    <div class="proj-wrap"><table class="proj"><thead><tr>${cols}</tr></thead><tbody>
      <tr class="sec"><td colspan="3">Income</td></tr>${P_.inc.map(row).join("")}${sub("Total income", P_.incSo, P_.incAll)}
      <tr class="sec"><td colspan="3">Costs</td></tr>${P_.cost.map(row).join("")}${sub("Total costs", P_.costSo, P_.costAll)}
      ${sub(P_.net >= 0 ? "Profit" : "Loss", P_.incSo - P_.costSo, P_.net, P_.net >= 0 ? "good" : "bad")}</tbody></table></div>
    <p class="tiny muted" style="margin-top:6px">${P_.summer ? "Preseason: this is the coming season from kick-off, at today's squad, wages and prices. Transfers this summer count in the coming season's accounts." : "Cash basis: transfer fees count when paid, not spread over the contract."} Sponsor bonuses (promotion, Europe, a cup) and cup runs come on top. Cash above a year's base income at the end of the season: the board invests half of it in the club.</p></section>`;
}
/* Transfer budget: the smaller of what your cash can pay without ending the season in the red, and what the
   Squad Cost Ratio has room for before the levy line (fees count in the ratio as fee ÷ contract years). */
function transferBudget(c) {
  const pj = finProjection(c), f = (S.phase === "summer" ? c.pre : c.fin) || {}, rev = annualIncome(c) + oneOffs(c);
  const cost = sum(c.squad, id => P(id).wage + (P(id).am ? P(id).am.per : 0)), room = RULES.scrLimit * rev - cost;
  const xi = (S.lineup || []).filter(x => x != null).map(P), wage = xi.length ? sum(xi, p => p.wage) / xi.length : c.squad.length ? sum(c.squad, id => P(id).wage) / c.squad.length : 0;
  const yrs = 4, wkLeft = (pj.remWk + 10) / 52;
  // Cash: a signing costs fee × 1.05 now plus his wages for the rest of this season.
  const byCash = Math.max(0, (pj.endCash - wage * wkLeft) / 1.05), byRatio = Math.max(0, (room - wage) * yrs);
  return { pj, room, wage, yrs, byCash, byRatio, budget: Math.min(byCash, byRatio), net: (f.sold || 0) - (f.bought || 0) - (f.agent || 0), sold: f.sold || 0, bought: f.bought || 0, agent: f.agent || 0, ratio: scr(c) };
}
function transferBudgetCard(c) {
  const t = transferBudget(c), lim = t.byCash <= t.byRatio ? "cash" : "ratio";
  return `<section class="card"><div class="card-h"><h2>Transfer budget</h2><span class="eyebrow">${t.pj.summer ? "for the coming season" : "rest of this season"}</span></div>
    <div class="proj-head"><span>You can spend about</span><b class="${t.budget > 0 ? "good" : "bad"}">${money(Math.round(t.budget / 1e5) * 1e5)}</b><span class="small muted">on a fee for a player on ${perWeek(t.wage)} (your starters' average) over ${t.yrs} years · limited by ${lim === "cash" ? "cash" : "the cost ratio"}</span></div>
    <dl class="ledger small">
      <dt>Cash: keeps you out of the red at season's end</dt><dd>${money(t.byCash)}</dd>
      <dt>Cost ratio: room under ${pct(RULES.scrLimit)} (now ${pct(t.ratio)})</dt><dd class="${t.room < 0 ? "bad" : ""}">${t.room < 0 ? `over by ${money(-t.room)} a year` : `${money(t.room)} a year → ${money(t.byRatio)} fee`}</dd>
      ${duesOf(c).total ? `<dt>Deferred fees still owed</dt><dd class="bad">${money(duesOf(c).total)} <span class="tiny muted">(${money(duesOf(c).next)} at the start of next season${t.pj.summer ? ", counted above" : ""})</span></dd>` : ""}
      <dt>Fees received this season</dt><dd class="good">${money(t.sold)}</dd><dt>Fees and agents paid</dt><dd class="bad">${money(-(t.bought + t.agent))}</dd>
      <dt class="tot">Net transfer spend</dt><dd class="tot ${t.net >= 0 ? "good" : "bad"}">${t.net >= 0 ? "+" : "−"}${money(Math.abs(t.net))}</dd></dl>
    <p class="tiny muted" style="margin-top:6px">A fee counts in the cost ratio as fee ÷ contract years, plus his wage; selling a player adds the profit over his book value to revenue. Projected season result: <b class="${t.pj.net >= 0 ? "good" : "bad"}">${t.pj.net >= 0 ? "+" : "−"}${money(Math.abs(t.pj.net))}</b> (Finances page).</p></section>`;
}
function viewFinances() {
  const c = me(), f = c.fin, ratio = scr(c);
  const mk = v => clamp(v / 1.5 * 100, 0, 100);
  const cases = S.cases.filter(k => !isForeign(C(k.club))).slice(-12).reverse();
  const acadCost = Math.round((c.academy + 1) * 1.5e6 * MONEY * [0, 1, .15, .05, .03, .012, .005][c.tier]);
  return `<div class="grid2"><div class="stack">${projectionCard(c)}${transferBudgetCard(c)}<section class="card"><div class="card-h"><h2>Squad Cost Ratio</h2><span class="eyebrow">${seasonLabel(S.year)}</span></div>
    <div class="prose"><p>Wages, transfer amortisation and agent fees, as a share of football revenue plus profit on player sales. Above <b>${pct(RULES.scrLimit)}</b> you pay a levy at the end of the season; above <b>${pct(RULES.scrSporting)}</b> you are charged and face a points deduction the following season.</p></div>
    <div class="gauge" role="img" aria-label="Projected ratio ${pct(ratio)}"><span class="tick" style="left:${mk(.85)}%">85%</span><span class="tick" style="left:${mk(1.15)}%">115%</span><span class="mk" style="left:${mk(ratio)}%"><span>${pct(ratio)}</span></span></div>
    <p class="small muted">Projected for the full season at today's wage bill and income. ${c.lastSCR ? `Last season: ${pct(c.lastSCR)}.` : ""}</p></section>
    <section class="card"><div class="card-h"><h2>This season so far</h2></div><dl class="ledger">
      <dt>Broadcast, commercial and matchday</dt><dd>${money(f.rev)}</dd><dt class="tiny" style="padding-left:12px">of which ticket sales</dt><dd class="tiny">${money(f.gate || 0)}</dd>${f.cupGate ? `<dt class="tiny" style="padding-left:24px">of which cup ties</dt><dd class="tiny">${money(f.cupGate)}</dd>` : ""}<dt class="tiny" style="padding-left:12px">of which sponsorship</dt><dd class="tiny">${money(f.spons || 0)}</dd><dt>Prize money</dt><dd>${money(f.prize + f.merit)}</dd><dt>Player sales (fees received)</dt><dd>${money(f.sold)}</dd>${f.scheme ? `<dt>Connected-party income</dt><dd>${money(f.scheme)}</dd>` : ""}
      <dt>Wages</dt><dd class="bad">${money(-f.wages)}</dd><dt>Staff and running costs</dt><dd class="bad">${money(-f.ops)}</dd><dt>Transfer fees paid</dt><dd class="bad">${money(-f.bought)}</dd><dt>Agent fees</dt><dd class="bad">${money(-f.agent)}</dd>${f.stadium ? `<dt>Stadium works</dt><dd class="bad">${money(-f.stadium)}</dd>` : ""}<dt>Scouting network</dt><dd class="bad">${money(-f.scouting)}</dd>${f.levy ? `<dt>Cost-ratio levy</dt><dd class="bad">${money(-f.levy)}</dd>` : ""}
      <dt class="tot">Cash in the bank</dt><dd class="tot">${money(c.cash)}</dd></dl>
      <p class="small muted" style="margin-top:8px">Annual income at this level: about ${money(annualIncome(c))}, of which ${money(sponsorTotal(c))} sponsorship and about ${money(matchdayEstimate(c))} ticket sales. Transfer fees are spread over the contract (amortisation: ${money(sum(c.squad, id => P(id).am ? P(id).am.per : 0))} a year).</p></section>
    ${cupIncomeCard(c)}</div>
    <div class="stack">${sponsorCard(c)}${stadiumCard(c)}<section class="card"><div class="card-h"><h2>Scouting & academy</h2></div>
      <div class="prose"><p>Scouting network: <b>level ${S.rec.scoutLvl}</b> (${money(S.rec.scoutLvl * scoutCost())} a year) gives ${recHours()} recruiting hours a week.</p>
      <div class="row"><button class="btn sm" data-a="scout" data-v="-1" ${S.rec.scoutLvl <= 1 ? "disabled" : ""}>Reduce</button><button class="btn sm" data-a="scout" data-v="1" ${S.rec.scoutLvl >= 5 ? "disabled" : ""}>Expand</button></div>
      <p>Youth development: <b>${c.academy}/20</b>. It sets the potential of each summer's academy graduates, attracts prospects, develops under-21s faster and lets you offer more places. A small club with a great academy can produce stars.</p>
      <div class="row"><button class="btn sm" data-a="academy" data-v="${acadCost}" ${c.academy >= 20 || c.cash < acadCost ? "disabled" : ""}>Upgrade for ${money(acadCost)}</button></div></div></section>
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
  const ah = S.history.find(h => h.year === UI.awY) || S.history[0], akeys = ah ? [...ENG_LGS, ...TOP_LGS.slice(1)].filter(k => ah.L[k]) : [], ak = akeys.includes(UI.awL) ? UI.awL : (ah && ah.L[me().lg] ? me().lg : akeys[0]);
  const awardsCard = ah ? `<section class="card"><div class="card-h"><h2>Awards</h2><div class="row"><select data-c="awy" aria-label="Season">${S.history.map(h => `<option value="${h.year}" ${h === ah ? "selected" : ""}>${seasonLabel(h.year)}</option>`).join("")}</select><select data-c="awl" aria-label="League">${akeys.map(k => `<option value="${k}" ${k === ak ? "selected" : ""}>${LG[k].foreign ? COUNTRY[LG[k].c].name + ": " : ""}${leagueName(k)}</option>`).join("")}</select></div></div>${awardsHtml(ah.L[ak])}${(S.me.awards || []).length ? `<p class="small" style="margin-top:10px"><b>Your manager awards:</b> ${S.me.awards.map(esc).join("; ")}</p>` : ""}</section>` : "";
  return `<div class="stack"><section class="card"><div class="card-h"><h2>Your career</h2></div>${S.career.length ? table("career", [{ k: "y", l: "Season", f: r => seasonLabel(r.year) }, { k: "c", l: "Club", f: r => clubA(r.club) }, { k: "l", l: "League", f: r => leagueName(r.lg) }, { k: "p", l: "Finish", r: 1, f: r => ord(r.pos) }, { k: "e", l: "Target", r: 1, f: r => ord(r.exp) }, { k: "t", l: "Trophies", f: r => r.trophies.map(trophyName).join(", ") || "—" }], S.career) : '<p class="muted">Finish a season to start your record.</p>'}
    <p class="small" style="margin-top:8px">${esc(c.name)} honours: ${c.trophies.length ? c.trophies.map(t => `${trophyName(t.t)} ${seasonLabel(t.y)}`).join(", ") : "none yet"}.</p></section>
    ${awardsCard}
    ${seasons || '<section class="card"><p class="muted">League history fills in at the end of each season.</p></section>'}
    ${S.history.length > UI.histN ? `<button class="btn" data-a="morehist">Show older seasons</button>` : ""}
    <section class="card"><div class="card-h"><h2>Hall of fame</h2><span class="small muted">Retired players with long or decorated careers</span></div>${hof.length ? table("hof", [{ k: "n", l: "Player", f: h => `<b>${esc(h.name)}</b> <span class="tiny muted">${h.nat}</span>` }, { k: "pos", l: "Pos", f: h => h.pos }, { k: "y", l: "Career", f: h => `${h.y0}–${h.y1}` }, { k: "a", l: "Apps", r: 1, f: h => h.apps }, { k: "g", l: "Goals", r: 1, f: h => h.goals }, { k: "pk", l: "Peak", r: 1, f: h => h.peak }, { k: "c", l: "Clubs", f: h => h.clubs.join(", "), cls: "hide-sm" }, { k: "aw", l: "Awards", r: 1, f: h => h.awards.length }], hof) : '<p class="muted">Nobody has retired with a hall-of-fame career yet.</p>'}</section>
    <section class="card"><div class="card-h"><h2>Save file</h2></div><p class="small" style="margin-bottom:8px">Your career saves automatically in this browser. Export a copy to back it up or move it to another device, then import it there.</p>
    <div class="row"><button class="btn" data-a="landing">Your careers</button><button class="btn" data-a="export">Export save</button><label class="btn" for="import-file" style="cursor:pointer">Import save</label><input type="file" id="import-file" accept=".json,application/json" data-c="import" hidden></div><p class="tiny muted" style="margin-top:6px">Exporting doesn't work inside the Claude preview; use the installed or GitHub Pages version.</p></section></div>`;
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
  if (UI.loanPick === p.id && mine) {
    const ds = loanDestinations(p, { mix: true });
    actions = `<div><h3 style="margin-bottom:6px">Where should ${esc(sur(p))} go on loan?</h3>${ds.length ? ds.map(d => `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span>${clubA(d.id, { flag: 1 })} <span class="tiny muted">${isForeign(d) ? COUNTRY[d.country].name + " · " : ""}${leagueName(d.lg)} · squad ${r20(clubLevel(d)).toFixed(1)} · would start</span></span><button class="btn sm" data-a="loan-to" data-v="${p.id}|${d.id}">Loan here</button></div>`).join("") : '<p class="small muted">No club with room for him would play him regularly right now.</p>'}
      <p class="tiny muted" style="margin-top:6px">A season-long loan; the borrowing club pays his wages. Abroad he gains experience but not English homegrown time${p.age <= 20 ? `: he has ${p.yt.ENG || 0} of the 3 seasons he needs` : ""}.</p><button class="btn sm" data-a="loan-cancel" style="margin-top:6px">Cancel</button></div>`;
  } else if (cf && cf.id === p.id) actions = `<div class="row"><span class="small">${esc(cf.msg)}</span><button class="btn sm danger" data-a="confirm-yes">${cf.yes}</button><button class="btn sm" data-a="confirm-no">Cancel</button></div>`;
  else if (mine) {
    const r = renewTerms(p);
    actions = `<div class="row">${p.yrs <= 2 ? `<button class="btn sm" data-a="renew" data-v="${p.id}" ${r.happy ? "" : "disabled"} title="${esc(r.reason || (p.loy > .75 ? "Loyal to the club: he asks less to stay" : ""))}">Renew (${perWeek(r.wage)}, 4 yrs${p.loy > .75 ? ", loyal" : ""})</button>` : ""}
      ${loanable(p) ? `<button class="btn sm" data-a="ask-loan" data-v="${p.id}" ${windowOpen() ? "" : "disabled"}>Loan out</button>` : ""}
      ${p.acad ? `<button class="btn sm" data-a="promote" data-v="${p.id}">Promote to first team</button>` : p.age <= ACAD_MAX_AGE ? `<button class="btn sm" data-a="demote" data-v="${p.id}">Send to academy</button>` : ""}
      <button class="btn sm" data-a="list" data-v="${p.id}">${p.listed ? "Remove from transfer list" : "Put on transfer list"}</button>
      ${p.listed ? `<label class="row small" style="gap:6px">Asking <select data-c="list-pct">${[.8, .9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2].map(k => `<option value="${k}" ${Math.abs(k - (p.listPct || 1)) < .01 ? "selected" : ""}>${money(Math.round(value(p) * k / 1e4) * 1e4)} (${Math.round(k * 100)}%)</option>`).join("")}</select></label>` : ""}
      <button class="btn sm" data-a="ask-sell" data-v="${p.id}" ${windowOpen() ? "" : "disabled"}>Sell abroad (${money(Math.round(value(p) * .8 / 1e4) * 1e4)})</button>
      <button class="btn sm danger" data-a="ask-release" data-v="${p.id}">Release</button></div>${!r.happy && p.yrs <= 2 ? `<p class="small warn">${esc(r.reason)}</p>` : ""}`;
  } else if (onLoanFromMe) actions = `<p class="small">On loan at ${clubA(p.club)} until the end of the season.</p>`;
  else if (loanedIn) actions = `<div class="row"><span class="small">On loan from ${clubA(p.loan.from)} until the end of the season.</span><button class="btn sm danger" data-a="ask-endloan" data-v="${p.id}">Send back to ${esc(C(p.loan.from).short)}</button></div>`;
  else if (S.club != null && p.age >= 17 && !p.loan) {
    const [l, k] = willingLabel(willingness(p, me()));
    actions = `<div class="row"><button class="btn sm" data-a="bid" data-v="${p.id}" ${windowOpen() ? "" : "disabled"}>${c ? `Make an offer (asking ${money(askingPrice(p))})` : "Offer a contract"}</button>${c && loanable(p) && !wouldStart(p, c) ? `<button class="btn sm" data-a="loanin" data-v="${p.id}" ${windowOpen() ? "" : "disabled"} title="On loan you pay his wage">Ask to loan (you pay ${perWeek(p.wage)})</button>` : ""}<span class="small">Interest in joining you: <b class="${k === "ok" ? "" : k}">${l}</b></span></div>`;
  }
  return mHead(esc(p.name) + (mine ? "" : " " + starBtn(p.id, "fav", !!(S.fav || {})[p.id])), `${ROLE_NAME[p.pos]} · ${NAT_NAME[p.nat] || p.nat} · ${p.age}`, c ? c.color : "var(--muted)", c ? crest(c, 36) : "") + `<div class="modal-b">
    <dl class="facts"><div><dt>Rating</dt><dd class="num">${ratingHtml(p)} <span class="muted tiny">/ 20</span></dd></div><div><dt>Potential</dt><dd>${potHtml(p)} <span class="muted tiny">/ 20</span></dd></div><div><dt>Injury proneness</dt><dd>${injHtml(p)} <span class="muted tiny">/ 20</span></dd></div><div><dt>Club</dt><dd>${c ? clubA(c.id, { flag: 1 }) : "Free agent"}</dd></div>
      <div><dt>Value</dt><dd class="num">${money(value(p))}</dd></div><div><dt>Wage</dt><dd class="num">${p.club >= 0 ? perWeek(p.wage) : "—"}</dd></div><div><dt>Contract</dt><dd>${c ? p.yrs + " yr" + (p.yrs === 1 ? "" : "s") : "—"}</dd></div>
      <div><dt>Fitness</dt><dd>${fitBar(p.fit)} ${Math.round(p.fit)}</dd></div><div><dt>Mood</dt><dd>${moodTag(p)}</dd></div><div><dt>Homegrown</dt><dd>${Object.entries(p.yt).filter(([, v]) => v >= RULES.hgYears).map(([k]) => COUNTRY[k] ? COUNTRY[k].name : k).join(", ") || "No"}</dd></div>
      ${(h => h ? `<div><dt>Coaches' view</dt><dd class="${h[1]}">${h[0]}</dd></div>` : "")(gsHint(p))}
      <div><dt>Season</dt><dd class="num">${p.s.app} apps · ${p.s.g} g · ${p.s.a} a</dd></div>${p.s.sh || p.s.kp || p.s.sv ? `<div><dt>Advanced</dt><dd class="num small">${p.pos === "GK" ? `${p.s.sv || 0} saves · ${p.s.cs} clean sheets` : `${p.s.sh || 0} shots (${p.s.sot || 0} on) · ${(p.s.xg || 0).toFixed(1)} xG · ${p.s.kp || 0} key passes · ${(p.s.xa || 0).toFixed(1)} xA`}</dd></div>` : ""}<div><dt>Avg rating</dt><dd class="num">${avg}</dd></div><div><dt>Career</dt><dd class="num">${p.tot[0] + p.s.app} apps · ${p.tot[1] + p.s.g} g</dd></div></dl>
    ${attrPanel(p)}
    ${p.inj ? `<p class="small bad">${esc(p.injT ? p.injT.charAt(0).toUpperCase() + p.injT.slice(1) : "Injured")}: out for ${injLength(p.inj)}.</p>` : ""}
    ${statusChips(p, c) ? `<div>${statusChips(p, c)}</div>` : ""}
    ${reasons.length ? `<div class="small">${reasons.map(([t, s]) => `<span class="${s > 0 ? "good" : s < 0 ? "bad" : ""}">● ${esc(t)}</span>`).join("&nbsp;&nbsp; ")}</div>` : ""}
    ${(p.awards || []).length ? `<p class="small"><b>Honours:</b> ${p.awards.map(esc).join("; ")}</p>` : ""}
    ${actions}
    <div><h3 style="margin-bottom:6px">Career</h3>${table("hist-" + p.id, [{ k: "y", l: "Season", f: h => seasonLabel(h[0]) }, { k: "c", l: "Club", f: h => (S.clubs[h[2]] ? clubA(h[2], { short: true }) : h[1]) + (h[7] ? ' <span class="tiny muted">loan</span>' : "") }, { k: "a", l: "Apps", r: 1, f: h => h[3] }, { k: "g", l: "Goals", r: 1, f: h => h[4] }, { k: "as", l: "Assists", r: 1, f: h => h[5] }, { k: "r", l: "Avg", r: 1, f: h => h[6].toFixed(2) }], p.hist.slice().reverse(), { empty: "No completed seasons yet." })}</div></div>`;
}
function attrPanel(p) {
  const lvl = scoutLevel(p), main = attrKeys(p.pos), rest = allKeys(p.pos).filter(k => !main.includes(k));
  const row = k => { const l = ATTR_NAME[k]; const v = attrView(p, k); return `<div class="attr"><span>${l}</span><span class="abar">${v ? `<i style="left:${(v[0] - 1) / 19 * 100}%;width:${Math.max(2, (v[1] - v[0]) / 19 * 100)}%" class="${aCls((v[0] + v[1]) / 2)}"></i>` : ""}</span><b class="num">${v ? (v[0] === v[1] ? v[0] : v[0] + "–" + v[1]) : "?"}</b></div>`; };
  const rows = main.map(row).join("") + (rest.length ? `<details class="attr-more"><summary class="small muted">Other attributes (used out of position)</summary>${rest.map(row).join("")}</details>` : "");
  const need = lvl < 2 ? `<div class="row" style="margin-top:6px"><span class="small muted">${lvl === 0 ? "Not scouted: attributes unknown, and the rating is a rough band (wider in leagues you know less well)." : "Partly scouted: attributes are ranges."}</span><button class="btn sm" data-a="scoutp" data-v="${p.id}">Scout him (${scoutHours(2, playerCountry(p))}h${travelCost(playerCountry(p)) ? `, ${money(travelCost(playerCountry(p)))} travel` : ""}; ${S.rec.hours}h left)</button><span class="tiny muted">Your knowledge of ${KNOW_NAME(playerCountry(p))}: ${Math.floor(knowOf(playerCountry(p)))}/20</span></div>` : "";
  return `<div><h3 style="margin-bottom:6px">${LINE_NAME[LINE[p.pos]]} attributes <span class="tiny muted">out of 20</span></h3><div class="attrs">${rows}</div>${need}</div>`;
}
function modalClub(c) {
  const L = S.leagues[c.lg], ps = c.squad.map(P).sort((a, b) => ROLE_ORDER[a.pos] - ROLE_ORDER[b.pos] || b.ovr - a.ovr);
  return mHead(esc(c.name), `${leagueName(c.lg)} · ${esc(c.region)}, ${COUNTRY[c.country].name}${c.gone ? ` · dropped out ${seasonLabel(c.goneYear)}` : ""}`, c.color, crest(c, 40)) + `<div class="modal-b">
    <dl class="facts">${c.gone ? "" : `<div><dt>Position</dt><dd>${ord(posIn(L, c.id))}</dd></div>`}<div><dt>Squad level</dt><dd class="num">${r20(clubLevel(c)).toFixed(1)} / 20</dd></div><div><dt>Prestige</dt><dd class="num">${c.rep}</dd></div>
      <div><dt>Formation</dt><dd>${isUser(c) ? c.formation : (F => `${F.usual}<br><span class="tiny muted">coach prefers ${F.pref}; ${FLEX_WORD[F.flex]}</span>`)(clubForms(c))}</dd></div><div><dt>Style</dt><dd>${isUser(c) ? INSTR.map(I => S[I.s] && S[I.s] !== "normal" ? I.set[S[I.s]].l : "").filter(Boolean).join(", ") || "Neutral" : MENT[baseStyle(c)].l}</dd></div><div><dt>Youth development</dt><dd>${c.academy}/20</dd></div><div><dt>Owner</dt><dd>${OWNER[c.owner].l}</dd></div>
      <div><dt>Coach</dt><dd>${esc(coachOf(c).name)}<br><span class="tiny muted">${ARCH[coachOf(c).arch].l} · prefers ${coachOf(c).form} · ${COACH_KEYS.map(([k, l]) => l.slice(0, 3) + " " + coachOf(c)[k]).join(" · ")}</span></dd></div>
      <div><dt>Shirt sponsor</dt><dd>${esc(((c.deals || []).find(d => d.kind === "shirt") || {}).name || "—")}</dd></div><div><dt>Ground</dt><dd class="num">${(c.cap || 0).toLocaleString()}${c.build ? ' <span class="tiny muted">(expanding)</span>' : ""}</dd></div><div><dt>Supporters</dt><dd>${fanWord(c.fans)[0]} <span class="tiny muted">· support ${c.support}/20</span></dd></div><div><dt>Cost ratio</dt><dd class="num">${pct(scr(c))}</dd></div><div><dt>Trophies</dt><dd>${c.trophies.length}</dd></div></dl>
    ${c.hist.length ? `<p class="small">Recent finishes: ${c.hist.slice(-6).reverse().map(h => `${seasonLabel(h.y)} ${ord(h.pos)} in ${leagueName(h.lg)}`).join(" · ")}</p>` : ""}
    ${(c.takeovers || []).length ? `<p class="small">Ownership: ${c.takeovers.slice(-4).map(t => `${seasonLabel(t.y)} ${esc(t.who.replace(/^An? /, "").toLowerCase())} (${t.kind === "invest" ? "investor" : "cost-cutter"})`).join(" · ")}</p>` : ""}
    ${Object.keys(c.rivals || {}).length ? `<p class="small">Rivals: ${Object.entries(c.rivals).filter(([id]) => !C(+id).gone).map(([id, n]) => `${clubA(+id, { crest: false })} (${RIVAL_WORD[n].toLowerCase()}, ${recStr(h2hOf(c, +id))})`).join(" · ")}</p>` : ""}
    ${c.trophies.length ? `<p class="small">Honours: ${c.trophies.slice(-12).reverse().map(t => `${trophyName(t.t)} ${seasonLabel(t.y)}`).join(", ")}</p>` : ""}
    ${(() => { // this season's record, as on your own pages: league position, record, goals and xG
      const r = c.gone ? null : standings(L).find(x => x.id === c.id), xs = c.xs || {};
      return r && r.p ? `<p class="small"><b>This season:</b> P${r.p} W${r.w} D${r.d} L${r.l} · GF ${r.gf} GA ${r.ga} · ${r.pts} pts${xs.xg != null && !isForeign(c) ? ` · xG ${xs.xg.toFixed(1)} for, ${xs.xga.toFixed(1)} against` : ""}</p>` : ""; })()}
    ${table("club-" + c.id, [
      { k: "n", l: "Player", v: p => p.name, f: p => playerA(p) + " " + statusChips(p, c) },
      { k: "pos", l: "Pos", v: p => ROLE_ORDER[p.pos], f: p => `<span class="pos">${p.pos}</span>` },
      { k: "age", l: "Age", r: 1, v: p => p.age, f: p => p.age },
      { k: "ovr", l: "Rating", r: 1, v: p => ratingSort(p), f: p => ratingHtml(p) },
      { k: "pot", l: "Potential", r: 1, v: p => viewMid(potView(p)), f: p => potHtml(p) },
      { k: "app", l: "Apps", r: 1, v: p => p.s.app, f: p => p.s.app },
      { k: "g", l: "Goals", r: 1, v: p => p.s.g, f: p => p.s.g },
      { k: "a", l: "Assists", r: 1, v: p => p.s.a, f: p => p.s.a },
      { k: "rt", l: "Avg rating", r: 1, v: p => p.s.app ? p.s.rt / p.s.app : 0, f: p => p.s.app ? `<span class="mr ${mrCls(p.s.rt / p.s.app)}">${(p.s.rt / p.s.app).toFixed(2)}</span>` : "—" },
      { k: "v", l: "Value", r: 1, v: p => value(p), f: p => money(value(p)) },
    ], ps, { sort: { k: "pos", d: 1 } })}</div>`;
}
function modalProspect(y) {
  if (!y) return "";
  const c = me(), f = factors(y, c), cs = contenders(y).slice(0, 5);
  const best = cs[0] ? cs[0].s : 1;
  return mHead(esc(y.name) + " " + starBtn(y.id, "yfav", !!(S.yfav || {})[y.id]), `${ROLE_NAME[y.pos]} · age 15 · ${esc(y.region)}${y.country === "ENG" ? "" : " (abroad)"}`, "var(--accent)") + `<div class="modal-b">
    <dl class="facts"><div><dt>Potential</dt><dd>${rangeHtml(prospectPot(y))} <span class="muted tiny">/ 20</span></dd></div><div><dt>Injury proneness</dt><dd>${rangeHtml(prospectInj(y), true)}</dd></div><div><dt>Scouted</dt><dd>${["Not yet", "Once", "Twice", "Fully"][y.sc]}</dd></div>
      ${y.sc >= 3 ? `<div><dt>Current rating</dt><dd class="num">${Math.round(r20(y.ovr))} / 20</dd></div>` : ""}<div><dt>Distance</dt><dd class="num">${Math.round(f.d)} km</dd></div>
      <div><dt>Open to moving</dt><dd>${y.known ? (y.open > .66 ? "Very" : y.open > .4 ? "Somewhat" : "Prefers to stay near home") : "Unknown"}</dd></div><div><dt>Status</dt><dd>${y.commit != null ? "Committed to " + clubA(y.commit) : y.offers.length + " offer" + (y.offers.length === 1 ? "" : "s")}</dd></div></dl>
    ${y.commit != null && y.commit !== c.id ? `<p class="small">He has committed elsewhere, but nothing is signed until the end of the season. Make an offer and keep building the relationship: if your club clearly suits him better, he may change his mind.</p>` : ""}
    <div><h3 style="margin-bottom:4px">How your club looks to him</h3>
      ${FACTORS.map(([k, l]) => `<div class="factor"><span><b>${l}</b>${y.known && y.top.includes(k) ? ' <span class="chip list">matters most</span>' : ""}<br><span class="tiny muted">${FACTOR_HELP[k]}</span></span><span class="grade ${grade(f[k])}">${grade(f[k])}</span><span class="bar"><i style="width:${(y.known ? y.pri[k] / .4 : .5) * 100}%;${y.known ? "" : "opacity:.25"}"></i></span></div>`).join("")}
      <p class="tiny muted" style="margin-top:6px">${y.known ? "Bars show how much each factor weighs with him." : "Call his family or scout him twice to learn what he cares about."} ${f.slots === 0 && y.pos !== "GK" ? `Your ${S.formation} has no ${ROLE_NAME[y.pos].toLowerCase()} role.` : ""} ${f.ahead ? `${f.ahead} young player${f.ahead > 1 ? "s" : ""} already ahead of him at his position.` : ""}</p></div>
    <div><h3 style="margin-bottom:4px">Clubs in the running</h3>${cs.length ? cs.map(x => `<div class="row between" style="padding:4px 0;border-top:1px solid var(--line)"><span>${clubA(x.c.id, { flag: 1 })} ${x.offer ? `<span class="chip hg">${y.offers[0] === x.c.id ? "first offer" : "offer made"}</span>` : ""}${y.commit === x.c.id ? ' <span class="chip xi">committed</span>' : ""}</span><span class="bar"><i style="width:${clamp(x.s / best, 0, 1) * 100}%"></i></span></div>`).join("") : '<p class="muted small">Nobody has approached him yet.</p>'}</div>
    ${y.commit !== c.id && !y.signed ? `<div class="row"><button class="btn sm" data-a="rec" data-v="${y.id}|scout" ${y.sc >= 3 ? "disabled" : ""}>Scout (${scoutHours(3, prospectCountry(y))}h${travelCost(prospectCountry(y)) ? ", " + money(travelCost(prospectCountry(y))) : ""})</button><button class="btn sm" data-a="rec" data-v="${y.id}|call">Call family (1h)</button><button class="btn sm" data-a="rec" data-v="${y.id}|visit" ${y.visit ? "disabled" : ""}>Host a visit (${scoutHours(5, prospectCountry(y))}h${travelCost(prospectCountry(y)) ? ", " + money(travelCost(prospectCountry(y))) : ""})</button><button class="btn sm" data-a="rec" data-v="${y.id}|coach" ${y.coach ? "disabled" : ""}>${y.coach ? "Coaches spoken to" : `Speak to his youth coaches (${scoutHours(2, prospectCountry(y))}h)`}</button><button class="btn sm" data-a="rec" data-v="${y.id}|home" ${y.home || y.sc < 1 ? "disabled" : ""}>${y.home ? "Family visited" : `Visit his family (${scoutHours(4, prospectCountry(y))}h${travelCost(prospectCountry(y)) ? ", " + money(travelCost(prospectCountry(y))) : ""})`}</button><button class="btn sm" data-a="rec" data-v="${y.id}|offer">${y.offers.includes(c.id) ? "Withdraw offer" : "Offer a place"}</button><span class="small muted">${S.rec.hours}h left this week · your knowledge of ${KNOW_NAME(prospectCountry(y))}: ${Math.floor(knowOf(prospectCountry(y)))}/20</span></div>` : ""}</div>`;
}
function modalCoach(m) {
  const c = DRAFT.clubs[m.club], arch = m.arch || "bal", co = newManager("", arch), form = m.form || "4-3-3";
  return mHead("Your manager", `Taking over ${esc(c.name)} · ${leagueName(c.lg)}`, c.color, crest(c, 36)) + `<div class="modal-b">
    <label class="f">Name<input type="text" id="coach-name" maxlength="28" value="${esc(m.name || "")}" placeholder="Your name"></label>
    <div><h3 style="margin-bottom:6px">Style</h3><div class="train arch">${Object.entries(ARCH).map(([k, a]) => `<button data-a="arch" data-v="${k}" aria-pressed="${arch === k}"><b>${a.l}</b><span class="tiny muted">${a.d}</span></button>`).join("")}</div></div>
    <div class="attrs">${COACH_KEYS.map(([k, l]) => `<div class="attr"><span>${l}</span><span class="abar"><i style="left:0;width:${co[k] / 20 * 100}%" class="${aCls(co[k])}"></i></span><b class="num">${co[k]}</b></div>`).join("")}</div>
    <label class="f">Preferred formation<select id="coach-form" data-c="cform">${FORM_KEYS.map(f => `<option ${f === form ? "selected" : ""}>${f}</option>`).join("")}</select><span class="tiny muted" style="font-weight:400">Your teams play about 2% better in it. ${esc(c.name)} currently play ${c.formation}.</span></label>
    <p class="small muted">You start as an average coach: 40 points across four ratings out of 20. A specialist puts 14 in one area and gives a point up elsewhere. You earn more points every season, and extra for beating the board's target, winning trophies and promotion.</p>
    <label class="row small"><input type="checkbox" id="coach-unsack"> Unsackable mode: the board still judges you, but can never fire you. You can switch it off later.</label>
    <div class="row"><button class="btn primary" data-a="startcareer">Start the career</button><button class="btn" data-a="closemodal">Back</button></div></div>`;
}
function modalBid(p) {
  const c = me(), ask = askingPrice(p), w = willingness(p, c), [wl, wk] = willingLabel(w), demand = contractDemand(p, c, w);
  const b = UI.bid && UI.bid.id === p.id ? UI.bid : (UI.bid = { id: p.id, fee: ask, yrs: p.age >= 31 ? 2 : 4, wage: demand, msg: "" });
  if (b.wage == null) b.wage = demand;
  const after = scr(c, b.wage + (b.fee ? b.fee / b.yrs : 0) + b.fee * .05);
  const plan = p.club >= 0 ? clamp(b.plan || 1, 1, DEFER_MAX) : 1, dm = deferMult(plan);
  // Fee and wage choices: steps around the asking price and his demand, plus any counter-offer on the table.
  const uniq = a => [...new Set(a)].sort((x, y) => x - y);
  // Fee steps follow the payment plan: a deferred deal costs deferMult more in total.
  const fees = p.club >= 0 ? uniq([.7, .8, .85, .9, .95, 1, 1.05, 1.1, 1.2].map(k => roundFee(ask * dm * k)).concat(b.counterFee ? [b.counterFee] : [], [b.fee])) : [0];
  const wages = uniq([.7, .8, .85, .9, .95, 1, 1.05, 1.1, 1.2, 1.3].map(k => Math.round(demand * k / 1000) * 1000).concat(b.counterWage ? [b.counterWage] : [], [b.wage]));
  const feeAgreed = b.feeOK != null && b.fee >= b.feeOK;
  const counters = [b.counterFee && b.fee !== b.counterFee && !feeAgreed ? `<button class="btn sm" data-a="bidcounter" data-v="fee">Offer their ${money(b.counterFee)}</button>` : "", b.counterWage && b.wage !== b.counterWage ? `<button class="btn sm" data-a="bidcounter" data-v="wage">Offer him ${perWeek(b.counterWage)}</button>` : ""].filter(Boolean).join("");
  return mHead(esc(p.name), `${p.club >= 0 ? "Offer to " + esc(C(p.club).name) : "Free agent"} · ${ROLE_NAME[p.pos]} · ${p.age} · ${ratingBlank(p) ? "rating unknown: scout him" : `rated ${ratingView(p).join("–").replace(/^(\d+)–\1$/, "$1")}`}`, p.club >= 0 ? C(p.club).color : "var(--muted)") + `<div class="modal-b">
    <dl class="facts"><div><dt>Asking price</dt><dd class="num">${p.club >= 0 ? money(ask) : "None"}</dd></div><div><dt>His interest</dt><dd class="${wk === "ok" ? "" : wk}">${wl}</dd></div><div><dt>His contract request</dt><dd class="num">${perWeek(demand)}</dd></div><div><dt>Earns now</dt><dd class="num">${p.club >= 0 ? perWeek(p.wage) : "—"}</dd></div><div><dt>Your cash</dt><dd class="num">${money(c.cash)}</dd></div></dl>
    ${w < .45 ? `<p class="small">${esc(whyNot(p, c) || "He isn't convinced by the move.")}</p>` : ""}
    <div class="filters">${p.club >= 0 ? `<label class="f">Transfer fee ${feeAgreed ? '<span class="good tiny">agreed ✓</span>' : ""}<select id="bid-fee" data-c="bid-fee">${fees.map(v => `<option value="${v}" ${v === b.fee ? "selected" : ""}>${money(v)}${v === roundFee(ask * dm) ? (plan > 1 ? " (asking, deferred)" : " (asking)") : ""}${v === b.counterFee ? " (their counter)" : ""}</option>`).join("")}</select></label>` : ""}
      <label class="f">Wage offer<select id="bid-wage" data-c="bid-wage">${wages.map(v => `<option value="${v}" ${v === b.wage ? "selected" : ""}>${perWeek(v)}${v === demand ? " (his request)" : ""}${v === b.counterWage ? " (he'd sign)" : ""}</option>`).join("")}</select></label>
      ${p.club >= 0 ? `<label class="f">Payment<select id="bid-plan" data-c="bid-plan">${Array.from({ length: DEFER_MAX }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === plan ? "selected" : ""}>${n === 1 ? "Lump sum" : `Over ${n} years (+${Math.round((deferMult(n) - 1) * 100)}%)`}</option>`).join("")}</select></label>` : ""}
      <label class="f">Contract length<select id="bid-yrs" data-c="bid-yrs">${[1, 2, 3, 4, 5].map(y => `<option value="${y}" ${y === b.yrs ? "selected" : ""}>${y} year${y > 1 ? "s" : ""}</option>`).join("")}</select></label></div>
    <p class="small">With agent fees (5%) this costs <b>${money(b.fee / plan + b.fee * .05)}</b> now${plan > 1 ? `, then <b>${money(b.fee / plan)}</b> at the start of each of the next ${plan - 1} season${plan > 2 ? "s" : ""}` : ""}, and <b>${perWeek(b.wage)}</b> in wages. Your projected cost ratio would move from ${pct(scr(c))} to <b class="${after > RULES.scrSporting ? "bad" : after > RULES.scrLimit ? "warn" : ""}">${pct(after)}</b>. ${isSenior(p) ? (regInfo(c).registered < RULES.squadMax ? `He'd take one of your ${RULES.squadMax - regInfo(c).registered} free registration places.` : `Your 25 registration places are full: he'd join unregistered unless you take someone else off the list.`) : "As an under-21 he needs no registration place."}</p>
    ${b.msg ? `<p class="small ${b.ok ? "good" : "bad"}"><b>${esc(b.msg)}</b></p>` : ""}
    ${counters ? `<div class="row" style="gap:6px">${counters}</div>` : ""}
    <p class="tiny muted">Offer below his request and he may say no and name his price; keen players accept a little less. His club may come back with a counter-offer. Three refusals from either side and talks are off until next week.</p>
    <div class="row"><button class="btn primary" data-a="submitbid" data-v="${p.id}" ${windowOpen() && !b.ok ? "" : "disabled"}>${p.club >= 0 ? (feeAgreed ? "Offer these terms" : "Submit offer") : "Offer contract"}</button>${windowOpen() ? "" : '<span class="small muted">The transfer window is closed.</span>'}</div></div>`;
}

/* ---------- live match ---------- */
/* Your side during a live match: the formation on a pitch with each player's rating in his position right
   now (fitness included), fitness bars and bookings, and the bench. Tap a player and then a substitute to
   bring him on, or two players to swap their positions; either pauses the match. */
const mrCls = r => r >= 8 ? "mr4" : r >= 7 ? "mr3" : r >= 6 ? "mr2" : "mr1";
/* Match ratings for everyone who has played, both sides: still on, subbed off (and the minute) or sent off,
   with goals, assists and bookings. Shown from kick-off. */
/* One player's advanced numbers in a match, only those that happened: "3 sh (1 on) · 0.62 xG · 2 KP · 0.31 xA · 4 saves". */
function advLine(x) {
  if (!x) return "";
  const t = [];
  if (x.sh) t.push(`${x.sh} sh${x.sot ? ` (${x.sot} on)` : ""}`, `${x.xg.toFixed(2)} xG`);
  if (x.kp) t.push(`${x.kp} KP`, `${x.xa.toFixed(2)} xA`);
  if (x.sv) t.push(`${x.sv} save${x.sv > 1 ? "s" : ""}`);
  for (const [k, l] of [["tk", "tkl"], ["int", "int"], ["clr", "clr"], ["bk", "blk"]]) if (x[k]) t.push(`${x[k]} ${l}`);
  if (x.bt) t.push(`beaten for ${x.bt === 1 ? "a goal" : x.bt + " goals"}`);
  return t.join(" · ");
}
/* Season advanced stats, for the squad table. G−xG is finishing: above zero, he scores more than his chances
   are worth. Per 90 figures need 450 minutes, so a cameo doesn't top the column. */
const per90 = (p, v) => p.s.min >= 450 ? v / p.s.min * 90 : null;
const f2 = v => v == null ? "—" : v.toFixed(2);
const ADV_COLS = [
  { k: "sh", l: "Shots", r: 1, v: p => p.s.sh || 0, f: p => p.s.sh || 0 },
  { k: "sot", l: "On tgt", r: 1, v: p => p.s.sot || 0, f: p => p.s.sot || 0 },
  { k: "xg", l: "xG", r: 1, v: p => p.s.xg || 0, f: p => (p.s.xg || 0).toFixed(1) },
  { k: "gxg", l: "G−xG", r: 1, v: p => p.s.g - (p.s.xg || 0), f: p => p.s.sh ? (d => `<span class="${d >= 1 ? "good" : d <= -1 ? "bad" : ""}">${d > 0 ? "+" : ""}${d.toFixed(1)}</span>`)(p.s.g - p.s.xg) : "—" },
  { k: "xg90", l: "xG/90", r: 1, v: p => per90(p, p.s.xg || 0) ?? -1, f: p => f2(per90(p, p.s.xg || 0)) },
  { k: "kp", l: "Key passes", r: 1, v: p => p.s.kp || 0, f: p => p.s.kp || 0 },
  { k: "xa", l: "xA", r: 1, v: p => p.s.xa || 0, f: p => (p.s.xa || 0).toFixed(1) },
  { k: "tk", l: "Tackles", r: 1, v: p => p.s.tk || 0, f: p => p.s.tk || 0 },
  { k: "int", l: "Interceptions", r: 1, v: p => p.s.int || 0, f: p => p.s.int || 0 },
  { k: "clr", l: "Clearances", r: 1, v: p => p.s.clr || 0, f: p => p.s.clr || 0 },
  { k: "bk", l: "Blocks", r: 1, v: p => p.s.bk || 0, f: p => p.s.bk || 0 },
  { k: "bt", l: "Beaten (goals)", r: 1, v: p => p.s.bt || 0, f: p => p.s.bt || 0 },
  { k: "sv", l: "Saves", r: 1, v: p => p.s.sv || 0, f: p => p.pos === "GK" ? p.s.sv || 0 : "" },
  { k: "cs", l: "Clean sheets", r: 1, v: p => p.s.cs || 0, f: p => p.s.cs || 0 },
];
function liveRatings(M) {
  const side = i => { const s = i ? M.a : M.h, onIds = new Set(s.on.map(o => o.p.id)), rows = s.used.map(id => P(id)).filter(Boolean).map(p => {
      const g = M.goals.filter(x => x.pid === p.id).length, a = M.goals.filter(x => x.ast === p.id).length, red = M.reds.some(r => r[0] === p.id), sub = !onIds.has(p.id) && !red;
      const came = (s.on.find(o => o.p.id === p.id) || {}).from;
      return { p, r: matchRating(M, i, p.id), g, a, y: M.cards.includes(p.id), red, sub, came: came > 0 ? came : null };
    }).sort((x, y) => ROLE_ORDER[x.p.pos] - ROLE_ORDER[y.p.pos]);
    return `<div><h3 style="margin:0 0 6px">${esc(C(s.club).short)}${s.club === S.club ? " <span class=\"tiny muted\">you</span>" : ""}</h3>${rows.map(x => `<div class="mr-row${x.sub || x.red ? " off" : ""}"><span class="pos">${x.p.pos}</span><span class="nm">${s.club === S.club || M.fx.h === S.club || M.fx.a === S.club ? playerA(x.p) : esc(x.p.name)}${"⚽".repeat(x.g)}${x.a ? ` <span class="tiny muted">${x.a}A</span>` : ""}${x.y && !x.red ? ' <span class="yc-i" title="Booked"></span>' : ""}${x.red ? ' <span class="rc-i" title="Sent off"></span>' : ""}${x.came ? ` <span class="tiny muted">on ${x.came}′</span>` : ""}${x.sub ? ' <span class="tiny muted">off</span>' : ""}${(t => t ? `<span class="mr-adv">${t}</span>` : "")(advLine((M.ps || {})[x.p.id]))}</span><b class="mr ${mrCls(x.r)}">${x.r.toFixed(1)}</b></div>`).join("")}</div>`; };
  return `<div class="card lv-rat"><div class="card-h"><h2>Match ratings</h2><span class="tiny muted">out of 10${M.done ? " · final" : " · live"}</span></div>${M.min > 0 ? `<div class="mr-grid">${side(LIVE.k)}${side(1 - LIVE.k)}</div>` : '<p class="small muted">Ratings appear once the match kicks off.</p>'}</div>`;
}
function liveTeam(M, k) {
  const s = k ? M.a : M.h, F = FORMATIONS[s.form], sel = UI.lsel || {}, done = M.done, left = subsLeft(s);
  const pre = M.min === 0 && !done, bench = pre ? s.bench.map(P).filter(Boolean) : benchAvail(M, k), canSub = !done && (pre || left > 0);
  const inSquad = new Set([...s.on.map(o => o.p.id), ...s.bench]), outside = pre ? eligibleIds(C(s.club)).map(P).filter(p => avail(p) && !inSquad.has(p.id)).sort((a, b) => ROLE_ORDER[a.pos] - ROLE_ORDER[b.pos] || b.ovr - a.ovr) : [];
  const slots = s.on.map((o, idx) => { const [role, x, y] = F[o.si] || [o.slot, 50, 50], f = FAM[o.p.pos][o.slot], on = sel.on === idx;
    return `<button class="slot ${f < .9 ? "oop" : ""} ${on ? "sel" : ""}" style="left:${x}%;top:${y}%" data-a="livetap" data-v="${idx}" ${done ? "disabled" : ""} title="${esc(o.p.name)}, ${o.p.pos} playing ${o.slot}, fitness ${Math.round(o.fit)}">
      <span class="disc" title="Rating as ${o.slot}">${Math.round(slotRating(o.p, o.slot))}</span>${s.yel[o.p.id] ? '<span class="yc" aria-label="Booked"></span>' : ""}${(g => g ? `<span class="gl" aria-label="${g} goal${g > 1 ? "s" : ""}">${g > 1 ? g + "×" : ""}⚽</span>` : "")(M.goals.filter(x => x.pid === o.p.id).length)}${M.min > 0 ? `<span class="mr ${mrCls(matchRating(M, k, o.p.id))}" title="Match rating">${matchRating(M, k, o.p.id).toFixed(1)}</span>` : ""}<span class="nm">${esc(pitchName(o.p, s.on.map(x => x.p)))}</span><span class="fpct" style="--fc:${fitColor(o.fit)}">${Math.round(o.fit)}%</span></button>`; }).join("");
  // Positions nobody is in (a red card, or an injury with no subs left): tap a player, then the gap, to move him there.
  const empties = s.on.length < F.length ? F.map((f, si) => [f, si]).filter(([, si]) => !s.on.some(o => o.si === si)) : [];
  const emptyHtml = empties.map(([[role, x, y], si]) => `<button class="slot empty ${sel.empty === si ? "sel" : ""}" style="left:${x}%;top:${y}%" data-a="liveempty" data-v="${si}" ${done ? "disabled" : ""} title="Nobody at ${role}: tap a player, then here"><span class="disc">${role}</span><span class="nm">Empty</span></button>`).join("");
  const hint = done ? "" : empties.length && !pre ? (sel.on != null ? `Tap an empty position to move ${esc(s.on[sel.on].p.name)} there, another player to swap, or a sub to bring on.` : sel.empty != null ? "Now tap the player to move into that position." : `You're down to ${s.on.length}: change the formation above, or tap a player and then an empty position to move him there.`) : pre ? (sel.on != null || sel.bench != null || sel.out != null ? `Now tap who to swap with ${esc(P(sel.on != null ? s.on[sel.on].p.id : sel.bench ?? sel.out).name)}: a starter, a substitute or someone outside the squad.` : "Before kick-off: tap any two players (starters, substitutes or the rest of the squad) to swap them. Changes here don't use a substitution and are kept for later matches.") : sel.on != null ? (canSub ? `Now tap a substitute to bring on for ${esc(s.on[sel.on].p.name)}, or another player to swap positions.` : "Tap another player to swap positions.") : sel.bench != null ? `Now tap the player to take off for ${esc(P(sel.bench).name)}.` : `Tap a player, then a substitute to bring him on, or two players to swap positions.`;
  return `<div class="card live-team lv-team" style="--club:${C(s.club).color}"><div class="card-h"><h2>Your team</h2><span class="eyebrow">${pre ? "Before kick-off · team changes are free" : s.friendly ? `Friendly · unlimited subs (${s.subs} made)` : `${left} sub${left === 1 ? "" : "s"} left`}</span></div>
    <div class="row between small" style="margin-bottom:8px"><label class="row">Formation <select data-c="liveform" ${done ? "disabled" : ""}>${Object.keys(FORMATIONS).map(f => `<option ${f === s.form ? "selected" : ""}>${f}</option>`).join("")}</select></label><span class="muted">${MENT[s.ment].l}</span></div>
    <div class="pitch live">${PITCH_LINES}${slots}${emptyHtml}</div>
    <p class="small muted" style="margin:8px 0">${hint}</p>
    <h3 style="margin:4px 0 6px">Substitutes</h3>
    ${bench.length ? `<div class="bench">${bench.map(p => `<button class="bench-p ${sel.bench === p.id ? "sel" : ""}" data-a="livebench" data-v="${p.id}" ${canSub ? "" : "disabled"}><span class="pos">${p.pos}</span><span class="nm">${esc(p.name)}</span><span class="rt-pair"><b class="rt ${aCls(r20(p.ovr))}">${Math.round(r20(p.ovr))}</b>${sel.on != null && s.on[sel.on] && s.on[sel.on].slot !== p.pos ? `<span class="oop-r ${slotRating(p, s.on[sel.on].slot) < r20(p.ovr) - .5 ? "warn" : ""}">→ ${Math.round(slotRating(p, s.on[sel.on].slot))} at ${s.on[sel.on].slot}</span>` : ""}</span><span class="tiny num" style="color:${fitColor(p.fit)}">${Math.round(p.fit)}%</span></button>`).join("")}</div>` : '<p class="small muted">No substitutes available.</p>'}
    ${pre && (sel.bench != null || sel.on != null) ? `<div class="sub-pick" style="margin-top:8px"><b class="small">${sel.bench != null ? `Replace ${esc(P(sel.bench).name)} with…` : `Or bring in for ${esc(s.on[sel.on].p.name)}…`}</b>${outside.length ? `<div class="bench" style="margin-top:6px">${outside.map(p => `<button class="bench-p" data-a="liveout" data-v="${p.id}"><span class="pos">${p.pos}</span><span class="nm">${esc(p.name)}</span><b class="rt ${aCls(r20(p.ovr))}">${Math.round(r20(p.ovr))}</b><span class="tiny num" style="color:${fitColor(p.fit)}">${Math.round(p.fit)}%</span></button>`).join("")}</div>` : '<p class="small muted">Everyone available is already in the matchday squad.</p>'}</div>` : ""}
    <h3 style="margin:12px 0 6px">Starting XI</h3>
    <div class="bench">${s.on.slice().sort((a, b) => a.si - b.si).map(o => { const idx = s.on.indexOf(o), here = slotRating(o.p, o.slot), ovr = r20(o.p.ovr), oop = o.p.pos !== o.slot;
      return `<button class="bench-p xi-p ${sel.on === idx ? "sel" : ""}" data-a="livetap" data-v="${idx}" ${done ? "disabled" : ""} title="${esc(o.p.name)}: ${o.p.pos}, rated ${Math.round(ovr)}${oop ? `; ${Math.round(here)} at ${o.slot}` : ""}"><span class="pos">${o.slot}</span><span class="nm">${esc(o.p.name)}${"⚽".repeat(M.goals.filter(x => x.pid === o.p.id).length)}${s.yel[o.p.id] ? ' <span class="yc-i" title="Booked"></span>' : ""}${oop ? ` <span class="tiny muted">${o.p.pos}</span>` : ""}</span><span class="rt-pair"><b class="rt ${aCls(ovr)}">${Math.round(ovr)}</b>${oop ? `<span class="oop-r ${here < ovr - .5 ? "warn" : ""}">→ ${Math.round(here)} at ${o.slot}</span>` : ""}</span><span class="tiny muted"><span style="color:${fitColor(o.fit)}">${Math.round(o.fit)}%</span>${M.min > 0 ? ` · <span class="mr ${mrCls(matchRating(M, k, o.p.id))}">${matchRating(M, k, o.p.id).toFixed(1)}</span>` : ""}</span></button>`; }).join("")}</div>
  </div>`;
}
/* Scorers and bookings under the score, each side's in minute order, as on a TV scoreboard. */
function liveEvents(M, side) {
  const ev = [...M.goals.filter(g => g.side === side).map(g => ({ min: g.min, pid: g.pid, n: g.n, k: "g" })), ...(M.bk || []).filter(b => b.side === side).map(b => ({ min: b.min, pid: b.pid, n: b.n, k: b.red ? "r" : "y" }))].sort((a, b) => a.min - b.min);
  const ic = { g: '<span class="ev-g" aria-label="Goal">⚽</span>', y: '<span class="yc-i" title="Booked"></span>', r: '<span class="rc-i" title="Sent off"></span>' };
  return ev.map(e => `<span class="ev">${ic[e.k]} ${esc(e.n || sur(P(e.pid)))} ${e.min}′</span>`).join("");
}
/* The live match has three tabs, so nothing needs scrolling past on a phone: the commentary, your tactics
   (style, formation, team and substitutes) and the stats (shots, possession, match ratings). The score,
   scorers, bookings and the play controls stay above the tabs. */
const LIVE_TABS = [["match", "Commentary"], ["tactics", "Tactics"], ["stats", "Stats"]];
function viewLive() {
  const M = LIVE.M, H = C(M.h.club), A = C(M.a.club), tp = (M.h.poss + M.a.poss) || 1, hp = Math.round(M.h.poss / tp * 100);
  const k = LIVE.k, mine = k ? M.a : M.h, tab = UI.ltab || "match";
  const cl = e => e.side < 0 ? "var(--muted)" : C((e.side ? M.a : M.h).club).color;
  const stat = (l, x, y) => `<tr><td class="num">${x}</td><td class="eyebrow">${l}</td><td class="num">${y}</td></tr>`;
  let ctrl, style = "";
  if (M.done) { const w = tieWinner(M); ctrl = `<div class="row"><p style="margin:0"><b>Full time.</b> ${w === S.club ? (M.fx.ko ? "Through to the next round." : "A win.") : w == null ? "A draw." : (M.fx.ko ? "Knocked out." : "A defeat.")}</p><button class="btn primary" data-a="livecont">Continue</button></div>`; }
  else {
    ctrl = `<div class="row">${LIVE.paused ? `<button class="btn primary" data-a="liveresume">${M.min === 0 ? "Kick off" : M.min === 45 ? "Second half" : M.min === 90 ? "Extra time" : "Resume"}</button>` : `<button class="btn" data-a="livepause">Pause</button>`}<button class="btn" data-a="liveskip">Skip to the end</button><span class="seg" role="group" aria-label="Speed">${[["Normal", 300], ["Fast", 80]].map(([l, v]) => `<button data-a="livespeed" data-v="${v}" aria-pressed="${LIVE.speed === v}">${l}</button>`).join("")}</span></div>`;
    style = `<div class="card ctrl">${INSTR.map((I, i) => `<label${i ? ' style="margin-top:8px"' : ""}>${I.h}<span class="seg" role="group">${Object.entries(I.set).map(([x, v]) => { const f = v.keys ? instrFit(mine.on, v) : 0, w = v.keys ? fitWord(f)[1] : "";
      // Green for an option that suits the players on the pitch now, red for one that doesn't (FIT_WORDS' ±0.12).
      return `<button class="${f >= .12 ? "fit-g" : f <= -.12 ? "fit-b" : ""}" data-a="liveins" data-v="${I.k}|${I.s}|${x}" aria-pressed="${(mine[I.k] || "normal") === x}" title="${esc(v.d + (w ? " " + w + "." : ""))}">${v.l}</button>`; }).join("")}</span></label>`).join("")}
    <label style="margin-top:8px">Tackling<span class="seg" role="group">${Object.entries(TACKLE).map(([x, v]) => `<button data-a="livetk" data-v="${x}" aria-pressed="${(mine.tk || "normal") === x}" title="${esc(v.d)}">${v.l}</button>`).join("")}</span></label>
    <p class="tiny muted" style="margin:6px 0 0"><span class="fit-key fit-g"></span> suits the players on the pitch <span class="fit-key fit-b"></span> doesn't suit them (fit changes with your substitutions)</p>
    <p class="small muted" style="margin:6px 0 0">${esc(C((k ? M.h : M.a).club).short)} are playing ${MENT[(k ? M.h : M.a).ment].l.toLowerCase()} in a ${(k ? M.h : M.a).form}.</p></div>`;
  }
  const feed = `<div class="card lv-feed"><ul class="feed" aria-live="polite">${M.log.slice().reverse().map((e, i) => `<li class="${e.type === "goal" ? "goal" : ""} ${i === 0 && !M.done ? "new" : ""}"><span class="m">${e.m}′</span><span><span class="tag" style="background:${cl(e)}"></span>${esc(e.text)}</span></li>`).join("") || '<li><span class="m">0′</span><span>The teams are out. Press kick off when ready.</span></li>'}</ul></div>`;
  const stats = `<div class="card lv-stats"><table class="stats"><tbody>${stat("Possession", hp + "%", 100 - hp + "%")}${stat("Expected goals (xG)", (M.h.xg || 0).toFixed(2), (M.a.xg || 0).toFixed(2))}${stat("Shots", M.h.shots, M.a.shots)}${stat("On target", M.h.sot, M.a.sot)}${stat("Big chances", M.h.big || 0, M.a.big || 0)}${stat("Headed shots", M.h.hdr || 0, M.a.hdr || 0)}${stat("Saves", M.h.sav || 0, M.a.sav || 0)}${stat("Yellow cards", (M.bk || []).filter(b => !b.side && !b.red).length, (M.bk || []).filter(b => b.side && !b.red).length)}${stat("Red cards", M.reds.filter(r => (M.bk || []).some(b => b.pid === r[0] && !b.side)).length, M.reds.filter(r => (M.bk || []).some(b => b.pid === r[0] && b.side)).length)}${stat("Subs", M.h.subs, M.a.subs)}</tbody></table></div>`;
  const body = tab === "tactics" ? style + liveTeam(M, k) : tab === "stats" ? stats + liveRatings(M) : feed;
  const he = liveEvents(M, 0), ae = liveEvents(M, 1);
  return `<section style="--hc:${H.color};--ac:${A.color}"><div class="board">${M.fx.comp === "L" || M.fx.comp === "F" ? `<span class="comp eyebrow">${esc(compLabel(M.fx))}</span>` : `<span class="comp"><span class="cup-badge">🏆 ${esc(compLabel(M.fx))}</span>${M.fx.ko ? `<span class="cup-sub">First leg ${esc(C(M.fx.a).short)} ${M.fx.ko.aggA}–${M.fx.ko.aggH} ${esc(C(M.fx.h).short)}</span>` : ""}${M.fx.neutral ? '<span class="cup-sub">Neutral venue</span>' : ""}</span>`}<div class="t">${crest(H, 40)}<span class="tn"><b>${esc(H.name)}</b><span class="tf">${M.h.form}</span></span></div>
    <div class="score">${M.h.goals}–${M.a.goals}<span class="clock">${M.done ? (M.pens ? `pens ${M.pens[0]}–${M.pens[1]}` : M.et ? "AET" : "FT") : M.min === 45 && LIVE.paused ? "HT" : M.min + "′"}</span></div><div class="t away"><span class="tn"><b>${esc(A.name)}</b><span class="tf">${M.a.form}</span></span>${crest(A, 40)}</div>
    ${he || ae ? `<div class="evs">${he}</div><div></div><div class="evs away">${ae}</div>` : ""}</div>
    <div class="poss"><span class="h" style="width:${hp}%"></span><span class="a" style="width:${100 - hp}%"></span></div>
    <div class="row small muted between"><span>Possession ${hp}%</span><span>${100 - hp}%</span></div>
    ${M.injWait && M.injWait.side === k ? (() => { const w = M.injWait, out = P(w.pid), subs = benchAvail(M, k).sort((a, b) => slotRating(b, w.slot) - slotRating(a, w.slot));
      return `<div class="card inj-ask"><h3 style="margin:0 0 4px">Injury: ${esc(out.name)} can't continue</h3><p class="small muted" style="margin:0 0 8px">Who comes on at ${ROLE_NAME[w.slot].toLowerCase()}? ${mine.friendly ? "Unlimited substitutions in a friendly." : `${RULES.subs - mine.subs} substitution${RULES.subs - mine.subs === 1 ? "" : "s"} left.`} Ratings are at ${w.slot}.</p>
        <div class="bench">${subs.map(p => { const r = slotRating(p, w.slot); return `<button class="bench-p" data-a="injsub" data-v="${p.id}"><span class="pos">${p.pos}</span><span class="nm">${esc(p.name)}</span><b class="rt ${aCls(r)}">${Math.round(r)}</b><span class="tiny num" style="color:${fitColor(p.fit)}">${Math.round(p.fit)}%</span></button>`; }).join("")}</div>
        <button class="btn sm" data-a="injon" style="margin-top:8px">Play on with ${mine.on.length} for now</button></div>`; })() : ""}
    ${M.redWait && !M.done ? (() => { const w = M.redWait, who = P(w.pid), ours = w.side === k, n = mine.on.length, them = (k ? M.h : M.a).on.length;
      return `<div class="card inj-ask red-ask"><h3 style="margin:0 0 4px">Red card: ${esc(who.name)} ${ours ? "is sent off" : `(${esc(C((w.side ? M.a : M.h).club).short)}) is sent off`}</h3>
        <p class="small muted" style="margin:0 0 8px">${ours ? `You're down to ${n}. Change formation or move players to cover his ${ROLE_NAME[w.slot].toLowerCase()} position, or make a substitution, on the Tactics tab.` : `They're down to ${them}. A more attacking style could make the extra man count.`}</p>
        <div class="row" style="gap:8px">${ours ? '<button class="btn primary sm" data-a="redtac">Rearrange on Tactics</button>' : '<button class="btn primary sm" data-a="redtac">Tactics and style</button>'}<button class="btn sm" data-a="redok">Carry on as we are</button></div></div>`; })() : ""}
    <div class="card ctrl lv-bar">${ctrl}</div>
    <div class="seg lv-tabs" role="tablist">${LIVE_TABS.map(([v, l]) => `<button role="tab" data-a="livetab" data-v="${v}" aria-pressed="${tab === v}" aria-selected="${tab === v}">${l}</button>`).join("")}</div>
    <div class="lv-body stack">${body}</div></section>`;
}

/* Overall, potential and age in one short line, for the Tactics pickers: "Ovr 14 · Pot 15–18 · Age 19". */
const opaLine = p => { const o = Math.round(r20(p.ovr)); let [lo, hi] = potView(p) || [o, o]; lo = Math.max(lo, o); hi = Math.max(hi, o);  // the estimate never sits below what he already is
  return `<span class="opa">Ovr ${o} · Pot ${lo === hi ? lo : lo + "–" + hi} · Age ${p.age}</span>`; };
/* ---------- academy ---------- */
function viewAcademy() {
  const c = me(), kids = c.squad.map(P).filter(p => p.acad), young = c.squad.map(P).filter(p => !p.acad && p.age <= ACAD_MAX_AGE && !p.loan);
  const as = p => p.as || { app: 0, g: 0, a: 0, rt: 0 };
  const cols = [
    { k: "n", l: "Name", v: p => p.name, f: p => playerA(p) },
    { k: "pos", l: "Pos", v: p => ROLE_ORDER[p.pos], f: p => `<span class="pos">${p.pos}</span>` },
    { k: "age", l: "Age", r: 1, v: p => p.age, f: p => p.age },
    { k: "ready", l: "First team?", v: p => { const r = acadReadiness(p, c); return ["Not yet", "Close", "Ready", "Ready to start"].indexOf(r[0]); }, f: p => { const [l, k, bar] = acadReadiness(p, c); return `<span class="${k}">${l}</span><br><span class="tiny muted">${bar ? `his ${Math.round(r20(p.ovr))} v ${Math.round(r20(bar))} at ${p.pos}` : `a place is free at ${p.pos}`}</span>`; } },
    { k: "act", l: "", f: p => `<button class="btn sm" data-a="promote" data-v="${p.id}">Promote</button>` },
    { k: "ovr", l: "Rating", r: 1, v: p => ratingSort(p), f: p => ratingHtml(p) },
    { k: "pot", l: "Potential", r: 1, v: p => viewMid(potView(p)), f: p => potHtml(p) },
    { k: "gs", l: "Coaches' view", v: p => { const h = gsHint(p); return h ? ["Slow to develop", "A late developer: be patient", "Too early to tell", "Developing at a normal pace", "A quick learner", "Picks things up very quickly"].indexOf(h[0]) : -1; }, f: p => { const h = gsHint(p); return h ? `<span class="small ${h[1]}">${h[0]}</span>` : ""; } },
    { k: "app", l: "Apps", r: 1, v: p => as(p).app, f: p => as(p).app },
    { k: "g", l: "G", r: 1, v: p => as(p).g, f: p => as(p).g },
    { k: "a", l: "A", r: 1, v: p => as(p).a, f: p => as(p).a },
    { k: "rt", l: "Avg", r: 1, v: p => as(p).app ? as(p).rt / as(p).app : 0, f: p => as(p).app ? (as(p).rt / as(p).app).toFixed(2) : "—" },
    // Playing time as development sees it: a rolling share of the minutes on offer each week (academy matches
    // for academy players, first-team fixtures for the rest).
    { k: "pt", l: "Playing time", r: 1, v: p => p.pt, f: p => `<span class="bar" title="${Math.round(p.pt * 100)}%"><i style="width:${p.pt * 100}%"></i></span> <span class="tiny num">${Math.round(p.pt * 100)}%</span>` },
    { k: "fit", l: "Fit", v: p => p.fit, f: p => fitBar(p.fit) },
  ];
  const res = (S.acadRes || []).filter(r => r.y === S.year);
  const W = res.filter(r => r.gf > r.ga).length, D = res.filter(r => r.gf === r.ga).length, Lx = res.length - W - D;
  // This year's graduate pool, while you're choosing (S.intake): tick up to INTAKE_KEEP, then confirm.
  const it = S.intake, ik = it ? it.ids.map(id => S.players[id]).filter(Boolean) : [];
  const room = intakeRoom(), left = INTAKE_DEADLINE - S.summerDay;
  const intakeCard = it ? `<section class="card intake"><div class="card-h"><h2>Graduate intake</h2><span class="small">Keep up to <b>${room}</b> of ${ik.length} · <b class="num">${it.pick.length}</b> chosen · Academy places <b class="num">${kids.length}/${ACAD_CAP}</b></span></div>
    <p class="small" style="margin:0 0 8px">Local 16-year-olds your academy has brought through. Keep up to ${INTAKE_KEEP}, or none: each one takes an academy place, and there are ${ACAD_CAP}. The rest are released as free agents, where any club can sign them. <b>Choose by the end of preseason week ${INTAKE_DEADLINE}</b> (${left <= 1 ? "this week" : `${left} weeks left`}): whoever is ticked then joins, and anyone not ticked is released. Nobody is picked for you.${room < INTAKE_KEEP ? ` <span class="warn">Your academy only has room for ${room}: promote or release someone to make space.</span>` : ""}</p>
    ${table("intake", [
      { k: "k", l: "Keep", f: p => { const on = it.pick.includes(p.id); return `<button class="btn sm ${on ? "primary" : ""}" data-a="intakepick" data-v="${p.id}" aria-pressed="${on}" aria-label="${on ? "Kept: tap to untick" : "Keep"} ${esc(p.name)}">${on ? "✓" : "+"}</button>`; } },
      { k: "n", l: "Name", v: p => p.name, f: p => esc(p.name) },
      { k: "pos", l: "Pos", v: p => ROLE_ORDER[p.pos], f: p => `<span class="pos">${p.pos}</span>` },
      { k: "pot", l: "Potential", r: 1, v: p => viewMid(potView(p)), f: p => potHtml(p) },  // first: it's what you're choosing on
      { k: "ovr", l: "Rating", r: 1, v: p => p.ovr, f: p => ratingHtml(p) },
    ], ik, { sort: { k: "pot", d: -1 } })}
    <div class="row" style="margin-top:10px;gap:8px"><button class="btn primary" data-a="intakeok">Confirm: keep ${it.pick.length}, release ${ik.length - it.pick.length}</button></div></section>` : "";
  return `<div class="stack">${intakeCard}<section class="card"><div class="card-h"><h2>Academy</h2><span class="small"><b class="num ${kids.length >= ACAD_CAP ? "warn" : ""}">${kids.length}/${ACAD_CAP}</b> places · Youth development <b class="num">${c.academy}/20</b>${res.length ? ` · This season W${W} D${D} L${Lx}` : ""}</span></div>
    <p class="small" style="margin:0 0 8px">Your academy players train and play their own unofficial match each week of the season, which counts as playing time for their development. They aren't picked for the first team unless you include them; one who comes off the bench for 20 minutes or less in a week still plays for the academy that week. Promote anyone who is ready; players move up automatically once they turn ${ACAD_MAX_AGE + 1}.</p>
    <label class="small" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px"><input type="checkbox" data-c="acadsel" style="margin-top:3px" ${S.set.acadSel ? "checked" : ""}> Include academy players in first-team selection (XI and substitutes)</label>
    ${table("acad", cols, kids, { sort: { k: "ready", d: -1 }, empty: "Nobody in the academy. Each summer you choose up to three graduates (or none) from a pool of five, and youth recruits join on signing day." })}
    <p class="hint" style="margin-top:8px"><b>First team?</b> compares him with your senior players at his position in your ${S.formation}: <b>Ready to start</b> means he's as good as your weakest starter there, <b>Ready</b> that he'd make the matchday squad, <b>Close</b> within about a point and a half.</p></section>
    <section class="card"><div class="card-h"><h2>Academy results</h2><span class="tiny muted">unofficial under-18 matches</span></div>${res.length ? res.map(r => `<div class="res"><span class="h">${esc(c.short)} U18</span><span class="sc">${r.gf}–${r.ga}</span><span>${esc(C(r.opp).short)} U18 <span class="tiny muted">wk ${r.w + 1}${r.sc.length ? " · " + r.sc.map(id => S.players[id] ? esc(sur(S.players[id])) : "").filter(Boolean).join(", ") : ""}</span></span></div>`).join("") : '<p class="small muted">No academy matches yet this season. They are played each week of the season.</p>'}</section>
    ${young.length ? `<section class="card"><div class="card-h"><h2>Young players in the first-team squad</h2><span class="tiny muted">${ACAD_MAX_AGE} and under</span></div>${table("acad-young", [cols[0], cols[1], cols[2], cols[5], cols[6], cols.find(x => x.k === "gs"), { k: "sapp", l: "Apps", r: 1, v: p => p.s.app, f: p => p.s.app }, { k: "savg", l: "Avg", r: 1, v: p => p.s.app ? p.s.rt / p.s.app : 0, f: p => p.s.app ? (p.s.rt / p.s.app).toFixed(2) : "—" }, cols.find(x => x.k === "pt"), { k: "act", l: "", f: p => `<button class="btn sm" data-a="demote" data-v="${p.id}">Send to academy</button>` }], young, { sort: { k: "ovr", d: -1 } })}<p class="hint" style="margin-top:8px">Development weighs playing time, match ratings and happiness. A youngster on under about two-thirds of the first team's minutes, or averaging under a good game (7), usually develops faster in the academy, where he plays every week. An academy player who plays for the first team misses that week's academy match.</p></section>` : ""}</div>`;
}
function viewManager() {
  const co = S.me, c = me();
  const row = ([k, l]) => `<div class="attr"><span><b>${l}</b><br><span class="tiny muted">${COACH_EFFECT[k]}</span></span><span class="abar"><i style="left:0;width:${co[k] / 20 * 100}%" class="${aCls(co[k])}"></i></span><b class="num">${co[k]}</b>${co.pts > 0 && co[k] < 20 ? `<button class="btn sm" data-a="coachpt" data-v="${k}">+1</button>` : ""}</div>`;
  const rivals = S.leagues[c.lg].clubs.filter(id => id !== c.id).map(C).sort((a, b) => sum(COACH_KEYS, ([k]) => b.coach[k]) - sum(COACH_KEYS, ([k]) => a.coach[k])).slice(0, 8);
  return `<div class="grid2"><div class="stack"><section class="card"><div class="card-h"><h2>${esc(co.name)}</h2><span class="eyebrow">${ARCH[co.arch].l} · prefers ${co.form} · ${co.seasons} season${co.seasons === 1 ? "" : "s"} · ${esc(c.name)}</span></div>
    <div class="attrs coach">${COACH_KEYS.map(row).join("")}</div>
    <label class="row small" style="margin-top:12px">Preferred formation <select id="mg-pref" data-c="pref">${FORM_KEYS.map(f => `<option ${f === co.form ? "selected" : ""}>${f}</option>`).join("")}</select><span class="tiny muted">Changing it takes a season to bed in: the bonus applies from next season.</span></label>
    <label class="row small" style="margin-top:8px"><input type="checkbox" id="mg-unsack" data-c="unsack" ${S.set.unsackable ? "checked" : ""}> Unsackable mode (the board can't fire you)</label>
    <p class="small" style="margin-top:10px">${co.pts ? `<b>${co.pts} point${co.pts > 1 ? "s" : ""} to spend.</b> ` : ""}You earn a point every season, plus one for finishing above the board's target, up to two for trophies, and one for promotion. Ratings are out of 20.</p></section>
    <section class="card"><div class="card-h"><h2>League knowledge</h2><span class="small muted">out of 20</span></div>
    <div class="attrs coach">${KNOW_KEYS.map(k => { const v = Math.floor(knowOf(k)); return `<div class="attr"><span><b>${KNOW_NAME(k)}</b><br><span class="tiny muted">Scouting: ${scoutHours(2, k)}h a player, ${scoutHours(3, k)}h a prospect${travelCost(k) ? `, ${money(travelCost(k))} travel` : ""}${v >= 15 ? " · full report in one trip" : ""}</span></span><span class="abar"><i style="left:0;width:${v / 20 * 100}%" class="${aCls(v)}"></i></span><b class="num">${v}</b>${co.pts > 0 && v < 20 ? `<button class="btn sm" data-a="knowpt" data-v="${k}">+1</button>` : ""}</div>`; }).join("")}</div>
    <p class="tiny muted" style="margin-top:6px">The better you know a country, the fewer hours scouting there takes and the sharper the reports. From 15, one trip gives a full report. Scouting abroad costs 50% more hours plus travel. Knowledge grows each time you scout somewhere, or spend coaching points here.</p></section>
    <section class="card"><div class="card-h"><h2>Career</h2></div>${S.career.length ? table("career-m", [{ k: "y", l: "Season", f: r => seasonLabel(r.year) }, { k: "c", l: "Club", f: r => clubA(r.club) }, { k: "l", l: "League", f: r => leagueName(r.lg) }, { k: "p", l: "Finish", r: 1, f: r => ord(r.pos) }, { k: "e", l: "Target", r: 1, f: r => ord(r.exp) }, { k: "t", l: "Trophies", f: r => r.trophies.map(trophyName).join(", ") || "—" }], S.career) : '<p class="muted">Finish a season to start your record.</p>'}</section></div>
    <section class="card"><div class="card-h"><h2>Rival coaches</h2><span class="small muted">${leagueName(c.lg)}</span></div>${table("rivalco", [{ k: "c", l: "Club", f: x => clubA(x.id, { short: true }) }, { k: "n", l: "Coach", f: x => esc(x.coach.name) + `<br><span class="tiny muted">${ARCH[x.coach.arch].l}</span>` }, { k: "f", l: "System", f: x => x.coach.form }, ...COACH_KEYS.map(([k, l]) => ({ k, l: l.slice(0, 3), r: 1, f: x => x.coach[k] }))], rivals)}</section></div>`;
}
const VIEWS = { academy: viewAcademy, manager: viewManager, home: viewHome, squad: viewSquad, needs: viewNeeds, tactics: viewTactics, fixtures: viewFixtures, league: viewLeague, cups: viewCups, transfers: viewTransfers, youth: viewYouth, finances: viewFinances, news: viewNews, history: viewHistory };
