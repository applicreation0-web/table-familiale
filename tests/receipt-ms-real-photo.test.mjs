import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReceiptText,applyReceiptReview,recommendReceiptMatches} from '../receipt.js';
import {reconstructReceiptRows} from '../receipt-layout.js';
import {newState,finance,validateImport,makeMonth} from '../model.js';
import {compareReceiptToPlan} from '../receipt-benchmark.js';

// Fixture 100 % synthétique : aucune liste réelle de courses ni donnée
// de paiement/client n'est conservée dans le dépôt GitHub public.
// Les quelques EAN servent seulement à tester les correspondances de catalogue.
const skuCases=[
 ['00328739 4PT ORG ENG W',2.65],
 ['5036589201601 VLY WHLE MLK',3.10],
 ['5036589201601 VLY WHLE MLK',3.10],
 ['3282380060219 LE BU RO UNS',3.75],
 ['29089635 MIXED EGGS X1',5.40],
 ['29089635 MIXED EGGS X1',5.40],
 ['29087914 ORG CARROTS',1.60],
 ['00857406 WHITE GRAPE',2.50],
];
const synthetic=Array.from({length:35},(_,i)=>[
 String(91000000+i)+' GENERIC PANTRY '+String(i+1).padStart(2,'0'),
 i===0?4.25:Math.round((.75+(i%7)*.41)*100)/100
]);
const items=[...synthetic,...skuCases];
const subtotal=Math.round(items.reduce((n,[,amount])=>n+amount,0)*100)/100;
const discount=1.25, paid=Math.round((subtotal-discount)*100)/100;
const transcript=items.map(([label,cost])=>label+' £'+cost.toFixed(2)+'<').join('\n')+
 '\nBalance before Saving £'+subtotal.toFixed(2)+
 '\n**Car Park Refund** -£'+discount.toFixed(2)+
 '\nItems: 44 Balance to Pay £'+paid.toFixed(2)+
 '\nCard Tendered £'+paid.toFixed(2);
test('ticket M&S fictif: 43 achats, remise et paiement exacts sans faux prix',()=>{
 const r=parseReceiptText(transcript);
 assert.equal(items.length,43);
 assert.equal(r.lines.length,43);
 assert.equal(r.recognizedTotal,subtotal);
 assert.equal(r.subtotal,subtotal);
 assert.equal(r.discountTotal,-discount);
 assert.equal(r.ticketTotal,paid);
 assert.equal(r.expectedPaid,paid);
 assert.equal(r.reconciliationGap,0);
 assert.equal(r.lines.filter(x=>x.label==='MIXED EGGS X1').length,2);
 assert.equal(r.lines.filter(x=>x.label==='VLY WHLE MLK').length,2);
});
test('import fictif revu: 43 articles et remboursement comptabilisés une seule fois',()=>{
 const s=newState(),m=s.months['0'],r=parseReceiptText(transcript);
 const rows=r.lines.map(x=>({...x,selectedId:'extra'}));
 const result=applyReceiptReview(s,m,r,rows);
 assert.equal(result.total,paid);
 assert.equal(result.discountApplied,-discount);
 assert.equal(result.extras,43);
 assert.equal(m.extraExpenses.length,44);
 assert.equal(finance(m).paid,paid);
 assert.equal(m.receiptImports[0].reconciledTotal,paid);
 assert.throws(()=>applyReceiptReview(s,m,r,rows),/déjà été rapproché/);
});
test('deux boîtes d’œufs du même ticket: un seul produit payé 10,80 sans prix unitaire inventé',()=>{
 const s=newState(),m=s.months['0'],r=parseReceiptText(transcript);
 const eggs=m.groceries.find(x=>x.name==='Œufs'&&x.week===0);
 const rows=r.lines.map(x=>({...x,selectedId:x.label==='MIXED EGGS X1'?eggs.id:''}));
 const result=applyReceiptReview(s,m,r,rows);
 assert.equal(result.total,10.8);
 assert.equal(result.matched,1);
 assert.equal(result.discountApplied,0);
 assert.equal(eggs.actual,10.8);
 assert.equal(Object.keys(s.priceBook).length,0);
});
test('raisin blanc ne doit pas s’associer automatiquement aux raisins rouges du panier',()=>{
 const r=parseReceiptText(transcript),m=newState().months['0'];
 const matches=recommendReceiptMatches(r,m,0);
 const white=matches.find(x=>x.label==='WHITE GRAPE');
 assert.ok(white);
 assert.equal(white.selectedId,'');
});
test('OCR ML Kit: rapprochement par ligne géométrique malgré texte livré en colonnes',()=>{
 const box=(text,x,y)=>({text,boundingBox:{left:x,top:y,right:x+150,bottom:y+12}});
 const raw={
   text:'MILK\nEGGS\nMILK\nEGGS\n£3.10\n£5.40\n£3.10\n£5.40',
   blocks:[
    {lines:[box('VLY WHLE MLK',135,22),box('MIXED EGGS X1',135,50),box('VLY WHLE MLK',135,78),box('MIXED EGGS X1',135,106)]},
    {lines:[box('£3.10<',460,22),box('£5.40<',460,50),box('£3.10<',460,78),box('£5.40<',460,106)]}
   ]
 };
 const rebuilt=reconstructReceiptRows(raw);
 assert.equal(parseReceiptText(rebuilt).lines.length,4);
 assert.equal(parseReceiptText(rebuilt).recognizedTotal,17);
 assert.ok(rebuilt.startsWith('VLY WHLE MLK £3.10<'));
});
test('un ticket partiel ne reçoit pas une remise inventée',()=>{
 const s=newState(),m=s.months['0'],r=parseReceiptText(transcript);
 const row={...r.lines[0],selectedId:'extra'};
 applyReceiptReview(s,m,r,[row]);
 assert.equal(finance(m).paid,4.25);
});

