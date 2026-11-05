"use strict";
/* Play loop, live matches, saving, and every button. */
let LIVE = null, DRAFT = null;

/* ---------- storage (IndexedDB: a full world is a few MB, too big for localStorage) ---------- */
const DB = {
  db: null,
  open() { return new Promise((res, rej) => { try { const r = indexedDB.open("touchline-manager", 1); r.onupgradeneeded = () => r.result.createObjectStore("s"); r.onsuccess = () => { DB.db = r.result; res(); }; r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); },
  get(k) { return new Promise(res => { try { const t = DB.db.transaction("s").objectStore("s").get(k); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); } catch (e) { res(null); } }); },
  put(k, v) { return new Promise(res => { try { const t = DB.db.transaction("s", "readwrite"); t.objectStore("s").put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); } catch (e) { res(false); } }); },
  del(k) { return new Promise(res => { try { const t = DB.db.transaction("s", "readwrite"); t.objectStore("s").delete(k); t.oncomplete = () => res(true); t.onerror = () => res(false); } catch (e) { res(false); } }); },
};
let saveWarned = false;
async function save() { if (!S || !DB.db) return; const ok = await DB.put("career", S); if (!ok && !saveWarned) { saveWarned = true; toast("Progress couldn't be saved in this browser."); } }

function toast(t) { const el = document.getElementById("toast"); el.textContent = t; el.hidden = false; clearTimeout(UI.toastT); UI.toastT = setTimeout(() => el.hidden = true, 3200); }
function busy(on, text) { const el = document.getElementById("busy"); el.hidden = !on; if (text) el.firstElementChild.textContent = text; }

/* ---------- taking a club ---------- */
function takeClub(id, name, arch) {
  S = DRAFT; DRAFT = null; S.club = id; S.me = newManager(name || "The Manager", arch || "bal");
  const c = me(); S.formation = c.formation; S.lineup = autoPick(c.squad, S.formation);
  startSeason();
  news(`You take charge of ${c.name} in the ${leagueName(c.lg)}. The board's target: ${expText(S.expPos, c.lg).toLowerCase()}.`, true, "board");
  UI.page = "home"; save(); render(); window.scrollTo(0, 0);
}

/* ---------- playing ---------- */
const nextTick = () => new Promise(r => setTimeout(r, 0));
async function play(mode) {
  if (UI.busy || LIVE) return;
  UI.menu = false;
  if (openDecisions().length) { UI.page = "home"; render(); toast("Deal with the decision waiting for you first."); return; }
  UI.busy = true;
  const startWeek = S.week, startPhase = S.phase, startYear = S.year;
  let steps = 0, stopMsg = "";
  try {
    while (true) {
      if (S.sacked) break;
      if (openDecisions().length) { UI.page = "home"; if (!S.sacked) stopMsg = "A decision needs your attention."; break; }
      if (S.phase === "summer") {
        summerStep(); steps++;
        if (mode === "day" || S.phase === "season") break;
        if (steps % 2 === 0) { busy(true, "Summer window…"); await nextTick(); }
        continue;
      }
      const day = S.days[S.di], fxs = dayFixtures(day), ufx = userFixture(fxs);
      if (ufx && !regInfo(me()).ok) { UI.page = "squad"; stopMsg = "Your squad registration is invalid. Reduce to 25 seniors and 17 non-homegrown first."; break; }
      playOthers(day, fxs);
      if (ufx) {
        if (S.set.live && (mode === "match" || mode === "day")) { startLive(ufx); UI.busy = false; busy(false); render(); window.scrollTo(0, 0); return; }
        const M = runToEnd(makeMatch(ufx, true)); applyMatch(M); recordResult(ufx, M);
      }
      finishDay(); steps++;
      if (S.phase !== startPhase || S.year !== startYear) break;
      if (mode === "day") break;
      if (mode === "match" && ufx) break;
      if (mode === "week" && S.week > startWeek) break;
      if (mode === "month" && S.week >= startWeek + 4) break;
      if (mode === "window" && !CAL.jan.includes(S.week)) break;
      if (steps % 2 === 0) { busy(true, `Week ${S.week + 1}…`); await nextTick(); }
    }
  } catch (e) { console.error(e); stopMsg = "Something went wrong: " + e.message; }
  UI.busy = false; busy(false);
  if (S.phase === "summer" && startPhase === "season") UI.page = "home";
  await save(); render();
  if (stopMsg) toast(stopMsg);
}
async function playNewSeason() {
  if (UI.busy) return;
  if (openDecisions().length) { UI.page = "home"; render(); toast("Deal with the decision waiting for you first."); return; }
  UI.busy = true; busy(true, "Summer window…");
  while (S.phase === "summer" && !openDecisions().length) { summerStep(); await nextTick(); }
  UI.busy = false; busy(false); UI.page = "home"; await save(); render();
  if (S.phase === "summer") toast("A decision needs your attention before the season starts.");
}

