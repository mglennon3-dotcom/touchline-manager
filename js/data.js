"use strict";
const APP_VERSION = "5.17.4";  // shown on the start screen; keep in step with VERSION in sw.js
/* ---------- small helpers ---------- */
const R = Math.random;
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const rf = (a, b) => a + R() * (b - a);
const pick = a => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += R(); return (u - 3) * 1.41; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sum = (a, f = x => x) => a.reduce((s, x) => s + f(x), 0);
function wpick(arr, w) { let t = 0; const ws = arr.map(x => { const v = Math.max(0, w(x)); t += v; return v; }); if (!t) return arr[0]; let r = R() * t; for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1]; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function money(v) {
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  if (a < 500) return "€0";
  if (a >= 1e9) return s + "€" + (a / 1e9).toFixed(2) + "bn";
  if (a >= 1e7) return s + "€" + (a / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (a >= 1e6) return s + "€" + (a / 1e6).toFixed(2).replace(/0$/, "").replace(/\.0$/, "") + "M";
  return s + "€" + Math.round(a / 1000) + "k";
}
// Weekly wages to the nearest hundred below €10k (money() rounds to whole thousands, so €1,250 and
// €1,700 a week both read "€1k"), and to the nearest ten below €1k.
const perWeek = annual => { const w = annual / 52; return (w >= 1e4 ? money(w) : w >= 1000 ? "€" + (w / 1000).toFixed(1).replace(/\.0$/, "") + "k" : "€" + Math.round(w / 10) * 10) + "/wk"; };
const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);
const pct = x => Math.round(x * 100) + "%";
function km(a, b) {
  const toR = x => x * Math.PI / 180, dLat = toR(b.lat - a.lat), dLon = toR(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const stripAcc = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/* ---------- football model ---------- */
const ROLES = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"];
const ROLE_NAME = { GK: "Goalkeeper", CB: "Centre-back", FB: "Full-back", DM: "Defensive midfielder", CM: "Central midfielder", AM: "Attacking midfielder", W: "Winger", ST: "Striker" };
const LINE = { GK: "GK", CB: "DEF", FB: "DEF", DM: "MID", CM: "MID", AM: "MID", W: "ATT", ST: "ATT" };
const ROLE_ORDER = { GK: 0, CB: 1, FB: 2, DM: 3, CM: 4, AM: 5, W: 6, ST: 7 };
// How well a player of one role (row) performs in another role's slot (column).
const FAM = {
  GK: { GK: 1, CB: .2, FB: .2, DM: .2, CM: .2, AM: .2, W: .2, ST: .2 },
  CB: { GK: .2, CB: 1, FB: .8, DM: .8, CM: .62, AM: .45, W: .42, ST: .45 },
  FB: { GK: .2, CB: .8, FB: 1, DM: .7, CM: .66, AM: .6, W: .82, ST: .5 },
  DM: { GK: .2, CB: .82, FB: .7, DM: 1, CM: .92, AM: .75, W: .6, ST: .55 },
  CM: { GK: .2, CB: .65, FB: .66, DM: .9, CM: 1, AM: .9, W: .75, ST: .66 },
  AM: { GK: .2, CB: .45, FB: .55, DM: .7, CM: .9, AM: 1, W: .88, ST: .85 },
  W:  { GK: .2, CB: .4, FB: .76, DM: .55, CM: .75, AM: .88, W: 1, ST: .82 },
  ST: { GK: .2, CB: .45, FB: .45, DM: .45, CM: .6, AM: .82, W: .8, ST: 1 },
};
// What each slot contributes to [attack, midfield, defence].
const WT = { GK: [0, 0, 1.6], CB: [.05, .2, 1], FB: [.25, .3, .8], DM: [.1, .9, .65], CM: [.35, 1, .3], AM: [.75, .8, .1], W: [1, .45, .1], ST: [1, .2, .03] };
// Slot role, x (0 left – 100 right), y (0 attacking end – 100 own goal)
const FORMATIONS = {
  "4-3-3":     [["GK",50,92],["FB",13,72],["CB",37,77],["CB",63,77],["FB",87,72],["DM",50,59],["CM",29,44],["CM",71,44],["W",15,22],["ST",50,15],["W",85,22]],
  "4-2-3-1":   [["GK",50,92],["FB",13,72],["CB",37,77],["CB",63,77],["FB",87,72],["DM",35,58],["DM",65,58],["W",15,34],["AM",50,36],["W",85,34],["ST",50,14]],
  "4-4-2":     [["GK",50,92],["FB",13,72],["CB",37,77],["CB",63,77],["FB",87,72],["W",13,45],["CM",37,50],["CM",63,50],["W",87,45],["ST",37,19],["ST",63,19]],
  "4-4-1-1":   [["GK",50,92],["FB",13,72],["CB",37,77],["CB",63,77],["FB",87,72],["W",13,46],["CM",37,52],["CM",63,52],["W",87,46],["AM",50,32],["ST",50,15]],
  "4-1-4-1":   [["GK",50,92],["FB",13,72],["CB",37,77],["CB",63,77],["FB",87,72],["DM",50,60],["W",13,40],["CM",37,44],["CM",63,44],["W",87,40],["ST",50,15]],
  "4-3-2-1":   [["GK",50,92],["FB",13,72],["CB",37,77],["CB",63,77],["FB",87,72],["CM",29,50],["DM",50,57],["CM",71,50],["AM",35,31],["AM",65,31],["ST",50,14]],
  "4-1-2-1-2": [["GK",50,92],["FB",13,72],["CB",37,77],["CB",63,77],["FB",87,72],["DM",50,60],["CM",29,47],["CM",71,47],["AM",50,34],["ST",37,17],["ST",63,17]],
  "3-4-2-1":   [["GK",50,92],["CB",27,77],["CB",50,79],["CB",73,77],["FB",9,50],["CM",37,54],["CM",63,54],["FB",91,50],["AM",33,30],["AM",67,30],["ST",50,14]],
  "3-4-3":     [["GK",50,92],["CB",27,77],["CB",50,79],["CB",73,77],["FB",9,48],["CM",36,52],["CM",64,52],["FB",91,48],["W",15,21],["ST",50,15],["W",85,21]],
  "3-5-2":     [["GK",50,92],["CB",27,77],["CB",50,79],["CB",73,77],["FB",9,50],["DM",50,59],["CM",31,43],["CM",69,43],["FB",91,50],["ST",37,18],["ST",63,18]],
  "5-3-2":     [["GK",50,92],["FB",8,66],["CB",29,77],["CB",50,79],["CB",71,77],["FB",92,66],["CM",27,47],["DM",50,55],["CM",73,47],["ST",37,20],["ST",63,20]],
  "5-4-1":     [["GK",50,92],["FB",8,64],["CB",29,77],["CB",50,79],["CB",71,77],["FB",92,64],["W",14,42],["CM",38,48],["CM",62,48],["W",86,42],["ST",50,17]],
};
// How often coaches favour each shape, roughly as in the modern game: back fours dominate, back threes are a strong minority.
const FORM_WEIGHT = { "4-3-3": 18, "4-2-3-1": 20, "4-4-2": 9, "4-4-1-1": 6, "4-1-4-1": 7, "4-3-2-1": 3, "4-1-2-1-2": 3, "3-4-2-1": 11, "3-4-3": 6, "3-5-2": 7, "5-3-2": 5, "5-4-1": 5 };
const FORM_PREF_BONUS = 1.02;  // a coach's own system is drilled in: about 2% on everything
const FORM_KEYS = Object.keys(FORMATIONS);
const slotsOf = f => FORMATIONS[f].map(s => s[0]);
const roleSlots = (f, r) => FORMATIONS[f].filter(s => s[0] === r).length;
// Each formation is normalised mostly against itself, so shape is a modest trade-off (about ±5%) rather than a cheat code.
const FNORM = (() => {
  const sums = Object.fromEntries(FORM_KEYS.map(f => { const n = [0, 0, 0]; for (const [r] of FORMATIONS[f]) for (let i = 0; i < 3; i++) n[i] += WT[r][i]; return [f, n]; }));
  const mean = [0, 1, 2].map(i => FORM_KEYS.reduce((s, f) => s + sums[f][i], 0) / FORM_KEYS.length);
  return Object.fromEntries(FORM_KEYS.map(f => [f, sums[f].map((v, i) => Math.pow(v, .75) * Math.pow(mean[i], .25))]));
})();
/* Style of play. m multiplies attack, midfield and defence; sh is how often possession becomes a shot;
   open is how exposed the side leaves itself, which is what a counter-attacking side feeds on (ctr).
   Between two equal sides every step toward attack adds goals at both ends, and slightly more against
   than for, so it pays when you are the better side or need a goal, and costs when you are not.
   ag orders them from most to least attacking, for the AI's adjustments. */
const MENT = {
  vatt: { l: "Very attacking", ag: 3, m: [1.08, 1, .84], sh: 1.16, open: 1, expose: .25, tire: 1.12, d: "Everyone forward. Far more chances at both ends; players tire faster. For chasing a game." },
  att: { l: "Attacking", ag: 2, m: [1.04, 1, .92], sh: 1.08, open: .7, expose: .2, tire: 1.06, d: "Push on. More chances for and against. Suits the stronger side." },
  pos: { l: "Control possession", ag: 1, m: [.98, 1.08, 1], sh: .9, open: .5, expose: 1, tire: 1.03, d: "Keep the ball. More possession, so fewer chances against, but patient build-up creates less, and a high line invites counters." },
  bal: { l: "Neutral", ag: 0, m: [1, 1, 1], sh: 1, open: .3, tire: 1, d: "No particular bias." },
  ctr: { l: "Counter attack", ag: -1, m: [1, .92, 1.04], sh: 1, open: .1, ctr: .35, expose: .2, tire: 1, d: "Concede the ball, break quickly. Better chances against open sides, little against a deep block." },
  def: { l: "Defensive", ag: -2, m: [.97, .97, 1.1], sh: .9, open: 0, expose: .15, tire: .97, d: "Sit deeper. Fewer goals against, fewer for. Suits the weaker side." },
  vdef: { l: "Very defensive", ag: -3, m: [.93, .94, 1.25], sh: .8, open: 0, expose: .15, tire: .95, d: "Park the bus. Hard to break down and rarely threatening. For holding a lead." },
};
// The attributes each style leans on. How far the XI's are above or below what's usual for their positions
// and ratings decides how well the style works for them (see styleFit).
// Squad-page summaries. Keepers have no outfield attributes: their "attack" is distribution and their
// "defence" is shot-stopping, and they have no physical ratings.
const ATTR_GROUPS = {
  out: { atk: ["fin", "dri", "tec", "vis", "pas", "cmp"], dfn: ["tac", "mar", "hea"], phy: ["pac", "sta", "str"] },
  gk: { atk: ["lp", "sp"], dfn: ["ss"], phy: [] },
};
const STYLE_KEYS = { vatt: ["fin", "dri", "pac", "sta"], att: ["fin", "dri", "vis", "tec"], pos: ["pas", "tec", "vis", "cmp"], bal: [],
  ctr: ["pac", "dri", "fin", "vis"], def: ["tac", "mar", "hea", "str"], vdef: ["tac", "mar", "hea", "cmp"] };
const STYLE_BY_AG = { 3: "vatt", 2: "att", 1: "pos", 0: "bal", "-1": "ctr", "-2": "def", "-3": "vdef" };
const TRAIN = {
  rec: { l: "Recovery", fit: 24, grow: .45, d: "+24 fitness a week. Players barely develop." },
  bal: { l: "Balanced", fit: 17, grow: 1, d: "+17 fitness a week. Steady development." },
  int: { l: "Intense", fit: 10, grow: 1.6, d: "+10 fitness a week. Fastest development; occasional training knocks." },
};
// Squad shape every generated club starts from (24 senior-ish players)
const ROLE_MIX = { GK: 3, CB: 4, FB: 4, DM: 2, CM: 3, AM: 2, W: 3, ST: 3 };

/* ---------- competition rules (modelled on the current English game) ---------- */
const RULES = {
  squadMax: 25, nonHGMax: 17, hgYears: 3,  // 25 registered seniors, at most 17 not homegrown, under-21s unlimited
  aiSeniorCap: 28,                          // AI clubs may carry a few unregistered seniors
  benchSize: 9, subs: 5,
  yellowBans: [[5, .5, 1], [10, .84, 2], [15, 9, 3]], // [cautions, before this share of the league season, games banned]
  straightRed: 3, secondYellow: 1,
  scrLimit: 0.85, scrSporting: 1.15,         // Squad Cost Ratio: levy above 85%, points deductions above 115%
  loanMaxAge: 23, loansIn: 4,
};

/* ---------- the English pyramid you manage in, and the foreign top flights you compete with ---------- */
const HOME = "ENG";
const LG = {
  E1:  { name: "Premier Division", c: "ENG", tier: 1, size: 20, rep: [81, 1.3], up: 0, down: 3, po: null },
  E2:  { name: "First Division", c: "ENG", tier: 2, size: 24, rep: [56, .5], up: 2, down: 3, po: { type: "c", from: 3, to: 8 } },
  E3:  { name: "Second Division", c: "ENG", tier: 3, size: 24, rep: [41, .45], up: 2, down: 4, po: { type: "std", from: 3, to: 6 } },
  E4:  { name: "Third Division", c: "ENG", tier: 4, size: 24, rep: [31, .3], up: 3, down: 2, po: { type: "std", from: 4, to: 7 } },
  E5:  { name: "National Division", c: "ENG", tier: 5, size: 24, rep: [24, .3], up: 1, down: 4, po: { type: "nl", from: 2, to: 7 } },
  E6N: { name: "National Division North", c: "ENG", tier: 6, size: 24, rep: [17, .3], up: 1, down: 4, po: { type: "nl", from: 2, to: 7 }, half: "N" },
  E6S: { name: "National Division South", c: "ENG", tier: 6, size: 24, rep: [17, .3], up: 1, down: 4, po: { type: "nl", from: 2, to: 7 }, half: "S" },
};
// Foreign countries: three simulated divisions of 20, three up and three down between each.
const FOREIGN_DEF = { ESP: ["Primera", "Segunda", "Tercera", 80], GER: ["Erste Liga", "Zweite Liga", "Dritte Liga", 79], ITA: ["Serie Prima", "Serie Seconda", "Serie Terza", 79],
  FRA: ["Division Une", "Division Deux", "Division Trois", 75], POR: ["Primeira Divisão", "Segunda Divisão", "Terceira Divisão", 70], NED: ["Hoofdklasse", "Eerste Klasse", "Tweede Klasse", 69], BEL: ["Pro Division", "Challenger Division", "Nationale Division", 64] };
for (const [c, [n1, n2, n3, top]] of Object.entries(FOREIGN_DEF)) {
  LG[c + "1"] = { name: n1, c, tier: 1, size: 20, rep: [top, 1.3], up: 0, down: 3, foreign: true };
  LG[c + "2"] = { name: n2, c, tier: 2, size: 20, rep: [top - 28, .5], up: 3, down: 3, foreign: true };
  LG[c + "3"] = { name: n3, c, tier: 3, size: 20, rep: [top - 40, .4], up: 3, down: 0, foreign: true };
}
const ENG_LGS = ["E1", "E2", "E3", "E4", "E5", "E6N", "E6S"];
const FOREIGN_LGS = Object.keys(LG).filter(k => LG[k].foreign);
const TOP_LGS = ["E1", ...Object.keys(FOREIGN_DEF).map(c => c + "1")];
const LG_ABOVE = { E2: "E1", E3: "E2", E4: "E3", E5: "E4", E6N: "E5", E6S: "E5" };
const LG_BELOW = { E1: "E2", E2: "E3", E3: "E4", E4: "E5" };
for (const c of Object.keys(FOREIGN_DEF)) { LG_ABOVE[c + "2"] = c + "1"; LG_ABOVE[c + "3"] = c + "2"; LG_BELOW[c + "1"] = c + "2"; LG_BELOW[c + "2"] = c + "3"; }
// Squad strength follows reputation: Premier Division stars reach 17–19 out of 20; the bottom of the pyramid sits around 5.
const lvlForRep = rep => 45.5 + rep * .42;  // calibrated so the average professional rates about 10
const roundsOf = k => (LG[k].size - 1) * 2;

const COUNTRIES = [
  { code: "ENG", name: "England", adj: "English",
    regions: [["London",51.51,-0.13,"S"],["South East",51.25,0.55,"S"],["South West",50.95,-3.2,"S"],["East Anglia",52.4,1.0,"S"],["West Midlands",52.48,-1.9,"N"],["East Midlands",52.95,-1.15,"N"],["North West",53.6,-2.55,"N"],["Yorkshire",53.8,-1.45,"N"],["North East",54.9,-1.6,"N"]],
    pre: ["Ash","Brack","Cal","Thorn","Wick","Hal","Mar","Stan","Red","Brom","Kes","Lan","Pen","Har","Wes","Nor","Sal","Ever","Hol","Til","Elm","Fen","Gran","Kirk","Mill","Oak","Rush","Shel","Ald","Bex","Cor","Dun","Lyd","Mor","Sand","Hart","Wil","Brad","Chip","Fal","Gil","Haw","Ilk","Ket","Lox","Nant","Ross","Stoke","That","Wal"],
    suf: ["ford","ton","bury","ley","ham","wick","field","mouth","stead","by","gate","worth","borough","bridge","mere","dale","well","combe","hurst","stow","hampton","minster","chester","port","wood","thorpe"],
    fmt: ["{t} Town","{t} United","{t} City","{t} Athletic","{t} Rovers","{t} Albion","{t} Wanderers","{t} FC","AFC {t}","{t} Borough","{t} County"] },
  { code: "ESP", name: "Spain", adj: "Spanish",
    regions: [["Madrid",40.42,-3.7],["Catalonia",41.6,1.9],["Andalusia",37.4,-5.0],["Valencia",39.45,-0.5],["Basque Country",43.1,-2.6],["Galicia",42.8,-8.0],["Castile",41.6,-4.7],["Aragon",41.65,-0.9]],
    pre: ["Val","Mon","Sant","Alca","Villa","Torre","Cas","Pal","Ber","Mar","Lor","Gua","Sal","Ron","Tar","Bena","Cam","Fuen","Hor","Lin","Olm","Peñ","Riba","Seg","Tre","Zar","Ali","Mer","Cor"],
    suf: ["ares","eda","illa","ena","ejo","ona","ante","oz","ero","ida","ales","uela","ar","era","obre","al","iza","ón","ada"],
    fmt: ["Real {t}","{t} CF","Atlético {t}","CD {t}","UD {t}","Deportivo {t}","Racing {t}","SD {t}","CF {t}"] },
  { code: "GER", name: "Germany", adj: "German",
    regions: [["Bavaria",48.6,11.6],["Berlin",52.52,13.4],["Rhineland",50.6,7.0],["Ruhr",51.45,7.2],["Saxony",51.1,13.2],["North",53.5,9.9],["Baden",48.6,8.5],["Hesse",50.3,8.7]],
    pre: ["Alt","Bad","Berg","Eich","Fal","Gro","Hei","Kirch","Lin","Mar","Neu","Ober","Ros","Schön","Stein","Wal","Hoch","Lich","Mühl","Sond","Tann","Unter","Brem","Lau","Rhein","Sieg","Würz","Elm","Dor"],
    suf: ["dorf","hausen","heim","feld","stadt","bach","berg","au","ingen","hagen","rode","stein","furt","tal","brück","wald","see","burg"],
    fmt: ["FC {t}","SV {t}","VfB {t}","TSV {t}","Eintracht {t}","SC {t}","Borussia {t}","1. FC {t}","SpVgg {t}"] },
  { code: "ITA", name: "Italy", adj: "Italian",
    regions: [["Lombardy",45.5,9.4],["Piedmont",45.0,7.7],["Lazio",41.9,12.6],["Campania",40.9,14.4],["Tuscany",43.5,11.2],["Veneto",45.5,12.0],["Emilia",44.6,11.0],["Sicily",37.6,14.0]],
    pre: ["Ca","Mon","San","Vil","Pie","Fi","Lu","Ter","Bel","Cor","Fon","Mar","Ponte","Val","Ac","Bor","Cas","Gal","Lo","Or","Pe","Sas","Ve","Ri","Aqui","Sor","Tre"],
    suf: ["ella","ano","ena","ola","ate","ara","eto","ignano","iglia","ezzo","one","asco","ello","orto","iana","era"],
    fmt: ["{t} Calcio","AC {t}","US {t}","{t} FC","Atletico {t}","SS {t}","AS {t}","Sporting {t}","Virtus {t}"] },
  { code: "FRA", name: "France", adj: "French",
    regions: [["Île-de-France",48.85,2.35],["Brittany",48.1,-2.8],["Normandy",49.2,0.3],["Provence",43.6,5.5],["Rhône",45.75,4.85],["Nord",50.5,3.0],["Aquitaine",44.8,-0.6],["Lorraine",48.7,6.2]],
    pre: ["Beau","Mont","Val","Chât","Ro","Bel","Ver","Gran","Lan","Mar","Sa","Bour","Cler","Font","Mor","Pont","Cha","Vau","Lou","Ger"],
    suf: ["ville","mont","court","gny","lieu","nac","sac","bourg","fort","mas","lac","ières","oux","eau","ay","eux"],
    fmt: ["{t} FC","AS {t}","Olympique {t}","Stade {t}","SC {t}","RC {t}","US {t}","FC {t}","AJ {t}"] },
  { code: "POR", name: "Portugal", adj: "Portuguese",
    regions: [["Lisbon",38.72,-9.14],["Porto",41.15,-8.6],["Minho",41.6,-8.4],["Algarve",37.1,-8.2],["Coimbra",40.2,-8.4],["Alentejo",38.5,-7.9],["Madeira",32.65,-16.9],["Azores",37.75,-25.67]],
    pre: ["Vila","Ar","Bra","Cas","Fa","Gui","Lou","Mon","Pe","Sa","Tor","Val","Es","Al","Ma","Ri","Cova","Fer"],
    suf: ["inho","ela","ães","ar","eira","ão","ense","osa","al","edo","elo","oa","anda"],
    fmt: ["{t} FC","SC {t}","CD {t}","GD {t}","Sporting {t}","Académico {t}","União {t}","FC {t}"] },
  { code: "NED", name: "Netherlands", adj: "Dutch",
    regions: [["Holland",52.37,4.9],["Utrecht",52.09,5.12],["Brabant",51.6,5.1],["Gelderland",52.0,5.9],["Limburg",51.0,5.8],["Friesland",53.1,5.8],["Groningen",53.2,6.6],["Overijssel",52.4,6.4]],
    pre: ["Ams","Rot","Hel","Zwol","Gro","Bre","Ein","Til","Del","Har","Dor","Venl","Ap","Al","Bos","Leeu","Wa","Oos","Zee","Hoog","Mid"],
    suf: ["dam","drecht","burg","hoven","wijk","veld","huizen","horst","land","sum","lo","werd","haven","rode","kerk"],
    fmt: ["{t} FC","SC {t}","VV {t}","FC {t}","Sparta {t}","RKC {t}","Fortuna {t}","SBV {t}"] },
  { code: "BEL", name: "Belgium", adj: "Belgian",
    regions: [["Brussels",50.85,4.35],["Flanders",51.05,3.7],["Antwerp",51.22,4.4],["Liège",50.63,5.57],["Hainaut",50.45,4.0],["Limburg (BE)",50.93,5.34],["Namur",50.47,4.87],["Ardennes",49.9,5.5]],
    pre: ["Ber","Mol","Wa","Ou","Lok","Tur","Has","Gen","Roe","Lie","Char","Aal","Ze","Kor","Ost","Ve","Tie","Her"],
    suf: ["eren","hout","ege","ingen","elle","gem","beke","dam","rode","stal","ken","aart","laar"],
    fmt: ["KV {t}","RSC {t}","Royal {t}","KRC {t}","Standard {t}","Sporting {t}","{t} FC","Racing {t}"] },
];
const COUNTRY = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));
const TOWN_BLOCK = new Set(["Torino","Valencia","Hamburg","Wolfsburg","Marino","Salerno","Lucca","Sevilla","Marburg","Rotdam","Amsdam","Brugge","Genk",
  // Real English clubs the generator can spell out of its own parts (one was "Everton FC" in a test save).
  "Ashford","Brackley","Margate","Bromley","Weston","Salford","Everton","Tilbury","Kirkby","Corby","Hartley","Bradford","Ashton","Thornbury","Redbridge","Walton"]);
