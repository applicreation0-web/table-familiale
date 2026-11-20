const CACHE='table-familiale-static-v18';
const FILES=['./','./index.html','./styles.css','./app.js','./backup.js','./pricing.js','./receipt.js','./receipt-benchmark.js','./receipt-stock.js','./receipt-quick.js','./week1-plan.js','./receipt-ocr.js','./model.js','./family-portions.js','./recipes.js','./meal-plan.js','./data.js','./manifest.webmanifest','./icons/icon.svg'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
