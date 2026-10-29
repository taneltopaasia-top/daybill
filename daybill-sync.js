/* Daybill · sünkroonimine (Google Firebase, tasuta pakett).
   Iga kasutaja andmed on ainult tema kontol: users/{uid}/projects, users/{uid}/invoices, users/{uid}/meta.
   Projektid ja arved on eraldi dokumendid, uuem muudatus (_u) võidab. Arve number broneeritakse tehinguga,
   nii et kaks seadet ei saa kunagi sama numbrit anda. Ilma internetita arvet ei koostata (number peab olema kontrollitud). */
const cfg=window.DAYBILL_FIREBASE;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let fb=null,user=null,status='',unsub=[],pushed=new Map(),pushTimer=null,pendingRemote=null;
// Iga kasutaja mälupiir pilves. Tasuta pakett (1 GB) jagatakse kõigi kasutajate vahel; 5 MB on ~10 aasta töö.
export const CAP=5*1024*1024;
const hash=str=>{let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (4294967296*(2097151&h2)+(h1>>>0)).toString(36)};
const pk=()=>'daybill.pushed.'+user.uid,lk=()=>'daybill.lastSync.'+user.uid;
function loadPushed(){try{pushed=new Map(Object.entries(JSON.parse(localStorage.getItem(pk())||'{}')))}catch(e){pushed=new Map()}}
function savePushed(){try{localStorage.setItem(pk(),JSON.stringify(Object.fromEntries(pushed)))}catch(e){}}
function lastSync(){try{return Number(localStorage.getItem(lk()))||0}catch(e){return 0}}
function seen(u){if(u>lastSync())try{localStorage.setItem(lk(),String(u))}catch(e){}}
export function usage(){let b=0;try{for(const p of state.projects)if(!p.deleted)b+=JSON.stringify(p).length;for(const x of window.TraageldusInvoices.all())if(!x.deleted)b+=JSON.stringify(x).length;b+=JSON.stringify(window.DaybillSettings.get()).length}catch(e){}return Math.round(b*1.6)}
window.daybillUsage=()=>({used:usage(),cap:CAP});
window.daybillEmail=()=>user&&user.email?String(user.email).toLowerCase():'';
const setStatus=(t,c)=>{status=t;try{document.documentElement.dataset.sync=c||'wait';window.daybillConn&&window.daybillConn()}catch(e){}const el=$('dbSync');if(el)el.textContent=t;const cs=$('cloudStatus');if(cs)cs.textContent=t};
const fp=v=>JSON.stringify(canon(v));
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>!k.startsWith('_')&&k!=='draft'&&k!=='draftEditing'&&k!=='beforeEdit').sort().map(k=>[k,canon(v[k])])):v;

async function load(){const V='10.12.2',base=`https://www.gstatic.com/firebasejs/${V}/`;
 const [app,auth,fs]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
 const a=app.initializeApp(cfg);// Mälupõhine vahemälu: Daybill hoiab andmeid ise selles seadmes. Nii ei saa teine (taustal külmunud) vahekaart ühendust kinni hoida.
 let db;try{db=fs.initializeFirestore(a,{localCache:fs.memoryLocalCache()})}catch(e){db=fs.getFirestore(a)}
 return {auth:auth.getAuth(a),A:auth,db,F:fs}}

/* ---------- saatmine ---------- */
function projectsChanged(){clearTimeout(pushTimer);pushTimer=setTimeout(pushProjects,4000)}
// „pushed” märgitakse alles siis, kui pilv on kirjutamise kinnitanud: katkenud saatmine korratakse järgmisel avamisel.
let pushing=false;
async function pushProjects(){if(!user)return;if(pushing){projectsChanged();return}const {F,db}=fb;const batch=F.writeBatch(db);let n=0;const done=[];
 const full=usage()>CAP;let blocked=0;
 for(const p of state.projects){const f=hash(p.deleted?'deleted':fp(p));if(pushed.get('p:'+p.id)===f)continue;
  if(full&&!p.deleted){blocked++;continue}
  p._u=Date.now();done.push(['p:'+p.id,f]);batch.set(F.doc(db,'users',user.uid,'projects',p.id),p.deleted?{deleted:true,u:p._u}:{data:JSON.stringify(p),u:p._u});n++;if(n>=400)break}
 if(blocked)setStatus('Pilve mälu on täis, nii et uusi muudatusi ei saadeta pilve. Ava Seaded → Mälu ja piirid ning kustuta mõni vana projekt.','err');
 if(!n)return;try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
 pushing=true;try{await batch.commit();for(const [k,f] of done)pushed.set(k,f);savePushed();setStatus('Sünkroonitud · '+user.email,'ok')}catch(e){setStatus('Sünk ootab ühendust · muudatused on alles','wait')}finally{pushing=false}
 if(n>=400)projectsChanged()}
