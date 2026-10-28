/* Daybill · arved.
   Arve number antakse ainult üks kord ja seda ei kasutata kunagi uuesti (ka tühistatud või kreeditarvega arve number jääb kinni).
   Väljastatud arve andmeid ei muudeta; parandus = kreeditarve + uus arve. Müüja andmed salvestatakse arvele väljastamise hetkel. */
'use strict';
(function(){
const INV_KEY='daybill.invoices.v1',SET_KEY='daybill.settings.v1';
const $i=id=>document.getElementById(id);
const escH=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r2=n=>{const v=Number(n)||0;return v<0?-Math.round((-v+Number.EPSILON)*100)/100:Math.round((v+Number.EPSILON)*100)/100};
const pad=(n,l=2)=>String(n).padStart(l,'0');
const isoToday=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const addDays=(iso,n)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+Number(n||0));return d.toISOString().slice(0,10)};
const dmy=iso=>{const [y,m,d]=String(iso||'').split('-');return d?d+'.'+m+'.'+y:''};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const eurUi=n=>new Intl.NumberFormat('et-EE',{style:'currency',currency:'EUR'}).format(r2(n));
const num2=(n,lang)=>r2(n).toLocaleString(lang==='en'?'en-GB':'et-EE',{minimumFractionDigits:2,maximumFractionDigits:2});

/* ---------- seaded (müüja andmed) ---------- */
const SETTINGS_DEFAULT={name:'',reg:'',vatNo:'',vatPayer:true,street:'',city:'',country:'Eesti',email:'',phone:'',bank:'',iban:'',approver:'',vat:24,days:7,numberFormat:'month',firstSeq:1,filePrefix:'',lang:'et',vatNote:''};
function loadSettings(){try{return {...SETTINGS_DEFAULT,...JSON.parse(localStorage.getItem(SET_KEY)||'{}')}}catch(e){return {...SETTINGS_DEFAULT}}}
let settings=loadSettings();
function saveSettings(next,fromSync){settings={...settings,...next};if(!fromSync)settings._u=Date.now();try{localStorage.setItem(SET_KEY,JSON.stringify(settings))}catch(e){}if(!fromSync)try{window.daybillSettingsSaved&&window.daybillSettingsSaved(settings)}catch(e){}}
function sellerReady(){return !!(settings.name.trim()&&settings.iban.trim()&&settings.street.trim())}

/* ---------- register ---------- */
let list=[];
function loadList(){try{const s=JSON.parse(localStorage.getItem(INV_KEY)||'[]');if(Array.isArray(s))list=s}catch(e){}}
function saveList(changed){try{localStorage.setItem(INV_KEY,JSON.stringify(list))}catch(e){alertBox('Arvet ei saanud selle seadme mällu salvestada. Ära sulge lehte, tee varukoopia.')}for(const x of changed||[])try{window.daybillInvoiceSaved&&window.daybillInvoiceSaved(x)}catch(e){}}
loadList();
const live=()=>list.filter(x=>!x.deleted);
const creditsOf=x=>live().filter(c=>c.credit&&c.creditFor===x.id);
function credited(x){return !x.credit&&creditsOf(x).reduce((s,c)=>s+c.gross,0)<=-x.gross+0.005}
function status(x){if(x.credit)return ['Kreeditarve','credit'];if(credited(x))return ['Krediteeritud','credited'];if(x.paidAt||x.paid)return ['Makstud','paid'];if(x.due<isoToday())return ['Üle tähtaja','overdue'];return ['Ootab makset','open']}
function forProject(pid){if(!pid)return [];return live().filter(x=>(x.hoursProject===pid||'inv'+x.id===pid)&&!x.credit).map(x=>({id:x.id,number:x.number,date:x.date,gross:x.gross,hoursNet:Number(x.hoursNet??x.net)||0,status:status(x)[0],fullyCredited:credited(x),net:x.net,desc:String(x.rows&&x.rows[0]&&x.rows[0].desc||'')}))}

/* ---------- numeratsioon: NNN/KKAA (igal kuul 001) või AAAA-NNN ---------- */
function periodOf(date,fmt=settings.numberFormat){return fmt==='year'?date.slice(0,4):date.slice(5,7)+date.slice(2,4)}
function formatNumber(seq,period,fmt){return fmt==='year'?period+'-'+pad(seq,3):pad(seq,3)+'/'+period}
// Kõik kunagi antud numbrid samas perioodis on kinni, ka tühistatud ja kustutatud kirjetel.
function usedSeqs(period,fmt){return new Set(list.filter(x=>x.period===period&&(x.numberFormat||'month')===fmt).map(x=>Number(x.seq)))}
function nextNumber(date){const fmt=settings.numberFormat,period=periodOf(date,fmt),used=usedSeqs(period,fmt);let seq=used.size?Math.max(...used)+1:Math.max(1,Number(settings.firstSeq)||1);while(used.has(seq))seq++;return {seq,period,fmt,number:formatNumber(seq,period,fmt)}}
// Hoursist toodud arved (admin) kuuluvad Hoursi registrisse: nende numbreid kontrollib Hours.
const admin=()=>!!settings.hoursAdmin;
function integrity(){const errs=[],seen=new Map();for(const x of list){if(x.deleted||x.fromHours)continue;const k=(x.numberFormat||'month')+'|'+x.number;if(seen.has(k))errs.push(`Number ${x.number} on registris kaks korda (${seen.get(k).client.name} ja ${x.client.name}). Uusi arveid ei koostata enne, kui see on lahendatud.`);else seen.set(k,x)}return errs}