/* ---------- live matches ---------- */
function startLive(fx) { LIVE = { M: makeMatch(fx, false), fx, k: fx.h === S.club ? 0 : 1, paused: true, speed: 300, t: 0 }; }
function tick() {
  if (!LIVE || LIVE.paused || LIVE.M.done) return;
  const before = LIVE.M.end;
  step(LIVE.M);
  if ((LIVE.M.min === 45 || (LIVE.M.min === 90 && LIVE.M.end > before)) && !LIVE.M.done) LIVE.paused = true;
  render();
  if (!LIVE.paused && !LIVE.M.done) LIVE.t = setTimeout(tick, LIVE.speed);
}
async function finishLive() {
  const { M, fx } = LIVE; LIVE = null;
  applyMatch(M); recordResult(fx, M); finishDay();
  await save(); render(); window.scrollTo(0, 0);
}

/* ---------- actions ---------- */
function assignSlot(i, id) {
  const p = P(id); if (!avail(p)) { toast(`${p.name} is ${p.inj ? "injured" : "suspended"}.`); return; }
  const j = S.lineup.indexOf(id); if (j >= 0) [S.lineup[i], S.lineup[j]] = [S.lineup[j], S.lineup[i]]; else S.lineup[i] = id;
  UI.sel = null; save(); render();
}
const ACT = {
  go: v => { UI.page = v; UI.sel = null; UI.menu = false; location.hash = v; render(); window.scrollTo(0, 0); },
  menu: () => { UI.menu = !UI.menu; render(); },
  play: v => v === "newseason" ? playNewSeason() : play(v),
  pick: v => takeClub(+v),
  choose: v => { UI.modal = { t: "coach", club: +v, arch: "bal", name: "" }; renderModal(); setTimeout(() => { const el = document.getElementById("coach-name"); if (el) el.focus(); }, 0); },
  arch: v => { const el = document.getElementById("coach-name"); UI.modal.name = el ? el.value : UI.modal.name; UI.modal.arch = v; renderModal(); },
  startcareer: () => { const el = document.getElementById("coach-name"); const m = UI.modal; UI.modal = null; takeClub(m.club, (el && el.value.trim()) || "The Manager", m.arch); },
  coachpt: v => { if (S.me.pts <= 0 || S.me[v] >= 20) return; S.me[v]++; S.me.pts--; save(); render(); },
  scoutp: v => { const p = P(+v); if (S.rec.hours < 2) return toast(`Not enough scouting hours left this week (${S.rec.hours}).`); S.rec.hours -= 2; S.scout[p.id] = Math.min(2, (S.scout[p.id] || 0) + 1); save(); renderModal(); render(); toast(S.scout[p.id] >= 2 ? `Full report on ${p.name} filed.` : `First look at ${p.name}: one more visit for a full report.`); },
  sort: v => { const [id, k] = v.split("|"); const cur = UI.sort[id]; UI.sort[id] = { k, d: cur && cur.k === k ? -cur.d : (["n", "pos", "club", "from", "rank"].includes(k) ? 1 : -1) }; render(); },
  club: v => { UI.modal = { t: "club", id: +v }; UI.confirm = null; renderModal(); },
  player: v => { UI.modal = { t: "player", id: +v }; UI.confirm = null; renderModal(); },
  prospect: v => { UI.modal = { t: "prospect", id: v }; renderModal(); },
  closemodal: (v, el, e) => { if (el.classList.contains("scrim") && e.target.closest("[data-stop]")) return; UI.modal = null; UI.bid = null; UI.confirm = null; renderModal(); render(); },
  decide: v => { const [id, ch] = v.split("|"); const m = S.inbox.find(x => x.id === +id); if (!m || m.done) return; const msg = resolveDecision(m, ch); save(); render(); if (msg) toast(msg); },
  seenreview: () => { S.seasonOverSeen = true; save(); render(); },
  ment: v => { S.mentality = v; save(); render(); },
  train: v => { S.training = v; save(); render(); },
  autopick: () => { S.lineup = autoPick(me().squad, S.formation); UI.sel = null; save(); render(); toast("Best available XI selected."); },
  slot: v => { const i = +v; if (UI.sel && UI.sel.pid != null) return assignSlot(i, UI.sel.pid); UI.sel = UI.sel && UI.sel.slot === i ? null : { slot: i }; render(); },
  "pick-p": v => { const id = +v; if (UI.sel && UI.sel.slot != null) return assignSlot(UI.sel.slot, id); UI.sel = UI.sel && UI.sel.pid === id ? null : { pid: id }; render(); },
  sqf: v => { UI.sqf = v; render(); }, ttab: v => { UI.tab = v; render(); }, nf: v => { UI.nf = v; render(); },
  morehist: () => { UI.histN += 10; render(); },
  loanin: v => { const r = userLoanIn(P(+v)); toast(r.msg); if (r.ok) { UI.modal = null; save(); } render(); },
  "ask-loan": v => { const p = P(+v), d = loanDestinations(p)[0]; if (!d) return toast(`No club suitable for ${p.name} has room for a loan right now.`); UI.confirm = { id: p.id, act: "loan", to: d.id, msg: `Loan ${p.name} to ${d.name} (${leagueName(d.lg)}) for the season? He'd be a regular starter there.`, yes: "Agree the loan" }; renderModal(); },
  export: () => { try { const blob = new Blob([JSON.stringify(S)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `touchline-${me().short}-${S.year}.json`; document.body.appendChild(a); a.click(); a.remove(); toast("Save file exported."); } catch (e) { toast("Export isn't available here."); } },
  bid: v => { UI.modal = { t: "bid", id: +v }; UI.bid = null; renderModal(); },
  submitbid: v => { const p = P(+v), b = UI.bid; const r = userBid(p, p.club >= 0 ? b.fee : 0, b.yrs); b.msg = r.msg; b.ok = r.ok; save(); if (r.ok) { toast(r.msg); render(); } renderModal(); },
  rec: v => { const [id, act] = v.split("|"); const y = S.prospects.find(x => x.id === id); const r = recAct(y, act); toast(r); save(); render(); },
  renew: v => { const p = P(+v), t = renewTerms(p); if (!t.happy) return toast(t.reason); p.yrs = 4; p.wage = t.wage; p.mood = Math.min(100, p.mood + 5); news(`${p.name} signs a new four-year contract on ${perWeek(t.wage)}.`, false, "squad"); save(); render(); toast(`${p.name} renewed until ${S.year + 4}.`); },
  list: v => { const p = P(+v); p.listed = !p.listed; if (p.listed) p.mood = Math.max(0, p.mood - 6); save(); render(); toast(p.listed ? `${p.name} is on the transfer list.` : `${p.name} is off the list.`); },
  "ask-sell": v => { const p = P(+v), c = me(); if (c.squad.length <= 16) return toast("You need at least 16 players."); if (p.pos === "GK" && c.squad.filter(id => P(id).pos === "GK").length <= 2) return toast("You need to keep two goalkeepers."); UI.confirm = { id: p.id, act: "sell", msg: `Sell ${p.name} for ${money(Math.round(value(p) * .8 / 1e4) * 1e4)}?`, yes: "Sell him" }; renderModal(); },
  "ask-release": v => { const p = P(+v); UI.confirm = { id: p.id, act: "release", msg: `Release ${p.name}? You pay ${money(Math.round(p.wage * Math.max(0, p.yrs) * .5))} to settle his contract.`, yes: "Release him" }; renderModal(); },
  "confirm-no": () => { UI.confirm = null; renderModal(); },
  "confirm-yes": () => { const cf = UI.confirm; UI.confirm = null; const p = P(cf.id); if (!p) return; if (cf.act === "loan") { startLoan(p, C(cf.to)); fixUserLineup(); toast(`${p.name} joins ${C(cf.to).name} on loan.`); UI.modal = null; save(); render(); return; } if (cf.act === "sell") { const fee = sellToAbroad(p); toast(`Sold for ${money(fee)}.`); } else { releasePlayer(p); toast(`${p.name} released.`); } UI.modal = null; save(); render(); },
  scout: v => { S.rec.scoutLvl = clamp(S.rec.scoutLvl + +v, 1, 5); save(); render(); },
  academy: v => { const c = me(), cost = +v; if (c.cash < cost || c.academy >= 10) return; c.cash -= cost; c.academy++; news(`Academy upgraded to ${c.academy}/10 at a cost of ${money(cost)}.`, false, "youth"); save(); render(); },
  takejob: v => { const c = C(+v); S.club = c.id; S.sacked = false; S.sackReason = null; S.board = 55; S.formation = c.formation; S.lineup = autoPick(c.squad, c.formation); S.expPos = expectedPos(c); S.inbox.forEach(m => m.done = true); news(`You are the new manager of ${c.name}.`, true, "board"); UI.page = "home"; save(); render(); },
  reset: async () => { await DB.del("career"); S = null; DRAFT = null; LIVE = null; UI.page = "home"; render(); window.scrollTo(0, 0); },
  liveresume: () => { LIVE.paused = false; tick(); },
  livepause: () => { LIVE.paused = true; clearTimeout(LIVE.t); render(); },
  livespeed: v => { LIVE.speed = +v; render(); },
  liveme: v => { const s = LIVE.k ? LIVE.M.a : LIVE.M.h; s.ment = v; s.rt = null; S.mentality = v; render(); },
  livesub: () => { const off = +document.getElementById("sub-off").value, on = +document.getElementById("sub-on").value; doSub(LIVE.M, LIVE.k, off, on); render(); },
  liveskip: () => { clearTimeout(LIVE.t); const s = LIVE.k ? LIVE.M.a : LIVE.M.h; s.auto = true; runToEnd(LIVE.M); render(); },
  livecont: () => finishLive(),
};
const CHG = {
  form: v => { reshapeUser(v); save(); render(); toast(`Switched to ${v}.`); },
  live: (v, el) => { S.set.live = el.checked; save(); },
  lg: v => { UI.lg = v; render(); },
  startl: v => { UI.startL = v; render(); },
  cup: v => { UI.cupK = v; render(); },
  import: (v, el) => { const f = el.files && el.files[0]; if (!f) return; const r = new FileReader(); r.onload = async () => { try { const d = JSON.parse(r.result); if (d.v !== 4 || d.club == null) throw new Error("not a save"); S = d; LIVE = null; UI.page = "home"; await save(); render(); toast("Save file loaded."); } catch (e) { toast("That file isn't a Touchline Manager save."); } }; r.readAsText(f); },
  "tf-pos": v => { UI.tf.pos = v; render(); }, "tf-age": v => { UI.tf.age = +v; render(); }, "tf-min": v => { UI.tf.min = +v; render(); }, "tf-fee": v => { UI.tf.fee = +v; render(); }, "tf-lg": v => { UI.tf.lg = v; render(); },
  "yf-reg": v => { UI.yf.reg = v; render(); }, "yf-pos": v => { UI.yf.pos = v; render(); }, "yf-st": v => { UI.yf.st = v; render(); },
  "bid-fee": v => { UI.bid.fee = +v; UI.bid.msg = ""; renderModal(); }, "bid-yrs": v => { UI.bid.yrs = +v; UI.bid.msg = ""; renderModal(); },
};
document.addEventListener("click", e => {
  const t = e.target.closest("[data-a]");
  if (UI.menu && !e.target.closest(".playbox")) { UI.menu = false; if (!t) { render(); return; } }
  if (!t || t.disabled) return;
  if (t.dataset.a === "closemodal" && t.classList.contains("scrim") && e.target !== t) return;
  ACT[t.dataset.a]?.(t.dataset.v, t, e);
});
document.addEventListener("change", e => { const t = e.target.closest("[data-c]"); if (t) CHG[t.dataset.c]?.(t.value, t); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && UI.modal) { UI.modal = null; UI.bid = null; renderModal(); render(); } });
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (VIEWS[h] && h !== UI.page) { UI.page = h; render(); } });

/* ---------- boot ---------- */
async function boot(data) {
  const h = location.hash.slice(1); if (VIEWS[h]) UI.page = h;
  try { await DB.open(); } catch (e) { /* storage unavailable: play in memory */ }
  S = (data && data.S) || (DB.db ? await DB.get("career") : null);
  if (S && (S.v !== 4 || S.club == null)) S = null;
  render();
  // Ask the browser not to clear a long career when space runs low, and cache the game for offline play.
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
  try { if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && window.top === window) navigator.serviceWorker.register("sw.js").catch(() => { }); } catch (e) { }
}
window.claude?.hot?.snapshot?.(() => ({ S }));
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
