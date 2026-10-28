// Ajalugu: kõik, mis kasutaja Daybillis teinud on, ühes kohas. Arved, maksed, eelvaated ja tööpäevad loetakse
// otse andmetest; pangaväljavõtted ja projekti lõpetamine/kustutamine salvestatakse logisse (sünkib pilve kaudu).
(()=>{
const KEY='daybill.log.v1';
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const escH=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur=n=>new Intl.NumberFormat('et-EE',{style:'currency',currency:'EUR'}).format(Math.round((Number(n)||0)*100)/100);
const dmy=iso=>{const [y,m,d]=String(iso||'').slice(0,10).split('-');return d?d+'.'+m+'.'+y:''};
const when=iso=>{const s=String(iso||'');if(s.length<=10)return dmy(s);const d=new Date(s);return isNaN(d)?dmy(s):pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes())};
const local=iso=>{const s=String(iso||'');if(s.length<=10)return s;const d=new Date(s);return isNaN(d)?s.slice(0,10):d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const addDay=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const lang=()=>{try{return localStorage.getItem('hoursLang')==='et'?'et':'en'}catch(e){return 'en'}};

/* ---------- logi (ainult lisatakse, iga kirje oma id-ga, nii et seadmete vahel ei teki konflikte) ---------- */
let log=[];try{log=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(log))log=[]}catch(e){log=[]}
function keep(){try{localStorage.setItem(KEY,JSON.stringify(log))}catch(e){}}
function add(ev){const e={id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),at:new Date().toISOString(),...ev,_u:Date.now()};log.push(e);keep();try{window.daybillLogSaved&&window.daybillLogSaved(e)}catch(x){}refresh();return e}
function receive(list){let n=0;for(const e of list){if(!e||!e.id||log.some(x=>x.id===e.id))continue;log.push(e);n++}if(n){keep();refresh()}return n}

/* ---------- pangaväljavõtete kataloog ---------- */
function statements(){const m=new Map();for(const e of log)if(e.type==='bank'&&e.from&&e.to){const k=e.from+'|'+e.to+'|'+e.n,o=m.get(k);if(!o||o.at<e.at)m.set(k,{...e,paid:[...new Set([...(o&&o.paid||[]),...(e.paid||[])])]})}return [...m.values()].sort((a,b)=>a.from.localeCompare(b.from)||a.at.localeCompare(b.at))}
function coverage(){const st=statements();if(!st.length)return {last:'',gaps:[]};const gaps=[];let end=st[0].to;
 for(const s of st.slice(1)){if(s.from>addDay(end,1))gaps.push([addDay(end,1),addDay(s.from,-1)]);if(s.to>end)end=s.to}
 return {last:end,gaps}}

