/* Daybill · navigatsioon nagu Hoursi iPhone'i rakenduses:
   projektide nimekiri → projekt (Alusta tööd, Lisa tänane tööpäev, Lisa tunnid käsitsi, kokkuvõte, päevad) → Muuda.
   Andmete sisestus jääb samaks: samad vormid (tööpäev, projekti valikud, lisakulud) avanevad lehena alt üles. */
'use strict';
(function(){
if(!window.DB)return;
const DB=window.DB,$=id=>document.getElementById(id),pad=n=>String(n).padStart(2,'0');
const escH=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=()=>(window.HoursI18n&&window.HoursI18n.lang)||'et';
const hmm=m=>{m=Math.max(0,Math.round(Number(m)||0));return Math.floor(m/60)+':'+pad(m%60)+' h'};
const SCREEN='daybill.screen';
document.documentElement.classList.add('ios');

/* ---------- vaated ---------- */
const main=document.querySelector('main');
const home=document.createElement('section');home.id='ipHome';home.className='ip-view';
const proj=document.createElement('section');proj.id='ipProj';proj.className='ip-view hidden';
main.prepend(proj);main.prepend(home);
const ICON={
 back:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
 plus:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
 chev:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
 list:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
 inv:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h7M9 16h7"/></svg>',
 hist:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
 gear:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'};

/* ---------- alumine menüü ---------- */
const tabs=document.createElement('nav');tabs.className='ip-tabs';tabs.setAttribute('aria-label','Menüü');
tabs.innerHTML=`<button type="button" data-nav="home">${ICON.list}<span>Projektid</span></button><button type="button" data-nav="inv">${ICON.inv}<span>Arved</span></button><button type="button" data-nav="history">${ICON.hist}<span>Ajalugu</span></button><button type="button" data-nav="settings">${ICON.gear}<span>Seaded</span><i class="ip-dot" aria-hidden="true"></i></button>`;
document.body.append(tabs);
let screen='home',pid=null,tab='home';
try{const s=JSON.parse(localStorage.getItem(SCREEN)||'{}');if(s.s==='proj'&&s.pid){screen='proj';pid=s.pid}}catch(e){}
function remember(){try{localStorage.setItem(SCREEN,JSON.stringify({s:screen,pid}))}catch(e){}}
function markTab(t){tab=t;tabs.querySelectorAll('[data-nav]').forEach(b=>{const on=b.dataset.nav===t;b.classList.toggle('on',on);b.toggleAttribute('aria-current',on)})}
tabs.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{const t=b.dataset.nav;if(t==='home'){if(tab==='home'&&screen==='proj'){screen='home';remember()}window.daybillShow('home')}else window.daybillShow(t)});
// Teised vaated (Arved, Ajalugu, Seaded) peidavad projektide vaated.
window.daybillLeave=v=>{home.classList.add('hidden');proj.classList.add('hidden');stopTick();markTab(v==='sum'?'inv':v)};
window.daybillHome=()=>{markTab('home');draw()};
window.daybillIosRefresh=()=>{if(tab==='home')draw()};
window.addEventListener('hourslangchange',()=>{if(tab==='home')draw()});

/* ---------- andmed ---------- */
const all=()=>state.projects.filter(x=>!x.deleted&&!x.kind);
const byId=id=>all().find(x=>x.id===id);
function order(list){try{return listOrder(list)}catch(e){return list}}
function rowsOf(p){try{return calculate(p,p.entries||[])}catch(e){return []}}
function totalsOf(p,rows){try{return projectTotals(p,rows)}catch(e){return null}}
function ioOf(p){try{return invoiceOnly(p)}catch(e){return null}}
function daysOf(p,io){try{return workDays(p,io)}catch(e){return new Set((p.entries||[]).map(e=>e.date)).size}}
const daysLabel=n=>n===1?'1 päev':n+' päeva';
function invLabel(p){try{return invoicedLabel(p)}catch(e){return ''}}
function focus(p){state.selected=p.id;try{archiveView=!!p.archived;projectExpanded=true;setStage('hours')}catch(e){}try{render()}catch(e){}}
function longDay(iso){const d=new Date(iso+'T12:00:00Z'),L=lang()==='en'?'en-GB':'et-EE';const wd=new Intl.DateTimeFormat(L,{weekday:'long',timeZone:'UTC'}).format(d),dm=new Intl.DateTimeFormat(L,{day:'numeric',month:'long',timeZone:'UTC'}).format(d);return [wd.charAt(0).toUpperCase()+wd.slice(1),dm]}
function lastStart(p){const e=[...(p.entries||[])].filter(x=>x.start).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).pop();return e?e.start:'08:00'}
function dayHours(p){try{const R=rulesOf(p);if(R)return R.day;if(dayMode(p))return Number(p.dayHours)}catch(e){}return 12}

/* ---------- avaleht: projektide nimekiri ---------- */
let showDone=false;
function rowHtml(p){const rows=rowsOf(p),t=totalsOf(p,rows),io=ioOf(p),n=daysOf(p,io),gross=io?io.gross:t?t.gross:0;
 const meta=[daysLabel(n),t&&t.mins?hmm(t.mins):'tunnid teadmata',money(gross)].join(' · '),inv=invLabel(p);
 return `<button type="button" class="ip-row" data-open="${escH(p.id)}"><span class="ip-row-t"><strong>${escH(p.name||'Nimetu projekt')}</strong><span class="ip-sub">${escH(meta)}</span>${inv?`<span class="ip-sub ip-small">${escH(inv)}</span>`:''}</span>${p.clock?'<span class="ip-tag">TÖÖL</span>':''}<span class="ip-chev">${ICON.chev}</span></button>`}
function drawHome(){stopTick();
 const list=order(all().filter(x=>!x.archived)),done=order(all().filter(x=>x.archived)),run=all().filter(x=>x.clock);
 const L=lang();
 home.innerHTML=`<div class="ip-top"><div class="ip-seg" role="group" aria-label="Keel"><button type="button" data-lang="en" class="${L==='en'?'on':''}">EN</button><button type="button" data-lang="et" class="${L==='et'?'on':''}">ET</button></div><button type="button" class="ip-round" id="ipNew" aria-label="Lisa projekt">${ICON.plus}</button></div>
 <h1 class="ip-big">Daybill</h1>
 ${run.map(p=>`<button type="button" class="ip-card ip-runrow" data-open="${escH(p.id)}"><span><strong>${escH(p.name)}</strong><span class="ip-sub">${p.clock.pausedAt?'Paus':'Tööl alates '+DB.hm(new Date(p.clock.start))}</span></span><span class="ip-runtime" data-run="${escH(p.id)}">${DB.fmt(DB.elapsed(p.clock))}</span></button>`).join('')}
 <div class="ip-cap">Projektid</div>
 <div class="ip-list">${list.length?list.map(rowHtml).join(''):'<p class="ip-empty">Lisa esimene projekt nupuga +.</p>'}</div>
 ${done.length?`<details class="ip-done"${showDone?' open':''}><summary>Lõpetatud projektid (${done.length})</summary><div class="ip-list">${done.map(rowHtml).join('')}</div></details>`:''}
 <div class="ip-foot" id="ipFoot"></div>`;
 home.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openProject(b.dataset.open));
 home.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{const H=window.HoursI18n;if(H&&H.lang!==b.dataset.lang)H.set(b.dataset.lang);draw()});
 $('ipNew').onclick=newSheet;
 const d=home.querySelector('.ip-done');d&&(d.ontoggle=()=>{showDone=d.open});
 foot();if(run.length)startTick()}
