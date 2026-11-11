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
/* Several careers can be kept. Each is stored under "save:<id>", and "saves" holds a small index (club,
   manager, season, last played) so the landing screen can list them without loading every world.
   Before 5.13 there was one career under "career"; boot moves it across. */
let saveWarned = false;
const SAVES = { list: [] };
const newSaveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function saveMeta() {
  const c = me();
  return { id: S.saveId, club: c.name, short: c.short, color: c.color, manager: S.me ? S.me.name : "", lg: c.lg, year: S.year, phase: S.phase, week: S.week,
    sacked: !!S.sacked, created: S.created || Date.now(), updated: Date.now() };
}
async function save() {
  if (!S || S.club == null || !DB.db) return;
  if (!S.saveId) S.saveId = newSaveId();
  const ok = await DB.put("save:" + S.saveId, S);
  if (ok) { const m = saveMeta(); SAVES.list = [m, ...SAVES.list.filter(x => x.id !== m.id)]; await DB.put("saves", SAVES.list); }
  else if (!saveWarned) { saveWarned = true; toast("Progress couldn't be saved in this browser."); }
}
// Load a stored career and bring it up to date. Returns false if it can't be used.
function adoptSave(d) {
  if (!d) return false;
  if (d.v === 4) migrate4(d);
  if (d.v !== 5 || d.club == null) return false;
  S = d; upgradeSave(); if (S.club != null) drawAhead(); LIVE = null; UI.page = "home"; UI.modal = null; UI.screen = null; UI.delAsk = null;
  return true;
}

function toast(t) { const el = document.getElementById("toast"); el.textContent = t; el.hidden = false; clearTimeout(UI.toastT); UI.toastT = setTimeout(() => el.hidden = true, 3200); }
function busy(on, text) { const el = document.getElementById("busy"); el.hidden = !on; if (text) el.firstElementChild.textContent = text; }

/* ---------- taking a club ---------- */
function takeClub(id, name, arch, form) {
  S = DRAFT; DRAFT = null; S.club = id; S.me = newManager(name || "The Manager", arch || "bal", form || "4-3-3");
  S.saveId = newSaveId(); S.created = Date.now(); UI.screen = null;
  const c = me(); S.formation = S.me.form; c.formation = S.formation; autoRegister(c, false); S.lineup = autoPick(eligibleIds(c), S.formation);
  startSeason(); initAcademy(); S.seenV = 1; for (const id of c.squad) P(id).seen = GS_SEEN;  // the club's coaches already know its players
  // Every career starts with five weeks of preseason, window open, before the first match.
  S.phase = "summer"; S.summerDay = 0; S.firstPre = true; S.friendlies = []; S.friNo = [];
  news(`You take charge of ${c.name} in the ${leagueName(c.lg)}. The board's target: ${expText(S.expPos, c.lg).toLowerCase()}. Five weeks of preseason first, with the transfer window open.`, true, "board");
  UI.page = "home"; save(); render(); toTop();
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
        // This week's friendly first: live if you watch matches live (the week moves on when it ends).
        const f = friendlyAt(S.summerDay);
        if (f && !f.played) {
          if (S.set.live && mode === "day") { startLive(friendlyFixture(f)); UI.busy = false; busy(false); render(); toTop(); return; }
          playFriendlySim();
        }
        summerStep(); steps++;
        if (mode === "day" || S.phase === "season") break;
        busy(true, "Preseason…"); await nextTick();
        continue;
      }
      const day = S.days[S.di], fxs = dayFixtures(day), ufx = userFixture(fxs);
      // Rotation: on match day the assistant picks a fresh XI, once, so any changes you then make stick.
      if (ufx && S.set.rotate && S.rotDi !== S.year * 1000 + S.di) { S.lineup = freshPick(eligibleIds(me()), S.formation); S.rotDi = S.year * 1000 + S.di; }
      // "To my next match day" stops at the start of your match day without playing it, so you can set the
      // team first; Play match then plays it (live if you watch live).
      if (mode === "match" && ufx) { UI.page = "home"; stopMsg = steps ? `Match day: ${compLabel(ufx)}. Set your team, then press Play match.` : "Your match is today. Set your team, then press Play match."; break; }
      if (ufx && !regInfo(me()).ok) { UI.page = "squad"; stopMsg = "Your registration is invalid: register at most 25 seniors (17 non-homegrown) and at least 16 eligible players."; break; }
      playOthers(day, fxs);
      if (ufx) {
        if (S.set.live && (mode === "play" || mode === "day")) { startLive(ufx); UI.busy = false; busy(false); render(); toTop(); return; }
        const M = runToEnd(makeMatch(ufx, true)); applyMatch(M); recordResult(ufx, M);
      }
      finishDay(); steps++;
      if (S.phase !== startPhase || S.year !== startYear) break;
      if (mode === "day") break;
      if (mode === "play" && ufx) break;
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
  UI.busy = true; busy(true, "Preseason…");
  while (S.phase === "summer" && !openDecisions().length) { playFriendlySim(); summerStep(); await nextTick(); }
  UI.busy = false; busy(false); UI.page = "home"; await save(); render();
  if (S.phase === "summer") toast("A decision needs your attention before the season starts.");
}

/* ---------- live matches ---------- */
function livePause() { clearTimeout(LIVE.t); LIVE.paused = true; }
/* Before kick-off: tap any two of a starter, a substitute and a player outside the matchday squad to swap
   them. It changes the team sheet, so no substitution is used. Two starters swap positions. */
function livePre(x) {
  const M = LIVE.M, k = LIVE.k, sel = UI.lsel || {}, kind = o => o.on != null ? "on" : o.bench != null ? "bench" : "out", same = (a, b) => kind(a) === kind(b) && (a.on ?? a.bench ?? a.out) === (b.on ?? b.bench ?? b.out);
  if (!UI.lsel) UI.lsel = x;
  else if (same(sel, x)) UI.lsel = null;
  else if (kind(sel) === "on" && kind(x) === "on") { swapSlots(M, k, sel.on, x.on); savePreMatch(k ? M.a : M.h); UI.lsel = null; }
  else if (kind(sel) === kind(x)) UI.lsel = x;
  else { preSwap(M, k, sel, x); UI.lsel = null; save(); }
  render();
}
function startLive(fx) { UI.lsel = null; LIVE = { M: makeMatch(fx, false), fx, k: fx.h === S.club ? 0 : 1, paused: true, speed: 300, t: 0 }; }
function tick() {
  if (!LIVE || LIVE.paused || LIVE.M.done) return;
  const before = LIVE.M.end;
  step(LIVE.M);
  if ((LIVE.M.min === 45 || (LIVE.M.min === 90 && LIVE.M.end > before)) && !LIVE.M.done) LIVE.paused = true;
  if (LIVE.M.injWait && LIVE.M.injWait.side === LIVE.k) { LIVE.paused = true; UI.lsel = null; }  // an injury: you choose the substitute
  if (LIVE.M.redWait) { LIVE.paused = true; UI.lsel = null; }  // a red card: time to rethink
  render();
  if (!LIVE.paused && !LIVE.M.done) LIVE.t = setTimeout(tick, LIVE.speed);
}
async function finishLive() {
  const { M, fx } = LIVE; LIVE = null;
  if (fx.comp === "F") { settleFriendly(M, friendlyAt(S.summerDay)); summerStep(); await save(); render(); toTop(); return; }  // a friendly: off the record, then the week moves on
  applyMatch(M); recordResult(fx, M); finishDay();
  await save(); render(); toTop();
}

/* ---------- actions ---------- */
function assignSlot(i, id) {
  const p = P(id); if (!avail(p)) { toast(`${p.name} is ${p.inj ? "injured" : "suspended"}.`); return; }
  if (!isReg(p, me())) { toast(`${p.name} isn't registered, so he can't play.`); return; }
  const j = S.lineup.indexOf(id); if (j >= 0) [S.lineup[i], S.lineup[j]] = [S.lineup[j], S.lineup[i]]; else S.lineup[i] = id;
  const fromPicker = UI.page === "tactics" && document.querySelector(".tac-pick");
  UI.sel = null; save(); render();
  // On the Line-up tab the picker sits below the pitch: return to the pitch to show the change.
  if (fromPicker) window.scrollTo(0, 0);
}
// Every country can be switched off (Unselect all, then pick the few you want); the lists then say none are selected.
function ctyToggle(key, v) { const off = new Set(S.set[key] || []); off.has(v) ? off.delete(v) : off.add(v); S.set[key] = [...off]; save(); render(); }
// The club fields in the new-career form, kept on the modal so a re-render (picking a colour) doesn't lose them.
function keepClubForm(m) { const n = document.getElementById("club-name"), s = document.getElementById("club-short"); if (n) m.cname = n.value; if (s) m.cshort = s.value.toUpperCase();
  for (const [k, id] of [["cregion", "club-region"], ["cowner", "club-owner"], ["crep", "club-rep"], ["cacad", "club-acad"], ["csup", "club-sup"], ["cfans", "club-fans"], ["ccap", "club-cap"], ["ccash", "club-cash"], ["cinc", "club-inc"], ["csq", "club-sq"]]) { const el = document.getElementById(id); if (el) m[k] = el.value; } }