// Youth prospects also come from outside the eight leagues.
const ABROAD = [["BRA","Brazil",-15.8,-47.9],["ARG","Argentina",-34.6,-58.4],["WAF","West Africa",6.5,-1.5],["SCA","Scandinavia",59.9,10.8]];
const NAT_NAME = { ENG: "England", ESP: "Spain", GER: "Germany", ITA: "Italy", POR: "Portugal", FRA: "France", NED: "Netherlands", BEL: "Belgium", BRA: "Brazil", ARG: "Argentina", WAF: "Ghana", SCA: "Norway" };
const NAMES = {
  ENG: [["Jack","Oliver","Harry","George","Callum","Kieran","Lewis","Jamie","Ryan","Connor","Ben","Josh","Liam","Tom","Dan","Alfie","Charlie","Reece","Owen","Mason","Ethan","Archie","Toby","Jordan","Nathan","Sam","Max","Joe","Kyle","Luke","Adam","Elliot","Finley","Rhys","Theo","Aaron","Bradley","Caleb","Declan","Freddie","Harvey","Isaac","Jake","Leo","Louis","Marcus","Noah","Oscar","Rory","Sonny","Tyler","Will","Zach","Ellis","Jacob"],
        ["Ashworth","Barlow","Carver","Dawson","Ellison","Fletcher","Garside","Hargreaves","Ingram","Jenner","Kitson","Lomax","Marsh","Norris","Oakley","Pickering","Quayle","Rowntree","Shaw","Tindall","Upton","Varley","Whitfield","Yates","Brook","Cartwright","Denton","Holloway","Pryce","Sheard","Bancroft","Cooke","Dyson","Fairclough","Gosling","Hesketh","Kendrick","Lindley","Moss","Ogden","Pell","Rigby","Stott","Thwaite","Walsh","Whittaker","Atherton","Bellamy","Birtles","Bramwell","Calloway","Catterall","Dunmore","Eastwood","Fenwick","Greenhalgh","Haworth","Hollins","Kershaw","Lambton","Lister","Mayall","Nuttall","Openshaw","Platt","Ramsden","Royle","Scholfield","Settle","Speight","Starkey","Sutcliffe","Tattersall","Thorley","Trickett","Wadsworth","Walmsley","Warburton","Weatherall","Wilde","Woodhead","Worsley","Brierley","Crossley","Duckworth","Entwistle","Hulme","Mottram","Pilling","Ratcliffe"]],
  ESP: [["Álvaro","Iker","Pablo","Sergio","Javier","Adrián","Mario","Hugo","Diego","Rubén","Marcos","Óscar","Raúl","Unai","Aitor","Carlos","Dani","Jorge","Nacho","Gonzalo","Íñigo","Pau","Asier","Rodrigo","Borja","Fran","Iván","Jon","Mikel","Víctor","Samu","Héctor","Álex","Ander"],
        ["Arrieta","Bermejo","Cabrera","Delgado","Echeverría","Fuentes","Galindo","Herrero","Ibarra","Jiménez","Lozano","Méndez","Navas","Olmedo","Pizarro","Quesada","Robles","Saavedra","Tejada","Urrutia","Vidal","Zamora","Montero","Carrasco","Salcedo","Aranda","Beltrán","Castaño","Domingo","Espinosa","Ferrer","Gallego","Hurtado","Iglesias","Lorente","Marín","Nieto","Ortega","Prieto","Rivas","Soler"]],
  GER: [["Lukas","Jonas","Leon","Finn","Felix","Niklas","Tim","Jannik","Moritz","Maximilian","Paul","Julian","Tobias","Florian","Kevin","Marco","Lennart","Philipp","Sebastian","Dominik","Kai","Benedikt","Malte","Elias","Noah","Luis","Jan","Fabian","Marvin","Robin","Till","Henrik","Nils"],
        ["Achterberg","Brenner","Dietrich","Eckert","Fiedler","Görtz","Hartmann","Jäger","Kessler","Lindner","Möller","Neuhaus","Oswald","Pfeiffer","Reinhold","Seidel","Thalberg","Urban","Vogt","Wendt","Zimmer","Krause","Brandt","Kühne","Albrecht","Baumann","Engel","Frank","Graf","Haas","Kraus","Lorenz","Martens","Nowak","Otto","Probst","Roth","Schulte","Thiele","Winkler"]],
  ITA: [["Lorenzo","Matteo","Alessandro","Davide","Federico","Riccardo","Simone","Andrea","Gabriele","Tommaso","Nicolò","Francesco","Luca","Stefano","Giacomo","Pietro","Daniele","Emanuele","Filippo","Marco","Edoardo","Mattia","Leonardo","Samuele","Alberto","Christian","Michele","Antonio","Giorgio","Salvatore"],
        ["Bellucci","Caruso","De Santis","Esposito","Ferrara","Galli","Lombardi","Mancuso","Negri","Orlando","Pellegrini","Rinaldi","Sartori","Testa","Valente","Zanella","Marchetti","Colombo","Fontana","Moretti","Barbieri","Greco","Leone","Serra","Amato","Benedetti","Conti","D'Angelo","Farina","Gentile","Longo","Mariani","Palumbo","Ricci","Rossetti","Sala","Silvestri","Vitale","Ferri","Bruno"]],
  POR: [["João","Rúben","Tiago","Diogo","Gonçalo","Rafael","André","Nuno","Vitor","Rui","Pedro","Henrique","Miguel","Bernardo","Francisco","Hugo","Luís","Martim","Sérgio","Fábio","Bruno","Ricardo","Daniel"],["Almeida","Batista","Cardoso","Duarte","Fonseca","Gomes","Lopes","Macedo","Neves","Pinto","Quintela","Ramos","Simões","Teixeira","Correia","Antunes","Barros","Coelho","Esteves","Faria","Godinho","Leal","Marques","Nogueira","Pacheco","Rocha","Sequeira","Tavares","Vieira"]],
  FRA: [["Théo","Lucas","Hugo","Maxime","Antoine","Mathis","Enzo","Yanis","Clément","Bastien","Romain","Nolan","Rayan","Moussa","Adrien","Baptiste","Florian","Jules","Kylian","Louis","Matteo","Nathan","Quentin","Thomas","Valentin"],["Aubert","Benoît","Chevalier","Delorme","Fabre","Garnier","Lacroix","Marchand","Perrin","Roussel","Tessier","Vasseur","Fournier","Diallo","Camara","Bertin","Blanchard","Collin","Dumas","Fleury","Gauthier","Leroy","Masson","Morel","Navarro","Picard","Renaud","Robin","Schmitt","Vidal","Lemoine"]],
  NED: [["Daan","Sem","Thijs","Lars","Jesse","Bram","Ruben","Stijn","Joris","Niels","Wout","Tijn","Milan","Jens","Luuk","Thomas","Bas","Koen","Rick","Mats","Jasper","Teun","Sven","Gijs"],["Bakker","Visser","Smit","Mulder","de Graaf","van Dam","Kuipers","Veenstra","Hoekstra","Brouwer","Dekker","van Rijn","Jansen","Kok","Boer","de Jong","Hendriks","Koster","Maas","Peters","Postma","Schouten","van Leeuwen","Verhoeven","Vos","de Wit","Bosman","Meijer"]],
  BEL: [["Arne","Wout","Jelle","Simon","Thibault","Maxime","Lander","Senne","Cédric","Robin","Dries","Brecht","Jonas","Kobe","Matthias","Ruben","Thomas","Victor","Bart","Joren","Lucas","Seppe"],["Peeters","Janssens","Maes","Claes","Wouters","Goossens","Dubois","Lambert","Mertens","Willems","Leclercq","Vermeulen","De Smet","Aerts","Bogaerts","Coppens","Desmet","Hermans","Jacobs","Michiels","Pauwels","Smets","Van Damme","Verstraeten","Wuyts"]],
  BRA: [["Gabriel","Lucas","Mateus","Rafael","Thiago","Felipe","Bruno","Caio","Igor","Renan","Wesley","Danilo","Éverton","Rodrigo","Luan","Vinícius","Arthur","Guilherme","Leandro","Marcelo","Paulo","Samuel","Vitor"],["Silva","Souza","Oliveira","Pereira","Costa","Ribeiro","Martins","Carvalho","Araújo","Barbosa","Moraes","Nascimento","Moreira","Cardoso","Almeida","Batista","Campos","Dias","Fernandes","Lima","Monteiro","Rocha","Teixeira","Vieira"]],
  ARG: [["Santiago","Matías","Nicolás","Facundo","Joaquín","Tomás","Agustín","Franco","Gonzalo","Emiliano","Leandro","Ezequiel","Valentín","Lautaro","Bautista","Ignacio","Julián","Lucas","Mauro","Rodrigo","Thiago"],["Acosta","Benítez","Coronel","Domínguez","Escobar","Ferreyra","Godoy","Herrera","Ledesma","Medina","Ojeda","Paredes","Quiroga","Sosa","Vera","Aguirre","Bustos","Cabral","Funes","Giménez","Luna","Molina","Navarro","Peralta","Rojas"]],
  WAF: [["Kwame","Kofi","Yaw","Emmanuel","Ibrahim","Samuel","Abdul","Moses","Daniel","Joseph","Isaac","Osman","Chidi","Tunde","Sékou"],["Mensah","Asante","Boateng","Owusu","Adebayo","Okafor","Eze","Nwosu","Traoré","Koné","Diarra","Bamba","Sarpong","Appiah","Ogunleye"]],
  SCA: [["Erik","Magnus","Oscar","Emil","Sander","Mathias","Viktor","Henrik","Anders","Jonas","Sindre","Elias","Rasmus"],["Andersen","Berg","Dahl","Ekström","Haugen","Lund","Nyberg","Sørensen","Strand","Vik","Holm","Lindgren","Aas","Bakke"]],
};
const ALL_NATS = Object.keys(NAMES);
const CLUB_COLORS = ["#1f4fc4","#b42323","#0d7268","#6d3fd0","#0a6aa0","#3b4a5e","#c2410c","#2f7d32","#9a6408","#b3195c","#1f2937","#7c2d12","#0e7490","#4d7c0f","#a21caf","#be123c","#1e3a8a","#065f46","#854d0e","#5b21b6","#0f766e","#9f1239"];