function foot(){const f=$('ipFoot');if(!f)return;const st=document.documentElement.dataset.sync||'wait',txt=($('dbSync')||{}).textContent||'';
 f.innerHTML=`<span class="ip-led" data-s="${escH(st)}"></span><span>${escH(txt||(st==='off'?'Andmed on selles seadmes · logi seadetes sisse, et sünkida':'Ühendan…'))}</span>`;
 tabs.querySelector('.ip-dot').dataset.s=st}
{const s=$('dbSync');if(s)new MutationObserver(foot).observe(s,{childList:true,characterData:true,subtree:true});new MutationObserver(foot).observe(document.documentElement,{attributes:true,attributeFilter:['data-sync']})}

/* ---------- projekti leht ---------- */
function openProject(id){const p=byId(id);if(!p)return;pid=id;screen='proj';remember();DB.setClock(id);focus(p);draw();window.scrollTo(0,0)}
function draw(){if(tab!=='home')return;const p=screen==='proj'&&byId(pid);
 home.classList.toggle('hidden',!!p);proj.classList.toggle('hidden',!p);
 if(p)drawProject(p);else{screen='home';drawHome()}}
function runHtml(p){const c=p.clock;let live='';try{const now=new Date(),st=new Date(c.start),pause=(c.pauseSeconds||0)+(c.pausedAt?Math.round((now-Date.parse(c.pausedAt))/1000):0);
  const r=calculate(p,[{id:'live',date:DB.ymd(st),endDate:DB.ymd(now),start:DB.hm(st),end:DB.hm(now),breaks:Math.round(pause/60)||0,job:p.job,rate:p.rate}])[0];if(r&&!isFixed(p))live='· '+money(r.net)+' ilma KM-ta'}catch(e){}
 return `<div class="ip-run"><div class="ip-clock" id="ipTime">${DB.fmt(DB.elapsed(c))}</div><div class="ip-sub"><span>${c.pausedAt?'Paus alates '+DB.hm(new Date(c.pausedAt)):'Alates '+DB.hm(new Date(c.start))}</span> ${live?`<span>${escH(live)}</span>`:''}</div>
 <div class="ip-two"><button type="button" class="ip-btn" id="ipPause">${c.pausedAt?'Jätka':'Paus'}</button><button type="button" class="ip-btn ip-fill" id="ipStop">Lõpeta töö</button></div>
 <button type="button" class="ip-link" id="ipStart">Muuda algusaega</button>
 <label class="ip-com"><span>Kommentaar (valikuline)</span><input id="ipComment" maxlength="500" value="${escH(c.comment||'')}" placeholder="nt kolimine, lisatöö"></label></div>`}
