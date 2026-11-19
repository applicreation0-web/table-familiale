import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMonth,newState,finance,shoppingEntries,allShoppingEntries,markBought,validateImport} from '../model.js';
import {priceIdentity,recordActualPrice,applyLearnedPrices,learnFromConfirmedPurchase,forgetConfirmedPurchase,priceBookStats} from '../pricing.js';
import {parseReceiptText,recommendReceiptMatches,applyReceiptReview,receiptFingerprint} from '../receipt.js';
import {nativeReceiptAvailable,captureReceiptText} from '../receipt-ocr.js';

const grapes=m=>m.groceries.find(x=>x.name==='Raisins rouges sans pépins M&S'&&x.week===0);
const nextGrapes=(m,w)=>shoppingEntries(m,w,false).find(x=>x.name==='Raisins rouges sans pépins M&S');
test('Prix confirmés : 1 kg de raisins propage au même conditionnement et aux 500g',()=>{
 const state=newState(),m=state.months['0'],first=grapes(m);
 assert.equal(priceIdentity(first).quantity,1000);
 assert.equal(priceIdentity(nextGrapes(m,4)).quantity,500);
 const before=finance(m).forecast;
 markBought(m,{...first,kind:'base'},true,6);
 first.actualConfirmed=true;
 const updates=learnFromConfirmedPurchase(state,m,first,6);
 assert.ok(updates.length>=4);
 assert.equal(nextGrapes(m,1).estimate,6);
 assert.equal(nextGrapes(m,2).estimate,6);
 assert.equal(nextGrapes(m,4).estimate,3);
 assert.equal(finance(m).forecast,Math.round((before+0.7*4+0.35)*100)/100);
 assert.equal(finance(m).paid,6);
 assert.equal(priceBookStats(state).series,1);
});
test('Correction d’un prix : même preuve remplacée, pas de double observation',()=>{
 const s=newState(),m=s.months['0'],item=grapes(m);
 markBought(m,{...item,kind:'base'},true,6);
 learnFromConfirmedPurchase(s,m,item,6);
 markBought(m,{...item,kind:'base'},true,7);
 learnFromConfirmedPurchase(s,m,item,7);
 assert.equal(nextGrapes(m,1).estimate,7);
 assert.equal(priceBookStats(s).observations,1);
 assert.equal(finance(m).paid,7);
});
test('Décoche achat : référence apprise retirée, estimations d’origine rétablies',()=>{
 const s=newState(),m=s.months['0'],item=grapes(m);
 markBought(m,{...item,kind:'base'},true,6);
 learnFromConfirmedPurchase(s,m,item,6);
 forgetConfirmedPurchase(s,m,item);
 markBought(m,{...item,kind:'base'},false,null);
 assert.equal(nextGrapes(m,1).estimate,5.3);
 assert.equal(nextGrapes(m,4).estimate,2.65);
 assert.equal(finance(m).forecast,889.08);
 assert.equal(priceBookStats(s).series,0);
});
test('Prix manuel et achats déjà payés sont intouchables, prochains mois apprennent',()=>{
 const s=newState(),m=s.months['0'],item=grapes(m),future=m.groceries.find(x=>x.name===item.name&&x.week===2);
 future.overridePrice=3.91;
 const previous=m.groceries.find(x=>x.name===item.name&&x.week===1);
 markBought(m,{...previous,kind:'base'},true,5.25);
 markBought(m,{...item,kind:'base'},true,6);
 learnFromConfirmedPurchase(s,m,item,6);
 assert.equal(future.overridePrice,3.91);
 assert.equal(shoppingEntries(m,2,false).find(x=>x.name===item.name).estimate,3.91);
 assert.equal(previous.actual,5.25);
 s.months['1']=makeMonth(1);
 applyLearnedPrices(s,{onlyPeriod:1});
 assert.equal(nextGrapes(s.months['1'],0).estimate,6);
});
test('Quantités : un conditionnement incomparable ne reçoit pas de prix appris',()=>{
 const s=newState(),m=s.months['0'];
 const a={name:'Pain',qty:'1 L',supplier:'M&S'};
 const b={name:'Pain',qty:'6 pièces',supplier:'M&S'};
 recordActualPrice(s,a,3.4);
 m.groceries.push({id:'custom-testing',...b,price:2,purchase:'weekly',week:2,bought:false,hidden:false});
 applyLearnedPrices(s,{onlyPeriod:0});
 assert.equal(m.groceries.at(-1).learnedPrice,undefined);
});
test('Ticket britannique : articles, total, carte et remises séparés',()=>{
 const text='M&S\nRED SEEDLESS GRAPES 2.65\nSTRAWBERRIES 4.00\nDISCOUNT 0.20\nTOTAL £6.45\nVISA 6.45';
 const r=parseReceiptText(text);
 assert.equal(r.lines.length,2);
 assert.deepEqual(r.lines.map(x=>x.amount),[2.65,4]);
 assert.equal(r.ticketTotal,6.45);
 assert.equal(r.recognizedTotal,6.65);
 assert.equal(r.fingerprint,receiptFingerprint(text));
});
test('Ticket ambigu : seul le produit reconnaissable est proposé et reste à confirmer',()=>{
 const m=makeMonth(0);
 const r=parseReceiptText('STRAWBERRIES 4.00\nTHING UNKNOWN 1.25\nTOTAL 5.25');
 const rows=recommendReceiptMatches(r,m,0);
 assert.equal(rows.length,2);
 assert.ok(rows[0].selectedId);
 assert.equal(rows[1].selectedId,'');
});
test('Import ticket : reçus reconnus, marge réajustée et fingerprint bloquant le deuxième import',()=>{
 const state=newState(),m=state.months['0'];
 const r=parseReceiptText('STRAWBERRIES 4.50\nRED GRAPES 3.00\nTOTAL 7.50');
 const berries=m.groceries.find(x=>x.name==='Fraises M&S'&&x.week===0);
 const grapes0=grapes(m);
 const rows=[{...r.lines[0],selectedId:berries.id},{...r.lines[1],selectedId:grapes0.id}];
 const before=finance(m).forecast;
 const result=applyReceiptReview(state,m,r,rows);
 assert.equal(result.matched,2);
 assert.equal(result.total,7.5);
 assert.equal(finance(m).paid,7.5);
 assert.equal(m.groceries.find(x=>x.id===berries.id).actual,4.5);
 assert.equal(nextGrapes(m,1).estimate,6);
 assert.equal(nextGrapes(m,4).estimate,3);
 assert.ok(finance(m).forecast>before);
 const snapshot=finance(m);
 assert.throws(()=>applyReceiptReview(state,m,r,rows),/déjà été rapproché/);
 assert.deepEqual(finance(m),snapshot);
 assert.equal(m.receiptImports.length,1);
});
test('Lignes sans produit : seulement les dépenses hors liste explicitement choisies sont comptées',()=>{
 const s=newState(),m=s.months['0'];
 const r=parseReceiptText('AUBERGINE RARE 2.50\nTOTAL 2.50');
 const row={...r.lines[0],selectedId:'extra'};
 applyReceiptReview(s,m,r,[row],{supplier:'Ocado'});
 assert.equal(finance(m).paid,2.5);
 assert.equal(m.extraExpenses.length,1);
 assert.equal(m.extraExpenses[0].supplier,'Ocado');
 assert.ok(!JSON.stringify(m.receiptImports).includes('AUBERGINE'));
});
test('Validation atomique : un produit introuvable annule tout le ticket',()=>{
 const s=newState(),m=s.months['0'];
 const r=parseReceiptText('STRAWBERRIES 4.50\nGRAPES 2.65\nTOTAL 7.15');
 const berries=m.groceries.find(x=>x.name==='Fraises M&S'&&x.week===0);
 const row1={...r.lines[0],selectedId:berries.id};
 const row2={...r.lines[1],selectedId:'not-in-cart'};
 assert.throws(()=>applyReceiptReview(s,m,r,[row1,row2]),/Produit déjà acheté ou non disponible/);
 assert.equal(finance(m).paid,0);
 assert.equal(m.receiptImports.length,0);
});
test('Deux lignes vers le même produit : refus, pas de double dépense',()=>{
 const s=newState(),m=s.months['0'];
 const r=parseReceiptText('STRAWBERRIES 4.00\nSTRAWBERRIES 4.00');
 const id=m.groceries.find(x=>x.name==='Fraises M&S'&&x.week===0).id;
 assert.throws(()=>applyReceiptReview(s,m,r,r.lines.map(x=>({...x,selectedId:id}))),/deux lignes/);
 assert.equal(finance(m).paid,0);
});
test('Migration v10 → v11 : reçus historiques, sauvegarde, prix anciens intacts',()=>{
 const raw=newState(),month=raw.months['0'];
 raw.version=10;delete raw.priceBook;
 const item=grapes(month);item.bought=true;item.actual=5.75;
 month.extraExpenses.push({id:'facture',label:'Taxi livraison',supplier:'Autre',amount:3.1,date:'2026-11-19'});
 const newer=validateImport(structuredClone(raw));
 assert.equal(newer.version,11);
 assert.deepEqual(newer.priceBook,{});
 assert.equal(newer.months['0'].groceries.find(x=>x.id===item.id).actual,5.75);
 assert.equal(finance(newer.months['0']).paid,8.85);
 assert.deepEqual(newer.months['0'].receiptImports,[]);
});
test('OCR Android sans modules : refus explicite, pas de faux scan',async()=>{
 assert.equal(nativeReceiptAvailable({isNativePlatform:()=>false}),false);
 await assert.rejects(captureReceiptText({isNativePlatform:()=>false}),/APK Android/);
 await assert.rejects(captureReceiptText({isNativePlatform:()=>true,Plugins:{}}),/Modules natifs/);
});
test('OCR Android bridge : photo locale, texte reçu sans upload',async()=>{
 let calls=0;
 const cap={isNativePlatform:()=>true,Plugins:{
  Camera:{getPhoto:async()=>{calls++;return {path:'file:///private/ticket.jpg'}}},
  TextRecognition:{processImage:async options=>{calls++;assert.equal(options.path,'file:///private/ticket.jpg');assert.equal(options.script,'LATIN');return {text:'STRAWBERRIES 4.00'}}}
 }};
 assert.equal(nativeReceiptAvailable(cap),true);
 assert.equal(await captureReceiptText(cap),'STRAWBERRIES 4.00');
 assert.equal(calls,2);
});
