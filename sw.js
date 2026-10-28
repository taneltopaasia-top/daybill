/* Daybill: töötab ka ilma internetita. Uus versioon laaditakse taustal ja võetakse kasutusele järgmisel avamisel. */
const CACHE='daybill-v17';
const FILES=['./','index.html','daybill.css','daybill.js','daybill-invoices.js','daybill-bank.js','daybill-history.js','daybill-sync.js','firebase-config.js','lang.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>c.add(new Request(f,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(e.request,{ignoreSearch:true});const net=fetch(e.request.url,{cache:'no-cache',credentials:'same-origin'}).then(r=>{if(r.ok)c.put(e.request,r.clone());return r}).catch(()=>hit);return hit||net}))});