function drawProject(p){stopTick();
 const rows=rowsOf(p),t=totalsOf(p,rows),io=ioOf(p),n=daysOf(p,io),fixed=(()=>{try{return isFixed(p)}catch(e){return false}})();
 const vatL='KM '+String(Number(p.vat)||0).replace('.',',')+' %';
 const sum=io?[['Päevi',n],['Tööaeg','teadmata'],['Ilma KM-ta · arvelt',money(io.net)],['KM',money(io.vat)],['Kokku',money(io.gross),1]]
  :[['Päevi',n],['Tööaeg',hmm(t?t.mins:0)]].concat(fixed&&t?[['Fikseeritud hind',money(t.hours)]]:[]).concat(!fixed&&t&&t.extras>0?[['sh lisatasud ja trahvid',money(t.extras)]]:[]).concat([[t&&t.costs>0?'Ilma KM-ta · sh kulud '+money(t.costs):'Ilma KM-ta',money(t?t.net:0)],[vatL,money(t?t.vat:0)],['Kokku',money(t?t.gross:0),1]]);
 const groups={};for(const r of rows)(groups[r.date]??=[]).push(r);
 const days=Object.keys(groups).sort().reverse();
 const lw=DB.lastWrap&&DB.lastWrap();
 let R=null;try{R=rulesOf(p)}catch(e){}
 proj.innerHTML=`<div class="ip-nav"><button type="button" class="ip-round" id="ipBack" aria-label="Kõik projektid">${ICON.back}</button><div class="ip-title">${escH(p.name||'Nimetu projekt')}</div><button type="button" class="ip-pill" id="ipEdit">Muuda</button></div>
 ${lw&&lw.pid===p.id&&!p.clock?`<div class="ip-note" role="status"><strong>✓ Päev salvestatud</strong><span>${escH(lw.text)}</span></div>`:''}
 ${p.job?'':`<div class="ip-note ip-warn" role="status"><strong>Lisa oma amet ja hind.</strong><span>Vajuta „Muuda”. Siis saad tööd alustada.</span></div>`}
 <div class="ip-card ip-acts">${p.clock?runHtml(p):`<button type="button" class="ip-btn ip-fill" id="ipCall">Alusta tööd</button><button type="button" class="ip-btn" id="ipToday">Lisa tänane tööpäev</button><button type="button" class="ip-btn" id="ipManual">Lisa tehtud tunnid käsitsi</button>`}</div>
 <div class="ip-card ip-sum">${sum.map(([k,v,b])=>`<div class="ip-li${b?' ip-b':''}"><span>${escH(k)}</span><span>${escH(v)}</span></div>`).join('')}</div>
 ${io?'<p class="ip-foot2">See projekt on tehtud otse arvel, tunde pole sisestatud. Tunde võid soovi korral lisada.</p>':''}
 ${R&&!fixed&&!io?`<p class="ip-foot2">Tööreeglid: ${escH(R.set==='film'?'Film':R.set==='commercial'?'Reklaam':'Oma valik')}, võttepäev ${escH(String(R.day))} h, päevatasu ${escH(money((Number(p.rate)||0)*R.day))}.</p>`:''}
 ${(p.entries||[]).length||(p.expenses||[]).length?`<div class="ip-card ip-acts"><button type="button" class="ip-btn ip-fill" id="ipPdf">Tööaja ja kulude ülevaade (PDF)</button><button type="button" class="ip-btn" id="ipSend">Saada produtsendile</button></div>`:''}
 ${days.map(d=>{const g=groups[d],mins=g.reduce((s,r)=>s+(r.mins||0),0),net=g.reduce((s,r)=>s+(r.net||0),0),[wd,dm]=longDay(d);
  return `<div class="ip-dayh"><span>${escH(wd)}<br>${escH(dm)}</span><span>${escH(fixed?hmm(mins):hmm(mins)+' · '+money(net))}</span></div><div class="ip-card">${g.map(r=>entryHtml(r,p,fixed)).join('')}</div>`}).join('')}
 <div class="ip-cap ip-cap2">Lisakulud ja muud read</div>
 <div class="ip-card">${(()=>{let cs=[];try{cs=costRows(p)}catch(e){}return cs.map(c=>`<button type="button" class="ip-entry" data-ic="${escH(c.id)}"><span class="ip-row-t"><span>${escH(c.desc)}</span><span class="ip-sub">${escH([c.date?longDay(c.date)[1]:'',Number(c.qty)!==1?String(c.qty).replace('.',',')+' × '+money(c.price):''].filter(Boolean).join(' · '))}</span></span><span class="ip-num">${money(c.total)}</span></button>`).join('')})()}<button type="button" class="ip-entry ip-add" id="ipCost">Lisa rida</button></div>
 <p class="ip-foot2">Nt kaamera rent või sõit. Summad on ilma käibemaksuta; käibemaks lisandub projekti määraga.</p>
 <div class="ip-card"><button type="button" class="ip-entry ip-add" id="ipManual2">Lisa tunnid käsitsi</button><button type="button" class="ip-entry ip-add" id="ipPrep">Prep või muu päev kindla summaga</button></div>`;
 $('ipBack').onclick=()=>{screen='home';remember();DB.clearWrap();draw();window.scrollTo(0,0)};
 $('ipEdit').onclick=()=>editSheet(p);
 const on=(id,f)=>{const b=$(id);if(b)b.onclick=f};
 on('ipCall',()=>startWork(p));on('ipToday',()=>entrySheet(p,'today'));on('ipManual',()=>entrySheet(p,'new'));on('ipManual2',()=>entrySheet(p,'new'));
 on('ipPrep',()=>{focus(p);DB.dayDialog(p)});on('ipCost',()=>costSheet(p,null));
 on('ipPdf',()=>{focus(p);const b=$('pdf');b&&b.click()});on('ipSend',()=>{focus(p);const b=$('pdfMail');b&&b.click()});
 on('ipPause',()=>{const c=p.clock;if(c.pausedAt){c.pauseSeconds=(c.pauseSeconds||0)+Math.round((Date.now()-Date.parse(c.pausedAt))/1000);delete c.pausedAt}else c.pausedAt=new Date().toISOString();save();draw()});
 on('ipStop',()=>stopSheet(p));on('ipStart',()=>startTimeSheet(p));
 const cm=$('ipComment');if(cm)cm.oninput=e=>{p.clock.comment=e.target.value;save()};
 proj.querySelectorAll('[data-ie]').forEach(b=>b.onclick=()=>entrySheet(p,'edit',b.dataset.ie));
 proj.querySelectorAll('[data-ic]').forEach(b=>b.onclick=()=>costSheet(p,b.dataset.ic));
 if(p.clock)startTick()}