/* ---------- summa sõnadega ---------- */
const ONES=['','üks','kaks','kolm','neli','viis','kuus','seitse','kaheksa','üheksa'];
function under1000(n){const out=[];const h=Math.floor(n/100),t=Math.floor(n%100/10),o=n%10;if(h)out.push(ONES[h]+'sada');if(t===1){out.push(o===0?'kümme':ONES[o]+'teist')}else{if(t)out.push(ONES[t]+'kümmend');if(o)out.push(ONES[o])}return out.join(' ')}
function wordsEt(n){n=Math.floor(n);if(n===0)return 'null';const parts=[],mil=Math.floor(n/1e6),th=Math.floor(n%1e6/1000),rest=n%1000;if(mil)parts.push(under1000(mil)+(mil===1?' miljon':' miljonit'));if(th)parts.push(under1000(th)+' tuhat');if(rest)parts.push(under1000(rest));return parts.join(' ')}
const EN1=['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'],EN10=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function enUnder1000(n){const out=[],h=Math.floor(n/100),r=n%100;if(h)out.push(EN1[h]+' hundred');if(r){if(r<20)out.push(EN1[r]);else out.push(EN10[Math.floor(r/10)]+(r%10?'-'+EN1[r%10]:''))}return out.join(' ')}
function wordsEn(n){n=Math.floor(n);if(n===0)return 'zero';const parts=[],mil=Math.floor(n/1e6),th=Math.floor(n%1e6/1000),rest=n%1000;if(mil)parts.push(enUnder1000(mil)+' million');if(th)parts.push(enUnder1000(th)+' thousand');if(rest)parts.push(enUnder1000(rest));return parts.join(' ')}
function amountWords(x,lang='et'){const c=Math.round(r2(x)*100);if(c<0)return (lang==='en'?'minus ':'miinus ')+amountWords(-c/100,lang);const e=Math.floor(c/100),s=pad(c%100);return lang==='en'?wordsEn(e)+' euros and '+s+' cents':wordsEt(e)+' eurot ja '+s+' senti'}

/* ---------- PDF (vektor, Helvetica, nagu Hoursi tunniaruanne) ---------- */
const W={" ":278,"!":278,"\"":355,"#":556,"$":556,"%":889,"&":667,"'":191,"(":333,")":333,"*":389,"+":584,",":278,"-":333,".":278,"/":278,":":278,";":278,"<":584,"=":584,">":584,"?":556,"@":1015,"A":667,"B":667,"C":722,"D":722,"E":667,"F":611,"G":778,"H":722,"I":278,"J":500,"K":667,"L":556,"M":833,"N":722,"O":778,"P":667,"Q":778,"R":722,"S":667,"T":611,"U":722,"V":667,"W":944,"X":667,"Y":667,"Z":611,"[":278,"\\":278,"]":278,"^":469,"_":556,"`":333,"a":556,"b":556,"c":500,"d":556,"e":556,"f":278,"g":556,"h":556,"i":222,"j":222,"k":500,"l":222,"m":833,"n":556,"o":556,"p":556,"q":556,"r":333,"s":500,"t":278,"u":556,"v":500,"w":722,"x":500,"y":500,"z":500,"€":556,"–":556,"—":1000,"„":333,"“":333,"”":333};
const base=c=>c.normalize('NFD')[0];
function textW(t,size,bold){return [...String(t)].reduce((s,c)=>{let w=W[c]??W[base(c)]??556;if(bold&&!/[0-9.,\s€]/.test(c))w*=1.06;return s+w},0)*size/1000}
const WINANSI={'Š':138,'š':154,'Ž':142,'ž':158,'€':128,'–':150,'—':151,'’':146,'‘':145,'“':147,'”':148,'„':132};
const encode=str=>Array.from(str,c=>WINANSI[c]??(c.charCodeAt(0)<256?c.charCodeAt(0):63));
function wrapText(t,width,size,bold){const out=[];for(const para of String(t).split(/\r?\n/)){let cur='';for(let w of para.split(/\s+/).filter(Boolean)){while(textW(w,size,bold)>width){let i=w.length;while(i>1&&textW(w.slice(0,i),size,bold)>width)i--;if(cur){out.push(cur);cur=''}out.push(w.slice(0,i));w=w.slice(i)}const next=cur?cur+' '+w:w;if(textW(next,size,bold)>width&&cur){out.push(cur);cur=w}else cur=next}out.push(cur)}return out}
function pdfDoc(){const pages=[];let cmd=[],img=null,imgPages=[];
 const esc=s=>String(s).replace(/[\\()]/g,'\\$&');
 const api={
  text(x,y,t,o={}){const size=o.size||10,font=o.bold?'F2':'F1';let px=x;if(o.align==='right')px=x-textW(t,size,o.bold);else if(o.align==='center')px=x-textW(t,size,o.bold)/2;cmd.push(`BT /${font} ${size} Tf 1 0 0 1 ${px.toFixed(2)} ${(842-y).toFixed(2)} Tm (${esc(t)}) Tj ET`)},
  line(x1,y1,x2,y2,w=0.5){cmd.push(`${w} w ${x1} ${842-y1} m ${x2} ${842-y2} l S`)},
  // Logo: JPEG (base64), joonistatakse kastis vasakule üles.
  image(x,y,w,h,logo){img=logo;cmd.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(842-y-h).toFixed(2)} cm /Im1 Do Q`)},
  newPage(){if(cmd.length)pages.push(cmd.join('\n'));cmd=[]},
  bytes(){api.newPage();const objs=['<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'],kids=[];
   let xo='';if(img){const bin=atob(img.data);objs.push(`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bin.length} >>\nstream\n${bin}\nendstream`);xo=` /XObject << /Im1 ${objs.length} 0 R >>`}
   for(const content of pages){const n=objs.length+1;kids.push(`${n} 0 R`);objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xo} >> /Contents ${n+1} 0 R >>`);objs.push(`<< /Length ${encode(content).length} >>\nstream\n${content}\nendstream`)}
   objs[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
   let out='%PDF-1.4\n';const offs=[];objs.forEach((o,i)=>{offs.push(encode(out).length);out+=`${i+1} 0 obj\n${o}\nendobj\n`});const xref=encode(out).length;
   out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
   return new Uint8Array(encode(out))}};
 return api}

