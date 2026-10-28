// Pangaväljavõte: loeb CSV või ISO XML (camt.053) faili ja märgib makstud arved ise. Fail jääb seadmesse.
(()=>{
const r2=n=>Math.round((Number(n)||0)*100)/100;
const pad=n=>String(n).padStart(2,'0');
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const escH=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur=n=>new Intl.NumberFormat('et-EE',{style:'currency',currency:'EUR'}).format(r2(n));
const dmy=iso=>{const [y,m,d]=String(iso||'').split('-');return d?d+'.'+m+'.'+y:''};
const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const T=()=>window.TraageldusInvoices;

/* ---------- faili lugemine (sama loogika mis Hoursis) ---------- */
function decodeFile(buf){try{return new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(e){try{return new TextDecoder('windows-1257').decode(buf)}catch(e2){return new TextDecoder('iso-8859-1').decode(buf)}}}
function parseAmount(v){let t=String(v||'').replace(/\s| /g,'').replace(/[€A-Z]/gi,'');if(t.includes(',')&&t.includes('.'))t=t.replace(/\./g,'').replace(',','.');else t=t.replace(',','.');const n=Number(t);return Number.isFinite(n)?n:NaN}
function parseDate(v){v=String(v||'').trim();let m=/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/.exec(v);if(m)return m[3]+'-'+pad(m[2])+'-'+pad(m[1]);m=/^(\d{4})-(\d{2})-(\d{2})/.exec(v);return m?m[0]:''}
function splitCsv(line,d){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}else if(c==='"')q=true;else if(c===d){out.push(cur);cur=''}else cur+=c}out.push(cur);return out.map(x=>x.trim())}
function parseCsv(text){const lines=text.replace(/^﻿/,'').split(/\r?\n/).filter(l=>l.trim());if(!lines.length)throw Error('empty');
 const d=[';','\t',','].map(c=>[c,lines[0].split(c).length]).sort((a,b)=>b[1]-a[1])[0][0];
 const hi=lines.findIndex(l=>/kuup|date/i.test(l)&&/summa|amount/i.test(l));if(hi<0)throw Error('columns');
 const H=splitCsv(lines[hi],d).map(norm);const col=re=>H.findIndex(h=>re.test(h));const isAcc=h=>/konto|account|iban/.test(h);
 const cDate=col(/kuupaev|date/),cName=H.findIndex(h=>/saaja\/maksja|maksja|saaja|payer|beneficiary|name|nimi/.test(h)&&!isAcc(h)),cDesc=col(/selgitus|description|details|explanation/),cAmt=col(/^summa$|amount|summa/),cDK=col(/deebet|kreedit|d\/k|debit|credit|cdt/),cRef=col(/viite|reference/),cType=col(/reatuup|row type/),cArch=col(/arhiveerimis|archive|transaction id/);
 const tx=[],dates=[];for(const l of lines.slice(hi+1)){const r=splitCsv(l,d);const dt=parseDate(r[cDate]);if(dt)dates.push(dt);if(cType>=0&&r[cType]&&r[cType]!=='20')continue;let amt=parseAmount(r[cAmt]);if(!Number.isFinite(amt))continue;
  const dk=cDK>=0?String(r[cDK]||'').toUpperCase():'';const credit=dk?/^(K|C|CR|CRDT|KREEDIT|CREDIT)/.test(dk):amt>0;if(!credit)continue;
  tx.push({date:dt,payer:cName>=0?r[cName]:'',desc:cDesc>=0?r[cDesc]:'',ref:cRef>=0?r[cRef]:'',amount:r2(Math.abs(amt)),id:cArch>=0?r[cArch]:''})}
 dates.sort();return {tx,from:dates[0]||'',to:dates[dates.length-1]||''}}
function parseCamt(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('xml');
 const pick=(el,names)=>{for(const n of names){const f=el.getElementsByTagName(n)[0];if(f&&f.textContent.trim())return f.textContent.trim()}return ''};
 const tx=[],dates=[];for(const e of doc.getElementsByTagName('Ntry')){const dt=parseDate(pick(e,['BookgDt','ValDt']));if(dt)dates.push(dt);if(pick(e,['CdtDbtInd'])!=='CRDT')continue;
  const party=e.getElementsByTagName('Dbtr')[0];tx.push({date:dt,payer:party?pick(party,['Nm']):'',desc:[...e.getElementsByTagName('Ustrd')].map(u=>u.textContent).join(' '),ref:pick(e,['Ref']),amount:r2(parseAmount(pick(e,['Amt']))),id:pick(e,['AcctSvcrRef','NtryRef'])})}
 const from=pick(doc,['FrDtTm']).slice(0,10),to=pick(doc,['ToDtTm']).slice(0,10);dates.sort();return {tx,from:from||dates[0]||'',to:to||dates[dates.length-1]||''}}
function parseStatement(text){return /<Document|<BkToCstmrStmt|camt\.05/i.test(text)?parseCamt(text):parseCsv(text)}

/* ---------- sobitamine: summa peab klappima sendi pealt, lisaks nimi või arve number ---------- */
const CORP=/\b(ou|as|mtu|sa|fie|ltd|uab|sia|oy|ab|gmbh|llc|inc)\b/g;
const words=s=>norm(s).replace(CORP,' ').replace(/[^a-z0-9 ]/g,' ').split(' ').filter(w=>w.length>2);
function numberHit(x,text){const [nn,code]=String(x.number).split('/');const t=text.replace(/\s+/g,'');return code?[nn+'/'+code,nn+'_'+code,nn+code,nn+'-'+code,nn+'.'+code].some(v=>t.includes(v)):t.includes(nn)}
function balance(x,all){return r2(x.gross+all.filter(c=>c.credit&&c.creditFor===x.id&&!c.deleted).reduce((s,c)=>s+c.gross,0))}
function used(t,all){return all.some(x=>x.paidRef&&((t.id&&x.paidRef.bankId===t.id)||(!t.id&&Math.abs((x.paidRef.amount||0)-t.amount)<0.005&&x.paidAt===t.date&&norm(x.paidRef.payer)===norm(t.payer))))}
function isOpen(x){const I=T();return !x.deleted&&!x.fromHours&&!x.credit&&!x.paidAt&&!x.paid&&!(I.credited&&I.credited(x))}
function match(tx){const all=T().all(),open=all.filter(isOpen),pairs=[];
 tx.forEach((t,ti)=>{if(used(t,all))return;for(const x of open){const bal=balance(x,all);if(bal<=0||Math.abs(t.amount-bal)>0.005)continue;if(t.date&&t.date<x.date)continue;
  let sc=0;if(numberHit(x,t.desc+' '+t.ref))sc+=5;const a=words(t.payer),b=words(x.client&&x.client.name);if(a.some(w=>b.includes(w)))sc+=3;pairs.push({ti,id:x.id,sc})}});
 pairs.sort((a,b)=>b.sc-a.sc);const sure=[],check=[],tU=new Set(),xU=new Set();
 for(const p of pairs){if(tU.has(p.ti)||xU.has(p.id))continue;
  // kaks võrdset kandidaati: ei oleta, kasutaja otsustab
  const ties=pairs.filter(q=>q!==p&&q.sc===p.sc&&((q.ti===p.ti&&!xU.has(q.id))||(q.id===p.id&&!tU.has(q.ti))));
  if(ties.length){for(const q of [p,...ties]){if(!check.includes(q))check.push({...q,tie:true});tU.add(q.ti);xU.add(q.id)}continue}
  tU.add(p.ti);xU.add(p.id);(p.sc>=3?sure:check).push(p)}
 return {sure,check}}

/* ---------- vaade ---------- */
let res=null,err='';
async function readFile(file){err='';res=null;try{const st=parseStatement(decodeFile(await file.arrayBuffer()));const m=match(st.tx);const paid=[];
  for(const p of m.sure){const t=st.tx[p.ti];if(T().markPaid(p.id,t.date||today(),{payer:t.payer,desc:t.desc,amount:t.amount,bankId:t.id}))paid.push(p.id)}
  res={from:st.from,to:st.to,n:st.tx.length,tx:st.tx,paid,check:m.check};
  try{const all=T().all();window.DaybillLog&&window.DaybillLog.add({type:'bank',from:st.from,to:st.to,file:file.name||'',n:st.tx.length,paid:paid.map(id=>(all.find(x=>x.id===id)||{}).number).filter(Boolean),check:m.check.length})}catch(e){console.error(e)}}
 catch(e){err=e.message==='empty'?'Fail on tühi.':'Seda faili ei saanud lugeda. Ekspordi internetipangast konto väljavõte CSV või XML (camt.053) failina.'}
 T().render()}
function line(x,extra){return `<li><strong>${escH(x.number)}</strong> · ${escH(x.client&&x.client.name)} · ${eur(x.gross)}${extra||''}</li>`}
function mount(el){if(!el)return;const I=T(),all=I.all(),get=id=>all.find(x=>x.id===id);
 const mine=all.filter(x=>!x.deleted&&!x.fromHours&&!x.credit);
 if(!mine.length&&all.some(x=>x.fromHours&&!x.deleted)){el.innerHTML='';return}
 let out='';
 if(err)out+=`<p class="error" role="alert">${escH(err)}</p>`;
 if(res){const t=today(),open=all.filter(isOpen),wait=open.filter(x=>!(x.due<t)),late=open.filter(x=>x.due<t),checks=res.check.filter(p=>isOpen(get(p.id)||{deleted:true}));
  out+=`<div class="db-bank-res" role="status"><p><strong>Väljavõte ${dmy(res.from)} – ${dmy(res.to)}</strong> · ${res.n} laekumist</p>`;
  out+=res.paid.length?`<h3>✓ Märkisin makstuks: ${res.paid.length}</h3><ul>${res.paid.map(id=>get(id)).filter(Boolean).map(x=>line(x,` · ${dmy(x.paidAt)}`)).join('')}</ul>`:`<p>Uusi makseid arvetele ei leidnud.</p>`;
  if(checks.length)out+=`<h3>Kontrolli üle: ${checks.length}</h3><p class="help">Nende puhul ma ei oleta. Vaata makse üle ja vajuta „Jah”, kui see on selle arve makse.</p><ul>${checks.map(p=>{const x=get(p.id),tr=res.tx[p.ti];return `<li><strong>${escH(x.number)}</strong> · ${escH(x.client&&x.client.name)} · ${eur(x.gross)}<br><span class="help">Makse: ${dmy(tr.date)} · ${escH(tr.payer||'—')}${tr.desc?' · '+escH(tr.desc):''}</span><br><span class="help">${p.tie?'Sama summaga arveid on mitu. Vali õige.':'Summa klapib, aga maksja nimi ja arve number mitte.'}</span><br><button type="button" data-bank-yes="${p.ti}|${escH(p.id)}">Jah, märgi makstuks</button></li>`}).join('')}</ul>`;
  out+=late.length?`<h3>Üle tähtaja: ${late.length}</h3><ul>${late.map(x=>line(x,` · tähtaeg oli ${dmy(x.due)}`)).join('')}</ul>`:'';
  out+=wait.length?`<h3>Ootab makset: ${wait.length}</h3><ul>${wait.map(x=>line(x,` · tähtaeg ${dmy(x.due)}`)).join('')}</ul>`:'';
  if(!open.length)out+=`<p>Kõik arved on makstud.</p>`;
  out+=`<button type="button" class="db-link" id="dbBankClose">Peida</button></div>`}
 el.innerHTML=`<div class="db-bank" id="dbBankDrop"><div><strong>Pangaväljavõte</strong><p class="help">Lohista siia panga konto väljavõte või vali fail. Daybill märgib makstud arved ise. Fail jääb sinu seadmesse.</p></div><label class="db-bank-btn"><input type="file" id="dbBankFile" accept=".csv,.xml,.txt,text/csv,application/xml,text/xml" hidden>Vali fail</label></div>${(()=>{try{const L=window.DaybillLog,st=L.statements(),c=L.coverage();if(!st.length)return '';const s=st.slice().sort((a,b)=>b.at.localeCompare(a.at))[0];return `<p class="help db-bank-last">Viimati laaditud ${dmy(s.at.slice(0,10))} · kaetud kuni ${dmy(c.last)}${c.gaps.length?' · <strong>vahele jäi aeg</strong>':''} · <button type="button" class="db-link" id="dbBankHist">Kõik väljavõtted</button></p>`}catch(e){return ''}})()}<details class="db-bank-how"><summary>Kust ma selle faili saan?</summary><p class="help">Internetipangas ava konto väljavõte, vali periood (näiteks viimased 3 kuud) ja vajuta „Ekspordi”. Vali CSV või XML. Sobib Swedbank, SEB, LHV, Coop ja Luminor.</p></details>${out}`;
 const drop=el.querySelector('#dbBankDrop'),inp=el.querySelector('#dbBankFile');
 inp.onchange=()=>{const f=inp.files&&inp.files[0];if(f)readFile(f)};
 drop.ondragover=e=>{e.preventDefault();drop.classList.add('over')};drop.ondragleave=()=>drop.classList.remove('over');
 drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');const f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f)readFile(f)};
 el.querySelectorAll('[data-bank-yes]').forEach(b=>b.onclick=()=>{const [ti,id]=b.dataset.bankYes.split('|');const t=res.tx[+ti];if(T().markPaid(id,t.date||today(),{payer:t.payer,desc:t.desc,amount:t.amount,bankId:t.id,manual:true})){res.paid.push(id);res.check=res.check.filter(p=>p.id!==id&&p.ti!==+ti)}T().render()});
 const hb=el.querySelector('#dbBankHist');if(hb)hb.onclick=()=>window.daybillShow('history');
 const c=el.querySelector('#dbBankClose');if(c)c.onclick=()=>{res=null;err='';T().render()}}
window.daybillBank=mount;
window.DaybillBank={parseStatement,match};
})();