function entryHtml(r,p,fixed){const ex=r.extras||[];let type='';try{type=r.type&&DAY_TYPES[r.dayType]?DAY_TYPES[r.dayType][lang()==='en'?'en':'et']:''}catch(e){}
 const sub=[r.job,type,r.breaks&&!r.type?'paus '+r.breaks+' min':'',r.lunch?'lõuna '+r.lunch:r.noLunch?'lõunat ei olnud':'',r.endDate&&r.endDate!==r.date&&r.start?'lõpeb '+longDay(r.endDate).join(' '):''].filter(Boolean);
 const ot=(r.ot||0)+(r.dbl||0)+(r.trip||0)>0?hmm(r.mins)+' · 1,5× '+hmm(r.ot).replace(' h','')+' · 2× '+hmm(r.dbl).replace(' h','')+(r.trip?' · 3× '+hmm(r.trip).replace(' h',''):''):hmm(r.mins);
 return `<button type="button" class="ip-entry" data-ie="${escH(r.id)}"><span class="ip-row-t"><span class="ip-time">${r.start?escH(r.start)+' → '+escH(r.end):escH(type||'Muu päev')}</span>${sub.length?`<span class="ip-sub">${sub.map(x=>`<span>${escH(x)}</span>`).join(' · ')}</span>`:''}${fixed?'':ex.map(x=>`<span class="ip-small">+ ${escH(x.text)} · ${escH(money(x.amount))}</span>`).join('')}${r.comment?`<span class="ip-sub ip-it">${escH(r.comment)}</span>`:''}</span><span class="ip-right">${fixed?'':`<span class="ip-num">${money(r.net)}</span>`}<span class="ip-sub">${escH(ot)}</span></span></button>`}