const L={
 et:{invoice:'ARVE',credit:'KREEDITARVE',to:'Arve saaja',date:'Arve kuupäev',no:'Arve nr',creditFor:'Krediteeritav arve nr',desc:'Kaubad, teenused',qty:'Kogus',price:'Hind',sum:'Kokku',net:'Kokku ilma KM-ta',vat:'Käibemaks',noVat:'Käibemaksuta',total:'Tasumisele kuuluv summa',creditTotal:'Kreeditarve summa',words:'Summa sõnadega',days:'Makseaeg',daysUnit:'päeva',due:'Maksetähtaeg',approver:'Arve koostas',reg:'reg. nr',vatNo:'KMKR',iban:'IBAN',tel:'tel',email:'e-post',ref:'Palun märkige makse selgitusse arve number.',unit:'tk'},
 en:{invoice:'INVOICE',credit:'CREDIT NOTE',to:'Bill to',date:'Invoice date',no:'Invoice no',creditFor:'Credits invoice no',desc:'Description',qty:'Qty',price:'Price',sum:'Amount',net:'Total excl. VAT',vat:'VAT',noVat:'No VAT',total:'Amount due',creditTotal:'Credit total',words:'Amount in words',days:'Payment term',daysUnit:'days',due:'Due date',approver:'Issued by',reg:'reg. no',vatNo:'VAT no',iban:'IBAN',tel:'tel',email:'e-mail',ref:'Please quote the invoice number with your payment.',unit:'pcs'}};
function money(n,lang){return num2(n,lang)+' €'}
function invoicePdf(x){const lang=x.lang==='en'?'en':'et',T=L[lang],S=x.seller||settings,d=pdfDoc();let y=70;
 // logo (kui on) või müüja nimi
 const LG=S.logo||settings.logo;if(LG&&LG.data&&LG.w&&LG.h){const sc=Math.min(170/LG.w,48/LG.h);d.image(55,y-34,LG.w*sc,LG.h*sc,LG)}else d.text(55,y,S.name||'',{size:20,bold:true});d.text(540,y,x.credit?T.credit:T.invoice,{size:20,bold:true,align:'right'});y+=40;
 d.text(55,y,T.to+':',{bold:true,size:10});d.text(390,y,T.date+':',{bold:true,size:10});d.text(540,y,dmy(x.date),{size:10,align:'right'});y+=18;
 let cy=y;d.text(55,cy,x.client.name,{bold:true,size:11});cy+=15;for(const l of x.client.lines.filter(Boolean)){for(const w of wrapText(l,300,10)){d.text(55,cy,w,{size:10});cy+=13}}
 if(x.client.code){d.text(55,cy,(lang==='en'?'Reg. no ':'Registrikood ')+x.client.code,{size:10});cy+=13}if(x.client.vatNo){d.text(55,cy,T.vatNo+' '+x.client.vatNo,{size:10});cy+=13}
 d.text(390,y,T.no+':',{bold:true,size:10});d.text(540,y,x.number,{bold:true,size:10,align:'right'});
 if(!x.credit){d.text(390,y+15,T.due+':',{bold:true,size:10});d.text(540,y+15,dmy(x.due),{size:10,align:'right'})}
 else{d.text(390,y+15,T.creditFor+':',{size:9});d.text(540,y+15,x.creditNumber||'',{size:10,align:'right'})}
 y=Math.max(cy,y+30)+26;
 // tabel
 const C={desc:55,qty:350,price:440,sum:540};
 d.line(55,y,540,y,0.8);y+=15;d.text(C.desc,y,T.desc,{bold:true,size:9.5});d.text(C.qty,y,T.qty,{bold:true,size:9.5,align:'right'});d.text(C.price,y,T.price,{bold:true,size:9.5,align:'right'});d.text(C.sum,y,T.sum,{bold:true,size:9.5,align:'right'});y+=8;d.line(55,y,540,y);y+=16;
 for(const r of x.rows){const lines=wrapText(r.desc,255,10);if(y+lines.length*13>700){d.newPage();y=70}lines.forEach((l,i)=>d.text(C.desc,y+i*13,l,{size:10}));d.text(C.qty,y,num2(r.qty,lang).replace(/[.,]00$/,'')+' '+(r.unit||T.unit),{size:10,align:'right'});d.text(C.price,y,money(r.price,lang),{size:10,align:'right'});d.text(C.sum,y,money(r.total,lang),{size:10,align:'right'});y+=Math.max(1,lines.length)*13+9}
 d.line(55,y-4,540,y-4);y+=14;
 const vatLabel=x.vatRate>0?T.vat+' '+String(x.vatRate).replace('.',',')+'%':T.noVat;
 d.text(440,y,T.net,{size:10,align:'right'});d.text(540,y,money(x.net,lang),{size:10,align:'right'});y+=16;
 d.text(440,y,vatLabel,{size:10,align:'right'});d.text(540,y,money(x.vat,lang),{size:10,align:'right'});y+=8;d.line(300,y,540,y);y+=16;
 d.text(440,y,x.credit?T.creditTotal:T.total,{bold:true,size:11,align:'right'});d.text(540,y,money(x.gross,lang),{bold:true,size:11,align:'right'});y+=26;
 d.text(55,y,T.words+': '+x.words,{size:9.5});y+=16;
 if(S.vatNote){d.text(55,y,S.vatNote,{size:9.5});y+=16}
 if(!x.credit){y+=6;d.text(55,y,T.days+': '+x.days+' '+T.daysUnit+' · '+T.due+': '+dmy(x.due),{bold:true,size:10});y+=15;d.text(55,y,T.ref,{size:9.5});y+=15}
 if(S.approver){y+=20;d.text(55,y,T.approver+': '+S.approver,{size:10})}
 // jalus: müüja andmed
 const fy=770;d.line(55,fy-14,540,fy-14);
 const col1=[S.name,S.street,S.city,S.country].filter(Boolean),col2=[S.phone&&T.tel+' '+S.phone,S.email&&T.email+' '+S.email].filter(Boolean),col3=[S.bank,S.iban&&T.iban+' '+S.iban,S.reg&&T.reg+' '+S.reg,S.vatNo&&T.vatNo+' '+S.vatNo].filter(Boolean);
 col1.forEach((t,i)=>d.text(55,fy+i*12,t,{size:8.5}));col2.forEach((t,i)=>d.text(297,fy+i*12,t,{size:8.5,align:'center'}));col3.forEach((t,i)=>d.text(540,fy+i*12,t,{size:8.5,align:'right'}));
 return d.bytes()}