async function pushInvoice(x){if(!user)return;const {F,db}=fb;const h=hash(x.deleted?'deleted':fp(x));try{await F.setDoc(F.doc(db,'users',user.uid,'invoices',x.id),x.deleted?{deleted:true,u:x._u||Date.now()}:{data:JSON.stringify(x),u:x._u||Date.now()});pushed.set('i:'+x.id,h);savePushed()}catch(e){setStatus('Sünk ootab ühendust · muudatused on alles','wait')}}
async function pushLog(e){if(!user)return;const {F,db}=fb;try{await F.setDoc(F.doc(db,'users',user.uid,'log',e.id),{data:JSON.stringify(e),u:e._u||Date.now()});pushed.set('l:'+e.id,1);savePushed()}catch(x){}}
async function pushSettings(s){if(!user)return;const {F,db}=fb;try{await F.setDoc(F.doc(db,'users',user.uid,'meta','settings'),{data:JSON.stringify(s),u:s._u||Date.now()})}catch(e){}}

/* ---------- arve numbri broneerimine ---------- */
async function reserve(x){if(!user)return;const {F,db}=fb;if(!navigator.onLine)throw Error('Arve koostamiseks on vaja internetiühendust: number kontrollitakse kõigis sinu seadmetes, et sama numbrit ei tekiks kaks korda.');
 const ref=F.doc(db,'users',user.uid,'meta','numbers'),key=(x.numberFormat||'month')+'|'+x.period;
 await F.runTransaction(db,async t=>{const snap=await t.get(ref);const used=(snap.exists()&&snap.data()[key])||[];if(used.includes(x.seq))throw Error(`Number ${x.number} on juba teises seadmes kasutatud. Oota mõni sekund, kuni arved jõuavad siia, ja vajuta uuesti „Koosta arve”.`);t.set(ref,{[key]:[...used,x.seq]},{merge:true})})}

/* ---------- vastuvõtt ---------- */
function editingNow(){const a=document.activeElement;return a&&a.matches&&a.matches('#hoursView input,#hoursView textarea,#hoursView select')}
function applyProjects(docs){if(editingNow()){pendingRemote=docs;return}let changed=false;
 for(const d of docs){seen(d.u||0);if(d.deleted){const i=state.projects.findIndex(p=>p.id===d.id);pushed.set('p:'+d.id,hash('deleted'));if(i>=0){state.projects.splice(i,1);changed=true}continue}let r;try{r=JSON.parse(d.data)}catch(e){continue}const i=state.projects.findIndex(p=>p.id===r.id),l=state.projects[i];pushed.set('p:'+r.id,hash(fp(r)));
  if(!l){state.projects.push(r);changed=true}else if((r._u||0)>(l._u||0)&&fp(r)!==fp(l)){r.draft=l.draft;r.draftEditing=l.draftEditing;state.projects[i]=r;changed=true}}
 savePushed();if(changed){if(!state.projects.some(p=>p.id===state.selected))state.selected=null;try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}try{window.daybillRefresh&&window.daybillRefresh()}catch(e){}}}
document.addEventListener('focusout',()=>setTimeout(()=>{if(pendingRemote&&!editingNow()){const d=pendingRemote;pendingRemote=null;applyProjects(d)}},0));

/* Selle seadme andmed kuuluvad ühele kontole (daybill.owner). Kui sisse logib teine konto, tühjendatakse seade
   ja uus kasutaja alustab puhtalt: teise inimese projektid, arved ega admini seaded ei jõua kunagi tema kontole. */
