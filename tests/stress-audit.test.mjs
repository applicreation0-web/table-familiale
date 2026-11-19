import test from 'node:test';
import assert from 'node:assert/strict';
import {newState,makeMonth,finance,shoppingEntries,allShoppingEntries,markBought,markInStock,validateImport,setBakingWeek,HARD_CEILING} from '../model.js';
import {recordActualPrice,learnFromConfirmedPurchase,applyLearnedPrices,priceBookStats,priceIdentity} from '../pricing.js';
import {parseReceiptText,recommendReceiptMatches,applyReceiptReview,receiptFingerprint} from '../receipt.js';
const cents=v=>Math.round(v*100)/100;
const grocery=(m,name,week)=>m.groceries.find(x=>x.name===name&&(week==null||x.week===week));
test('STRESS 31 jours, panier initial, cinq pâtisseries, seuil strict intact',()=>{
 for(let k=0;k<12;k++){
  const s=newState(),m=s.months['0'];
  assert.equal(m.meals.length,31);
  assert.equal(HARD_CEILING,900);
  assert.equal(finance(m).forecast,898.08);
  for(let w=0;w<5;w++)setBakingWeek(m,w,true);
  assert.equal(finance(m).forecast,903.88);
  assert.equal(m.groceries.filter(x=>x.name==='Œufs').length,5);
 }
});
test('STRESS inflation 12% de chaque article réellement acheté : dépasser 900£ sans prix fantôme',()=>{
 const s=newState(),m=s.months['0'],entries=allShoppingEntries(m);
 let paid=0;
 for(const entry of entries){
  if(entry.estimate==null)continue;
  const actual=cents(entry.estimate*1.12);
  markBought(m,entry,true,actual);
  paid+=actual;
 }
 assert.equal(finance(m).paid,cents(paid));
 assert.ok(finance(m).forecast>900);
 assert.ok(finance(m).forecastHeadroom<0);
 assert.equal(m.budget,900);
});
test('STRESS dépenses additionnelles et prévisions : pas de plafond artificiellement relevé',()=>{
 const m=makeMonth(0);
 for(let i=0;i<100;i++)m.extraExpenses.push({id:'extra'+i,label:'livraison '+i,amount:0.99,supplier:'Autre'});
 assert.equal(finance(m).paid,99);
 assert.equal(finance(m).forecast,997.08);
 assert.equal(finance(m).forecastHeadroom,-97.08);
 assert.equal(m.budget,900);
});
test('STRESS 180 corrections du même prix : une preuve, prix prévisionnel stable',()=>{
 const s=newState(),m=s.months['0'];
 const item=grocery(m,'Raisins rouges sans pépins M&S',0);
 markBought(m,{...item,kind:'base'},true,5.3);
 for(let n=0;n<180;n++){
   const p=5.3+(n%21)/10;
   markBought(m,{...item,kind:'base'},true,p);
   learnFromConfirmedPurchase(s,m,item,p);
 }
 assert.equal(priceBookStats(s).observations,1);
 assert.equal(shoppingEntries(m,1,false).find(x=>x.name===item.name).estimate,6.4);
 assert.equal(finance(m).paid,6.4);
});
test('STRESS prix unitaires : 1kg ↔ 500g, mais fournisseur et unité jamais mélangés',()=>{
 const s=newState(),m=s.months['0'],item=grocery(m,'Raisins rouges sans pépins M&S',0);
 assert.equal(priceIdentity(item).quantity,1000);
 const alt={...item,qty:'500 g',supplier:'Ocado'};
 recordActualPrice(s,item,6);
 recordActualPrice(s,alt,2.9);
 applyLearnedPrices(s,{onlyPeriod:0});
 assert.equal(shoppingEntries(m,1,false).find(x=>x.name===item.name).estimate,6);
 assert.equal(shoppingEntries(m,4,false).find(x=>x.name===item.name).estimate,3);
 assert.equal(priceBookStats(s).series,2);
});
test('STRESS médiane robuste : prix promotionnel isolé ne renverse pas les trois preuves',()=>{
 const s=newState(),m=s.months['0'],item=grocery(m,'Raisins rouges sans pépins M&S',0);
 for(const p of [6,1,6])recordActualPrice(s,item,p);
 applyLearnedPrices(s,{onlyPeriod:0});
 assert.equal(shoppingEntries(m,1,false).find(x=>x.name===item.name).estimate,6);
 assert.equal(shoppingEntries(m,4,false).find(x=>x.name===item.name).estimate,3);
});
test('STRESS historique borné : 250 observations, au maximum douze prix pour un produit',()=>{
 const s=newState(),m=s.months['0'],item=grocery(m,'Raisins rouges sans pépins M&S',0);
 for(let i=0;i<250;i++)recordActualPrice(s,item,1+i/100,new Date(2026,10,19,0,i).toISOString(),'unique-'+i);
 assert.equal(priceBookStats(s).observations,12);
 assert.equal(priceBookStats(s).series,1);
});
test('STRESS frais et gratuité : aucun prix zéro ne devient une valeur durable',()=>{
 const s=newState(),m=s.months['0'],item=grocery(m,'Raisins rouges sans pépins M&S',0);
 assert.equal(recordActualPrice(s,item,0),false);
 assert.equal(recordActualPrice(s,item,-1),false);
 assert.equal(recordActualPrice(s,item,Number.POSITIVE_INFINITY),false);
 assert.equal(priceBookStats(s).series,0);
 markBought(m,{...item,kind:'base'},true,0);
 assert.equal(finance(m).paid,0);
});
test('STRESS correction manuelle de prix futur et stock: références ne les écrasent pas',()=>{
 const s=newState(),m=s.months['0'],item=grocery(m,'Raisins rouges sans pépins M&S',0);
 const customized=grocery(m,item.name,1),stocked=grocery(m,item.name,2),hidden=grocery(m,item.name,3);
 customized.overridePrice=8.75;
 markInStock(m,{...stocked,kind:'base'},true);
 hidden.hidden=true;
 recordActualPrice(s,item,6);
 applyLearnedPrices(s,{onlyPeriod:0});
 assert.equal(shoppingEntries(m,1,false).find(x=>x.name===item.name).estimate,8.75);
 assert.equal(stocked.learnedPrice,undefined);
 assert.equal(hidden.learnedPrice,undefined);
 assert.equal(grocery(m,item.name,4).learnedPrice,3);
});
test('STRESS achat ancien masqué reste toujours dans les dépenses comptables',()=>{
 const m=makeMonth(0),item=grocery(m,'Raisins rouges sans pépins M&S',0);
 markBought(m,{...item,kind:'base'},true,5.99);
 item.hidden=true;
 assert.equal(finance(m).paid,5.99);
 assert.ok(allShoppingEntries(m).some(x=>x.id===item.id));
});
test('STRESS 120 lignes OCR admissibles maximum sur un texte de 2000 articles',()=>{
 const raw=Array.from({length:2000},(_,i)=>'FRUIT TEST '+i+' 1.00').join('\n')+'\nTOTAL 2000.00';
 const parsed=parseReceiptText(raw);
 assert.equal(parsed.lines.length,120);
 assert.equal(parsed.recognizedTotal,120);
 assert.equal(parsed.rawLineCount,2001);
 assert.equal(parsed.truncatedLines,1880);
 const s=newState();
 assert.throws(()=>applyReceiptReview(s,s.months['0'],parsed,parsed.lines.map(x=>({...x,selectedId:'extra'}))),/trop long/);
 assert.equal(finance(s.months['0']).paid,0);
});
test('STRESS 120 extras validées : exactitude de la dépense, un seul ticket comptabilisé',()=>{
 const s=newState(),m=s.months['0'];
 const r=parseReceiptText(Array.from({length:120},(_,i)=>'GROCERY '+i+' 0.37').join('\n'));
 assert.equal(r.lines.length,120);
 const rows=r.lines.map(x=>({...x,selectedId:'extra'}));
 const result=applyReceiptReview(s,m,r,rows);
 assert.equal(result.extras,120);
 assert.equal(result.total,44.4);
 assert.equal(m.extraExpenses.length,120);
 assert.equal(finance(m).paid,44.4);
 assert.throws(()=>applyReceiptReview(s,m,r,rows),/déjà été rapproché/);
});
test('STRESS échec de dernière ligne : transaction atomique, pas d achat partiel',()=>{
 const s=newState(),m=s.months['0'],r=parseReceiptText('STRAWBERRIES 4.00\nRANDOM GROCERIES 9.99');
 const strawberry=grocery(m,'Fraises M&S',0);
 const rows=[{...r.lines[0],selectedId:strawberry.id,quantityConfirmed:true},{...r.lines[1],selectedId:'non-existent'}];
 const before=JSON.stringify(s);
 assert.throws(()=>applyReceiptReview(s,m,r,rows),/introuvable|déjà acheté|non disponible/);
 assert.equal(JSON.stringify(s),before);
});
test('STRESS 25 tickets identiques sur deux périodes : aucun second encaissement',()=>{
 const s=newState(),m=s.months['0'];s.months['1']=makeMonth(1);
 for(let i=0;i<25;i++){
  const r=parseReceiptText('ONE TEST ITEM '+i+' 2.00\nTOTAL 2.00');
  const rows=[{...r.lines[0],selectedId:'extra'}];
  applyReceiptReview(s,m,r,rows);
  assert.throws(()=>applyReceiptReview(s,s.months['1'],r,rows),/déjà été rapproché/);
 }
 assert.equal(finance(m).paid,50);
 assert.equal(finance(s.months['1']).paid,0);
});
test('STRESS injection montants non finis, négatifs, 10k+: aucune mutation',()=>{
 const s=newState(),m=s.months['0'],r=parseReceiptText('STRAWBERRIES 4.00');
 const item=grocery(m,'Fraises M&S',0);
 for(const invalid of [NaN,Infinity,-0.01,10001,Number.NEGATIVE_INFINITY]){
   assert.throws(()=>applyReceiptReview(s,m,r,[{...r.lines[0],selectedId:item.id,amount:invalid}]),/invalide/);
   assert.equal(finance(m).paid,0);
 }
 assert.deepEqual(m.receiptImports,[]);
});
test('STRESS deux emballages pour un achat prévu : cumuler sans double achat',()=>{
 const s=newState(),m=s.months['0'],r=parseReceiptText('STRAWBERRIES 2.00\nSTRAWBERRIES 2.00');
 const id=grocery(m,'Fraises M&S',0).id;
 const out=applyReceiptReview(s,m,r,r.lines.map(x=>({...x,selectedId:id})));
 assert.equal(out.matched,1);
 assert.equal(finance(m).paid,4);
 assert.throws(()=>applyReceiptReview(s,m,r,r.lines.map(x=>({...x,selectedId:id}))),/déjà été rapproché/);
});
test('STRESS OCR malveillant: pas de photo ni ticket brut dans historique JSON',()=>{
 const s=newState(),m=s.months['0'],r=parseReceiptText('PRIVATE RECEIPT LOCATION 1.00\nTOTAL 1.00');
 applyReceiptReview(s,m,r,[{...r.lines[0],selectedId:'extra'}]);
 const log=JSON.stringify(m.receiptImports);
 assert.equal(log.includes('PRIVATE'),false);
 assert.equal(log.includes('RECEIPT LOCATION'),false);
 assert.ok(log.includes('fingerprint'));
});
test('STRESS migration et export/import : 20 périodes, prix payés et repas jamais perdus',()=>{
 const state=newState();
 for(let i=1;i<20;i++)state.months[String(i)]=makeMonth(i);
 for(let i=0;i<20;i++){
   const m=state.months[String(i)];
   m.meals[0].cooked=true;
   const grape=grocery(m,'Raisins rouges sans pépins M&S',0);
   markBought(m,{...grape,kind:'base'},true,6+i/10);
 }
 const reloaded=validateImport(JSON.parse(JSON.stringify(state)));
 assert.equal(Object.keys(reloaded.months).length,20);
 for(let i=0;i<20;i++){
  const m=reloaded.months[String(i)];
  assert.equal(m.meals[0].cooked,true);
  assert.equal(m.groceries.find(x=>x.week===0&&x.name==='Raisins rouges sans pépins M&S').actual,cents(6+i/10));
 }
});
test('STRESS la prévision peut dépasser 900 : marge négative honnête après tickets',()=>{
 const s=newState(),m=s.months['0'];
 const r=parseReceiptText('SURPRISE SHOPPING 48.75');
 applyReceiptReview(s,m,r,[{...r.lines[0],selectedId:'extra'}]);
 assert.equal(finance(m).forecast,946.83);
 assert.equal(finance(m).forecastHeadroom,-46.83);
});
test('STRESS prix réel jamais automatiquement propagé à des achats payés',()=>{
 const s=newState(),m=s.months['0'];
 const first=grocery(m,'Raisins rouges sans pépins M&S',0);
 const second=grocery(m,'Raisins rouges sans pépins M&S',1);
 markBought(m,{...second,kind:'base'},true,5.99);
 markBought(m,{...first,kind:'base'},true,9);
 learnFromConfirmedPurchase(s,m,first,9);
 assert.equal(second.actual,5.99);
 assert.equal(second.learnedPrice,undefined);
});
test('STRESS plusieurs mois futurs, y compris année suivante, héritent des derniers prix confirmés',()=>{
 const s=newState(),m=s.months['0'],first=grocery(m,'Raisins rouges sans pépins M&S',0);
 markBought(m,{...first,kind:'base'},true,8);
 learnFromConfirmedPurchase(s,m,first,8);
 for(let i=1;i<13;i++){
   s.months[String(i)]=makeMonth(i);
   applyLearnedPrices(s,{onlyPeriod:i});
   const next=grocery(s.months[String(i)],first.name,0);
   assert.ok(next);
   assert.equal(next.learnedPrice,8);
 }
});
test('STRESS les prix réels ne créent pas d achats sans validation',()=>{
 const s=newState(),m=s.months['0'];
 const item=grocery(m,'Raisins rouges sans pépins M&S',0);
 recordActualPrice(s,item,5.99);
 applyLearnedPrices(s,{onlyPeriod:0});
 assert.equal(finance(m).paid,0);
 assert.equal(finance(m).bought,0);
});