/* Apply the new-career form's club edits to the chosen club before the career starts (5.72). Numbers are kept in range. */
function applyClubEdits(c, m) {
  const n = (k, lo, hi) => m[k] == null || m[k] === "" || isNaN(+m[k]) ? null : clamp(+m[k], lo, hi);
  const reg = clubRegions(c).find(r => r[0] === m.cregion);
  if (reg && reg[0] !== c.region) { c.region = reg[0]; c.lat = reg[1] + rf(-.3, .3); c.lon = reg[2] + rf(-.4, .4); }
  if (OWNER[m.cowner]) c.owner = m.cowner;
  const rep = n("crep", 1, 96); if (rep != null) { c.rep = c.rep0 = Math.round(rep); }
  const ac = n("cacad", 1, 20); if (ac != null) c.academy = Math.round(ac);
  const su = n("csup", 1, 20); if (su != null) c.support = Math.round(su);
  const fa = n("cfans", 20, 90); if (fa != null) c.fans = c.fans0 = Math.round(fa);
  const cap = n("ccap", 500, 100000); if (cap != null && Math.round(cap) !== c.cap) { c.cap = Math.round(cap); setTicketPrice(c); }
  const cash = n("ccash", 0, 2000); if (cash != null) c.cash = Math.round(cash * 1e6);
  const inc = n("cinc", 50, 300); if (inc != null && inc !== 100) { c.revBase = Math.round(c.revBase * inc / 100); scaleDeals(c, inc / 100); }
  // Squad strength: every attribute and potential moves by the same amount, so each player keeps his profile.
  const d = Math.round(n("csq", -3, 3) || 0);
  if (d) for (const id of c.squad) { const p = P(id); for (const k in p.at) p.at[k] = clamp(p.at[k] + d, 1, 20); setOvr(p); p.pot = clamp(p.pot + 3 * d, p.ovr, 95); p.peak = Math.max(p.peak || 0, p.ovr); }
  bumpTick();
}
const ACT = {
  regbest: () => { autoRegister(me(), false); fixUserLineup(); save(); render(); toast("Your best 25 seniors are registered."); },
  regtoggle: v => {
    const c = me(), p = P(+v); if (!windowOpen()) return toast("Registration only changes while the transfer window is open.");
    if (isReg(p, c)) { c.reg = c.reg.filter(id => id !== p.id); fixUserLineup(); toast(`${p.name} is off the registered list. He won't be happy.`); }
    else { const r = regInfo(c); if (r.registered >= RULES.squadMax) return toast("All 25 places are taken. Unregister someone first.");
      if (!isHG(p, c.country) && r.nonHG >= RULES.nonHGMax) return toast(`All ${RULES.nonHGMax} non-homegrown places are taken.`);
      c.reg.push(p.id); toast(`${p.name} is registered.`); }
    save(); render(); },
  buildask: v => { UI.confirmBuild = v; render(); },
  buildcancel: () => { UI.confirmBuild = null; render(); },
  build: v => { const c = me(); if (c.build) return; startExpansion(c, v); UI.confirmBuild = null; save(); render(); toast("Building work has started."); },
  go: v => { UI.page = v; UI.sel = null; UI.menu = false; location.hash = v; render(); toTop(); },
  menu: () => { UI.menu = !UI.menu; render(); },
  play: v => v === "newseason" ? playNewSeason() : play(v),
  pick: v => takeClub(+v),
  choose: v => { UI.modal = { t: "coach", club: +v, arch: "bal", name: "" }; renderModal(); setTimeout(() => { const el = document.getElementById("coach-name"); if (el) el.focus(); }, 0); },
  arch: v => { keepClubForm(UI.modal); const el = document.getElementById("coach-name"); UI.modal.name = el ? el.value : UI.modal.name; UI.modal.arch = v; renderModal(); },
  startcareer: () => { const el = document.getElementById("coach-name"), fe = document.getElementById("coach-form"), us = document.getElementById("coach-unsack"); const m = UI.modal;
    // Your club's name, short name and colour, as edited in the form; a name or short name another club uses is refused.
    keepClubForm(m); const c = DRAFT.clubs[m.club], name = (m.cname ?? c.name).trim().replace(/\s+/g, " "), short = (m.cshort ?? c.short).trim().toUpperCase();
    m.cerr = name.length < 3 ? "The club name needs at least three letters." : !/^[A-Z0-9]{2,3}$/.test(short) ? "The short name is two or three letters." : DRAFT.clubs.some(o => o.id !== c.id && o.name.toLowerCase() === name.toLowerCase()) ? `There is already a ${name}: choose another name.` : DRAFT.clubs.some(o => o.id !== c.id && o.short === short) ? `${short} is already another club's short name.` : null;
    if (m.cerr) { m.name = el ? el.value : m.name; renderModal(); return; }
    c.name = name; c.short = short; if (m.ccolor) c.color = m.ccolor;
    { const keep = S; S = DRAFT; applyClubEdits(c, m); S = keep; }
    UI.modal = null; takeClub(m.club, (el && el.value.trim()) || "The Manager", m.arch, fe ? fe.value : "4-3-3"); S.set.unsackable = !!(us && us.checked); save(); render(); },
  coachpt: v => { if (S.me.pts <= 0 || S.me[v] >= 20) return; S.me[v]++; S.me.pts--; save(); render(); },
  knowpt: v => { if (S.me.pts <= 0 || knowOf(v) >= 20) return; S.me.know[v] = Math.min(20, Math.floor(knowOf(v)) + 1); S.me.pts--; save(); render(); },
  scoutp: v => { const p = P(+v), code = playerCountry(p), h = scoutHours(2, code); if (S.rec.hours < h) return toast(`Not enough scouting hours left this week (${S.rec.hours}); scouting in ${KNOW_NAME(code)} takes ${h}.`); scoutPlayer(p); save(); renderModal(); render(); toast(S.scout[p.id] >= 2 ? `Full report on ${p.name} filed.` : `First look at ${p.name}: one more visit for a full report.`); },
  sort: v => { const [id, k] = v.split("|"); const cur = UI.sort[id]; UI.sort[id] = { k, d: cur && cur.k === k ? -cur.d : (["n", "pos", "club", "from", "rank"].includes(k) ? 1 : -1) }; render(); },
  club: v => { UI.modal = { t: "club", id: +v }; UI.confirm = null; renderModal(); },
  player: v => { UI.modal = { t: "player", id: +v }; UI.confirm = null; UI.loanPick = null; UI.loanIn = null; renderModal(); },
  prospect: v => { UI.modal = { t: "prospect", id: v }; renderModal(); },
  closemodal: (v, el, e) => { if (el.classList.contains("scrim") && e.target.closest("[data-stop]")) return; UI.modal = null; UI.bid = null; UI.confirm = null; renderModal(); render(); },
  decide: v => { const [id, ch] = v.split("|"); const m = S.inbox.find(x => x.id === +id); if (!m || m.done) return; const msg = resolveDecision(m, ch); save(); render(); if (msg) toast(msg); },
  seenreview: () => { S.seasonOverSeen = true; save(); render(); },
  ment: v => { S.mentality = v; save(); render(); },
  tackle: v => { S.tackling = v; save(); render(); },
  instr: (v, el) => { if (v.includes("|")) { const [key, o] = v.split("|"); S[key] = o; } else S[el.dataset.k] = v; save(); render(); },

  train: v => { S.training = v; save(); render(); },
  // Your bench: tap to add or remove; spots you don't fill are filled automatically.
  benchtoggle: v => { const id = +v, b = (S.bench || []).filter(x => S.players[x] && !S.lineup.includes(x)); const i = b.indexOf(id);
    if (i >= 0) { b.splice(i, 1); (S.benchNo ||= []).includes(id) || S.benchNo.push(id); } else { S.benchNo = (S.benchNo || []).filter(x => x !== id); if (b.length >= RULES.benchSize) return toast(`The bench holds ${RULES.benchSize}. Take someone off it first.`); b.push(id); }
    S.bench = b; save(); render(); },
  // From the match card: drop a sub (yours or automatic; he isn't brought back automatically) or add one.
  benchdrop: v => { const id = +v, cur = benchFor(me(), S.lineup); S.bench = cur.filter(x => x !== id && (S.bench || []).includes(x)); (S.benchNo ||= []).includes(id) || S.benchNo.push(id); save(); render(); },
  friask: () => { const f = UI.fri || {}; if (f.opp == null) return toast("Choose an opponent first."); const r = bookFriendly(f.wk ?? S.summerDay, f.opp, f.home !== false); UI.fri = { home: f.home, sort: f.sort }; save(); render(); toast(r); },
  yunscout: v => { const y = S.prospects.find(x => x.id === v); if (!y) return; y.hide = true; save(); render(); toast(`${y.name} removed from your scouted prospects. His report is kept: Show removed to restore him.`); },
  yunhide: v => { const y = S.prospects.find(x => x.id === v); if (!y) return; y.hide = false; save(); render(); toast(`${y.name} is back on your scouted prospects.`); },
  yshowremoved: () => { UI.yShowRemoved = !UI.yShowRemoved; render(); },
  ctytog: v => ctyToggle("ctyOff", v), ctyall: () => { S.set.ctyOff = []; save(); render(); },
  yctytog: v => ctyToggle("yCtyOff", v), yctyall: () => { S.set.yCtyOff = []; save(); render(); },
  ctynone: () => { S.set.ctyOff = KNOW_KEYS.slice(); save(); render(); }, yctynone: () => { S.set.yCtyOff = KNOW_KEYS.slice(); save(); render(); },
  intakepick: v => { const it = S.intake; if (!it) return; const id = +v, i = it.pick.indexOf(id); if (i >= 0) it.pick.splice(i, 1); else { const room = intakeRoom(); if (it.pick.length >= room) return toast(room < INTAKE_KEEP ? `Your academy has room for ${room} more (${acadCount(me())}/${ACAD_CAP} places used). Promote or release someone to make space.` : `You can keep ${INTAKE_KEEP} at most. Untick one first.`); it.pick.push(id); } save(); render(); },
  intakeok: () => { if (!S.intake) return; const n = S.intake.ids.length - S.intake.pick.length; settleIntake(false); save(); render(); toast(`Done. ${n ? `${n} released as free agent${n > 1 ? "s" : ""}.` : ""}`); },
  fav: v => { const p = P(+v), f = (S.fav ||= {}); if (f[p.id]) delete f[p.id]; else f[p.id] = 1; save(); render(); if (UI.modal) renderModal(); toast(f[p.id] ? `${p.name} added to your favourites (Transfers › Favourites).` : `${p.name} removed from your favourites.`); },
  yfav: v => { const y = S.prospects.find(x => x.id === v); if (!y) return; const f = (S.yfav ||= {}); if (f[y.id]) delete f[y.id]; else f[y.id] = 1; save(); render(); if (UI.modal) renderModal(); toast(f[y.id] ? `${y.name} added to your favourite prospects (Youth › Favourites).` : `${y.name} removed from your favourites.`); },
  unscout: v => { const p = P(+v); (S.scoutHide ||= {})[p.id] = 1; save(); render(); toast(`${p.name} removed from your scouted list. His report is kept: Show removed to restore him.`); },
  unhide: v => { const p = P(+v); if (S.scoutHide) delete S.scoutHide[p.id]; save(); render(); toast(`${p.name} is back on your scouted list.`); },
  showremoved: () => { UI.showRemoved = !UI.showRemoved; render(); },
  fricancel: v => { const r = cancelFriendly(+v); save(); render(); toast(r); },
  benchauto: () => { S.bench = null; S.benchNo = []; save(); render(); toast("Bench back to automatic: your best available players."); },
  potpick: () => { const c = me(), r = potentialPick(c); UI.sel = null; save(); render();
    const xi = S.lineup.filter(id => id != null).map(P), young = xi.filter(p => p.age <= 23).length, age = (xi.reduce((s, p) => s + p.age, 0) / xi.length).toFixed(1);
    const parts = [r.acadXI ? `${r.acadXI} academy player${r.acadXI > 1 ? "s" : ""} starting` : "", r.acadBench ? `${r.acadBench} academy player${r.acadBench > 1 ? "s" : ""} on the bench` : ""].filter(Boolean);
    toast(`High-potential XI: ${young} of 11 aged 23 or under, average age ${age}.${parts.length ? " " + parts.join(", ") + "." : ""}`); },
  freshpick: () => { const c = me(); S.acadPick = []; S.lineup = freshPick(eligibleIds(c), S.formation); UI.sel = null; save(); render(); const tired = S.lineup.filter(id => id != null && P(id).fit < FRESH_FIT).length; toast(tired ? `Fresh XI picked. ${tired} position${tired > 1 ? "s" : ""} had no one at ${FRESH_FIT}%+ fitness.` : `Fresh XI picked: everyone at ${FRESH_FIT}%+ fitness.`); },
  autopick: () => { S.acadPick = []; S.lineup = autoPick(eligibleIds(me()), S.formation); UI.sel = null; save(); render(); toast("Best available XI selected."); },
  slot: v => { const i = +v; if (UI.sel && UI.sel.pid != null) return assignSlot(i, UI.sel.pid); UI.sel = UI.sel && UI.sel.slot === i ? null : { slot: i }; render();
    // The "who plays here" list is below the pitch, off-screen on a phone: bring it into view.
    if (UI.sel) document.querySelector(".tac-pick")?.scrollIntoView({ block: "start" }); },
  "pick-p": v => { const id = +v; if (UI.sel && UI.sel.slot != null) return assignSlot(UI.sel.slot, id); UI.sel = UI.sel && UI.sel.pid === id ? null : { pid: id }; render(); },
  sqf: v => { UI.sqf = v; render(); }, ttab: v => { UI.tab = v; render(); }, nf: v => { UI.nf = v; render(); },
  morehist: () => { UI.histN += 10; render(); },
  loanin: v => { UI.modal = { t: "player", id: +v }; UI.confirm = null; UI.loanPick = null; UI.loanIn = +v; renderModal(); },
  "loanin-no": () => { UI.loanIn = null; renderModal(); },
  "loanin-go": v => { const [pid, sh] = v.split("|"), r = userLoanIn(P(+pid), +sh); toast(r.msg); if (r.ok) { UI.loanIn = null; UI.modal = null; save(); render(); } else renderModal(); },
  loanshare: v => { UI.loanOutShare = +v; renderModal(); },
  "ask-loan": v => { UI.loanPick = +v; renderModal(); },
  "loan-cancel": () => { UI.loanPick = null; renderModal(); },
  "loan-to": v => { const [pid, cid] = v.split("|").map(Number), p = P(pid), d = C(cid); if (!windowOpen()) return toast("Loans can only be agreed while the window is open.");
    const share = UI.loanOutShare || 1, max = borrowerMaxShare(p, d);
    if (share > max + 1e-9) return toast(`${d.name} won't pay ${share * 100}% of his wage: the most they'll cover is ${Math.round(downToQuarter(max) * 100)}%.`);
    startLoan(p, d, share); UI.loanPick = null; fixUserLineup(); UI.modal = null; save(); render(); toast(`${p.name} joins ${d.name} on loan.`); },
  "ask-loan-old": v => { const p = P(+v), d = loanDestinations(p)[0]; if (!d) return toast(`No club suitable for ${p.name} has room for a loan right now.`); UI.confirm = { id: p.id, act: "loan", to: d.id, msg: `Loan ${p.name} to ${d.name} (${leagueName(d.lg)}) for the season? He'd be a regular starter there.`, yes: "Agree the loan" }; renderModal(); },
  export: () => { try { const blob = new Blob([JSON.stringify(S)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `touchline-${me().short}-${S.year}.json`; document.body.appendChild(a); a.click(); a.remove(); toast("Save file exported."); } catch (e) { toast("Export isn't available here."); } },
  needfind: v => { UI.tf = { pos: v, age: 40, min: 0, fee: 0, lg: "ALL" }; UI.tab = "search"; UI.page = "transfers"; location.hash = "transfers"; render(); toTop(); },
  bid: v => { UI.modal = { t: "bid", id: +v }; UI.bid = null; renderModal(); },
  submitbid: v => { const p = P(+v), b = UI.bid; const r = userBid(p, p.club >= 0 ? b.fee : 0, b.yrs, b.wage, b); b.msg = r.msg; b.ok = r.ok; save(); if (r.ok) { toast(r.msg); render(); } renderModal(); },
  bidcounter: v => { const b = UI.bid; if (v === "fee" && b.counterFee) b.fee = b.counterFee; if (v === "wage" && b.counterWage) b.wage = b.counterWage; b.msg = ""; renderModal(); },
  rec: v => { const [id, act] = v.split("|"); const y = S.prospects.find(x => x.id === id); const r = recAct(y, act); toast(r); save(); render(); },
  renew: v => { const p = P(+v), t = renewTerms(p); if (!t.happy) return toast(t.reason); p.yrs = 4; p.wage = t.wage; p.mood = Math.min(100, p.mood + 5); news(`${p.name} signs a new four-year contract on ${perWeek(t.wage)}.`, false, "squad"); save(); render(); toast(`${p.name} renewed until ${S.year + 4}.`); },
  // Listing upsets a player who wants to stay (mood -6), and taking him off gives it back. One who wants out (has
  // asked to leave, or feels he's outgrown the club) doesn't mind. Before 5.55 the -6 was never undone.
  list: v => { const p = P(+v), c = me(); p.listed = !p.listed;
    if (p.listed) { p.listPct = p.listPct || 1; const wantsOut = p.req || (p.ovr > clubLevel(c) + 6 && p.amb > .6); p.listMood = wantsOut ? 0 : Math.min(6, p.mood); p.mood -= p.listMood; }
    else { p.mood = Math.min(100, p.mood + (p.listMood || 0)); p.listMood = 0; }
    save(); render(); toast(p.listed ? `${p.name} is on the transfer list at ${money(askingPrice(p))}${p.listMood ? "; he's not happy about it" : ""}.` : `${p.name} is off the list.`); },

  "ask-sell": v => { const p = P(+v), c = me(); if (c.squad.length <= 16) return toast("You need at least 16 players."); if (p.pos === "GK" && c.squad.filter(id => P(id).pos === "GK").length <= 2) return toast("You need to keep two goalkeepers."); UI.confirm = { id: p.id, act: "sell", msg: `Sell ${p.name} for ${money(Math.round(value(p) * .8 / 1e4) * 1e4)}?`, yes: "Sell him" }; renderModal(); },
  "ask-release": v => { const p = P(+v); UI.confirm = { id: p.id, act: "release", msg: `Release ${p.name}? You pay ${money(Math.round(p.wage * Math.max(0, p.yrs) * .5))} to settle his contract.`, yes: "Release him" }; renderModal(); },
  "confirm-no": () => { UI.confirm = null; renderModal(); },
  "ask-endloan": v => { const p = P(+v); UI.confirm = { id: p.id, act: "endloan", msg: `Send ${p.name} back to ${C(p.loan.from).name}? ${loanShare(p) < 1 ? `Your ${Math.round(loanShare(p) * 100)}% of his wage` : "His wage"}, ${perWeek(p.wage * loanShare(p))}, comes off your books${S.phase === "season" ? `: about ${money(loanWageLeft(p))} over the rest of the season` : " for the whole season"}.`, yes: "Send him back" }; renderModal(); },
  "confirm-yes": () => { const cf = UI.confirm; UI.confirm = null; const p = P(cf.id); if (!p) return; if (cf.act === "endloan") { if (p.loan && p.club === S.club) { const from = C(p.loan.from).name, saved = cancelLoanIn(p); toast(`${p.name} returns to ${from}. ${money(saved)} of wages saved.`); } UI.modal = null; save(); render(); return; } if (cf.act === "loan") { startLoan(p, C(cf.to)); fixUserLineup(); toast(`${p.name} joins ${C(cf.to).name} on loan.`); UI.modal = null; save(); render(); return; } if (cf.act === "sell") { const fee = sellToAbroad(p); toast(`Sold for ${money(fee)}.`); } else { releasePlayer(p); toast(`${p.name} released.`); } UI.modal = null; save(); render(); },
  scout: v => { S.rec.scoutLvl = clamp(S.rec.scoutLvl + +v, 1, 5); save(); render(); },
  academy: v => { const c = me(), cost = +v; if (c.cash < cost || c.academy >= 20) return; c.cash -= cost; c.academy++; news(`Youth development upgraded to ${c.academy}/20 at a cost of ${money(cost)}.`, false, "youth"); save(); render(); },
  takejob: v => { const c = C(+v); S.club = c.id; S.sacked = false; S.sackReason = null; S.board = 55; S.formation = c.formation; autoRegister(c, false); S.lineup = autoPick(eligibleIds(c), c.formation); initAcademy(); for (const id of c.squad) P(id).seen = GS_SEEN; S.expPos = expectedPos(c); S.inbox.forEach(m => m.done = true); news(`You are the new manager of ${c.name}.`, true, "board"); UI.page = "home"; save(); render(); },
  // From the sacked screen: the old career stays in your saves (delete it there if you like).
  reset: async () => { await save(); S = null; DRAFT = null; LIVE = null; UI.page = "home"; UI.screen = "new"; render(); toTop(); },
  landing: async () => {
    if (!DB.db) return toast("Saves aren't available in this browser, so your career can't be put aside.");
    await save(); S = null; LIVE = null; UI.modal = null; UI.screen = "landing"; UI.delAsk = null; UI.mastCompact = false; render(); toTop();
  },
  loadsave: async v => { if (!adoptSave(await DB.get("save:" + v))) return toast("That save couldn't be read."); render(); toTop(); },
  newcareer: () => { UI.screen = "new"; UI.delAsk = null; render(); toTop(); },
  tolanding: () => { UI.screen = "landing"; render(); toTop(); },
  delask: v => { UI.delAsk = v; render(); },
  delcancel: () => { UI.delAsk = null; render(); },
  delsave: async v => {
    const m = SAVES.list.find(x => x.id === v); await DB.del("save:" + v);
    SAVES.list = SAVES.list.filter(x => x.id !== v); await DB.put("saves", SAVES.list);
    UI.delAsk = null; toast(`${m ? m.club : "Save"} deleted.`); render();
  },
  liveresume: () => { if (LIVE.M.injWait) LIVE.M.injWait = null; LIVE.M.redWait = null; LIVE.paused = false; tick(); },  // resuming without choosing plays on short
  injsub: v => { const M = LIVE.M, w = M.injWait; if (!w) return; subIntoSlot(M, LIVE.k, w.si, +v, "Injury"); M.injWait = null; UI.lsel = null; render(); },
  injon: () => { LIVE.M.injWait = null; render(); },
  redtac: () => { LIVE.M.redWait = null; UI.ltab = "tactics"; render(); },
  redok: () => { LIVE.M.redWait = null; render(); },
  livepause: () => { LIVE.paused = true; clearTimeout(LIVE.t); render(); },
  sqadv: () => { S.set.sqAdv = !S.set.sqAdv; save(); render(); },
  // Substitutes on the Line-up tab: pick a bench spot, then anyone outside the matchday squad to take it.
  subslot: v => { const i = +v; UI.sel = UI.sel && UI.sel.sub === i ? null : { sub: i }; render(); if (UI.sel) document.querySelector(".sub-pick")?.scrollIntoView({ block: "start" }); },
  subpick: v => { const id = +v, i = UI.sel && UI.sel.sub; if (i == null) return; const cur = benchFor(me(), S.lineup.filter(x => x != null)), old = cur[i];
    cur[i] = id; S.bench = cur; S.benchNo = (S.benchNo || []).filter(x => x !== id); if (old != null && !S.benchNo.includes(old)) S.benchNo.push(old);
    UI.sel = null; save(); render(); document.querySelector(".subs-card")?.scrollIntoView({ block: "start" }); toast(`${P(id).name} on the bench in place of ${P(old).name}.`); },
  promote: v => { const p = P(+v); p.acad = false; save(); render(); toast(`${p.name} promoted to the first-team squad.`); },
  demote: v => { const p = P(+v); if (p.age > ACAD_MAX_AGE) return toast(`Only players aged ${ACAD_MAX_AGE} and under can join the academy.`); if (acadCount(me()) >= ACAD_CAP) return toast(`The academy is full (${ACAD_CAP} places). Promote or release someone first.`); p.acad = true; S.bench = (S.bench || []).filter(x => x !== p.id); if (!S.set.acadSel) fixUserLineup(); save(); render(); toast(`${p.name} moved to the academy.`); },
  tactab: v => { UI.tacTab = v; UI.sel = null; render(); },
  ytab: v => { UI.ytab = v; render(); },
  livetab: v => { UI.ltab = v; render(); },
  livespeed: v => { LIVE.speed = +v; render(); },
  // Tapping your team pauses the match: pick a player, then a substitute (or the other way round), or two
  // players to swap their positions.
  livetap: v => {
    const M = LIVE.M, k = LIVE.k, s = k ? M.a : M.h, idx = +v, sel = UI.lsel || {}; livePause();
    if (M.min === 0) return livePre({ on: idx });
    if (sel.empty != null) { moveToSlot(M, k, idx, sel.empty); UI.lsel = null; return render(); }
    if (sel.bench != null && subsLeft(s) > 0) { doSub(M, k, idx, sel.bench); UI.lsel = null; }
    else if (sel.on != null && sel.on !== idx) { swapSlots(M, k, sel.on, idx); UI.lsel = null; }
    else UI.lsel = sel.on === idx ? null : { on: idx };
    render();
  },
  liveempty: v => { const M = LIVE.M, k = LIVE.k, si = +v, sel = UI.lsel || {}; livePause();
    if (sel.on != null) { moveToSlot(M, k, sel.on, si); UI.lsel = null; }
    else if (sel.bench != null && M.min > 0) { subIntoSlot(M, k, si, sel.bench); UI.lsel = null; }
    else UI.lsel = sel.empty === si ? null : { empty: si };
    render(); },
  liveout: v => { livePause(); if (LIVE.M.min === 0) livePre({ out: +v }); },
  livebench: v => {
    const M = LIVE.M, k = LIVE.k, s = k ? M.a : M.h, id = +v, sel = UI.lsel || {}; livePause();
    if (M.min === 0) return livePre({ bench: id });
    if (sel.empty != null && subsLeft(s) > 0) { subIntoSlot(M, k, sel.empty, id); UI.lsel = null; }
    else if (sel.on != null && subsLeft(s) > 0) { doSub(M, k, sel.on, id); UI.lsel = null; }
    else UI.lsel = sel.bench === id ? null : { bench: id };
    render();
  },
  liveins: v => { const [k, key, o] = v.split("|"), s = LIVE.k ? LIVE.M.a : LIVE.M.h; s[k] = o; if (k === "fwd") s.fwd0 = o; s.rt = null; S[key] = o; render(); },
  livetk: v => { const s = LIVE.k ? LIVE.M.a : LIVE.M.h; s.tk = v; S.tackling = v; render(); },
  liveme: v => { const s = LIVE.k ? LIVE.M.a : LIVE.M.h; s.ment = v; s.rt = null; S.mentality = v; render(); },
  livesub: () => { const off = +document.getElementById("sub-off").value, on = +document.getElementById("sub-on").value; doSub(LIVE.M, LIVE.k, off, on); render(); },
  liveskip: () => { clearTimeout(LIVE.t); const s = LIVE.k ? LIVE.M.a : LIVE.M.h; s.auto = true; LIVE.M.redWait = null;
    { const w = LIVE.M.injWait; if (w) { const b = bestBench(LIVE.M, LIVE.k, w.slot); if (b) subIntoSlot(LIVE.M, LIVE.k, w.si, b.id, "Injury"); LIVE.M.injWait = null; } } runToEnd(LIVE.M); render(); },
  livecont: () => finishLive(),
};
const CHG = {
  acadsel: (v, el) => { S.set.acadSel = el.checked; if (!el.checked) { S.acadPick = []; S.bench = (S.bench || []).filter(x => !P(x) || !P(x).acad); fixUserLineup(); } save(); render(); toast(el.checked ? "Academy players can now be picked for the first team." : "Academy players are out of first-team selection again."); },
  rotate: (v, el) => { S.set.rotate = el.checked; save(); render(); toast(el.checked ? "Your assistant will pick a fresh XI before every match." : "Rotation off: your XI stays as you set it."); },
  "fri-wk": v => { (UI.fri ||= {}).wk = +v; render(); }, "fri-home": v => { (UI.fri ||= {}).home = v === "H"; render(); }, "fri-opp": v => { (UI.fri ||= {}).opp = +v; render(); }, "fri-sort": v => { (UI.fri ||= {}).sort = v; render(); },
  benchgk: (v, el) => { S.set.benchGK = el.checked; save(); render(); toast(el.checked ? "A substitute goalkeeper will always be named." : "No automatic substitute goalkeeper. If your keeper goes off, an outfielder goes in goal."); },
  benchadd: v => { if (v) ACT.benchtoggle(v); },
  autoscout: (v, el) => { S.set.autoScout = el.checked; delete S.set.autoAbroad; save(); render(); toast(el.checked ? "Scouting assistant on: spare hours, England only, no cost." : "Scouting assistant off."); },
  liveform: v => { livePause(); changeForm(LIVE.M, LIVE.k, v); if (LIVE.M.min === 0) savePreMatch(LIVE.k ? LIVE.M.a : LIVE.M.h); UI.lsel = null; render(); },
  startsort: v => { const cur = UI.sort.start; UI.sort.start = { k: v, d: cur && cur.k === v ? cur.d : (v === "n" || v === "reg" || v === "co" ? 1 : -1) }; render(); },
  style: v => { S.mentality = v; save(); render(); },
  tackle: v => { S.tackling = v; save(); render(); },
  instr: (v, el) => { if (v.includes("|")) { const [key, o] = v.split("|"); S[key] = o; } else S[el.dataset.k] = v; save(); render(); },
  autostyle: (v, el) => { S.set.autoStyle = el.checked; save(); },
  awy: v => { UI.awY = +v; render(); },
  awl: v => { UI.awL = v; render(); },
  form: v => { reshapeUser(v); save(); render(); toast(`Switched to ${v}.`); },
  live: (v, el) => { S.set.live = el.checked; save(); },
  lg: v => { UI.lg = v; render(); },
  startl: v => { UI.startL = v; render(); },
  ccolor: v => { keepClubForm(UI.modal); UI.modal.ccolor = v; const el = document.getElementById("coach-name"); UI.modal.name = el ? el.value : UI.modal.name; renderModal(); },
  cform: v => { UI.modal.form = v; const el = document.getElementById("coach-name"); UI.modal.name = el ? el.value : UI.modal.name; },
  unsack: (v, el) => { S.set.unsackable = el.checked; save(); render(); toast(el.checked ? "Unsackable mode on." : "Unsackable mode off: the board can fire you again."); },
  ticket: v => { me().tkt = +v; save(); render(); },
  pref: v => { S.me.formPending = v; toast(`From next season you'll prefer the ${v}.`); save(); },
  cup: v => { UI.cupK = v; render(); },
  import: (v, el) => { const f = el.files && el.files[0]; if (!f) return; const r = new FileReader(); r.onload = async () => { try { const d = JSON.parse(r.result); d.saveId = newSaveId(); if (!adoptSave(d)) throw new Error("not a save"); await save(); render(); toTop(); toast("Save file loaded as a new career."); } catch (e) { toast("That file isn't a Touchline Manager save."); } }; r.readAsText(f); },
  "tf-pos": v => { UI.tf.pos = v; render(); }, "tf-age": v => { UI.tf.age = +v; render(); }, "tf-min": v => { UI.tf.min = +v; render(); }, "tf-fee": v => { UI.tf.fee = +v; render(); }, "tf-lg": v => { UI.tf.lg = v; render(); }, "tf-int": v => { UI.tf.int = v; render(); },
  "yf-reg": v => { UI.yf.reg = v; render(); }, "yf-pos": v => { UI.yf.pos = v; render(); }, "yf-st": v => { UI.yf.st = v; render(); },
  "bid-fee": v => { UI.bid.fee = +v; UI.bid.msg = ""; renderModal(); }, "bid-yrs": v => { UI.bid.yrs = +v; UI.bid.msg = ""; renderModal(); }, "list-pct": v => { const m = UI.modal, p = m && P(m.id); if (!p) return; p.listPct = +v; save(); render(); toast(`${p.name} now listed at ${money(askingPrice(p))}.`); }, "bid-plan": v => { const b = UI.bid, from = deferMult(b.plan || 1), to = deferMult(+v); b.plan = +v; b.fee = roundFee(b.fee / from * to); b.counterFee = null; b.msg = ""; renderModal(); }, "bid-wage": v => { UI.bid.wage = +v; UI.bid.msg = ""; renderModal(); },
};
document.addEventListener("click", e => {
  const t = e.target.closest("[data-a]");
  if (UI.menu && !e.target.closest(".playbox")) { UI.menu = false; if (!t) { render(); return; } }
  if (!t || t.disabled) return;
  if (t.dataset.a === "closemodal" && t.classList.contains("scrim") && e.target !== t) return;
  ACT[t.dataset.a]?.(t.dataset.v, t, e);
});
/* Tall tables scroll inside a box that fits under the sticky masthead, whose height varies with screen
   width (about 100px on a laptop, 200px on a phone). */
function syncMastHeight() { const m = document.querySelector(".mast"); document.documentElement.style.setProperty("--mast-h", (m ? m.getBoundingClientRect().height : 0) + "px"); }
window.addEventListener("resize", () => { if (!phoneWidth() && UI.mastCompact) setCompact(false); syncMastHeight(); });
/* On a phone the masthead is a third of the screen. Scrolling down shrinks it to the club name and the
   Play button; scrolling up (or reaching the top) brings back the numbers and the section tabs. */
const phoneWidth = () => matchMedia("(max-width:760px)").matches;
let lastY = 0, upRun = 0, downRun = 0;
// Going to a new page starts at the top with the full masthead. Restoring it first matters: restoring it
// at the top would otherwise scroll the new page down by the amount it grew.
function toTop() { UI.mastCompact = false; const m = document.querySelector(".mast"); if (m) m.classList.remove("compact"); syncMastHeight(); restoreNav(); window.scrollTo(0, 0); lastY = 0; upRun = downRun = 0; }
function setCompact(on) {
  const m = document.querySelector(".mast"); UI.mastCompact = on; if (!m) return;
  const before = m.getBoundingClientRect().height;
  m.classList.toggle("compact", on); syncMastHeight();
  if (!on) restoreNav();  // hidden links lose their sideways scroll
  // The masthead is sticky, so it takes up room in the page: shrinking it would make everything below
  // jump up. Scroll by the difference so what you were reading stays where it was.
  const d = before - m.getBoundingClientRect().height; if (d) window.scrollBy(0, -d);
  lastY = scrollY; upRun = downRun = 0;
}
window.addEventListener("scroll", () => {
  const y = scrollY, dy = y - lastY; lastY = y;
  if (!phoneWidth() || UI.menu || !document.querySelector(".mast")) return;
  if (dy > 0) { downRun += dy; upRun = 0; } else { upRun -= dy; downRun = 0; }
  if (!UI.mastCompact && downRun > 30 && y > 200) setCompact(true);  // 200: past the shrink (~150px on a phone) plus the 40px "at the top" zone, so it cannot bounce
  else if (UI.mastCompact && (upRun > 60 || y < 40)) setCompact(false);
}, { passive: true });
/* Floating heading row for tall tables: a copy of the real one, pinned under the masthead while the table
   passes beneath it, with the same column widths and the same sideways scroll. Its sort buttons are copies
   too, so tapping one sorts as the real heading would. */
let floatSrc = null;
function floatHead() {
  let f = document.getElementById("float-head");
  if (!f) { f = document.createElement("div"); f.id = "float-head"; f.className = "tbl-wrap tall"; f.hidden = true; document.body.appendChild(f); }
  const w = document.querySelector("#app .tbl-wrap.tall"), m = document.querySelector(".mast");
  if (!w || !m) { f.hidden = true; floatSrc = null; return; }
  const t = w.querySelector("table"), th = t.tHead;
  if (floatSrc !== t) {  // the table was re-rendered: copy its heading again
    floatSrc = t;
    f.innerHTML = `<table><colgroup>${[...th.rows[0].cells].map(c => `<col style="width:${c.getBoundingClientRect().width}px">`).join("")}</colgroup>${th.outerHTML}</table>`;
    f.firstChild.style.width = t.getBoundingClientRect().width + "px";
  }
  const top = m.getBoundingClientRect().bottom, hr = th.getBoundingClientRect(), wr = w.getBoundingClientRect();
  const show = hr.top < top && wr.bottom > top + hr.height;
  f.hidden = !show; if (!show) return;
  f.style.top = top + "px"; f.style.left = wr.left + "px"; f.style.width = w.clientWidth + "px";
  f.scrollLeft = w.scrollLeft;
}
window.addEventListener("scroll", floatHead, { passive: true });
window.addEventListener("resize", () => { floatSrc = null; floatHead(); });
document.addEventListener("scroll", e => { if (e.target instanceof Element && e.target.matches("#app .tbl-wrap.tall")) floatHead(); }, { capture: true, passive: true });
// An open Play menu gets the height left below it, and scrolls inside if that's not enough (on an iPhone
// SE the masthead is tall enough that a fixed limit still ran the menu off the bottom).
function fitMenu() { const m = document.querySelector(".playmenu"); if (m) m.style.maxHeight = Math.max(160, innerHeight - m.getBoundingClientRect().top - 12) + "px"; }
window.addEventListener("resize", fitMenu);
new MutationObserver(() => { floatSrc = null; floatHead(); fitMenu(); }).observe(document.getElementById("app"), { childList: true, subtree: true });
new MutationObserver(syncMastHeight).observe(document.getElementById("app"), { childList: true });
document.addEventListener("change", e => { const t = e.target.closest("[data-c]"); if (t) CHG[t.dataset.c]?.(t.value, t); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && UI.modal) { UI.modal = null; UI.bid = null; renderModal(); render(); } });
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (VIEWS[h] && h !== UI.page) { UI.page = h; render(); } });