/* ---------- kell ---------- */
let tickT=null;
function stopTick(){clearInterval(tickT);tickT=null}
function startTick(){stopTick();tickT=setInterval(()=>{const p=screen==='proj'&&byId(pid);const el=$('ipTime');if(el&&p&&p.clock)el.textContent=DB.fmt(DB.elapsed(p.clock));
 home.querySelectorAll('[data-run]').forEach(e=>{const x=byId(e.dataset.run);if(x&&x.clock)e.textContent=DB.fmt(DB.elapsed(x.clock))})},1000)}
function startWork(p){if(!p.job){editSheet(p,'Lisa enne tööd oma amet ja hind.');return}
 const other=state.projects.find(x=>x.clock&&x.id!==p.id&&!x.deleted);
 if(other){if(!confirm(`Kell käib juba projektis „${other.name}”. Lõpetan selle päeva ja alustan „${p.name}”?`)||!DB.wrap(other,true))return}
 DB.clearWrap();p.clock={start:new Date().toISOString(),pauseSeconds:0,device:DB.standalone?'telefon':'brauser'};DB.setClock(p.id);save();draw()}

/* ---------- alt avanev leht ---------- */
const sheet=document.createElement('div');sheet.className='ip-sheet hidden';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
sheet.innerHTML='<div class="ip-sheet-in"><div class="ip-sheet-h"><button type="button" class="ip-pill" id="ipSX">Loobu</button><strong id="ipST"></strong><button type="button" class="ip-pill ip-pill-on" id="ipSOk">Salvesta</button></div><div class="ip-sheet-b" id="ipSB"></div></div>';
document.body.append(sheet);
const park=document.createElement('div');park.hidden=true;park.id='ipPark';document.body.append(park);
let onOk=null,onClose=null;
function openSheet(title,okText,ok,close){$('ipST').textContent=title;const b=$('ipSOk');b.textContent=okText||'Salvesta';b.hidden=!ok;onOk=ok;onClose=close||null;$('ipSX').textContent='Loobu';
 sheet.classList.remove('hidden');document.documentElement.classList.add('ip-lock');requestAnimationFrame(()=>sheet.classList.add('on'));$('ipSB').scrollTop=0}
function closeSheet(){sheet.classList.remove('on');document.documentElement.classList.remove('ip-lock');const f=onClose;onOk=onClose=null;
 // Vormid lähevad tagasi oma ootekohta (neid kasutab sama Hoursi tuum).
 for(const el of [...$('ipSB').children])if(el.dataset.keep)park.append(el);$('ipSB').innerHTML='';sheet.classList.add('hidden');f&&f();draw()}