function fileName(x){const clean=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'').replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,' ').trim();const pre=clean(settings.filePrefix||settings.name||'Arve').replace(/\s+/g,'_');return `${pre}_${x.lang==='en'?'invoice':'arve'}_${clean(x.number).replace(/\//g,'_')} ${clean(x.client.name)}${x.credit?(x.lang==='en'?' credit note':' kreeditarve'):''}.pdf`}
async function deliverPdf(x,{share=false}={}){const bytes=invoicePdf(x),name=fileName(x),blob=new Blob([bytes],{type:'application/pdf'});
 if(share&&navigator.canShare){const file=new File([blob],name,{type:'application/pdf'});if(navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:name,text:shareText(x)});return true}catch(e){if(e.name==='AbortError')return false}}}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);return true}
function shareText(x){return x.lang==='en'?`Hello,\n\nplease find attached invoice ${x.number} (${money(x.gross,'en')}), due ${dmy(x.due)}.\n\nBest regards,\n${settings.approver||settings.name}`:`Tere!\n\nSaadan arve ${x.number} summas ${money(x.gross,'et')}, maksetähtaeg ${dmy(x.due)}.\n\nParimate soovidega\n${settings.approver||settings.name}`}

/* ---------- mustand ---------- */
function fresh(){return {date:isoToday(),days:settings.days,vat:settings.vatPayer?settings.vat:0,lang:settings.lang||'et',client:{name:'',code:'',vatNo:'',line1:'',line2:'',email:''},rows:[{desc:'',qty:1,unit:'',price:''}],hoursProject:'',allowRebill:false}}
let draft=fresh(),tab='new',filter={year:String(new Date().getFullYear()),status:'all',q:''},msg='';
function computed(d=draft){const rows=d.rows.filter(r=>String(r.desc).trim()||Number(r.price)).map(r=>{const qty=Number(String(r.qty).replace(',','.'))||0,price=r2(Number(String(r.price).replace(',','.'))||0);return {desc:String(r.desc).trim().replace(/[“”„″]/g,'"').replace(/[‘’]/g,"'"),qty,unit:String(r.unit||'').trim(),price,total:r2(qty*price)}});const net=r2(rows.reduce((s,r)=>s+r.total,0)),vatRate=Number(d.vat)||0,vat=r2(net*vatRate/100);return {rows,net,vatRate,vat,gross:r2(net+vat),due:addDays(d.date,d.days)}}
function clientPool(){const seen=new Set(),pool=[];for(const x of [...live()].reverse()){if(x.credit)continue;const k=norm(x.client.name);if(!k||seen.has(k))continue;seen.add(k);pool.push(x.client)}return pool}
function hoursProjects(){try{return (state.projects||[]).filter(p=>!p.deleted&&!p.kind)}catch(e){return []}}
function projectById(id){return hoursProjects().find(p=>p.id===id)}
function periodText(p){const ds=(p.entries||[]).map(e=>e.date).concat((p.expenses||[]).map(c=>c.date)).filter(Boolean).sort();if(!ds.length)return '';const a=dmy(ds[0]),b=dmy(ds.at(-1));return a===b?a:a+' – '+b}
function fromProject(pid){const p=projectById(pid);if(!p)return;let t;try{t=projectTotals(p)}catch(e){alertBox(e.message);return}
 const lang=p.reportLang==='et'?'et':(settings.lang||'et');draft=fresh();draft.lang=lang;draft.hoursProject=p.id;draft.vat=Number(p.vat)||0;
 const job=[...new Set((p.entries||[]).map(e=>e.job).filter(Boolean))].join(', ')||p.job||'';const per=periodText(p);
 const workDesc=[(lang==='en'?'Project ':'Projekt ')+'"'+p.name+'"',[job,per].filter(Boolean).join(' '),p.pricing==='fixed'&&p.fixedNote?p.fixedNote:''].filter(Boolean).join('\n');
 draft.rows=[];if(t.hours)draft.rows.push({desc:workDesc,qty:1,unit:'',price:t.hours});
 for(const c of costRows(p))draft.rows.push({desc:c.desc+(c.date?' ('+dmy(c.date)+')':''),qty:c.qty,unit:'',price:c.price});
 if(!draft.rows.length)draft.rows.push({desc:workDesc,qty:1,unit:'',price:''});
 const bk=p.bookkeeper||{};if(bk.companyName){draft.client.name=bk.companyName;draft.client.code=bk.companyCode||'';draft.client.line1=bk.companyAddress||''}
 else if(p.client){Object.assign(draft.client,p.client)}
 const known=clientPool().find(c=>norm(c.name)===norm(draft.client.name));if(known)fillClient(known);
 tab='new';msg='';show('inv');render()}
function fillClientFields(c){fillClient(c);for(const [id,k] of [['invCode','code'],['invVatNo','vatNo'],['invEmail','email'],['invLine1','line1'],['invLine2','line2']]){const el=$i(id);if(el&&!el.value)el.value=draft.client[k]}}
function fillClient(c){draft.client={name:c.name||'',code:c.code||'',vatNo:c.vatNo||'',line1:(c.lines||[])[0]||c.line1||'',line2:(c.lines||[])[1]||c.line2||'',email:c.email||''}}