test('articles répétés : suggestion de rapprochement identique mais confirmation obligatoire',()=>{
 const r=parseReceiptText(transcript),m=newState().months['0'];
 const suggestions=recommendReceiptMatches(r,m,0);
 const eggs=suggestions.filter(x=>x.label==='MIXED EGGS X1');
 assert.equal(eggs.length,2);
 assert.ok(eggs[0].selectedId);
 assert.equal(eggs[0].selectedId,eggs[1].selectedId);
});
test('OCR géométrique mauvais : le texte initial lisible est préservé',()=>{
 const raw='MILK £3.10\nEGGS £5.40';
 const misplaced={text:raw,blocks:[{lines:[
  {text:'MILK',boundingBox:{x:0,y:20,height:10}},
  {text:'EGGS',boundingBox:{x:0,y:40,height:10}},
  {text:'£3.10',boundingBox:{x:300,y:200,height:10}},
  {text:'£5.40',boundingBox:{x:300,y:220,height:10}},
 ]}]};
 assert.equal(reconstructReceiptRows(misplaced),raw);
});

test('migration v11→v12 : revaloriser uniquement les œufs non achetés, sans perdre achats et prix saisis',()=>{
 const original=newState(),m=original.months['0'];
 original.version=11;
 const eggs=m.groceries.filter(x=>x.name==='Œufs');
 for(const e of eggs)e.price=e.week<4?8.80:4.40;
 eggs[0].bought=true;eggs[0].actual=11.05;
 eggs[1].overridePrice=12.99;
 const saved=JSON.parse(JSON.stringify(original));
 const migrated=validateImport(saved);
 assert.equal(migrated.version,13);
 const now=migrated.months['0'].groceries.filter(x=>x.name==='Œufs');
 assert.equal(now[0].actual,11.05);
 assert.equal(now[0].price,8.8);
 assert.equal(now[1].overridePrice,12.99);
 assert.equal(now[1].price,8.8);
 assert.equal(now[2].price,10.8);
 assert.equal(now[4].price,5.4);
 assert.equal(validateImport(migrated).months['0'].groceries.find(x=>x.id===now[2].id).price,10.8);
});

test('panier complet sauf viande/Dining : quantités certifiées des achats reproductibles',()=>{
 const month=makeMonth(0),receipt=parseReceiptText(transcript);
 const observed=compareReceiptToPlan(receipt,month,0);
 const map=Object.fromEntries(observed.map(x=>[x.key,x]));
 assert.equal(observed.length,5);
 assert.deepEqual([map.milk.actualQty,map.milk.plannedQty,map.milk.actualPrice],[4,4,6.2]);
 assert.deepEqual([map['milk-ms'].actualQty,map['milk-ms'].plannedQty,map['milk-ms'].actualPrice],[2.272,2.272,2.65]);
 assert.deepEqual([map.eggs.actualQty,map.eggs.plannedQty,map.eggs.actualPrice],[24,24,10.8]);
 assert.deepEqual([map.butter.actualQty,map.butter.plannedQty,map.butter.actualPrice],[250,250,3.75]);
 assert.equal(map.carrots.actualQty,1);
 assert.equal(map.carrots.plannedQty,3);
 assert.ok(map.carrots.recipeNeed>=2&&map.carrots.recipeNeed<3.2);
 assert.ok(Number.isFinite(finance(month).forecast));
});
test('ancien prix appris du lait 8L ramené au format réel 4L sans modifier les achats historiques',()=>{
 const s=newState(),m=s.months['0'],milks=m.groceries.filter(x=>x.name.startsWith('Lait Yeo Valley'));
 s.version=11;
 for(const item of milks){
   item.qty=item.week<4?'4 × 2 L (8 L)':'2 × 2 L (4 L)';
   item.price=item.week<4?12.60:6.30;
   item.learnedPrice=item.week<4?12.40:6.20;
 }
 milks[0].bought=true;milks[0].actual=12.35;
 const updated=validateImport(JSON.parse(JSON.stringify(s)));
 const next=updated.months['0'].groceries.filter(x=>x.name.startsWith('Lait Yeo Valley'));
 assert.equal(next[0].actual,12.35);
 assert.equal(next[0].qty,'4 × 2 L (8 L)');
 assert.equal(next[1].qty,'2 × 2 L (4 L)');
 assert.equal(next[1].learnedPrice,6.20);
 assert.equal(next[4].qty,'1 × 2 L (2 L)');
 assert.equal(next[4].learnedPrice,3.10);
});
