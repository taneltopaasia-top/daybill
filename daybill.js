/* Daybill · rakenduse riba, telefoni kell (Call / Paus / Wrap) ja seaded.
   Kasutab Hoursi tuuma (state, save, render, calculate, projectTotals) samast lehest. */
'use strict';
(function(){
const $d=id=>document.getElementById(id);
const escH=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const TOUR='daybill.tour',setFlag=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}};
const VIEW_KEY='daybill.view',main=document.querySelector('main');
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const phone=()=>matchMedia('(max-width:650px)').matches;

/* ---------- vaated ---------- */
const hoursView=document.createElement('div');hoursView.id='hoursView';hoursView.className='db-view';
while(main.firstChild)hoursView.append(main.firstChild);main.append(hoursView);
const invView=$d('invView');if(invView)main.append(invView);
const clockView=document.createElement('section');clockView.id='clockView';clockView.className='db-view hidden';main.prepend(clockView);
const setView=document.createElement('section');setView.id='settingsView';setView.className='db-view hidden';main.append(setView);
// Seaded ja varukoopia: Hoursi andmefaili osa liigub seadetesse.
const backup=$d('backupDetails');

const bar=document.createElement('header');bar.className='db-bar';
bar.innerHTML=`<div class="db-bar-in"><div class="db-brand"><img src="icons/icon-192.png" alt="">Daybill</div><span class="db-sync" id="dbSync"></span><button class="db-gear" data-view="settings" aria-label="Seaded">Seaded</button><nav class="db-nav"><button data-view="clock">Kell</button><button data-view="hours">Eelvaade</button><button data-view="inv">Arve</button></nav></div>`;
document.body.prepend(bar);
let view='hours';
const VIEWS=[['clock',clockView],['hours',hoursView],['inv',()=>$d('invView')],['settings',setView]];
// Projekti valikud (Hoursi seadete vorm) on kellas; eelvaates tagasi oma kohal.
const optForm=$d('settings');
// Eelvaates on valikud kokku pandud, et ülevaade jääks lihtne.
const pvOpts=document.createElement('details');pvOpts.className='ck-opts';pvOpts.innerHTML='<summary>Projekti valikud · amet, hind, tööreeglid</summary>';
if(optForm){optForm.parentNode.insertBefore(pvOpts,optForm);pvOpts.append(optForm)}
const optHome={parent:pvOpts,next:null};
function optBack(){if(optForm&&optForm.parentNode!==optHome.parent)optHome.parent.insertBefore(optForm,optHome.next)}
function show(v){if(v==='sum'){v='inv';try{window.TraageldusInvoices.setTab('sum')}catch(e){}}view=VIEWS.some(x=>x[0]===v)?v:'clock';if(view!=='clock')optBack();for(const [k,e] of VIEWS){const el=typeof e==='function'?e():e;el&&el.classList.toggle('hidden',k!==view)}
 bar.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('primary',b.dataset.view===view));
 try{localStorage.setItem(VIEW_KEY,view)}catch(e){}
 if(view==='clock')renderClock();if(view==='settings')renderSettings();if(view==='inv')try{window.TraageldusInvoices.render()}catch(e){}if(view==='hours')try{render()}catch(e){}
 window.scrollTo(0,0)}
window.daybillShow=show;
bar.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));