$('ipSX').onclick=()=>closeSheet();$('ipSOk').onclick=()=>{onOk&&onOk()};
sheet.addEventListener('click',e=>{if(e.target===sheet)closeSheet()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.classList.contains('hidden')&&!document.querySelector('dialog[open]'))closeSheet()});
function body(){return $('ipSB')}
function keep(el){if(!el)return null;el.dataset.keep='1';body().append(el);return el}
const fire=el=>{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
const snap=p=>JSON.stringify(p.entries||[]);

// Tööpäev: sama vorm mis enne (kuupäev, algus, lõpp, tunde, kommentaar, lõuna, pausid).
function entrySheet(p,mode,eid){focus(p);if(!p.job){editSheet(p,'Lisa enne tööd oma amet ja hind.');return}
 if(typeof editing!=='undefined'&&editing&&mode!=='edit'){const c=$('cancel');c&&c.click()}
 if(mode==='edit'){const b=document.querySelector(`#entries [data-edit="${CSS.escape(eid)}"]`);if(!b)return;b.click();const dd=$('dbDayDlg');if(dd&&dd.open)return}
 const form=$('entry');if(!form)return;keep(form);
 if(mode==='today'){const set=(id,v)=>{const el=$(id);if(el){el.value=v;fire(el)}};set('date',DB.ymd(new Date()));set('start',lastStart(p));const hs=$('dbHrs');if(hs){hs.value=String(dayHours(p));hs.dispatchEvent(new Event('change',{bubbles:true}))}}
 else if(mode==='new'&&!$('date').value){$('date').value=DB.ymd(new Date());fire($('date'))}
 const err=$('entryError');if(err)err.textContent='';
 const extra=document.createElement('div');extra.className='ip-sheet-x';
 extra.innerHTML=mode==='edit'?'<button type="button" class="ip-btn ip-danger" id="ipDel">Kustuta see päev</button>':'<button type="button" class="ip-btn" id="ipNext">Salvesta ja lisa järgmine päev</button><p class="ip-foot2">Salvestab selle päeva ja avab järgmise päeva samade kellaaegadega. Nii saad mitu järjestikust päeva kiiresti sisestada.</p><div class="ip-saved" id="ipSaved"></div>';
 body().append(extra);
 const submit=()=>{const before=snap(p);form.requestSubmit();return snap(p)!==before};
 openSheet(mode==='edit'?'Muuda tunde':'Lisa tunnid','Salvesta',()=>{if(submit()){closeSheet()}},()=>{if(typeof editing!=='undefined'&&editing){const c=$('cancel');c&&c.click()}});
 const nx=$('ipNext');if(nx)nx.onclick=()=>{const was=(p.entries||[]).length;if(submit()&&(p.entries||[]).length>was){const e=p.entries[p.entries.length-1];const s=$('ipSaved');if(s)s.insertAdjacentHTML('beforeend',`<div>✓ ${escH(longDay(e.date)[1])} · ${escH(e.start||'')}–${escH(e.end||'')}</div>`);const er=$('entryError');if(er)er.textContent=''}};
 const dl=$('ipDel');if(dl)dl.onclick=()=>{const b=document.querySelector(`#entries [data-delete="${CSS.escape(eid)}"]`);if(!b)return;const before=snap(p);b.click();if(snap(p)!==before)closeSheet()}}

// Projekti valikud: nimi, amet, hind, ületunnid, tööreeglid (sama vorm mis enne).
function editSheet(p,tip){focus(p);const f=$('settings');if(!f)return;
 const top=document.createElement('div');top.className='ip-sheet-x';
 top.innerHTML=`${tip?`<div class="ip-note ip-warn" role="status"><strong>${escH(tip)}</strong></div>`:''}<label class="ip-field"><span>Projekti nimi</span><input id="ipName" maxlength="120" value="${escH(p.name||'')}"></label>`;
 body().append(top);keep(f);const err=$('settingsError');if(err)err.textContent='';
 const low=document.createElement('div');low.className='ip-sheet-x';
 low.innerHTML=`<button type="button" class="ip-btn" id="ipArch">${p.archived?'Too tagasi aktiivseks':'Projekt on lõpetatud'}</button><button type="button" class="ip-btn ip-danger" id="ipDelP">Kustuta projekt</button>`;body().append(low);
 openSheet('Seaded','Salvesta',()=>{const n=$('ipName').value.trim();if(!n){$('ipName').focus();return}
  f.requestSubmit();if(err&&err.textContent){err.scrollIntoView({block:'center'});return}p.name=n;save();closeSheet()});
 setTimeout(()=>{const j=$('job');if(!p.job&&j)j.focus()},250);
 $('ipArch').onclick=()=>{const b=$('archiveProject');if(b){b.click();closeSheet()}};
 $('ipDelP').onclick=()=>{const b=$('deleteProject');if(!b)return;const n=all().length;b.click();if(all().length<n||!byId(p.id)){screen='home';remember();closeSheet()}}}

// Lisakulu või muu rida.
function costSheet(p,cid){focus(p);const f=$('costForm');if(!f)return;
 if(cid){const b=document.querySelector(`[data-cost-edit="${CSS.escape(cid)}"]`);b&&b.click()}else{try{costReset()}catch(e){}if(!$('costDate').value)$('costDate').value=DB.ymd(new Date())}
 keep(f);const snapC=()=>JSON.stringify(p.expenses||[]);
 if(cid){const x=document.createElement('div');x.className='ip-sheet-x';x.innerHTML='<button type="button" class="ip-btn ip-danger" id="ipDelC">Kustuta see rida</button>';body().append(x)}
 openSheet(cid?'Muuda rida':'Lisa rida','Salvesta',()=>{const b=snapC();f.requestSubmit();if(snapC()!==b)closeSheet()},()=>{try{costReset()}catch(e){}});
 const dc=$('ipDelC');if(dc)dc.onclick=()=>{const b=document.querySelector(`[data-cost-delete="${CSS.escape(cid)}"]`);if(!b)return;const s=snapC();b.click();if(snapC()!==s)closeSheet()}}

// Uus projekt: nimi ja liik (reklaam, film või muu). Amet ja hind tulevad kohe järel.
function newSheet(){const x=document.createElement('div');x.className='ip-sheet-x';let kind='';
 x.innerHTML=`<label class="ip-field"><span>Projekti nimi</span><input id="ipNewName" maxlength="120" placeholder="nt Reklaam Sõida Kainelt"></label>
 <p class="ip-cap ip-cap2" id="ipKindL">Mis projekt see on?</p><div class="ip-kind" role="group" aria-labelledby="ipKindL"><button type="button" data-kind="commercial"><strong>Reklaam</strong><span>10 h võttepäev</span></button><button type="button" data-kind="film"><strong>Film</strong><span>12 h võttepäev</span></button><button type="button" data-kind="none"><strong>Muu</strong><span>tavaline tunnitöö</span></button></div><p class="error" id="ipNewErr" role="alert"></p>`;
 body().append(x);
 x.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{kind=b.dataset.kind;$('ipNewErr').textContent='';x.querySelectorAll('[data-kind]').forEach(o=>{o.classList.toggle('on',o===b);o.setAttribute('aria-pressed',o===b)})});
 const go=()=>{const name=$('ipNewName').value.trim();if(!name){$('ipNewErr').textContent='Kirjuta projekti nimi.';$('ipNewName').focus();return}if(!kind){$('ipNewErr').textContent='Vali, kas see on reklaam, film või muu.';return}
  const n=DB.newProject(name,kind);pid=n.id;screen='proj';remember();closeSheet();focus(n);draw();if(!n.job)setTimeout(()=>editSheet(n,'Lisa oma amet ja hind. Siis saad tööd alustada.'),60)};
 $('ipNewName').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go()}};
 openSheet('Uus projekt','Loo projekt',go);setTimeout(()=>$('ipNewName').focus(),250)}