/* ---------- boot ---------- */
async function boot(data) {
  const h = location.hash.slice(1); if (VIEWS[h]) UI.page = h;
  try { await DB.open(); } catch (e) { /* storage unavailable: play in memory */ }
  if (DB.db) {
    SAVES.list = (await DB.get("saves")) || [];
    // The single career from before multiple saves becomes the first entry.
    const old = await DB.get("career");
    if (old) { if (adoptSave(old)) { S.saveId = S.saveId || newSaveId(); await save(); } await DB.del("career"); S = null; }
  }
  S = null;
  if (data && data.S && !adoptSave(data.S)) S = null;  // the Claude preview hands back the career it was showing
  UI.screen = S ? null : "landing";
  render();
  // Ask the browser not to clear a long career when space runs low, and cache the game for offline play.
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
  try { if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && window.top === window) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(r => r.update()).catch(() => { });
    // When a new version takes over, reload once so you are never left looking at the old one.
    let reloaded = false; navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloaded || LIVE || UI.busy) return; reloaded = true; location.reload(); }); } catch (e) { }
}
window.claude?.hot?.snapshot?.(() => ({ S }));
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});

/* Saves from version 4 gain injury proneness, coaches' preferred formations and a preference for you. */
/* Teenagers (18 and under) outside the matchday squad start in the academy: a new career, a new job, or a
   save from before 5.33. */
