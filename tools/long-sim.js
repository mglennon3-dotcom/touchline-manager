/* Simulates many seasons headlessly and checks the world stays sane: every division keeps its size,
   no club sits in two divisions, Champions Cup groups have four countries, every squad entry is a real player.
   It also prints drift indicators (ratings out of 20 by division, wages against income, cost-rule charges, save size).
   Usage: serve the folder (python3 -m http.server 8800), then: node tools/long-sim.js 50
   Needs Playwright with Chromium installed. */
const { chromium } = require('playwright');
const N = +process.argv[2] || 50;
(async () => { const b = await chromium.launch(); const pg = await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
  await pg.goto((process.env.URL || 'http://localhost:8800/index.html')); await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{ takeClub(DRAFT.leagues.E3.clubs[8], 'Test Manager', 'dev'); S.set.unsackable = true; });
  for (let s=0; s<N; s++) {
    const r = await pg.evaluate(async ()=>{ S.set.live=false; const t=Date.now(); let g=0;
      while(S.phase==='season'&&g++<600){ if(S.sacked) throw new Error('sacked despite unsackable mode');
        if(!regInfo(me()).ok) trimSquad(me(),false); while(me().squad.length<18||(regInfo(me()).eligible<16&&me().squad.length<30)){ const p=S.fa.map(P).sort((a,b)=>b.ovr-a.ovr)[0]; S.fa=S.fa.filter(x=>x!==p.id); p.club=S.club; p.yrs=2; me().squad.push(p.id);} 
        for(const m of openDecisions()) resolveDecision(m,m.opts[0][0]); await play('season'); }
      let gg=0; while(S.phase==="summer"&&gg++<60){ if(S.sacked) throw new Error('sacked despite unsackable mode'); for(const m of openDecisions()) resolveDecision(m,m.opts[1]?m.opts[1][0]:m.opts[0][0]); await playNewSeason(); }
      const bad=[]; const seen={};
      for(const [k,L] of Object.entries(S.leagues)){ if(L.clubs.length!==LG[k].size) bad.push(k+':'+L.clubs.length); for(const id of L.clubs){ if(seen[id]) bad.push('dup'+id); seen[id]=1; if(C(id).lg!==k||C(id).gone) bad.push('mis'+id);} }
      for(const k of ['CC']) S.cont[k].groups.forEach((g,i)=>{ if(g.length!==4) bad.push(k+i+'len'); if(new Set(g.map(id=>C(id).country)).size!==4) bad.push(k+i+'ctry'); });
      for(const c of activeClubs()) for(const id of c.squad){ const p=S.players[id]; if(!p) bad.push('ghost'); else if(p.club!==c.id) bad.push('clubmismatch'); }
      const med=a=>{a.sort((x,y)=>x-y);return a[Math.floor(a.length/2)]};
      const lv=k=>r20(med(S.leagues[k].clubs.map(id=>clubLevel(C(id))))).toFixed(1);
      const h=S.history[0]; let g2=0,n=0; for(const k of ['E1','E2','E5']){} 
      const ps=Object.values(S.players);
      return {y:h.year, ms:Date.now()-t, bad:bad.slice(0,5), lv:['E1','E2','E3','E4','E5','E6N','ESP1','ESP2','ESP3','BEL1'].map(k=>k+':'+lv(k)).join(' '),
        avgOvr:r20(ps.reduce((s,p)=>s+p.ovr,0)/ps.length).toFixed(2), top:[15,17,18,19].map(t=>ps.filter(p=>r20(p.ovr)>=t-.5).length).join('/'), longInj:ps.filter(p=>p.inj>=8).length, seasonInj:ps.filter(p=>p.inj>=30).length, retiring:ps.filter(p=>p.retiring).length, me:S.me.pts+'pts', ages:[[16,20],[21,25],[26,29],[30,40]].map(([a,b])=>{const q=ps.filter(p=>p.age>=a&&p.age<=b); return a+":"+q.length+"@"+(q.reduce((s,p)=>s+p.ovr,0)/q.length).toFixed(1)}).join(" "), players:ps.length, fa:S.fa.length, sq:med(activeClubs().map(c=>c.squad.length)),
        wageRev:med(activeClubs().map(c=>sum(c.squad,id=>P(id).wage)/c.revBase)).toFixed(2), scr95:activeClubs().map(c=>c.lastSCR||0).sort((a,b)=>a-b)[Math.floor(activeClubs().length*.95)].toFixed(2),
        charged:S.cases.filter(k=>k.y===S.year).length, cashMed:med(activeClubs().map(c=>c.cash/c.revBase)).toFixed(2), clubs:S.clubs.length, hof:S.hof.length,
        champs:['E1','ESP1'].map(k=>C(h.L[k].champ).short).join(','), cups:['FA','LC','CC','CS','CT'].map(k=>h.K[k]&&h.K[k].w!=null?C(h.K[k].w).short:'-').join(','),
        loans:ps.filter(p=>p.loan).length, kb:Math.round(JSON.stringify(S).length/1024), user:me().short+' '+me().lg+' '+S.career[0].pos };
    });
    if (r.bad.length || s%3===2 || s===0) console.log(JSON.stringify(r).slice(0,520));
    if (errs.length) { console.log('ERR', errs.slice(0,3)); break; }
  }
  await b.close(); })();