/* ---------- season calendar (week numbers 0–41) ---------- */
// 38-round leagues play weekends only; 46-round leagues add eight midweek rounds.
const CAL = {
  midweekLeague: [4, 8, 11, 15, 19, 24, 28, 33],
  jan: [18, 19, 20, 21], summerDays: 5,  /* summerDays: preseason weeks, window open throughout */ lastWeek: 41,
  // knockout schedules: one entry per round, a pair of weeks for two-legged rounds
  FA: [[2], [6], [10], [16], [20], [25], [29], [34], [38]],
  LC: [[1], [5], [9], [13], [17], [21, 23], [27]],
  contGroups: [3, 7, 10, 12, 14, 18],
  contKO: { CC: [[22, 24], [26, 28], [30, 32], [39]], CS: [[9, 12], [22, 24], [30, 32], [39]], CT: [[11, 14], [23, 25], [31, 33], [40]] },
  po: { c: [[38], [39, 40], [41]], std: [[39, 40], [41]], nl: [[38], [39], [41]] },
};
const CUPS = {
  FA: { name: "National Cup", rounds: ["Fourth qualifying round", "First round", "Second round", "Third round", "Fourth round", "Fifth round", "Quarter-finals", "Semi-finals", "Final"] },
  LC: { name: "League Cup", rounds: ["First round", "Second round", "Third round", "Fourth round", "Quarter-finals", "Semi-finals", "Final"] },
};
const CONT = { CC: { name: "Champions Cup", short: "CC", prize: [16e6, 2.5e6, 12e6] }, CS: { name: "Continental Shield", short: "CS", prize: [5e6, 1e6, 5e6] }, CT: { name: "Continental Trophy", short: "CT", prize: [2e6, .5e6, 2e6] } };
const CONT_ROUNDS = ["Round of 16", "Quarter-finals", "Semi-finals", "Final"];