/* ---------- kell ---------- */
let clockProject=null,tick=null,lastWrap=null;
try{clockProject=localStorage.getItem('daybill.clockProject')}catch(e){}
// Viimati kasutatud projekt on eespool (kell valib selle ise).
const lastAct=x=>(x.clock?'9':'')+(x.entries||[]).reduce((m,e)=>{const d=(e.endDate||e.date||'')+' '+(e.end||'');return d>m?d:m},'');
const active=()=>state.projects.filter(x=>!x.deleted&&!x.kind&&!x.archived&&!x.fromInvoice).sort((a,b)=>lastAct(b).localeCompare(lastAct(a)));
function cp(){return active().find(x=>x.id===clockProject)||active().find(x=>x.clock)||active()[0]}
const hm=d=>pad(d.getHours())+':'+pad(d.getMinutes());
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
function elapsed(c){const now=Date.now(),start=Date.parse(c.start),paused=(c.pauseSeconds||0)*1000+(c.pausedAt?now-Date.parse(c.pausedAt):0);return Math.max(0,now-start-paused)}
function fmt(ms){const s=Math.floor(ms/1000);return pad(Math.floor(s/3600))+':'+pad(Math.floor(s%3600/60))+':'+pad(s%60)}
function renderClock(){const p=cp();clearInterval(tick);
 if(!p){clockView.innerHTML=`<div class="clock"><h1>Kell</h1><p class="help">Alusta uue projektiga: kirjuta selle nimi.</p>${newProjectHtml()}</div>`;bindNew();return}
 const c=p.clock;let rows=[];try{rows=calculate(p,p.entries)}catch(e){}
 const t=(()=>{try{return projectTotals(p,rows)}catch(e){return null}})();
 const recent=[...rows].sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start)).slice(0,5);
 clockView.innerHTML=`<div class="clock">
  ${tourTip(p)}<div class="clock-field"><label for="ckProject">Projekt</label><select id="ckProject">${active().map(x=>`<option value="${escH(x.id)}"${x.id===p.id?' selected':''}>${escH(x.name)}${x.clock?' · tööl':''}</option>`).join('')}<option value="__new">+ Uus projekt…</option></select></div>
  <div id="ckNew" class="hidden">${newProjectHtml()}</div>
  ${lastWrap&&lastWrap.pid===p.id&&!c?`<div class="set-note ck-done" role="status"><strong>✓ Päev salvestatud</strong><br>${escH(lastWrap.text)}<div class="actions" style="margin:12px 0 0"><button type="button" id="ckPreview" class="primary">Tee arve eelvaade</button><button type="button" id="ckNewProject">Alusta uut projekti</button></div></div>`:''}
  <details class="ck-opts" id="ckOpts"${p.job?'':' open'}><summary>Projekti valikud · ${p.job?escH(p.job)+' · '+escH(priceLabel(p)):'amet, hind, tööreeglid'}</summary><p class="help">Need valikud kehtivad selle projekti kohta: amet, hind, ületunnid ja tööreeglid (Reklaam 10 h, Film 12 h või oma valik). Muudatused salvestuvad nupuga „Salvesta hind ja reeglid” või kui vajutad „Alusta tööd”.</p><div id="ckOptsSlot"></div></details>
  <div class="clock-face${c&&!c.pausedAt?' on':''}"><div class="clock-time" id="ckTime">${c?fmt(elapsed(c)):'00:00:00'}</div><div class="clock-sub">${c?(c.pausedAt?'Paus alates '+hm(new Date(c.pausedAt)):'Tööl alates '+hm(new Date(c.start))):'Pole tööl'}${c&&c.pauseSeconds?'<br>pausid kokku '+Math.round(c.pauseSeconds/60)+' min':''}</div></div>
  <div class="clock-btns">${c?`<button id="ckPause">${c.pausedAt?'Jätka':'Paus'}</button><button id="ckWrap" class="primary">Wrap · lõpeta</button>`:`<button id="ckCall" class="primary wide">Call · alusta tööd</button>`}</div>
  ${c?`<div class="clock-field"><label for="ckComment">Kommentaar (valikuline)</label><input id="ckComment" maxlength="500" value="${escH(c.comment||'')}" placeholder="nt kolimine, lisatöö"></div>`:''}
  <p class="error" id="ckError" role="alert"></p>
  <div class="clock-list"><h2>Viimased päevad · ${escH(p.name)}</h2>${recent.length?recent.map(e=>`<div class="row-item"><span>${escH(dayLabel(e.date))}<br>${escH(e.start)} → ${escH(e.end)}${e.breaks?' · paus '+e.breaks+' min':''}</span><span>${h(e.mins)}${e.ot||e.dbl?'<br>'+h(e.ot+e.dbl+(e.trip||0))+' ületunde':''}</span></div>`).join(''):'<div class="empty">Veel pole ühtegi päeva.</div>'}
  ${t?`<p class="help">Kokku ${h(t.mins)} · ${money(t.net)} ilma KM-ta.</p><div class="actions"><button type="button" id="ckPreview2">Vaata eelvaadet</button></div>`:''}</div></div>`;
 if(optForm){state.selected=p.id;try{render()}catch(e){}$d('ckOptsSlot').append(optForm)}
 $d('ckTipX')&&($d('ckTipX').onclick=()=>{setFlag(TOUR,null);renderClock()});$d('ckPreview')&&($d('ckPreview').onclick=()=>{if(lastWrap)setFlag(TOUR,null);openPreview(p.id)});$d('ckPreview2')&&($d('ckPreview2').onclick=()=>openPreview(p.id));
 $d('ckNewProject')&&($d('ckNewProject').onclick=()=>{lastWrap=null;$d('ckProject').value='__new';$d('ckNew').classList.remove('hidden');bindNew();$d('ckName').focus()});
 $d('ckProject').onchange=e=>{if(e.target.value==='__new'){$d('ckNew').classList.remove('hidden');bindNew();return}clockProject=e.target.value;try{localStorage.setItem('daybill.clockProject',clockProject)}catch(e){}renderClock()};
 $d('ckCall')&&($d('ckCall').onclick=()=>{// salvesta valikud enne algust (sama kontroll nagu nupul „Salvesta hind ja reeglid”)
  if(optForm&&$d('job')&&$d('job').value.trim()){try{optForm.requestSubmit()}catch(e){}if($d('settingsError')&&$d('settingsError').textContent){$d('ckOpts').open=true;return}}
  if(!p.job){$d('ckError').textContent='Täida enne projekti valikud: amet ja hind.';$d('ckOpts').open=true;$d('job')&&$d('job').focus();return}const other=state.projects.find(x=>x.clock&&x.id!==p.id&&!x.deleted);if(other){if(!confirm(`Kell käib juba projektis „${other.name}”. Lõpetan selle päeva ja alustan „${p.name}”?`)||!wrap(other,true))return}
  lastWrap=null;p.clock={start:new Date().toISOString(),pauseSeconds:0,device:standalone?'telefon':'brauser'};clockProject=p.id;save();renderClock()});
 $d('ckPause')&&($d('ckPause').onclick=()=>{const c=p.clock;if(c.pausedAt){c.pauseSeconds=(c.pauseSeconds||0)+Math.round((Date.now()-Date.parse(c.pausedAt))/1000);delete c.pausedAt}else c.pausedAt=new Date().toISOString();save();renderClock()});
 $d('ckComment')&&($d('ckComment').oninput=e=>{p.clock.comment=e.target.value;save()});
 $d('ckWrap')&&($d('ckWrap').onclick=()=>wrap(p));
 if(c)tick=setInterval(()=>{const el=$d('ckTime');if(!el||view!=='clock'){clearInterval(tick);return}el.textContent=fmt(elapsed(p.clock))},1000)}
function wrap(p,quiet){const c=p.clock;if(!c)return false;const end=new Date(),start=new Date(c.start);let pause=(c.pauseSeconds||0)+(c.pausedAt?Math.round((end-Date.parse(c.pausedAt))/1000):0);
 const e={id:(Date.now().toString(36)+Math.random().toString(36).slice(2)),date:ymd(start),endDate:ymd(end),start:hm(start),end:hm(end),comment:(c.comment||'').trim(),job:p.job,rate:p.rate,source:'Daybill kell',breaks:Math.round(pause/60)||undefined};
 const worked=end-start-pause*1000,drop=()=>{delete p.clock;save();renderClock();return true};
 if(worked<60000){if(!confirm('Tööd oli alla minuti, seda ei saa salvestada. Kas lõpetan ilma salvestamata?'))return false;return drop()}
 try{duration(e)}catch(err){if(!confirm((err.message||'Tööaeg on liiga lühike.')+' Kas lõpetan ilma salvestamata?'))return false;return drop()}
 // Tavaline päev on kuni ~16 h. Pikem tähendab tihti, et kell jäi kogemata käima.
 const dm=d=>d.getDate()+'.'+(d.getMonth()+1)+'. ';const sameDay=e.date===e.endDate,hrs=Math.floor(worked/3600e3);
 const from=(sameDay?'':dm(start))+e.start,to=(sameDay?'':dm(end))+e.end;
 if(hrs>=16&&!confirm(`Kell on käinud ${hrs} tundi. Kui see on õige, vajuta OK. Kui kell jäi kogemata käima, salvesta ikka ja paranda lõpuaeg hiljem eelvaates (Muuda).`))return false;
 if(!quiet&&!confirm(`Lõpetan: ${from} → ${to}${e.breaks?', paus '+e.breaks+' min':''}. Salvestan?`))return false;
 p.entries.push(e);delete p.clock;save();
 let sum='';try{const r=calculate(p,[e])[0];sum=' · '+h(r.mins)+(r.net!=null?' · '+money(r.net)+' ilma KM-ta':'')}catch(x){}
 lastWrap={pid:p.id,text:`${dayLabel(e.date)} · ${e.start} → ${e.end}${e.breaks?' · paus '+e.breaks+' min':''}${sum}`};renderClock();return true}