// Lõpeta töö: nagu Hoursis küsib päeva pikkust (12, 10 või 8 h) või salvestab täpse aja.
function stopSheet(p){const c=p.clock,st=new Date(c.start),worked=DB.elapsed(c);
 if(worked>=12*3600e3){if(DB.wrap(p,false))draw();return}
 const x=document.createElement('div');x.className='ip-sheet-x';
 const opts=[12,10,8].map(h=>{const e=new Date(st.getTime()+h*3600e3);return `<button type="button" class="ip-btn" data-len="${h}">${h} h · ${DB.hm(st)}–${DB.hm(e)}</button>`}).join('');
 x.innerHTML=`<p class="ip-foot2">Algus ${DB.hm(st)}. Vali päeva pikkus või salvesta täpne aeg.</p>${opts}<button type="button" class="ip-btn ip-fill" data-len="exact">Täpne aeg · ${hmm(Math.floor(worked/60000))}</button><p class="ip-cap ip-cap2">Lõpetasid varem?</p><label class="ip-field"><span>Tegelik lõpuaeg</span><input type="time" id="ipEndT" value="${DB.hm(new Date())}"></label><button type="button" class="ip-btn" id="ipEndOk">Lõpeta selle ajaga</button><p class="error" id="ipEndErr" role="alert"></p>`;
 body().append(x);openSheet('Kui pikk tööpäev oli?','',null);
 x.querySelectorAll('[data-len]').forEach(b=>b.onclick=()=>{const v=b.dataset.len;let end=null;if(v!=='exact'){const pause=(c.pauseSeconds||0)*1000;end=new Date(st.getTime()+Number(v)*3600e3+pause)}
  if(DB.wrap(p,true,end))closeSheet()})
 $('ipEndOk').onclick=()=>{const v=$('ipEndT').value,er=$('ipEndErr');er.textContent='';if(!/^\d\d:\d\d$/.test(v)){er.textContent='Vali kellaaeg, näiteks 08:00.';return}
  const [H,M]=v.split(':').map(Number),d=new Date(st);d.setHours(H,M,0,0);if(d<=st)d.setDate(d.getDate()+1);
  if(d>new Date()){er.textContent='Lõpuaeg ei saa olla tulevikus. Kui töö veel käib, vajuta hiljem „Lõpeta töö”.';return}
  if(DB.wrap(p,true,d))closeSheet()}}