/* ---------- sündmused ---------- */
function projects(){try{return (state.projects||[]).filter(p=>!p.kind)}catch(e){return []}}
function invoices(){try{return window.TraageldusInvoices.all().filter(x=>!x.deleted)}catch(e){return []}}
function createdAt(id){const t=parseInt(String(id).slice(0,8),36);return t>1577836800000&&t<4102444800000?new Date(t).toISOString():''}
function events(){const out=[],inv=invoices(),num=id=>{const x=inv.find(v=>v.id===id);return x?x.number:''};
 for(const p of projects()){if(p.deleted)continue;const c=createdAt(p.id);if(c)out.push({at:c,kind:'project',title:'Uus projekt',meta:p.name,go:{p:p.id}});
  for(const e of p.entries||[]){if(!e.date)continue;out.push({at:e.date,kind:'project',title:e.pay!=null&&e.pay!==''?(e.dayType==='prep'?'Prep päev':'Muu päev'):'Tööpäev',meta:[p.name,e.start&&e.end?e.start+' → '+e.end:'',e.pay!=null&&e.pay!==''?eur(e.pay):'',e.comment||''].filter(Boolean).join(' · '),go:{p:p.id}})}
  for(const h of (p.approval&&p.approval.history)||[]){if(!h.at)continue;out.push({at:h.at,kind:'project',title:h.status==='approved'?'Klient kinnitas eelvaate':h.status==='sent'?'Eelvaade saadetud':'Eelvaade muudetud',meta:[p.name,h.gross?eur(h.gross):''].filter(Boolean).join(' · '),go:{p:p.id}})}}
 for(const x of inv){const who=x.client&&x.client.name||'';
  out.push({at:x.createdAt||x.date,kind:'invoice',title:x.credit?'Kreeditarve {0}':'Arve {0}',n:x.number,meta:[who,eur(x.gross)].concat(x.credit&&x.creditFor?[num(x.creditFor)]:[]).filter(Boolean).join(' · '),go:{i:x.id}});
  for(const s of x.sent||[])out.push({at:s,kind:'invoice',title:'Arve {0} saadetud',n:x.number,meta:who,go:{i:x.id}});
  if(x.paidAt&&x.paidAt!==true)out.push({at:x.paidAt,kind:'paid',title:'Arve {0} makstud',n:x.number,meta:[who,eur(x.gross),x.paidRef?(x.paidRef.manual?'sinu kinnitusega väljavõttest':'pangaväljavõttest'):''].filter(Boolean).join(' · '),go:{i:x.id}})}
 for(const e of log){if(e.type==='bank')out.push({at:e.at,kind:'bank',title:'Pangaväljavõte laaditud',meta:[dmy(e.from)+' – '+dmy(e.to),e.n+' laekumist',(e.paid||[]).length+' arvet makstuks'].join(' · ')+(e.file?' · '+e.file:'')});
  else if(e.type==='project')out.push({at:e.at,kind:'project',title:{archived:'Projekt lõpetatud',restored:'Projekt tagasi aktiivseks',deleted:'Projekt kustutatud'}[e.what]||'Projekt muudetud',meta:e.name||'',go:e.what==='deleted'?null:{p:e.pid}})}
 return out.sort((a,b)=>String(b.at).localeCompare(String(a.at)))}