const OWNER='daybill.owner',KEEP=new Set(['daybill.theme','daybill.installHidden','hoursLang']);
function wipe(){try{const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('daybill.')&&!KEEP.has(k))ks.push(k)}for(const k of ks)localStorage.removeItem(k)}catch(e){}}
function ownerOf(){try{const o=localStorage.getItem(OWNER);if(o)return o;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';const m=k.match(/^daybill\.(?:pushed|lastSync)\.(.+)$/);if(m)return m[1]}}catch(e){}return ''}
function own(u){const o=ownerOf();if(o&&o!==u.uid){wipe();try{localStorage.setItem(OWNER,u.uid)}catch(e){}window.daybillWiping=true;location.reload();return false}
 try{localStorage.setItem(OWNER,u.uid)}catch(e){}return true}
// Kas mõni muudatus on veel pilve saatmata?
function unsynced(){if(!user)return 0;let n=0;try{for(const p of state.projects)if(pushed.get('p:'+p.id)!==hash(p.deleted?'deleted':fp(p)))n++;for(const x of window.TraageldusInvoices.all())if(pushed.get('i:'+x.id)!==hash(x.deleted?'deleted':fp(x)))n++;const L=window.DaybillLog;if(L)for(const e of L.all())if(!pushed.get('l:'+e.id))n++}catch(e){}return n}
async function signOut(){const n=unsynced();
 if(n){projectsChanged();if(!confirm('Mõni muudatus pole veel pilve jõudnud. Kui logid nüüd välja, kaovad need sellest seadmest. Oota paar sekundit, kuni ülal on roheline täpp, ja proovi uuesti. Kas login ikkagi välja?'))return}
 else if(!confirm('Login välja. Sinu projektid ja arved jäävad kontole alles ning see seade tühjendatakse. Järgmine kord logi sama e-postiga sisse ja kõik tuleb tagasi.'))return;
 window.daybillWiping=true;for(const f of unsub)f();unsub=[];try{await fb.A.signOut(fb.auth)}catch(e){}wipe();location.reload()}

// Kui kuulaja katkeb (nt kohe pärast konto loomist), proovitakse paari sekundi pärast uuesti.
let retryTimer=null,retries=0;
function retry(u){setStatus('Sünk ootab ühendust');clearTimeout(retryTimer);if(retries>20)return;retryTimer=setTimeout(()=>{retries++;if(user&&user.uid===u.uid)start(u)},Math.min(60000,3000*(retries+1)))}
async function start(u){if(u&&!own(u))return;user=u;for(const f of unsub)f();unsub=[];if(!u){setStatus('Andmed on selles seadmes · logi seadetes sisse, et sünkida','off');return}
 const {F,db}=fb;setStatus('Sünkroonin…');
 loadPushed();const since=lastSync(),first=!since;
 // Loetakse ainult muudatused pärast viimast sünki (u > since), nii jäävad tasuta paketi lugemised väikseks.
 const q=c=>F.query(F.collection(db,'users',u.uid,c),F.where('u','>',since));
 let firstProjects=true,firstInvoices=true;
 unsub.push(F.onSnapshot(q('projects'),snap=>{const docs=snap.docChanges().filter(c=>c.type!=='removed'&&!c.doc.metadata.hasPendingWrites).map(c=>({...c.doc.data(),id:c.doc.id}));
  if(docs.length)applyProjects(docs);
  if(firstProjects&&!snap.metadata.fromCache){firstProjects=false;if(first){const remote=new Set(snap.docs.map(d=>d.id));for(const p of state.projects)if(!remote.has(p.id))pushed.delete('p:'+p.id)}projectsChanged()}
  setStatus(snap.metadata.fromCache?'Ilma internetita · muudatused saadetakse hiljem':'Sünkroonitud · '+u.email,snap.metadata.fromCache?'wait':'ok')},()=>retry(u)));
 unsub.push(F.onSnapshot(q('invoices'),snap=>{const T=window.TraageldusInvoices,ch=snap.docChanges().filter(c=>c.type!=='removed'&&!c.doc.metadata.hasPendingWrites);
  const docs=[];for(const c of ch){const d=c.doc.data();seen(d.u||0);if(d.deleted){T.receive([{id:c.doc.id,deleted:true,_u:d.u}]);continue}try{docs.push(JSON.parse(d.data))}catch(e){}}if(docs.length)T.receive(docs);
  if(firstInvoices&&!snap.metadata.fromCache){firstInvoices=false;const remote=new Set(snap.docs.map(d=>d.id));for(const x of T.all())if((first&&!remote.has(x.id))||pushed.get('i:'+x.id)!==hash(x.deleted?'deleted':fp(x)))pushInvoice(x);
   // olemasolevate numbrite register, et teine seade ei saaks neid kasutada
   if(first){const ref=F.doc(db,'users',u.uid,'meta','numbers'),used={};for(const x of T.all()){const k=(x.numberFormat||'month')+'|'+x.period;(used[k]??=[]).push(x.seq)}
    if(Object.keys(used).length)F.runTransaction(db,async t=>{const s=await t.get(ref);const cur=s.exists()?s.data():{};const next={};for(const [k,v] of Object.entries(used))next[k]=[...new Set([...(cur[k]||[]),...v])];t.set(ref,next,{merge:true})}).catch(()=>{})}}},()=>retry(u)));
 let firstLog=true;
 unsub.push(F.onSnapshot(q('log'),snap=>{const L=window.DaybillLog;if(!L)return;const docs=[];for(const c of snap.docChanges()){if(c.type==='removed'||c.doc.metadata.hasPendingWrites)continue;const d=c.doc.data();seen(d.u||0);try{docs.push(JSON.parse(d.data))}catch(e){}}if(docs.length)L.receive(docs);
  if(firstLog&&!snap.metadata.fromCache){firstLog=false;for(const e of L.all())if(!pushed.get('l:'+e.id))pushLog(e)}},()=>{}));
 unsub.push(F.onSnapshot(F.doc(db,'users',u.uid,'meta','settings'),s=>{if(s.metadata.hasPendingWrites)return;const l=window.DaybillSettings.get();if(!s.exists()){if(l._u)pushSettings(l);return}try{const r=JSON.parse(s.data().data);if((r._u||0)>(l._u||0))window.DaybillSettings.save(r,true);else if((l._u||0)>(r._u||0))pushSettings(l)}catch(e){}}))}

/* ---------- konto (seadetes) ---------- */
function msgOf(e){const c=e&&e.code||'';return {'auth/invalid-email':'E-post on vale.','auth/missing-password':'Kirjuta parool.','auth/weak-password':'Parool peab olema vähemalt 6 märki.','auth/email-already-in-use':'Selle e-postiga konto on juba olemas: logi sisse.','auth/invalid-credential':'E-post või parool on vale. Kui unustasid parooli, vajuta „Unustasin parooli”.','auth/wrong-password':'E-post või parool on vale. Kui unustasid parooli, vajuta „Unustasin parooli”.','auth/user-not-found':'Sellise e-postiga kontot pole: loo konto.','auth/too-many-requests':'Liiga palju katseid. Proovi mõne minuti pärast.','auth/network-request-failed':'Internet puudub.','auth/requires-recent-login':'Logi uuesti sisse ja proovi siis uuesti.'}[c]||e.message||String(e)}
let loadFailed=false;
function renderBox(el){if(!el)return;if(!cfg){el.innerHTML='<p class="help">Sünkroonimine ei käivitunud. Praegu on andmed ainult selles seadmes.</p>';return}if(!fb){el.innerHTML=loadFailed?'<p class="help">Sünkroonimine ei käivitunud. Kontrolli internetiühendust ja ava Daybill uuesti. Sinu andmed on selles seadmes alles.</p>':'<p class="help">Laen…</p>';return}
 if(user){el.innerHTML=`<p class="help">Sisse logitud: <strong>${esc(user.email)}</strong>. Logi samaga sisse ka telefonis ja arvutis: projektid, tunnid ja arved on mõlemas.</p><p class="help" id="syncState">${esc(status)}</p><div class="actions"><button type="button" id="syOut">Logi välja</button><button type="button" id="syDel">Kustuta konto ja pilves olevad andmed</button></div><p class="error" id="syErr" role="alert"></p>`;
  $('syOut').onclick=signOut;
  $('syDel').onclick=async()=>{if(!confirm('Kustutan sinu konto ja kõik pilves olevad andmed (projektid, arved). Selles seadmes olevad andmed jäävad alles. Seda ei saa tagasi võtta. Jätkan?'))return;try{const {F,db}=fb,uid=user.uid;for(const c of ['projects','invoices','meta','log']){const s=await F.getDocs(F.collection(db,'users',uid,c));for(const d of s.docs)await F.deleteDoc(d.ref)}await fb.A.deleteUser(user);try{for(const k of [OWNER,'daybill.pushed.'+uid,'daybill.lastSync.'+uid])localStorage.removeItem(k)}catch(e){}renderBox(el)}catch(e){$('syErr').textContent=msgOf(e)}};return}
 el.innerHTML=`<p class="help">Logi sisse samal e-postiga telefonis ja arvutis. Siis näed telefonis tehtud tööpäevi kohe arvutis. Konto on tasuta.</p><form id="syForm"><div class="grid"><div><label for="syEmail">E-post (see on sinu kasutajanimi)</label><input id="syEmail" type="email" autocomplete="email" required></div><div><label for="syPass">Parool (vähemalt 6 märki)</label><input id="syPass" type="password" autocomplete="current-password" required minlength="6"></div></div><div class="actions" style="margin-top:14px"><button class="primary" id="syIn">Logi sisse</button><button type="button" id="syNew">Loo uus konto</button><button type="button" id="syForgot">Unustasin parooli</button></div><p class="error" id="syErr" role="alert"></p><p class="help" id="syInfo" role="status"></p></form>`;
 const go=async create=>{const e=$('syEmail').value.trim(),p=$('syPass').value;$('syErr').textContent='';try{if(create)await fb.A.createUserWithEmailAndPassword(fb.auth,e,p);else await fb.A.signInWithEmailAndPassword(fb.auth,e,p);renderBox(el)}catch(x){$('syErr').textContent=msgOf(x)}};
 $('syForm').onsubmit=ev=>{ev.preventDefault();go(false)};$('syNew').onclick=()=>{if($('syForm').reportValidity())go(true)};
 $('syForgot').onclick=async()=>{const em=$('syEmail'),e=em.value.trim(),info=$('syInfo');$('syErr').textContent='';info.innerHTML='';if(!e||!em.checkValidity()){$('syErr').textContent='Kirjuta ülemisse lahtrisse oma e-post ja vajuta uuesti „Unustasin parooli”.';em.focus();return}try{fb.auth.languageCode=(window.HoursI18n&&window.HoursI18n.lang)==='et'?'et':'en';await fb.A.sendPasswordResetEmail(fb.auth,e,{url:'https://daybill-app.web.app/'});info.innerHTML='<strong>Saatsin parooli muutmise lingi.</strong> <span translate="no">'+esc(e)+'</span><br><span>Ava see kiri, vajuta lingil, pane uus parool ja logi siin sisse.</span> <span>Kui kirja paari minutiga pole, vaata rämpsposti.</span> <span>Kui ka seal pole, ei ole sellel aadressil Daybilli kontot: proovi oma teist e-posti aadressi.</span>'}catch(x){$('syErr').textContent=msgOf(x)}}}
window.daybillRenderSync=renderBox;

if(cfg){setStatus('Ühendan…');load().then(x=>{fb=x;window.daybillSaved=projectsChanged;window.daybillInvoiceSaved=pushInvoice;window.daybillSettingsSaved=pushSettings;window.daybillLogSaved=pushLog;window.daybillReserveNumber=x2=>user?reserve(x2):Promise.resolve();
 fb.A.onAuthStateChanged(fb.auth,u=>{start(u);const box=$('syncBox');if(box)renderBox(box)})}).catch(()=>{loadFailed=true;setStatus('Sünkroonimine ei käivitunud · andmed on selles seadmes alles','err');const box=$('syncBox');if(box)renderBox(box)})}
else setStatus('Andmed on selles seadmes','err');