function initAcademy() {
  S.acadV = 1; const c = me(), keep = new Set([...(S.lineup || []), ...benchFor(c, (S.lineup || []).filter(x => x != null))]);
  const moved = c.squad.map(P).filter(p => p.age <= 18 && !keep.has(p.id) && !p.loan); moved.forEach(p => p.acad = true);
  return moved.length;
}
/* 5.61: the economy moved to real-world money (MONEY = 10). An older save has every amount multiplied by ten (so its
   finances keep their proportions), then ticket prices are reset by division and demand, with base income adjusted
   so each club's total income is unchanged by the new prices. */
function moneyRescale(k) {
  const num = o => { if (o) for (const f in o) if (typeof o[f] === "number") o[f] *= k; };
  for (const c of S.clubs) {
    for (const f of ["revBase", "revSeason", "cash"]) if (typeof c[f] === "number") c[f] = Math.round(c[f] * k);
    num(c.fin); num(c.pre);
    for (const d of c.deals || []) { d.amt *= k; num(d.bonus); }
    if (c.build) for (const f of ["cost", "perWeek", "paid"]) if (typeof c.build[f] === "number") c.build[f] *= k;
    for (const s of c.schemes || []) s.amt *= k;
  }
  for (const p of Object.values(S.players)) { p.wage = Math.round(p.wage * k); if (p.am) p.am.per = Math.round(p.am.per * k); }
  for (const d of S.dues || []) { d.per *= k; d.fee *= k; }
  for (const b of Object.values(S.bids || {})) { if (b.fee) b.fee *= k; if (b.ask) b.ask *= k; }
  for (const t of S.tlog || []) if (t.fee) t.fee *= k;
  for (const m of S.inbox || []) { for (const f of ["fee", "amt"]) if (typeof m[f] === "number") m[f] *= k; for (const b of m.bids || []) b.fee *= k; for (const o of m.offers || []) { o.amt *= k; num(o.bonus); } }
  for (const f of S.friendlies || []) for (const x of ["net", "gate", "fee"]) if (typeof f[x] === "number") f[x] *= k;
  num(S.revK); num(S.spK);
  for (const c of activeClubs()) {
    if (c.cap == null) continue;
    const oldMd = matchdayEstimate(c) * k;
    setTicketPrice(c); const d = oldMd - matchdayEstimate(c);
    c.revBase = Math.round(c.revBase + d); if (c.revSeason) c.revSeason = Math.round(c.revSeason + d);
  }
  UI.bid = null;
}
/* 5.62: incomes step down between divisions as real turnover does. An older save's leagues are each scaled to the
   median a new world gives that league (every club's money and its players' wages together, so a club's proportions
   and cost ratio are unchanged), and pending bids are withdrawn (player values changed). */