/* ---------- vaade ---------- */
const view=document.createElement('section');view.id='historyView';view.className='db-view hidden';
function place(){const m=document.querySelector('main')||document.body;if(view.parentElement!==m)m.append(view)}
place();setTimeout(place,0);
let filter='all',limit=100;
const FILTERS=[['all','Kõik'],['project','Projektid'],['invoice','Arved'],['paid','Maksed'],['bank','Väljavõtted']];
function render(){place();const ps=projects().filter(p=>!p.deleted),inv=invoices().filter(x=>!x.credit),st=statements(),cov=coverage();
 const paid=inv.filter(x=>x.paidAt||x.paid).length,active=ps.filter(p=>!p.archived).length;
 const all=events(),list=all.filter(e=>filter==='all'||e.kind===filter);
 const L=lang()==='et'?'et-EE':'en-GB';let month='',rows='';
 for(const e of list.slice(0,limit)){const m=local(e.at).slice(0,7);if(m!==month){month=m;const d=new Date(m+'-15T12:00:00');rows+=`<h3 class="db-hist-month">${escH(d.toLocaleDateString(L,{month:'long',year:'numeric'}))}</h3>`}
  const t=e.n?e.title.replace('{0}',e.n):e.title;
  rows+=`<button type="button" class="db-hist-row"${e.go&&e.go.p?` data-go-p="${escH(e.go.p)}"`:''}${e.go&&e.go.i?' data-go-i="1"':''}${!e.go?' disabled':''}><span class="db-hist-when">${escH(when(e.at))}</span><span class="db-hist-what"><strong>${escH(t)}</strong><span class="help">${escH(e.meta)}</span></span></button>`}
 view.innerHTML=`<div class="row top"><h1>Ajalugu</h1></div>
 <p class="help db-hist-intro">Siin on kõik, mida oled Daybillis teinud. Uuemad on üleval.</p>
 <div class="db-hist-cards">
  <button type="button" class="db-hist-card" id="dhProjects"><span class="help">Projektid</span><strong>${ps.length}</strong><span class="help">${active} aktiivset · ${ps.length-active} lõpetatud</span></button>
  <button type="button" class="db-hist-card" id="dhInvoices"><span class="help">Arved</span><strong>${inv.length}</strong><span class="help">${paid} makstud · ${inv.length-paid} ootab</span></button>
  <button type="button" class="db-hist-card" id="dhBank"><span class="help">Pangaväljavõtted</span><strong>${st.length}</strong><span class="help">${cov.last?`viimane kuni ${dmy(cov.last)}`:'pole veel laaditud'}</span></button>
 </div>
 ${st.length?`<h2 class="db-hist-h">Pangaväljavõtted</h2>
 ${cov.gaps.length?`<div class="inv-warn" role="status"><strong>Vahele jäi aeg, mille väljavõtet pole laaditud.</strong>${cov.gaps.map(g=>`<br>${dmy(g[0])} – ${dmy(g[1])}`).join('')}</div>`:''}
 <p class="help">Järgmine väljavõte võiks alata ${dmy(addDay(cov.last,1))}.</p>
 <div class="table"><table class="db-hist-bank"><thead><tr><th>Periood</th><th>Laaditud</th><th>Laekumisi</th><th>Makstuks</th></tr></thead><tbody>${st.slice().reverse().map(s=>`<tr><td>${dmy(s.from)} – ${dmy(s.to)}${s.file?`<br><span class="help">${escH(s.file)}</span>`:''}</td><td><span class="db-m">Laaditud</span> ${when(s.at)}</td><td><span class="db-m">Laekumisi</span> ${s.n}</td><td class="db-span"><span class="db-m">Makstuks</span> ${(s.paid||[]).length?escH((s.paid||[]).join(', ')):'—'}</td></tr>`).join('')}</tbody></table></div>`:''}
 <h2 class="db-hist-h">Kõik tegevused</h2>
 <nav class="db-hist-filter" aria-label="Filter">${FILTERS.map(([k,t])=>`<button type="button" data-hf="${k}" class="${filter===k?'primary':''}" aria-pressed="${filter===k}">${t}</button>`).join('')}</nav>
 <div class="db-hist-list">${rows||'<div class="empty">Siin pole veel midagi.</div>'}</div>
 ${list.length>limit?`<button type="button" id="dhMore">Näita rohkem</button>`:''}`;
 view.querySelectorAll('[data-hf]').forEach(b=>b.onclick=()=>{filter=b.dataset.hf;limit=100;render()});
 const more=$('dhMore');if(more)more.onclick=()=>{limit+=200;render()};
 $('dhProjects').onclick=()=>window.daybillAllProjects?window.daybillAllProjects():window.daybillShow('hours');
 $('dhInvoices').onclick=()=>{try{window.TraageldusInvoices.setTab('list')}catch(e){}window.daybillShow('inv')};
 $('dhBank').onclick=()=>{try{window.TraageldusInvoices.setTab('list')}catch(e){}window.daybillShow('inv')};
 view.querySelectorAll('[data-go-p]').forEach(b=>b.onclick=()=>{const p=projects().find(x=>x.id===b.dataset.goP);if(!p)return;try{state.selected=p.id;archiveView=!!p.archived;projectExpanded=true;save()}catch(e){}window.daybillShow('hours');const t=document.querySelector('.project-toggle.active');t&&t.scrollIntoView({block:'start'})});
 view.querySelectorAll('[data-go-i]').forEach(b=>b.onclick=()=>{try{window.TraageldusInvoices.setTab('list')}catch(e){}window.daybillShow('inv')})}
function refresh(){if(!view.classList.contains('hidden'))render()}

/* ---------- projekti lõpetamine ja kustutamine logisse (ainult kasutaja enda tegevus, mitte sünk) ---------- */
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#archiveProject,#deleteProject');if(!b)return;
 let pr=null;try{pr=p()}catch(x){}if(!pr)return;const id=pr.id,name=pr.name,was=!!pr.archived;
 setTimeout(()=>{const now=projects().find(x=>x.id===id);
  if(b.id==='deleteProject'){if(!now||now.deleted)add({type:'project',what:'deleted',pid:id,name})}
  else if(now&&!!now.archived!==was)add({type:'project',what:now.archived?'archived':'restored',pid:id,name})},0)},true);

window.DaybillLog={add,receive,all:()=>log.slice(),statements,coverage,events};
window.daybillHistory=render;
})();