/* ---------- player attributes, out of 20 (10 is average, 20 world class) ---------- */
/* Each line of the team has its own attributes. Every outfield player carries all twelve (a centre-back
   moved into midfield still needs his passing), but you see the five that define his line, and his rating
   comes from the mix his position needs. */
const ATTR_NAME = { fin: "Finishing", dri: "Dribbling", pac: "Pace", hea: "Heading", cmp: "Composure", pas: "Passing", vis: "Vision", tec: "Technique",
  sta: "Stamina", tac: "Tackling", mar: "Marking", str: "Strength", ss: "Shot-stopping", lp: "Long passing", sp: "Short passing" };
const OUT_KEYS = ["fin", "dri", "pac", "hea", "cmp", "pas", "vis", "tec", "sta", "tac", "mar", "str"], GK_KEYS = ["ss", "lp", "sp"];
const LINE_NAME = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", ATT: "Attacker" };
const LINE_ATTRS = { GK: GK_KEYS, DEF: ["tac", "mar", "hea", "str", "pac"], MID: ["pas", "vis", "tec", "tac", "sta"], ATT: ["fin", "dri", "pac", "hea", "cmp"] };  // keyed by LINE
// How much each attribute counts toward a role's rating (weights sum to 1).
const AW = {
  CB: { tac: .25, mar: .25, hea: .2, str: .15, pac: .1, pas: .05 },
  FB: { tac: .2, mar: .15, pac: .3, sta: .1, pas: .1, str: .05, hea: .05, dri: .05 },
  DM: { tac: .25, pas: .2, sta: .15, mar: .1, vis: .1, str: .1, tec: .1 },
  CM: { pas: .25, vis: .2, tec: .15, sta: .15, tac: .1, cmp: .05, fin: .05, str: .05 },
  AM: { pas: .2, vis: .2, tec: .2, dri: .15, fin: .1, cmp: .1, pac: .05 },
  W: { pac: .25, dri: .25, fin: .1, tec: .1, pas: .1, sta: .1, cmp: .05, vis: .05 },
  ST: { fin: .35, cmp: .15, hea: .15, pac: .1, str: .1, dri: .1, tec: .05 },
  GK: { ss: .7, lp: .15, sp: .15 },
};
// Typical shape of each position: centre-backs rarely finish well, wingers rarely mark.
const AOFF = {
  CB: { fin: -4, dri: -3, pac: -.5, hea: 2, cmp: -1, pas: -1, vis: -2, tec: -2, sta: 0, tac: 2, mar: 2, str: 2 },
  FB: { fin: -3, dri: 0, pac: 2, hea: -1, cmp: -1, pas: 0, vis: -1, tec: -.5, sta: 1.5, tac: 1, mar: 1, str: -1 },
  DM: { fin: -2, dri: -1, pac: -1, hea: 0, cmp: 0, pas: 1, vis: 0, tec: 0, sta: 1, tac: 2, mar: 1, str: 1 },
  CM: { fin: -.5, dri: 0, pac: 0, hea: -1, cmp: 0, pas: 2, vis: 1.5, tec: 1, sta: 1, tac: 0, mar: -1, str: 0 },
  AM: { fin: 1, dri: 1.5, pac: .5, hea: -2, cmp: .5, pas: 2, vis: 2, tec: 2, sta: -.5, tac: -3, mar: -3, str: -2 },
  W: { fin: .5, dri: 2.5, pac: 3, hea: -2, cmp: 0, pas: .5, vis: 0, tec: 1, sta: 1, tac: -3, mar: -3, str: -2 },
  ST: { fin: 2.5, dri: .5, pac: 1, hea: 1, cmp: 1.5, pas: -1, vis: -1, tec: 0, sta: -.5, tac: -4, mar: -4, str: 1 },
  GK: { ss: 1, lp: -1, sp: -1 },
};
// Pace and stamina go first with age; composure and vision last.
const DECLINE = { pac: 1.8, sta: 1.5, str: 1.2, dri: 1.2, tac: .8, hea: .7, fin: .7, mar: .5, pas: .5, tec: .5, cmp: .3, vis: .3, ss: 1, lp: .8, sp: .8 };
const r20 = ovr => (ovr - 30) / 3, o100 = r => 30 + 3 * r;   // internal 100-scale used by the engine and valuations