function priceLabel(p){try{if(isFixed(p))return money(p.fixedPrice)+' fikseeritud';if(dayMode(p))return money(p.dayRate)+' / päev'}catch(e){}return money(p.rate)+' / h'}
// Kellast eelvaatesse: sama projekt lahti, tööaja vaade.
function openPreview(pid){state.selected=pid;try{archiveView=false;projectExpanded=true;setStage('hours')}catch(e){}save();show('hours');setTimeout(()=>{const el=$d('summary');el&&el.scrollIntoView({block:'start'})},50)}
function newProjectHtml(){return `<div class="clock-field"><label for="ckName">Uue projekti nimi</label><div class="clock-new"><input id="ckName" maxlength="120" placeholder="nt Reklaam Sõida Kainelt"><button id="ckAdd" type="button">Lisa</button></div></div>`}
function bindNew(){const add=$d('ckAdd');if(!add)return;add.onclick=()=>{const name=$d('ckName').value.trim();if(!name){$d('ckName').focus();return}const n=project(name);const last=active()[0];if(last)for(const k of ['worker','job','rate','vat','ot','double','triple','round','reportLang','pricing','dayRate','dayHours','rules'])if(last[k]!==undefined)n[k]=JSON.parse(JSON.stringify(last[k]));lastWrap=null;state.projects.push(n);state.selected=n.id;clockProject=n.id;try{localStorage.setItem('daybill.clockProject',n.id)}catch(e){}save();renderClock()}}