// Muuda algusaega (unustasid kella käivitada).
function startTimeSheet(p){const c=p.clock,x=document.createElement('div');x.className='ip-sheet-x';
 x.innerHTML=`<label class="ip-field"><span>Tegelik algusaeg</span><input type="time" id="ipST2" value="${DB.hm(new Date(c.start))}"></label><p class="error" id="ipSTErr" role="alert"></p><p class="ip-foot2">Kui unustasid sisse lüüa, pane siia tegelik algusaeg.</p>`;
 body().append(x);
 openSheet('Algusaeg','Salvesta',()=>{const v=$('ipST2').value,er=$('ipSTErr');if(!/^\d\d:\d\d$/.test(v)){er.textContent='Vali kellaaeg, näiteks 08:00.';return}
  const [H,M]=v.split(':').map(Number),now=new Date(),d=new Date(now);d.setHours(H,M,0,0);if(d>now)d.setDate(d.getDate()-1);
  if(c.pausedAt&&Date.parse(c.pausedAt)<d){er.textContent='Paus algas enne seda aega. Jätka enne tööd ja proovi siis uuesti.';return}
  const clash=(p.entries||[]).find(e=>e.start&&e.end&&Date.parse(shiftEndDate(e)+'T'+e.end)>d&&Date.parse(e.date+'T'+e.start)<now);
  if(clash){er.textContent=`See aeg kattub juba salvestatud tööpäevaga: ${clash.date.split('-').reverse().join('.')} ${clash.start} → ${clash.end}.`;return}
  c.start=d.toISOString();save();closeSheet()})}

// Kui Hoursi tuum joonistab uuesti (nt prep päeva aken salvestas), uueneb ka projekti leht.
{const core=window.render;let busy=false;window.render=function(){const r=core.apply(this,arguments);if(!busy&&tab==='home'){busy=true;try{draw()}catch(e){console.error(e)}finally{busy=false}}return r}}
/* ---------- käivitus ---------- */
// Teised failid avavad vahel tööaja eelvaate või kella: need on nüüd projekti lehel.
window.daybillOpenProject=openProject;
if(tab==='home'&&!document.querySelector('#invView:not(.hidden),#settingsView:not(.hidden),#historyView:not(.hidden)'))window.daybillShow('home');
else markTab(['inv','settings','history'].find(v=>{const e=$(v==='settings'?'settingsView':v+'View');return e&&!e.classList.contains('hidden')})||'home');
})();
