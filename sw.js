/* Daybill: uus versioon jõuab kasutajani ise. Võrgu olemasolul tuleb alati värske fail, ilma internetita töötab viimane salvestatud versioon. */
const CACHE='daybill-v31';
const FILES=['./','index.html','daybill.css','daybill.js','daybill-app.js','daybill-invoices.js','daybill-bank.js','daybill-history.js','daybill-sync.js','firebase-config.js','lang.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>c.add(new Request(f,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// Kõigepealt võrk (kuni 4 s), siis salvestatud koopia. Ikoonid tulevad kohe salvestatud koopiast.
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 const key=e.request.mode==='navigate'?'index.html':e.request;
 e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(key,{ignoreSearch:true});
  if(hit&&u.pathname.includes('/icons/'))return hit;
  const net=fetch(e.request.url,{cache:'no-cache',credentials:'same-origin'}).then(r=>{if(r.ok&&r.type==='basic')c.put(key,r.clone());return r});
  if(!hit)return net;
  const slow=new Promise(res=>setTimeout(()=>res(hit),4000));
  return Promise.race([net.catch(()=>hit),slow])}))});