/* ---------- 3 · kokkuvõte (ilma raamatupidamiseta) ---------- */
const eur=n=>(Math.round((Number(n)||0)*100)/100).toLocaleString('et-EE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
let sumYear=String(new Date().getFullYear());
function renderSum(target){const T=window.TraageldusInvoices;const all=T?T.list():[];
 const years=[...new Set([String(new Date().getFullYear()),...all.map(x=>String(x.date).slice(0,4))])].sort().reverse();
 if(!years.includes(sumYear))sumYear=years[0];
 const inv=all.filter(x=>String(x.date).startsWith(sumYear));
 const st=x=>T.status(x)[1];
 const net=inv.reduce((s,x)=>s+(Number(x.net)||0),0),gross=inv.reduce((s,x)=>s+(Number(x.gross)||0),0);
 const paid=inv.filter(x=>st(x)==='paid'),open=all.filter(x=>['open','overdue'].includes(st(x))),late=open.filter(x=>st(x)==='overdue');
 const sumG=a=>a.reduce((s,x)=>s+(Number(x.gross)||0),0);
 const months={};for(const x of inv){const m=String(x.date).slice(0,7);const r=months[m]||(months[m]={n:0,net:0,vat:0,gross:0,paid:0});r.n+=x.credit?0:1;r.net+=Number(x.net)||0;r.vat+=Number(x.vat)||0;r.gross+=Number(x.gross)||0;if(st(x)==='paid')r.paid+=Number(x.gross)||0}
 const clients={};for(const x of inv){const k=(x.client&&x.client.name)||'—';const r=clients[k]||(clients[k]={n:0,gross:0,open:0});r.n+=x.credit?0:1;r.gross+=Number(x.gross)||0;if(['open','overdue'].includes(st(x)))r.open+=Number(x.gross)||0}
 const unbilled=state.projects.filter(p=>!p.deleted&&!p.kind&&!p.fromInvoice&&(p.entries||[]).length&&!(T&&T.forProject(p.id).some(i=>!i.fullyCredited))).map(p=>{let t=null;try{t=projectTotals(p)}catch(e){}return {p,t}}).filter(x=>x.t&&x.t.net>0);
 const hrs=m=>Math.floor(m/60)+' h '+pad(m%60)+' min';
 target.innerHTML=`<div class="row top"><h2 style="margin:0">Kokkuvõte</h2><select id="sumYear" style="width:auto">${years.map(y=>`<option${y===sumYear?' selected':''}>${y}</option>`).join('')}</select></div>
 <div class="inv-total"><div><span class="help">Arveldatud ${sumYear} · ilma KM-ta</span><br><strong>${eur(net)}</strong></div><div><span class="help">Arveldatud kokku · koos KM-ga</span><br><strong>${eur(gross)}</strong></div><div><span class="help">Laekunud</span><br><strong>${eur(sumG(paid))}</strong></div></div>
 <div class="inv-total"><div><span class="help">Ootab laekumist (kõik aastad)</span><br><strong>${eur(sumG(open))}</strong></div><div><span class="help">Üle tähtaja</span><br><strong>${eur(sumG(late))}</strong>${late.length?`<br><span class="help">${late.length} arvet · saada meeldetuletus</span>`:''}</div><div><span class="help">Arveldamata töö</span><br><strong>${eur(unbilled.reduce((s,x)=>s+x.t.net,0))}</strong></div></div>
 <div class="section"><h2>Arveldamata töö</h2>${unbilled.length?`<div class="db-scroll"><table><thead><tr><th>Projekt</th><th>Tunnid</th><th>Summa ilma KM-ta</th><th></th></tr></thead><tbody>${unbilled.map(({p,t})=>`<tr><td>${escH(p.name)}${p.archived?' <span class="help">(lõpetatud)</span>':''}</td><td>${hrs(t.mins)}</td><td>${eur(t.net)}</td><td><button type="button" data-bill="${escH(p.id)}">Koosta arve</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="help">Kõik tehtud töö on arveldatud.</p>'}</div>
 <div class="section"><h2>Kuude kaupa</h2>${Object.keys(months).length?`<div class="db-scroll"><table><thead><tr><th>Kuu</th><th>Arveid</th><th>Ilma KM-ta</th><th>KM</th><th>Kokku</th><th>Laekunud</th></tr></thead><tbody>${Object.keys(months).sort().map(m=>{const r=months[m];return `<tr><td>${m.slice(5)}.${m.slice(0,4)}</td><td>${r.n}</td><td>${eur(r.net)}</td><td>${eur(r.vat)}</td><td>${eur(r.gross)}</td><td>${eur(r.paid)}</td></tr>`}).join('')}</tbody></table></div>`:`<p class="help">Aastal ${sumYear} pole veel arveid.</p>`}</div>
 <div class="section"><h2>Klientide kaupa</h2>${Object.keys(clients).length?`<div class="db-scroll"><table><thead><tr><th>Klient</th><th>Arveid</th><th>Kokku</th><th>Laekumata</th></tr></thead><tbody>${Object.entries(clients).sort((a,b)=>b[1].gross-a[1].gross).map(([k,r])=>`<tr><td>${escH(k)}</td><td>${r.n}</td><td>${eur(r.gross)}</td><td>${eur(r.open)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="help">Klientide kokkuvõte tekib pärast esimest arvet.</p>'}</div>
 <p class="help">Kokkuvõte on sinu enda ülevaateks. See ei ole raamatupidamine ega maksudeklaratsioon. Kreeditarved on summades miinusega sees. Maksud deklareerid sina või sinu raamatupidaja.</p>`;
 $d('sumYear').onchange=e=>{sumYear=e.target.value;renderSum(target)};
 target.querySelectorAll('[data-bill]').forEach(b=>b.onclick=()=>{const T=window.TraageldusInvoices;if(!T)return;T.fromProject(b.dataset.bill)})}

/* ---------- mälu ja piirid ---------- */
const kb=b=>b<1024*1024?Math.max(1,Math.round(b/1024))+' KB':(b/1024/1024).toFixed(2).replace('.',',')+' MB';
function purgeProject(id){const i=state.projects.findIndex(x=>x.id===id);if(i<0)return;const p=state.projects[i];
 state.projects[i]={id:p.id,name:'',deleted:true,purged:true,entries:[],expenses:[]};
 if(state.selected===id)state.selected=(state.projects.find(x=>!x.deleted&&!x.kind&&!x.archived)||{}).id||null;
 if(clockProject===id)clockProject=null;save();try{render()}catch(e){}}
window.daybillPurgeProject=purgeProject;
function storageHtml(){const u=window.daybillUsage?window.daybillUsage():{used:Math.round(JSON.stringify(state).length*1.6),cap:5*1024*1024};
 const pct=Math.min(100,u.used/u.cap*100),T=window.TraageldusInvoices,old=T&&T.purgeable?T.purgeable():[];
 const rows=state.projects.filter(p=>!p.deleted&&!p.kind).map(p=>({p,b:Math.round(JSON.stringify(p).length*1.6)})).sort((a,b)=>b.b-a.b);
 // Keskmine projekt + üks arve (~1,6 KB). Vähem kui 3 projekti: tavaline 5-päevane projekt ~2,4 KB.
 const avg=rows.length>=3?Math.round(rows.reduce((s,r)=>s+r.b,0)/rows.length)+1600:4000,left=Math.max(0,Math.floor((u.cap-u.used)/avg));
 return `<div class="db-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct.toFixed(0)}"><span style="width:${Math.max(1,pct).toFixed(1)}%"></span></div>
 <p><strong>${kb(u.used)}</strong> / 5 MB kasutatud (${pct<1?'alla 1':pct.toFixed(0)} %)</p>
 <p><strong>Ruumi jätkub veel umbes ${left.toLocaleString('et-EE')} projektile.</strong> <span class="help">${rows.length>=3?'Arvutatud sinu projektide keskmise suuruse järgi':'Arvutatud tavalise filmiprojekti suuruse järgi'} (${kb(avg)} projekt koos arvega).</span></p>
 ${pct>=90?`<div class="inv-warn"><strong>Ruum saab varsti täis.</strong> Kustuta allpool vanu lõpetatud projekte, siis jätkub sünkroonimine. Enne kustutamist tee varukoopia.</div>`:''}
 <div class="set-note"><strong>Kuidas see töötab</strong><br>
 Daybill on tasuta ja jääb tasuta. Sinult ei küsita kunagi raha ega maksekaarti.<br>
 Andmed salvestuvad alati selles seadmes. Kui logid sisse, salvestuvad need ka sinu kontole pilves (Google Firebase, Euroopa Liit), et näeksid neid telefonis ja arvutis. Sinu andmeid näed ainult sina.<br>
 Igal kontol on 5 MB ruumi. Üks projekt võtab tavaliselt 1–3 KB ja üks arve umbes 1 KB, nii et ruumi jätkub üle 1000 projekti ehk enamasti üle 10 aasta.<br>
 Kui ruum saab täis, töötab Daybill edasi, aga uusi muudatusi ei saadeta pilve enne, kui kustutad vanu projekte.<br>
 Kui tasuta teenuse päevane piir täitub (väga palju kasutajaid samal päeval), ootab sünkroonimine järgmise päevani. Andmed jäävad seadmesse alles ja midagi ei kao.<br>
 Arveid peab seaduse järgi hoidma 7 aastat, seepärast saab arveid kustutada alles pärast seda.</div>
 <h2 style="margin-top:26px">Projektid suuruse järgi</h2>
 ${rows.length?`<div class="db-scroll"><table><thead><tr><th>Projekt</th><th>Suurus</th><th></th></tr></thead><tbody>${rows.map(({p,b})=>`<tr><td>${escH(p.name)}${p.archived?' <span class="help">(lõpetatud)</span>':''}</td><td>${kb(b)}</td><td><button type="button" data-purge="${escH(p.id)}">Kustuta jäädavalt</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="help">Projekte veel pole.</p>'}
 <p class="help">Projekti kustutamine eemaldab selle tunnid kõigist sinu seadmetest ja pilvest. Selle projekti arved jäävad arhiivi alles. Enne kustutamist tee varukoopia, kui tahad tunde hiljem näha.</p>
 <h2 style="margin-top:26px">Vanad arved</h2>
 ${old.length?`<p>${old.length} arvet on vanemad kui seadusega nõutud 7 aastat.</p><div class="actions"><button type="button" id="purgeOld">Kustuta need ${old.length} arvet</button></div>`:'<p class="help">Kustutada lubatud arveid ei ole. Arve kustutamine saab võimalikuks 7 aastat pärast selle aasta lõppu, mil arve tehti.</p>'}
 <p class="help">Kustutatud arve number jääb registrisse alles, et sama numbrit ei antaks kunagi uuesti.</p>`}
function bindStorage(box){box.querySelectorAll('[data-purge]').forEach(b=>b.onclick=()=>{const p=state.projects.find(x=>x.id===b.dataset.purge);if(!p)return;
  if(!confirm(`Kustutan projekti „${p.name}” jäädavalt kõigist sinu seadmetest ja pilvest. Seda ei saa tagasi võtta. Arved jäävad alles.\n\nKui tahad enne varukoopiat, vajuta Tühista ja kasuta allpool „Varukoopia”.\n\nKas kustutan?`))return;
  purgeProject(p.id);renderSettings();$d('storageBox')&&$d('storageBox').scrollIntoView()});
 const po=$d('purgeOld');if(po)po.onclick=()=>{const T=window.TraageldusInvoices,old=T.purgeable();if(!old.length)return;
  if(!confirm(`Kustutan ${old.length} arvet, mis on vanemad kui 7 aastat (${old.map(x=>x.number).slice(0,8).join(', ')}${old.length>8?'…':''}). Seda ei saa tagasi võtta. Numbrid jäävad registrisse.\n\nKas kustutan?`))return;
  T.purge(old.map(x=>x.id));renderSettings()}}

/* ---------- seaded ---------- */
const FIELDS=[['name','Nimi või firma nimi','nt OÜ Valgus või Mari Maasikas'],['reg','Registrikood (FIE või firma)',''],['vatNo','KMKR number (kui oled KM-kohustuslane)',''],['street','Aadress','Tänav ja maja'],['city','Postiindeks ja linn','10111 Tallinn'],['country','Riik',''],['email','E-post',''],['phone','Telefon',''],['bank','Pank','nt Swedbank'],['iban','IBAN','EE..'],['approver','Arve koostaja nimi','Kirjutatakse arvele'],['vatNote','Lisamärge arvel (valikuline)','nt kassapõhine käibemaksuarvestus']];
/* ---------- arvepõhi: logo ja ettevõtte andmed (Arve → Arvepõhi) ---------- */
function renderTemplate(target){const S=window.DaybillSettings.get();
 target.innerHTML=`${window.DaybillSettings.ready()?'':`<div class="set-note"><strong>Alusta siit.</strong> Täida see üks kord. Need andmed tulevad igale arvele ise ja sa ei pea neid enam sisestama. Arve koostamisel saad kõike veel muuta.</div>`}
 <div class="section" style="padding-top:0"><h2>Logo</h2><div class="tpl-logo">${S.logo&&S.logo.data?`<img alt="Logo" src="data:image/jpeg;base64,${S.logo.data}">`:'<span class="help">Logo pole lisatud. Ilma logota kirjutatakse arve ülaossa sinu nimi.</span>'}</div>
 <div class="actions"><button type="button" id="tplLogoBtn">${S.logo?'Vaheta logo':'Lisa logo'}</button><input id="tplLogo" type="file" accept="image/png,image/jpeg,image/webp" hidden>${S.logo?'<button type="button" id="tplLogoDel">Eemalda logo</button>':''}</div><p class="help" id="tplLogoMsg">PNG või JPG. Logo vähendatakse automaatselt, et see võtaks vähe ruumi.</p></div>
 <form id="setForm" class="section"><h2>Sinu andmed arvel</h2><div class="grid">${FIELDS.map(([k,l,ph])=>`<div class="${['name','street','approver','vatNote'].includes(k)?'full':''}"><label for="set_${k}">${l}</label><input id="set_${k}" value="${escH(S[k]||'')}" placeholder="${escH(ph)}"></div>`).join('')}</div>
 <h2 style="margin-top:30px">Arve vaikeväärtused</h2><div class="grid">
  <div><label for="set_vatPayer">Käibemaks</label><select id="set_vatPayer"><option value="1"${S.vatPayer?' selected':''}>Olen KM-kohustuslane</option><option value="0"${S.vatPayer?'':' selected'}>Ei ole KM-kohustuslane</option></select></div>
  <div><label for="set_vat">KM määr · %</label><input id="set_vat" type="number" min="0" max="100" step="0.01" value="${escH(S.vat)}"></div>
  <div><label for="set_days">Makseaeg · päeva</label><input id="set_days" type="number" min="0" value="${escH(S.days)}"></div>
  <div><label for="set_numberFormat">Arve numbri kuju</label><select id="set_numberFormat"><option value="month"${S.numberFormat==='month'?' selected':''}>001/1026 · igal kuul algab 001</option><option value="year"${S.numberFormat==='year'?' selected':''}>2026-001 · igal aastal algab 001</option></select></div>
  <div><label for="set_firstSeq">Esimene number uues perioodis</label><input id="set_firstSeq" type="number" min="1" value="${escH(S.firstSeq)}"></div>
  <div><label for="set_lang">Arve vaikekeel</label><select id="set_lang"><option value="et"${S.lang==='et'?' selected':''}>Eesti</option><option value="en"${S.lang==='en'?' selected':''}>Inglise</option></select></div>
 </div><p class="help">„Esimene number” on mõeldud siis, kui oled varem arveid teinud mõne teise programmiga: näiteks 15 tähendab, et selle kuu esimene Daybilli arve on 015. Juba antud numbreid ei kasutata kunagi uuesti.</p>
 <div class="actions"><button class="primary">Salvesta</button></div><p class="help" id="setSaved" role="status"></p></form>
`;
 $d('tplLogoBtn').onclick=()=>$d('tplLogo').click();
 $d('tplLogo').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const logo=await shrinkLogo(f);window.DaybillSettings.save({logo});renderTemplate(target)}catch(x){$d('tplLogoMsg').textContent='Seda pilti ei saanud avada. Proovi PNG või JPG faili.'}};
 $d('tplLogoDel')&&($d('tplLogoDel').onclick=()=>{if(!confirm('Eemaldan logo arvepõhjast?'))return;window.DaybillSettings.save({logo:null});renderTemplate(target)});
 $d('setForm').onsubmit=e=>{e.preventDefault();const next={};for(const [k] of FIELDS)next[k]=$d('set_'+k).value.trim();next.vatPayer=$d('set_vatPayer').value==='1';next.vat=Number($d('set_vat').value)||0;next.days=Math.max(0,Number($d('set_days').value)||0);next.numberFormat=$d('set_numberFormat').value;next.firstSeq=Math.max(1,Math.floor(Number($d('set_firstSeq').value)||1));next.lang=$d('set_lang').value;
  if(next.iban&&!/^[A-Z]{2}\d{2}[A-Z0-9 ]{8,30}$/i.test(next.iban)){$d('setSaved').textContent='IBAN tundub vale. Kontrolli: EE ja 18 numbrit.';return}
  window.DaybillSettings.save(next);$d('setSaved').textContent='Salvestatud.';};
}
// Logo: max 600×200 px JPEG valgel taustal (PDF-i jaoks), tavaliselt 10–40 KB.
function shrinkLogo(file){return new Promise((ok,bad)=>{const url=URL.createObjectURL(file),im=new Image();im.onload=()=>{try{const sc=Math.min(1,600/im.width,200/im.height),w=Math.max(1,Math.round(im.width*sc)),h=Math.max(1,Math.round(im.height*sc)),cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(im,0,0,w,h);URL.revokeObjectURL(url);ok({data:cv.toDataURL('image/jpeg',0.88).split(',')[1],w,h})}catch(e){bad(e)}};im.onerror=bad;im.src=url})}
window.daybillInvExtra=(tab,el)=>{if(!el)return;if(tab==='sum')renderSum(el);else renderTemplate(el)};

function renderSettings(){const lang=(window.HoursI18n&&window.HoursI18n.lang)||'et';
 setView.innerHTML=`<div class="row top"><h1>Seaded</h1></div>
 
 <div class="section"><h2>Keel</h2><div class="actions"><button type="button" data-lang="et" class="${lang==='et'?'primary':''}">Eesti</button><button type="button" data-lang="en" class="${lang==='en'?'primary':''}">English</button></div></div>
 <div class="section"><h2>Välimus</h2><div class="actions">${[['dark','Tume'],['light','Hele']].map(([k,l])=>`<button type="button" data-theme-set="${k}" class="${theme()===k?'primary':''}">${l}</button>`).join('')}</div><p class="help">Vaikimisi on Daybill tume. Valik jääb selles seadmes meelde.</p></div>
 <div class="section"><h2>Sünkroonimine telefoni ja arvuti vahel</h2><div id="syncBox"></div></div>
 <div class="section" id="storageBox"><h2>Mälu ja piirid</h2>${storageHtml()}</div>
 <div class="section" id="backupBox"><h2>Varukoopia</h2></div>
 <div class="section"><h2>Paigalda rakendusena</h2><p class="help">iPhone: ava see leht Safaris → Jaga → „Lisa avakuvale”. Mac: Safari → Fail → „Lisa Docki”. Android ja Chrome: menüü → „Installi rakendus”. Daybill töötab ka ilma internetita; muudatused jõuavad teise seadmesse, kui ühendus tuleb tagasi.</p></div>
 <p class="help">Daybill · tasuta tööaja ja arvete rakendus filmitegijatele.</p>`;
 if(backup){$d('backupBox').append(backup);backup.open=true;backup.style.margin='0'}
 setView.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{try{window.HoursI18n&&window.HoursI18n.set(b.dataset.lang)}catch(e){}try{localStorage.setItem('hoursLang',b.dataset.lang)}catch(e){}renderSettings()});
 setView.querySelectorAll('[data-theme-set]').forEach(b=>b.onclick=()=>{setTheme(b.dataset.themeSet);renderSettings()});
 bindStorage($d('storageBox'));
 try{window.daybillRenderSync&&window.daybillRenderSync($d('syncBox'))}catch(e){}
 if(!$d('syncBox').innerHTML)$d('syncBox').innerHTML='<p class="help">Praegu on andmed ainult selles seadmes. Sünkroonimine ei käivitunud: kontrolli internetiühendust ja ava Daybill uuesti.</p>'}


/* ---------- eelvaate PDF: salvesta või saada e-postiga ---------- */
let pdfMode='save';
function mailText(proj){const en=proj.reportLang!=='et';let t=null;try{t=projectTotals(proj)}catch(e){}const S=window.DaybillSettings.get(),who=proj.worker||S.approver||S.name||'';
 const days=(proj.entries||[]).map(e=>e.date).sort(),per=days.length?(days[0]===days[days.length-1]?dmyS(days[0]):dmyS(days[0])+' – '+dmyS(days[days.length-1])):'';
 const m=n=>(Math.round((Number(n)||0)*100)/100).toLocaleString(en?'en-GB':'et-EE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
 return en?{subject:`${proj.name} · work summary`,body:`Hello,\n\nplease find attached my work summary for ${proj.name}${per?' ('+per+')':''}.\n${t?`Total excl. VAT: ${m(t.net)}\nVAT: ${m(t.vat)}\nTotal: ${m(t.gross)}\n`:''}\nIf everything is correct, please confirm and I will send the invoice.\n\nBest regards,\n${who}${S.phone?'\n'+S.phone:''}`}
  :{subject:`${proj.name} · tööaja ülevaade`,body:`Tere!\n\nSaadan manuses projekti ${proj.name}${per?' ('+per+')':''} tööaja ülevaate.\n${t?`Summa ilma KM-ta: ${m(t.net)}\nKM: ${m(t.vat)}\nKokku: ${m(t.gross)}\n`:''}\nKui kõik on korras, palun kinnita ja saadan arve.\n\nParimate soovidega\n${who}${S.phone?'\n'+S.phone:''}`}}
function dmyS(d){const [y,m,dd]=String(d).split('-');return dd+'.'+m+'.'+y}
async function pdfOut(bytes,name){const mode=pdfMode;pdfMode='save';const blob=new Blob([bytes],{type:'application/pdf'});let proj=null;try{proj=p()}catch(e){}
 const file=typeof File==='function'?new File([blob],name,{type:'application/pdf'}):null,txt=proj?mailText(proj):{subject:name,body:''};
 // Telefonis ja Macis avab jagamine Maili (PDF manuses) või „Salvesta failidesse”.
 if(file&&navigator.canShare&&navigator.canShare({files:[file]})&&(mode==='email'||phone())){try{await navigator.share({files:[file],title:txt.subject,text:mode==='email'?txt.body:undefined});return}catch(e){if(e&&e.name==='AbortError')return}}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
 if(mode==='email'){setTimeout(()=>{location.href='mailto:?subject='+encodeURIComponent(txt.subject)+'&body='+encodeURIComponent(txt.body+'\n\n'+(window.HoursI18n&&window.HoursI18n.lang==='en'?'(PDF: '+name+' — attach it from Downloads)':'(PDF: '+name+' — lisa see manusena allalaadimiste kaustast)'))},400)}}
window.daybillPdfOut=(bytes,name)=>{pdfOut(bytes,name)};
$d('pdfMail')&&($d('pdfMail').onclick=()=>{pdfMode='email';$d('pdf').click();setTimeout(()=>{pdfMode='save'},0)});


/* ---------- paigaldamine avakuvale ---------- */
// Android/Chrome: brauseri oma „Installi” aken. iPhone: Apple ei luba automaatset paigaldust, seega juhis (Jaga → Lisa avakuvale).
const SHARE_ICON='<svg class="db-share" viewBox="0 0 14 16" aria-label="Jaga"><path d="M7 1v9M3.5 4.5 7 1l3.5 3.5M2 7H1v8h12V7h-1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
let installEvt=null,installBar=null;
const T_=(et,...v)=>window._t?window._t(et,...v):et.replace(/\{(\d+)\}/g,(m,n)=>v[n]);
const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const iosSafari=ios&&!/CriOS|FxiOS|EdgiOS|GSA\//.test(navigator.userAgent);
const macSafari=!ios&&/Macintosh/.test(navigator.userAgent)&&/Safari/.test(navigator.userAgent)&&!/Chrome|Chromium|Edg\//.test(navigator.userAgent);
function installDismissed(){try{return Date.now()-Number(localStorage.getItem('daybill.installHidden')||0)<7*864e5}catch(e){return false}}
function showInstall(html,withBtn){if(standalone||installDismissed())return;installBar&&installBar.remove();installBar=document.createElement('div');installBar.className='db-install';
 installBar.innerHTML=`<div class="db-install-in"><img src="icons/apple-touch-icon.png" alt=""><p>${html}</p>${withBtn?'<button type="button" class="primary" id="dbInstallGo">Paigalda</button>':''}<button type="button" id="dbInstallX" aria-label="Sulge">✕</button></div>`;
 bar.after(installBar);
 $d('dbInstallX').onclick=()=>{try{localStorage.setItem('daybill.installHidden',String(Date.now()))}catch(e){}installBar.remove()};
 $d('dbInstallGo')&&($d('dbInstallGo').onclick=async()=>{if(!installEvt)return;installEvt.prompt();try{await installEvt.userChoice}catch(e){}installEvt=null;installBar.remove()})}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;showInstall('Paigalda Daybill rakendusena: üks vajutus ja ikoon tekib avakuvale.',true)});
window.addEventListener('appinstalled',()=>{installBar&&installBar.remove()});
if(iosSafari)showInstall(T_('Lisa Daybill oma avakuvale: vajuta all Jaga {0} ja siis „Lisa avakuvale”.',SHARE_ICON));
else if(ios)showInstall(T_('Lisa Daybill oma avakuvale: ava see link Safaris, vajuta Jaga {0} ja siis „Lisa avakuvale”.',SHARE_ICON));
else if(macSafari)showInstall('Lisa Daybill Docki: Safari menüü Fail → „Lisa Docki”.');

/* ---------- hele / tume ---------- */
// Kaks valikut: tume (vaikimisi) ja hele.
function theme(){try{return localStorage.getItem('daybill.theme')==='light'?'light':'dark'}catch(e){return 'dark'}}
function setTheme(t){t=t==='light'?'light':'dark';try{localStorage.setItem('daybill.theme',t)}catch(e){}document.documentElement.dataset.theme=t;const m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='light'?'#ffffff':'#121212';markTheme()}
const themeBtn=document.createElement('div');themeBtn.id='themeSwitch';themeBtn.setAttribute('role','group');themeBtn.setAttribute('aria-label','Välimus');
themeBtn.innerHTML='<button type="button" data-t="light">Hele</button><button type="button" data-t="dark">Tume</button>';
function markTheme(){const t=theme();themeBtn.querySelectorAll('button').forEach(b=>{b.classList.toggle('primary',b.dataset.t===t);b.setAttribute('aria-pressed',b.dataset.t===t)})}
themeBtn.querySelectorAll('button').forEach(b=>b.onclick=()=>{setTheme(b.dataset.t);if(view==='settings')renderSettings()});
bar.querySelector('.db-bar-in').insertBefore(themeBtn,bar.querySelector('.db-gear'));markTheme();

/* ---------- käivitus ---------- */
// EN/ET valik rakenduse ribal.
const moveLang=()=>{const l=$d('langSwitch');if(l)bar.querySelector('.db-bar-in').insertBefore(l,bar.querySelector('.db-gear'))};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',moveLang);else moveLang();
window.addEventListener('hourslangchange',()=>{try{if(view==='clock')renderClock();if(view==='settings')renderSettings();if(view==='inv')window.TraageldusInvoices.render()}catch(e){}});
// Hoursi kliendi PDF ja kirjeldused: brändi nimi.
document.title='Daybill';
// Esimene vaade: telefonis kell, arvutis projektid.
let first='clock';try{first=localStorage.getItem(VIEW_KEY)||'clock'}catch(e){}
show(first);
// Esimene avamine: lühike juhend samm-sammult. Uus kasutaja vastab neljale küsimusele ja Daybill seab kõik ise valmis.
const WELCOME='daybill.welcome.v1';let seen=false;try{seen=!!localStorage.getItem(WELCOME)}catch(e){}
const hasProjects=()=>state.projects.some(x=>!x.deleted&&!x.kind);
function startWizard(){const w=document.createElement('div');w.className='db-welcome db-wiz';w.setAttribute('role','dialog');w.setAttribute('aria-label','Alustamine');document.body.append(w);
 const ans={name:'',job:'',rate:'',project:''};let step=0;
 const lang=()=>(window.HoursI18n&&window.HoursI18n.lang)||'et';
 const dots=n=>`<div class="wiz-dots" aria-hidden="true">${[1,2,3,4].map(i=>`<span class="${i<=n?'on':''}"></span>`).join('')}</div>`;
 const close=()=>{setFlag(WELCOME,'1');w.remove()};
 const steps=[
  ()=>`<h2 translate="no">Daybill</h2><p class="wiz-big" translate="no">Vali keel · Choose language</p><div class="wiz-choice" translate="no"><button type="button" data-lang="et">Eesti</button><button type="button" data-lang="en">English</button></div>`,
  ()=>`<h2>Tere!</h2><p class="wiz-big">Daybill paneb kirja sinu tööpäevad ja teeb neist arve.</p><p>Seadistamine võtab umbes minuti. Daybill on tasuta ja jääb tasuta.</p><div class="wiz-actions"><button type="button" class="primary wiz-go">Alustame</button><button type="button" class="wiz-have">Mul on juba konto</button></div>`,
  ()=>`${dots(1)}<h2>Mis su nimi on?</h2><p>See läheb tunnilehele ja arvele.</p><input class="wiz-in" id="wizIn" autocomplete="name" maxlength="120" placeholder="Ees- ja perekonnanimi" value="${escH(ans.name)}"><div class="wiz-actions"><button type="button" class="primary wiz-go">Edasi</button></div>`,
  ()=>`${dots(2)}<h2>Mis tööd sa teed?</h2><p>Vali üks või kirjuta ise.</p><div class="wiz-chips">${['Gaffer','Best boy','Valgustaja','Grip','Operaator','Kunstnik'].map(j=>`<button type="button" data-job="${j}">${j}</button>`).join('')}</div><input class="wiz-in" id="wizIn" maxlength="80" placeholder="Amet" value="${escH(ans.job)}"><div class="wiz-actions"><button type="button" class="primary wiz-go">Edasi</button></div>`,
  ()=>`${dots(3)}<h2>Kui palju sa tunnis küsid?</h2><p>Summa ilma käibemaksuta. Ületunnid arvutab Daybill ise ja hinda saad hiljem alati muuta.</p><div class="wiz-rate"><input class="wiz-in" id="wizIn" type="text" inputmode="decimal" autocomplete="off" placeholder="30" value="${escH(ans.rate)}"><span>€ / h</span></div><div class="wiz-actions"><button type="button" class="primary wiz-go">Edasi</button></div>`,
  ()=>`${dots(4)}<h2>Mis projektiga alustad?</h2><p>Näiteks filmi, reklaami või kliendi nimi.</p><input class="wiz-in" id="wizIn" maxlength="120" placeholder="nt Reklaam Sõida Kainelt" value="${escH(ans.project)}"><div class="wiz-actions"><button type="button" class="primary wiz-go">Valmis</button></div>`];
 const keys=[null,null,'name','job','rate','project'];
 function draw(){w.innerHTML=`<div class="db-welcome-in">${steps[step]()}<p class="error" id="wizErr" role="alert"></p>${step>1?'<button type="button" class="wiz-back">← Tagasi</button>':''}</div>`;
  const inp=w.querySelector('#wizIn');if(inp){setTimeout(()=>inp.focus(),30);inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();next()}}}
  w.querySelectorAll('[data-lang]').forEach(b=>{b.classList.toggle('primary',b.dataset.lang===lang());b.onclick=()=>{try{window.HoursI18n.set(b.dataset.lang)}catch(e){}step=1;draw()}});
  w.querySelectorAll('[data-job]').forEach(b=>b.onclick=()=>{inp.value=b.textContent;next()});
  const go=w.querySelector('.wiz-go');go&&(go.onclick=next);
  const have=w.querySelector('.wiz-have');have&&(have.onclick=()=>{close();show('settings');setTimeout(()=>{const e=$d('syEmail');e&&(e.scrollIntoView({block:'center'}),e.focus())},80)});
  const back=w.querySelector('.wiz-back');back&&(back.onclick=()=>{if(inp)ans[keys[step]]=inp.value.trim();step--;draw()})}
 function next(){const k=keys[step];if(!k){step++;draw();return}
  const inp=w.querySelector('#wizIn'),v=inp.value.trim(),err=w.querySelector('#wizErr');
  if(!v){err.textContent=k==='rate'?'Kirjuta oma tunnihind, näiteks 30.':'Palun täida see lahter.';inp.focus();return}
  if(k==='rate'){const n=Number(v.replace(',','.'));if(!(n>0)||n>10000){err.textContent='Kirjuta tunnihind numbrina, näiteks 30.';inp.focus();return}ans.rate=String(n)}else ans[k]=v;
  if(step<steps.length-1){step++;draw();return}
  finish()}
 function finish(){const n=project(ans.project);n.worker=ans.name;n.job=ans.job;n.rate=Number(ans.rate);n.reportLang=lang();
  state.projects.push(n);state.selected=n.id;clockProject=n.id;setFlag('daybill.clockProject',n.id);save();
  setFlag(TOUR,'call');close();show('clock')}
 draw()}
if(!seen){if(hasProjects())setFlag(WELCOME,'1');else startWizard()}
// Juhend kella vaates: üks lause korraga, kuni esimene päev on tehtud.
function tourTip(p){let t='';try{t=localStorage.getItem(TOUR)||''}catch(e){}if(!t||!p)return '';
 const msg=p.clock?['Kell käib.','Kui päev on läbi, vajuta „Wrap”. Telefoni võid vahepeal ära panna, kell käib edasi. Lõunapausi ajaks vajuta „Paus”.']
  :lastWrap&&lastWrap.pid===p.id?['Esimene päev on kirjas!','Vajuta „Tee arve eelvaade”. Seal näed tunde ja summat ning saad need produtsendile saata. Arve teed hiljem nupust „Arve”.']
  :['Kõik on valmis.','Kui töö algab, vajuta „Call”. Daybill hakkab aega lugema.'];
 return `<div class="ck-tip" role="status"><strong>${msg[0]}</strong><br><span>${msg[1]}</span><button type="button" class="ck-tip-x" id="ckTipX" aria-label="Peida juhend">Peida juhend</button></div>`}
// Teised aknad/sünk: kui andmed muutuvad, joonista kell uuesti.
window.addEventListener('storage',e=>{if(e.key==='daybill.v1'){try{const s=JSON.parse(e.newValue);if(s&&Array.isArray(s.projects)){state.projects=s.projects;render();if(view==='clock')renderClock()}}catch(x){}}});
window.daybillRefresh=()=>{try{render()}catch(e){}if(view==='clock')renderClock();if(view==='inv')try{window.TraageldusInvoices.render()}catch(e){}running()};
// Kes on praegu tööl (telefoni kellast): näha ka arvutis projektide all.
const run=document.createElement('p');run.className='help';run.id='dbRunning';$d('cloudStatus')&&$d('cloudStatus').after(run);
function running(){const on=state.projects.filter(x=>!x.deleted&&x.clock);run.innerHTML=on.map(x=>`<strong>Tööl praegu:</strong> ${escH(x.name)} · alates ${hm(new Date(x.clock.start))}${x.clock.pausedAt?' (paus)':''} · ${fmt(elapsed(x.clock)).slice(0,5)} h`).join('<br>')}
running();setInterval(running,30000);
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