const ECON_TARGET = { E1: 220, E2: 30, E3: 10.5, E4: 5.1, E5: 2.3, E6N: .95, E6S: .95, ESP1: 260, ESP2: 21, ESP3: 6.2, GER1: 200, GER2: 18.4, GER3: 6.4, ITA1: 205, ITA2: 18.5, ITA3: 5.7, FRA1: 119, FRA2: 13.3, FRA3: 3.9, POR1: 79, POR2: 9.4, POR3: 2.3, NED1: 74.5, NED2: 8.2, NED3: 2, BEL1: 42, BEL2: 4.6, BEL3: 1.4 };
function econRebase() {
  const num = (o, k) => { if (o) for (const f in o) if (typeof o[f] === "number") o[f] *= k; }, F = {};
  for (const [key, L] of Object.entries(S.leagues)) {
    const cs = L.clubs.map(C).filter(c => !c.gone), inc = cs.map(annualIncome).sort((a, b) => a - b), med = inc[inc.length >> 1];
    if (!med || !ECON_TARGET[key]) continue;
    const k = ECON_TARGET[key] * 1e6 / med; F[key] = k;
    for (const c of cs) {
      const md = matchdayEstimate(c);  // ticket prices stay; base income takes up the difference so total income scales by k
      for (const f of ["revBase", "revSeason", "cash"]) if (typeof c[f] === "number") c[f] = Math.round(c[f] * k);
      c.revBase = Math.round(c.revBase + (k - 1) * md); if (c.revSeason) c.revSeason = Math.round(c.revSeason + (k - 1) * md);
      num(c.fin, k); num(c.pre, k); for (const d of c.deals || []) { d.amt *= k; num(d.bonus, k); }
      if (c.build) for (const f of ["cost", "perWeek", "paid"]) if (typeof c.build[f] === "number") c.build[f] *= k;
      for (const sc of c.schemes || []) sc.amt *= k;
      for (const id of c.squad) { const p = P(id); p.wage = Math.round(p.wage * k); if (p.am) p.am.per = Math.round(p.am.per * k); }
    }
    if (S.revK[key]) S.revK[key] *= k; if (S.spK && S.spK[key]) S.spK[key] *= k;
  }
  for (const d of S.dues || []) { const k = F[C(d.payer).lg] || 1; d.per *= k; d.fee *= k; }
  let n = 0; for (const m of S.inbox || []) if (!m.done && (m.type === "bid" || m.type === "auction")) { m.done = true; m.choice = "withdrawn"; n++; }
  UI.bid = null;
  return { F, n };
}
function upgradeSave() {  // bring an older save up to date; runs on load and on import
  if (!S.money10 && S.clubs) { moneyRescale(MONEY); S.money10 = 1; if (S.club != null) news("The game now uses real-world money: every amount in your save is ten times bigger, so your finances are in the same proportions. Ticket prices now follow the division (60 in the Premier Division down to 7 in the fifth tier) and demand.", true, "finance"); }
  if (!S.econ2 && S.clubs) { const r = econRebase(); S.econ2 = 1; if (S.club != null) { const k = r.F[me().lg]; news(`Club incomes now step down between divisions as real turnover does (a Premier League club around 220M a year, the Second Division about 10M, the sixth tier under 1M). Your club's money and wages were scaled together by ${k ? k.toFixed(2) : "1"}×, so your finances keep their proportions.${r.n ? ` ${r.n} pending bid${r.n > 1 ? "s were" : " was"} withdrawn, as player values changed.` : ""}`, true, "finance"); } }
  // Repairs keepers whose fitness went NaN after playing outfield (fixed in 5.22.0).
  for (const p of Object.values(S.players)) { if (!isFinite(p.fit)) p.fit = 90; if (p.gs == null) p.gs = newGrowthSpeed(); }  // 5.34: hidden growth speed
  // 5.33: the academy. Teenagers (18 and under) outside the current matchday squad move into it.
  // 5.35: players already at your club before this season are known to your coaches (growth-speed hint).
  if (!S.seenV && S.club != null && !S.sacked) { S.seenV = 1; for (const id of me().squad) { const p = P(id); if (p.joined < S.year && p.seen == null) p.seen = GS_SEEN; } }
  if (!S.acadV && S.club != null && !S.sacked) { const n = initAcademy(); if (n) news(`Your club now runs an academy: ${n} teenager${n > 1 ? "s" : ""} outside the matchday squad moved into it. Promote any of them from the Academy page.`, true, "youth"); }
  if (!S.rivalsDone) ensureRivals();
  if (!S.stadiums) ensureStadiums();
  if (!S.sponsors) ensureSponsors();
  if (!S.dem2) ensureDemandAnchor();
  if (S.me && !S.me.know) S.me.know = newKnowledge("ENG");  // saves from before league knowledge
  if (!S.reg2) { for (const c of activeClubs()) autoRegister(c, false); S.reg2 = true; }
  if (!S.towns3) {  // (towns3: rerun when the blocklist grows) rename any club the generator gave a real club's town before the blocklist covered it
    for (const c of S.clubs) if (TOWN_BLOCK.has(c.town)) { const t = townName(COUNTRY[c.country]), old = c.town, taken = new Set(S.clubs.filter(x => x.country === c.country).map(x => x.short)), sh = stripAcc(t).toUpperCase().slice(0, 3);
      c.name = c.name.replace(old, t); c.town = t; if (!taken.has(sh)) c.short = sh; }
    S.towns3 = true; }
  if (!S.names2) {  // squads from before 5.13.3 can hold two players with one name
    for (const c of activeClubs()) { const r = dedupeNames(c); if (isUser(c)) for (const [o, n] of r) news(`To tell him apart from his namesake in the squad, ${o} will now be listed as ${n}.`, true, "squad"); }
    S.names2 = true; }
  if (!S.acad20) { for (const c of S.clubs) c.academy = clamp(c.academy * 2, 1, 20); S.acad20 = true; }  // older saves rated academies out of 10
  if (!S.attr2) { for (const p of Object.values(S.players)) convertAttrs(p); for (const c of S.clubs) delete c._lv; S.attr2 = true; }
  // 5.50: graduates come as a pool at the end of the season. A save already in preseason missed that step, and the
  // old one-or-two at kick-off is gone, so it gets this year's pools now (every club, yours included).
  if (S.phase === "summer" && !S.firstPre && S.club != null && !S.sacked && S.intakeY !== S.year && !S.intake) graduateIntakes();
  // 5.54.3: the 5.35 step above missed players who'd been with you since the career began (joined in the current
  // year, which doesn't change until kick-off), so some showed "Too early to tell" after a full season of 44 games.
  // Anyone with a completed season for your club in his record is known to your coaches.
  if (!S.seenV2 && S.club != null && !S.sacked) { for (const id of me().squad) { const p = P(id); if ((p.hist || []).some(h => h[2] === S.club)) p.seen = Math.max(p.seen || 0, GS_SEEN); } S.seenV2 = 1; }
  // 5.59: clubs promoted at the last season's end were left on their old division's income; bring them up once.
  if (!S.promoFix) { for (const c of activeClubs()) { const h = (c.hist || [])[c.hist.length - 1]; if (!(h && h.y >= S.year - 1 && LG[h.lg] && LG[c.lg] && !LG[c.lg].foreign && LG[c.lg].tier !== LG[h.lg].tier)) continue;
    const up = LG[c.lg].tier < LG[h.lg].tier, now = sponsorTotal(c); settleIncome(c, up ? "up" : "down");  // promoted or relegated last season
    if (now) { const lim = up ? divQuart(c.lg, sponsorTotal, .25) * .9 : divQuart(c.lg, sponsorTotal, .75) * 1.1; if (up ? now < lim : now > lim) scaleDeals(c, lim / now); }
    if (S.phase === "season") c.revSeason = up ? Math.max(c.revSeason || 0, c.revBase) : Math.min(c.revSeason || c.revBase, c.revBase); } S.promoFix = 1; }
  // 5.59: before 5.58 a preseason's transfers were booked to the season just finished. If this season has started and
  // the summer's business sits in last season's books, move it across from the transfer log (fees counted as profit:
  // the book value at the time isn't kept). Only your club, only last summer's window.
  if (!S.preFix && S.club != null && !S.sacked && S.phase === "season") { const c = me(), f = c.fin;
    for (const t of S.tlog || []) { if (t.y !== S.year - 1 || !/^Pre/.test(t.w) || !t.fee) continue;
      if (t.from === c.id) { f.sales += t.fee; f.sold += t.fee; } else if (t.to === c.id) { f.bought += t.fee; f.agent += t.fee * .05; } }
    S.preFix = 1; }
  if (S.phase === "summer") S.preFix = 1;  // a save in preseason now books the summer correctly (acct)
  // 5.59.1: a one-off amnesty for one save, misled by the pre-5.58 preseason ratio (71% shown, ~150% real): no levy,
  // charge or deduction for the cost ratio in its current season. Granted to whoever loads this version mid-season
  // with the ratio over the limit; it covers this season only.
  if (!S.amnestyV && S.club != null && !S.sacked) { if (S.phase === "season" && scr(me()) > RULES.scrLimit) { S.amnesty = { y: S.year, club: S.club }; news(`Cost-ratio amnesty for ${seasonLabel(S.year)}: the preseason figures understated your ratio, so this season brings no levy, charge or points deduction. Normal rules apply from next season.`, true, "finance"); } S.amnestyV = 1; }
  // 5.60: a bigger prospect pool abroad; this year's class is topped up now rather than waiting a year.
  if (!S.pool2) { const n = S.club != null ? topUpProspects() : 0; if (n) news(`More prospects abroad: ${n} more 15-year-olds from outside England are in this year's youth class.`, false, "youth"); S.pool2 = 1; }
  // 5.60.2: the English surname list grew from 90 to 371. English players at AI clubs carrying one of the original 90
  // get a new surname three times in four (the old names' fair share of the new list is about a quarter); first names
  // stay, and nobody gets a namesake at his club. Your players, and anyone on loan from you, keep their names.
  if (!S.names3 && S.club != null) {
    const OLD90 = new Set(NAMES.ENG[1].slice(0, 90));
    for (const c of activeClubs()) { if (isUser(c)) continue;
      for (const id of c.squad) { const p = P(id), [first, ...rest] = p.name.split(" ");
        if (p.nat !== "ENG" || (p.loan && p.loan.from === S.club) || !OLD90.has(rest.join(" ")) || R() > .75) continue;
        for (let i = 0; i < 20; i++) { const n = first + " " + pick(NAMES.ENG[1]); if (!hasNamesake(c, n, p.id)) { p.name = n; break; } } } }
    S.names3 = 1; }
  // 5.60.3: fixtures now alternate home and away. A season with no league games played yet is redrawn; otherwise the
  // new pattern starts next season.
  if (!S.rr2) { if (S.phase === "season") for (const L of Object.values(S.leagues)) if (!(L.results || []).length) { L.fixtures = roundRobin(shuffle(L.clubs.slice())); L._st = null; } S.rr2 = 1; }
  // 5.60.4: a season already under way keeps what's been played; the English leagues' remaining fixtures are rearranged
  // to break up the long home/away runs (rebalanceFixtures). Foreign leagues get the new draw next season.
  if (!S.rr3) { if (S.phase === "season") for (const k of ENG_LGS) { const L = S.leagues[k]; if (L && (L.results || []).length) rebalanceFixtures(L); } S.rr3 = 1; }
  // 5.60.5: promotion could lower ticket prices (see move()). Clubs promoted at the last season's end get the +15%
  // they should have had, once.
  if (!S.tkt2) { for (const c of activeClubs()) { const h = (c.hist || [])[c.hist.length - 1]; if (h && h.y >= S.year - 1 && LG[h.lg] && LG[c.lg] && !LG[c.lg].foreign && LG[c.lg].tier < LG[h.lg].tier) c.price = Math.round(c.price * 1.15 * 100) / 100; } S.tkt2 = 1; }
  // 5.62.1: one-off, alongside the amnesty: the save misled by the old preseason ratio has its wage bill halved (every
  // player at the club, academy included). Only a save holding that amnesty is touched.
  if (!S.wageHalf && S.amnesty && S.club != null && !S.sacked && S.amnesty.club === S.club) { const c = me(), before = sum(c.squad, id => P(id).wage); for (const id of c.squad) { const p = P(id); p.wage = Math.round(p.wage / 2 / 100) * 100; } S.wageHalf = 1; news(`Wage bill halved, a one-off correction for the preseason figures: from ${perWeek(before)} to ${perWeek(sum(c.squad, id => P(id).wage))}. New contracts are priced normally.`, true, "finance"); }
  // 5.62.5: results from before match days were stored get one from the calendar: league on Saturday (the first of a
  // week's two league games on Tuesday), cup ties Wednesday, European games Tuesday.
  // 5.66: your side's style of play became five instructions; carry the old style across as its nearest mix.
  if (!S.ins5 && S.clubs) { S.ins5 = 1;
    const MAP = { vatt: { forward: "push", tempo: "fast" }, att: { forward: "push" }, pos: { tempo: "slow", passing: S.passing || "ground" }, bal: {},
      ctr: { forward: "back", tempo: "fast" }, def: { forward: "back", line: "low" }, vdef: { forward: "back", line: "low", tempo: "slow" } };
    const m = MAP[S.mentality] || {}; for (const [k, v] of Object.entries(m)) if (!S[k] || S[k] === "normal") S[k] = v;
    if (S.club != null && S.mentality && S.mentality !== "bal") news(`Styles of play are now team instructions you set one by one (Tactics > Instructions). Your ${MENT[S.mentality].l.toLowerCase()} style has been carried over as: ${INSTR.map(I => S[I.s] && S[I.s] !== "normal" ? I.set[S[I.s]].l.toLowerCase() : "").filter(Boolean).join(", ")}.`);
    S.mentality = "bal"; }
  if (!S.ordFill) { const lgSeen = {}, lgN = {}; for (const r of S.myRes || []) if (r.comp === "L") lgN[r.w] = (lgN[r.w] || 0) + 1;
    for (const r of S.myRes || []) { if (r.ord != null || r.comp === "F") continue;
    if (r.comp === "L") { const n = lgSeen[r.w] = (lgSeen[r.w] || 0) + 1; r.ord = lgN[r.w] > 1 && n === 1 ? 2 : 3; }  // two league games that week: the first was midweek
    else r.ord = r.comp === "G" ? 0 : 1; } S.ordFill = 1; }
  // 5.55: listed players get a price you set. Ones already listed keep roughly what they were going for.
  if (S.club != null && !S.sacked) for (const id of me().squad) { const p = P(id); if (p.listed && p.listPct == null) p.listPct = clamp(Math.round(askingPrice(p) / value(p) * 10) / 10, .8, 2); }
  // 5.54.1: players you signed this season who haven't played yet start from what they expect, not a flat 50%.
  if (!S.pt2 && S.club != null && !S.sacked) { for (const id of me().squad) { const p = P(id); if (p.joined === S.year && !p.s.app && !p.acad) p.pt = Math.max(p.pt, expectedShare(p, me())); } S.pt2 = true; }
  // 5.51: free agents leave the game after three years unsigned. Ones already free start counting now.
  for (const id of S.fa || []) { const p = S.players[id]; if (p && p.faY == null) p.faY = S.year; }
}
function migrate4(d) {
  const keep = S; S = d;
  for (const p of Object.values(d.players)) if (p.ir == null) p.ir = clamp(Math.round(10 + gauss() * 3.2), 1, 20);
  for (const y of d.prospects || []) if (y.ir == null) y.ir = clamp(Math.round(10 + gauss() * 3.2), 1, 20);
  for (const c of d.clubs) { if (c.coach && !c.coach.form) c.coach.form = FORMATIONS[c.formation] ? c.formation : prefFormation(c.coach.arch); if (!FORMATIONS[c.formation]) c.formation = c.coach ? c.coach.form : "4-3-3"; }
  if (d.me && !d.me.form) d.me.form = FORMATIONS[d.formation] ? d.formation : "4-3-3";
  d.v = 5; S = keep;
}