/* ---------- kontroll enne koostamist ---------- */
function problems(){const out=[],c=computed();if(!sellerReady())out.push('Arvepõhi on veel täitmata: ava Arve → Arvepõhi ja kirjuta sinna vähemalt nimi, aadress ja IBAN. Need tulevad arvele.');
 if(!draft.client.name.trim())out.push('Kirjuta arve saaja nimi.');if(!c.rows.length)out.push('Lisa vähemalt üks rida kirjelduse ja hinnaga.');
 if(c.rows.some(r=>!r.desc))out.push('Igal real peab olema kirjeldus.');if(c.rows.some(r=>r.qty<=0))out.push('Kogus peab olema suurem kui 0.');
 if(!(c.gross>0))out.push('Arve summa peab olema suurem kui 0.');if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date))out.push('Vali arve kuupäev.');
 if(draft.date>isoToday())out.push('Arve kuupäev ei saa olla tulevikus.');
 const later=live().filter(x=>(x.numberFormat||'month')===settings.numberFormat&&x.period===periodOf(draft.date)&&x.date>draft.date);if(later.length)out.push(`Samas perioodis on juba hilisema kuupäevaga arve (${later.map(x=>x.number).join(', ')}). Numbrid peavad kasvama koos kuupäevaga: vali kuupäev ${dmy(later.map(x=>x.date).sort().at(-1))} või hiljem.`);
 if(draft.hoursProject&&!draft.allowRebill){const billed=forProject(draft.hoursProject).filter(x=>!x.fullyCredited).map(x=>x.number);if(billed.length)out.push(`See projekt on juba arveldatud (${billed.join(', ')}). Topeltarvet ei koostata. Kui see on tõesti eraldi lisaarve, märgi „See on eraldi lisaarve”.`)}
 out.push(...integrity());return out}
function build(extra={}){const c=computed(),n=nextNumber(draft.date),now=new Date().toISOString();const S={...settings};delete S.logo;delete S._u;delete S._u;
 return {id:uid(),number:n.number,seq:n.seq,period:n.period,numberFormat:n.fmt,date:draft.date,days:Number(draft.days)||0,due:c.due,lang:draft.lang,
  client:{name:draft.client.name.trim(),code:draft.client.code.trim(),vatNo:draft.client.vatNo.trim(),lines:[draft.client.line1,draft.client.line2].map(s=>s.trim()).filter(Boolean),email:draft.client.email.trim()},
  rows:c.rows,vatRate:c.vatRate,net:c.net,vat:c.vat,gross:c.gross,words:amountWords(c.gross,draft.lang),hoursProject:draft.hoursProject||'',hoursNet:draft.hoursProject?c.net:undefined,
  seller:S,createdAt:now,_u:Date.now(),sent:[],...extra}}
async function issue(){msg='';if(admin()){alertBox('Sinu arved teeb Hours (Macis), et numeratsioon oleks ühes kohas.');return}const errs=problems();if(errs.length){msg=errs.map(escH).join('<br>');render();return}
 const x=build();if(!confirm(`Koostan arve ${x.number} (${x.client.name}, ${eurUi(x.gross)}).\n\nArve numbrit ei saa hiljem muuta ega uuesti kasutada. Jätkan?`))return;
 try{if(window.daybillReserveNumber)await window.daybillReserveNumber(x)}catch(e){alertBox(e.message||String(e));return}
 list.push(x);saveList([x]);const pid=x.hoursProject;draft=fresh();tab='list';msg=`Arve ${escH(x.number)} on koostatud ja salvestatud. PDF laaditi alla.`;await deliverPdf(x);render();try{if(pid&&typeof render==='function'&&window.hoursInvoicesChanged)window.hoursInvoicesChanged()}catch(e){}}
function preview(){const c=computed();if(!c.rows.length){msg='Lisa vähemalt üks rida.';render();return}const x=build({number:(draft.lang==='en'?'DRAFT ':'EELVAADE ')+nextNumber(draft.date).number});deliverPdf(x)}
function update(x,changes){Object.assign(x,changes,{_u:Date.now(),updatedAt:new Date().toISOString()});saveList([x]);render();try{window.hoursInvoicesChanged&&window.hoursInvoicesChanged()}catch(e){}}
function creditNote(x){if(admin()||x.fromHours){alertBox('Kreeditarve tee Hoursis (Macis), kus on sinu arvete register.');return}if(credited(x)){alertBox('See arve on juba täielikult krediteeritud.');return}if(!confirm(`Koostan kreeditarve arvele ${x.number}. See tühistab arve summa (${eurUi(x.gross)}). Jätkan?`))return;
 const saved={...draft};draft={...fresh(),date:isoToday()<x.date?x.date:isoToday(),lang:x.lang,vat:x.vatRate,client:{name:x.client.name,code:x.client.code||'',vatNo:x.client.vatNo||'',line1:x.client.lines[0]||'',line2:x.client.lines[1]||'',email:x.client.email||''},rows:x.rows.map(r=>({...r,price:-r.price}))};
 if(!sellerReady()){draft=saved;alertBox('Täida enne arvepõhi (Arve → Arvepõhi).');return}
 const c=build({credit:true,creditFor:x.id,creditNumber:x.number,days:0,due:draft.date});c.rows=x.rows.map(r=>({...r,price:-r.price,total:-r.total}));c.net=-x.net;c.vat=-x.vat;c.gross=-x.gross;c.words=amountWords(c.gross,c.lang);c.hoursProject=x.hoursProject||'';c.hoursNet=undefined;draft=saved;
 list.push(c);saveList([c]);msg=`Kreeditarve ${escH(c.number)} on koostatud. Arve ${escH(x.number)} on nüüd krediteeritud.`;deliverPdf(c);render();try{window.hoursInvoicesChanged&&window.hoursInvoicesChanged()}catch(e){}}
function alertBox(t){alert(t)}

