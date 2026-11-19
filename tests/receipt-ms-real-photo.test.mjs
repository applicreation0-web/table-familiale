import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReceiptText,applyReceiptReview,recommendReceiptMatches} from '../receipt.js';
import {reconstructReceiptRows} from '../receipt-layout.js';
import {newState,finance} from '../model.js';

// Transcription de référence du ticket M&S photographié le 19/11/2026.
// Le test porte sur le parseur, pas sur une prétendue validation de caméra réelle.
const items=[
['29210053 CLN SIG SDOUG',4.25],
['00652230 COOKED BEETRO',.90],
['00652230 COOKED BEETRO',.90],
['29091188 GRATED CHEDDA',4.50],
['3282380060219 LE BU RO UNS',3.75],
['00328739 4PT ORG ENG W',2.65],
['5036589201601 VLY WHLE MLK',3.10],
['5036589201601 VLY WHLE MLK',3.10],
['00834087 STILTON 236G',4.50],
['00905350 MULTIPACK PEP',2.10],
['29481385 10 ATH GRK YG',4.25],
['29481385 10 ATH GRK YG',4.25],
['00848503 BROCCOLI CROW',1.30],
['00848503 BROCCOLI CROW',1.30],
['29481385 10 ATH GRK YG',4.25],
['00147217 MINI N POTATO',2.40],
['00147217 MINI N POTATO',2.40],
['29087914 ORG CARROTS',1.60],
['00857406 WHITE GRAPE',2.50],
['00233620 ORG COURGETTE',2.45],
['00233620 ORG COURGETTE',2.45],
['00853538 BRWN ONION NE',1.50],
['00671729 W/WHEAT PENNE',2.30],
['00089241 FUSILLI ONI',2.30],
['29329724 GIANT WG COUS',2.90],
['29076277 ORG STR WHML',2.10],
['29495511 STL CT OATS',2.75],
['00853538 BRWN ONION NE',1.50],
['29330812 QUINOA 500G',4.00],
['29173204 100 PEANUT BU',2.35],
['00821964 CHOPPD TOMATO',.50],
['00821964 CHOPPD TOMATO',.50],
['8003753900438 Illy Grd Coff',7.50],
['29460335 NTRL WLNT HLV',6.25],
['00199032 GARLIC BULB',.50],
['00199032 GARLIC BULB',.50],
['00821919 TOMATO PUREE',.75],
['29095773 ORG UNWXD LEM',2.00],
['00019477 SWT POT JKTS',2.25],
['00938112 Col 85% Peru',3.00],
['29089635 MIXED EGGS X1',5.40],
['00807395 VEGETABLE OIL',2.00],
['29089635 MIXED EGGS X1',5.40],
];
const transcript=items.map(([label,cost])=>label+' £'+cost.toFixed(2)+'<').join('\n')+
 '\nBalance before Saving £117.15\n**Car Park Refund** -£1.50\nItems: 44 Balance to Pay £115.65\nCard Tendered £115.65';
test('ticket réel M&S: 43 achats, remise 1,50, montant payé 115,65 sans prix fantôme',()=>{
 const r=parseReceiptText(transcript);
 assert.equal(items.length,43);
 assert.equal(r.lines.length,43);
 assert.equal(r.recognizedTotal,117.15);
 assert.equal(r.subtotal,117.15);
 assert.equal(r.discountTotal,-1.50);
 assert.equal(r.ticketTotal,115.65);
 assert.equal(r.expectedPaid,115.65);
 assert.equal(r.reconciliationGap,0);
 assert.equal(r.lines.filter(x=>x.label==='MIXED EGGS X1').length,2);
 assert.equal(r.lines.filter(x=>x.label==='VLY WHLE MLK').length,2);
});
test('import intégral revu: 43 articles et remboursement parking donnent 115,65, une seule fois',()=>{
 const s=newState(),m=s.months['0'],r=parseReceiptText(transcript);
 const rows=r.lines.map(x=>({...x,selectedId:'extra'}));
 const result=applyReceiptReview(s,m,r,rows);
 assert.equal(result.total,115.65);
 assert.equal(result.discountApplied,-1.5);
 assert.equal(result.extras,43);
 assert.equal(m.extraExpenses.length,44);
 assert.equal(finance(m).paid,115.65);
 assert.equal(m.receiptImports[0].reconciledTotal,115.65);
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
 const box=(text,x,y)=>({text,boundingBox:{x,y,width:150,height:12}});
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