/* ---------- coaches ---------- */
const COACH_KEYS = [["off", "Attack"], ["def", "Defence"], ["rec", "Recruitment"], ["dev", "Development"]];
const ARCH = {
  bal: { l: "Balanced", key: null, d: "Even across all four." },
  off: { l: "Attacking coach", key: "off", d: "Teams create and finish more chances." },
  def: { l: "Defensive organiser", key: "def", d: "Teams concede fewer and better chances." },
  rec: { l: "Recruiter", key: "rec", d: "More recruiting hours, sharper scouting, stronger relationships with prospects." },
  dev: { l: "Developer", key: "dev", d: "Young players improve faster and get closer to their potential." },
};
const COACH_EFFECT = {
  off: "Each point above 10 adds about 0.8% to your attack; below 10 takes it away.",
  def: "Each point above 10 adds about 0.8% to your defence.",
  rec: "Adds recruiting hours, narrows scouts' estimates of potential and injury risk, and builds relationships faster.",
  dev: "Raises the weekly chance that players improve, from 0.6× at 1 to 1.4× at 20.",
};

/* ---------- injuries ---------- */
// [cumulative share, min weeks, max weeks, examples]. Season-ending is rare; career-ending rarer still.
const INJURIES = [
  [.70, 1, 3, ["tight hamstring", "dead leg", "ankle knock", "groin strain", "calf strain", "back spasm"]],
  [.90, 4, 7, ["torn hamstring", "ankle ligament damage", "calf tear", "thigh strain"]],
  [.979, 8, 24, ["knee ligament damage", "fractured foot", "dislocated shoulder", "broken wrist", "torn adductor"]],
  [.9992, 30, 45, ["ruptured cruciate ligament", "broken leg", "ruptured Achilles tendon"]],
  [1, 0, 0, ["career-ending knee injury"]],
];
// Chance a player decides this is his last season, by age.
const RETIRE_AGE = { 30: .03, 31: .05, 32: .08, 33: .14, 34: .22, 35: .32, 36: .45, 37: .6, 38: .75, 39: .9 };