/* ---------- vaade ---------- */
let root=null;
function mount(){root=document.createElement('section');root.id='invView';root.className='db-view hidden';document.querySelector('main').append(root)}
function render(){if(!root)return;const c=computed(),errs=integrity();const open=live().filter(x=>!x.credit&&!x.paidAt&&!x.paid&&!credited(x)),over=open.filter(x=>x.due<isoToday());
 root.innerHTML=`<div class="row top"><h1>Arved</h1></div>${window.daybillSendBox?window.daybillSendBox():''}
 ${!live().length?'':`<div class="inv-strip">${open.length?`Ootab makset ${open.length} arvet · ${eurUi(open.reduce((s,x)=>s+x.gross,0))}${over.length?` · <strong>üle tähtaja ${over.length}</strong>`:''}`:'Kõik arved on makstud.'}</div>`}
 ${errs.length?`<div class="inv-warn"><strong>Registris on viga.</strong><br>${errs.map(escH).join('<br>')}</div>`:''}
 ${msg?`<div class="inv-warn" role="status">${msg}</div>`:''}
 <nav class="actions inv-tabs"><button data-tab="new" class="${tab==='new'?'primary':''}">Uus arve</button><button data-tab="list" class="${tab==='list'?'primary':''}">Arhiiv</button><button data-tab="sum" class="${tab==='sum'?'primary':''}">Kokkuvõte</button><button data-tab="tpl" class="${tab==='tpl'?'primary':''}">Arvepõhi</button></nav>
 ${tab==='new'&&admin()?adminHtml():tab==='new'?newHtml(c):tab==='list'?listHtml():'<div id="invExtra"></div>'}`;
 try{window.daybillSendBind&&window.daybillSendBind()}catch(e){}
 root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;msg='';render()});
 if(tab==='new'&&admin()){const b=$i('invGoList');if(b)b.onclick=()=>{tab='list';msg='';render()}}else if(tab==='new')bindNew();else if(tab==='list')bindList();else try{window.daybillInvExtra(tab,$i('invExtra'))}catch(e){console.error(e)}}
function adminHtml(){const n=live().filter(x=>x.fromHours).length;
 return `<div class="section" style="padding-top:0"><h2>Arved teed Hoursis</h2><p class="help">Sinu konto on ühendatud sinu raamatupidamise programmiga Hours. Arve koostad Macis Hoursis: seal on arvete register, Dropboxi kaust ja raamatupidamine. Nii on arvete numeratsioon alati ühes kohas ja topeltarveid ei teki.</p><p class="help">Daybillis lõpetatud tööpäevad jõuavad Hoursi ise, kui Hours on Macis lahti. Hoursi arved ja nende laekumised tulevad siia tagasi (${n} arvet).</p><div class="actions"><button type="button" class="primary" id="invGoList">Vaata arveid</button></div></div>`}
function newHtml(c){const n=nextNumber(draft.date),projects=hoursProjects().filter(p=>!p.archived||p.id===draft.hoursProject);
 return `${sellerReady()?'':`<div class="inv-warn">Enne esimest arvet täida oma arvepõhi: logo, nimi, aadress ja IBAN. Seda teed ainult ühe korra. <button type="button" id="invGoSettings">Täida arvepõhi</button></div>`}
 <div class="section" style="padding-top:0"><div class="grid">
  <div class="full"><label for="invProject">Projekt · täidab read ja summa</label><select id="invProject"><option value="">Ilma projektita</option>${projects.map(p=>`<option value="${escH(p.id)}"${p.id===draft.hoursProject?' selected':''}>${escH(p.name)}</option>`).join('')}</select>
  ${draft.hoursProject&&forProject(draft.hoursProject).some(x=>!x.fullyCredited)?`<label class="check" style="margin-top:10px"><input type="checkbox" id="invRebill"${draft.allowRebill?' checked':''}> See on eraldi lisaarve samale projektile</label>`:''}</div>
 </div></div>
 <div class="section"><h2>Arve saaja</h2><div class="grid">
  <div class="full"><label for="invClient">Nimi</label><input id="invClient" list="invClients" autocomplete="off" value="${escH(draft.client.name)}"><datalist id="invClients">${clientPool().map(x=>`<option value="${escH(x.name)}">`).join('')}</datalist></div>
  <div><label for="invCode">Registrikood</label><input id="invCode" value="${escH(draft.client.code)}"></div>
  <div><label for="invVatNo">KMKR nr (kui on)</label><input id="invVatNo" value="${escH(draft.client.vatNo)}"></div>
  <div><label for="invEmail">E-post</label><input id="invEmail" type="email" value="${escH(draft.client.email)}"></div>
  <div class="full"><label for="invLine1">Aadress</label><input id="invLine1" value="${escH(draft.client.line1)}" placeholder="Tänav ja maja"></div>
  <div class="full"><input id="invLine2" value="${escH(draft.client.line2)}" placeholder="Postiindeks ja linn" aria-label="Aadressi teine rida"></div>
 </div></div>
 <div class="section"><h2>Read</h2><div class="table"><table class="inv-rows"><thead><tr><th style="width:55%">Kirjeldus</th><th>Kogus</th><th>Ühik</th><th>Hind · € ilma KM</th><th>Kokku</th><th></th></tr></thead><tbody>
  ${draft.rows.map((r,i)=>`<tr><td><textarea data-row="${i}" data-k="desc" rows="2">${escH(r.desc)}</textarea></td><td><input data-row="${i}" data-k="qty" inputmode="decimal" value="${escH(r.qty)}" style="width:64px"></td><td><input data-row="${i}" data-k="unit" value="${escH(r.unit)}" style="width:56px" placeholder="tk"></td><td><input data-row="${i}" data-k="price" inputmode="decimal" value="${escH(r.price)}" style="width:100px"></td><td>${eurUi(r2((Number(String(r.qty).replace(',','.'))||0)*(Number(String(r.price).replace(',','.'))||0)))}</td><td>${draft.rows.length>1?`<button type="button" data-del="${i}" aria-label="Kustuta rida">×</button>`:''}</td></tr>`).join('')}
 </tbody></table></div><div class="actions" style="margin-top:12px"><button type="button" id="invAddRow">+ Lisa rida</button></div></div>
 <div class="section"><div class="grid">
  <div><label for="invDate">Arve kuupäev</label><input id="invDate" type="date" value="${escH(draft.date)}" max="${isoToday()}"></div>
  <div><label for="invDays">Makseaeg · päeva</label><input id="invDays" type="number" min="0" value="${escH(draft.days)}"></div>
  <div><label for="invVat">Käibemaks · %</label><input id="invVat" type="number" min="0" max="100" step="0.01" value="${escH(draft.vat)}"></div>
  <div><label for="invLang">Arve keel</label><select id="invLang"><option value="et"${draft.lang==='et'?' selected':''}>Eesti</option><option value="en"${draft.lang==='en'?' selected':''}>Inglise</option></select></div>
  <div class="full"><label>Arve number</label><div class="help" style="margin:4px 0 0">Järgmine vaba number: <strong>${escH(n.number)}</strong>. Daybill annab numbri ise ja sama numbrit ei tule kunagi kaks korda.</div></div>
 </div>
 <div class="inv-total"><div><label>Ilma KM-ta</label><strong>${eurUi(c.net)}</strong></div><div><label>KM ${escH(c.vatRate)}%</label><strong>${eurUi(c.vat)}</strong></div><div><label>Kokku</label><strong>${eurUi(c.gross)}</strong></div></div>
 <div class="actions"><button type="button" class="primary" id="invIssue">Koosta arve</button><button type="button" id="invPreview">Vaata eelvaadet (PDF)</button><button type="button" id="invClear">Tühjenda</button></div>
 <p class="help">Eelvaade ei võta numbrit. „Koosta arve” annab numbri, salvestab arve arhiivi ja laadib PDF-i alla.</p></div>`}
function bindNew(){const on=(id,fn)=>{const el=$i(id);if(el)el.addEventListener('input',fn)};
 $i('invGoSettings')&&($i('invGoSettings').onclick=()=>{tab='tpl';msg='';render()});
 $i('invProject').onchange=e=>{const v=e.target.value;if(v)fromProject(v);else{draft.hoursProject='';render()}};
 $i('invRebill')&&($i('invRebill').onchange=e=>{draft.allowRebill=e.target.checked});
 on('invClient',e=>{draft.client.name=e.target.value;const k=clientPool().find(c=>norm(c.name)===norm(e.target.value));if(k&&e.inputType!=='insertText')fillClientFields(k)});
 $i('invClient').addEventListener('change',e=>{const k=clientPool().find(c=>norm(c.name)===norm(e.target.value));if(k)fillClientFields(k)});
 on('invCode',e=>draft.client.code=e.target.value);on('invVatNo',e=>draft.client.vatNo=e.target.value);on('invEmail',e=>draft.client.email=e.target.value);on('invLine1',e=>draft.client.line1=e.target.value);on('invLine2',e=>draft.client.line2=e.target.value);
 root.querySelectorAll('[data-row]').forEach(el=>el.addEventListener('input',()=>{draft.rows[Number(el.dataset.row)][el.dataset.k]=el.value;refreshTotals()}));
 root.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{draft.rows.splice(Number(b.dataset.del),1);render()});
 $i('invAddRow').onclick=()=>{draft.rows.push({desc:'',qty:1,unit:'',price:''});render()};
 $i('invDate').onchange=e=>{draft.date=e.target.value;render()};on('invDays',e=>draft.days=e.target.value);$i('invVat').onchange=e=>{draft.vat=e.target.value;render()};$i('invLang').onchange=e=>{draft.lang=e.target.value};
 $i('invIssue').onclick=issue;$i('invPreview').onclick=preview;$i('invClear').onclick=()=>{if(confirm('Tühjendan arve vormi?')){draft=fresh();msg='';render()}}}
function refreshTotals(){const c=computed();const rows=root.querySelectorAll('.inv-rows tbody tr');draft.rows.forEach((r,i)=>{const td=rows[i]&&rows[i].children[4];if(td)td.textContent=eurUi(r2((Number(String(r.qty).replace(',','.'))||0)*(Number(String(r.price).replace(',','.'))||0)))});const s=root.querySelectorAll('.inv-total strong');if(s.length===3){s[0].textContent=eurUi(c.net);s[1].textContent=eurUi(c.vat);s[2].textContent=eurUi(c.gross)}}
function listHtml(){const years=[...new Set(live().map(x=>x.date.slice(0,4)).concat(String(new Date().getFullYear())))].sort().reverse();const q=norm(filter.q);
 const rows=live().filter(x=>(filter.year==='all'||x.date.startsWith(filter.year))&&(filter.status==='all'||status(x)[1]===filter.status||(filter.status==='unpaid'&&['open','overdue'].includes(status(x)[1])))&&(!q||norm(x.number+' '+x.client.name+' '+x.rows.map(r=>r.desc).join(' ')).includes(q))).sort((a,b)=>b.date.localeCompare(a.date)||b.seq-a.seq);
 const sum=rows.filter(x=>!credited(x)).reduce((s,x)=>s+x.gross,0);
 return `<div id="dbBank"></div><div class="inv-filter"><select id="invYear"><option value="all">Kõik aastad</option>${years.map(y=>`<option${filter.year===y?' selected':''}>${y}</option>`).join('')}</select>
 <select id="invStatus">${[['all','Kõik'],['unpaid','Ootab makset'],['overdue','Üle tähtaja'],['paid','Makstud'],['credited','Krediteeritud'],['credit','Kreeditarved']].map(([v,t])=>`<option value="${v}"${filter.status===v?' selected':''}>${t}</option>`).join('')}</select>
 <input id="invQ" type="search" placeholder="Otsi klienti, numbrit või kirjeldust" value="${escH(filter.q)}" style="flex:1;min-width:180px"></div>
 ${rows.length?`<div class="table"><table class="inv-list"><thead><tr><th>Number</th><th>Kuupäev</th><th>Klient</th><th>Summa</th><th>Olek</th><th></th></tr></thead><tbody>${rows.map(x=>{const [st,k]=status(x);return `<tr class="${k==='paid'||k==='credited'?'paid':''}"><td>${escH(x.number)}</td><td>${dmy(x.date)}</td><td>${escH(x.client.name)}</td><td>${eurUi(x.gross)}</td><td class="inv-status">${k==='overdue'?'<strong>'+st+'</strong>':st}${x.paidAt&&x.paidAt!==true?' '+dmy(x.paidAt):''}${x.sent&&x.sent.length?'<br>saadetud '+dmy(x.sent.at(-1).slice(0,10)):''}</td><td class="inv-actions">${x.fromHours?'<span class="help">Hoursis · PDF on Dropboxis</span>':`<button data-pdf="${escH(x.id)}">PDF</button> <button data-share="${escH(x.id)}">Saada</button>${x.credit||credited(x)?'':` <button data-paid="${escH(x.id)}">${x.paidAt?'Märgi maksmata':'Märgi makstuks'}</button> <button data-credit="${escH(x.id)}">Kreeditarve</button>`} <button data-copy="${escH(x.id)}">Kopeeri</button>`}</td></tr>`}).join('')}</tbody></table></div><p class="help">Kokku ${rows.length} arvet · ${eurUi(sum)} (krediteeritud arveteta).</p>`:'<div class="empty">Arveid pole.</div>'}`}
function bindList(){$i('invYear').onchange=e=>{filter.year=e.target.value;render()};$i('invStatus').onchange=e=>{filter.status=e.target.value;render()};$i('invQ').oninput=e=>{filter.q=e.target.value;const pos=e.target.selectionStart;render();const el=$i('invQ');el.focus();el.setSelectionRange(pos,pos)};
 const get=id=>list.find(x=>x.id===id);
 root.querySelectorAll('[data-pdf]').forEach(b=>b.onclick=()=>deliverPdf(get(b.dataset.pdf)));
 root.querySelectorAll('[data-share]').forEach(b=>b.onclick=async()=>{const x=get(b.dataset.share);const shared=navigator.canShare&&await deliverPdf(x,{share:true});if(!navigator.canShare){await deliverPdf(x);location.href=`mailto:${encodeURIComponent(x.client.email||'')}?subject=${encodeURIComponent((x.lang==='en'?'Invoice ':'Arve ')+x.number)}&body=${encodeURIComponent(shareText(x)+'\n\n'+(x.lang==='en'?'(PDF attached)':'(PDF manuses)'))}`}if(shared!==false)update(x,{sent:[...(x.sent||[]),new Date().toISOString()]})});
 root.querySelectorAll('[data-paid]').forEach(b=>b.onclick=()=>{const x=get(b.dataset.paid);if(x.paidAt){if(confirm(`Märgin arve ${x.number} maksmata?`))update(x,{paidAt:null})}else update(x,{paidAt:isoToday()})});
 root.querySelectorAll('[data-credit]').forEach(b=>b.onclick=()=>creditNote(get(b.dataset.credit)));
 root.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{const x=get(b.dataset.copy);draft=fresh();draft.lang=x.lang;draft.vat=x.vatRate;fillClient(x.client);draft.rows=x.rows.map(r=>({desc:r.desc,qty:r.qty,unit:r.unit,price:Math.abs(r.price)}));tab='new';msg=`Kopeeritud arvest ${escH(x.number)}. Kontrolli read ja kuupäev üle.`;render();window.scrollTo(0,0)});
 try{window.daybillBank&&window.daybillBank($i('dbBank'))}catch(e){console.error(e)}}

/* ---------- vaadete vahetus (Daybilli riba kutsub) ---------- */
function show(view){try{window.daybillShow&&window.daybillShow(view==='inv'||view===true?'inv':view||'hours')}catch(e){}}
// Kustutatud arve jätab alles ainult numbri, et seda numbrit ei antaks kunagi uuesti.
const tomb=(x,u)=>({id:x.id,deleted:true,_u:u||Date.now(),number:x.number,seq:x.seq,period:x.period,numberFormat:x.numberFormat,date:x.date});
// Seadus (RPS § 12): arveid hoitakse 7 aastat majandusaasta lõpust. Varem ei saa kustutada.
function keepUntil(x){return (Number(String(x.date||'').slice(0,4))+8)+'-01-01'}
function purgeable(){const t=isoToday();return live().filter(x=>keepUntil(x)<=t)}
function purge(ids){const set=new Set(ids),ok=new Set(purgeable().map(x=>x.id)),ch=[];list=list.map(x=>{if(set.has(x.id)&&ok.has(x.id)){const t=tomb(x);ch.push(t);return t}return x});saveList(ch);render();return ch.length}
function receive(remote){let changed=false;for(let r of remote){const i=list.findIndex(x=>x.id===r.id);if(r.deleted&&i>=0)r=tomb(list[i],r._u);if(i<0){list.push(r);changed=true}else if((r._u||0)>(list[i]._u||0)){list[i]=r;changed=true}}if(changed){try{localStorage.setItem(INV_KEY,JSON.stringify(list))}catch(e){}render();try{window.hoursInvoicesChanged&&window.hoursInvoicesChanged()}catch(e){}}return changed}

window.TraageldusInvoices={setTab(t){tab=t;msg='';render()},autoProject(pid){if(admin()||draft.hoursProject||draft.client.name||!pid||!projectById(pid)||forProject(pid).length)return;fromProject(pid)},markPaid(id,date,ref){const x=list.find(v=>v.id===id);if(!x||x.deleted||x.fromHours||x.credit||x.paidAt||x.paid||credited(x))return false;update(x,{paidAt:date||isoToday(),paidRef:ref||null});return true},purgeable,purge,keepUntil,list:()=>live().map(x=>JSON.parse(JSON.stringify(x))),all:()=>list,forProject,showView:show,fromProject,renderApproved(){},refreshProjects(){},credited,status,invoicePdf,amountWords,nextNumber,integrity,receive,render};
window.DaybillSettings={get:()=>settings,save:saveSettings,ready:sellerReady,DEFAULT:SETTINGS_DEFAULT};
mount();render();
})();
