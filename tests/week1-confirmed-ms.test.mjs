import test from 'node:test';
import assert from 'node:assert/strict';
import {newState,validateImport,finance,weeklyEggSummary,suggestedPurchases,shoppingEntries,quantityAudit} from '../model.js';
import {parseReceiptText,applyReceiptReview} from '../receipt.js';
import {applyUserConfirmedNoSalmonWeek1} from '../week1-plan.js';
import {prepareQuickReceipt} from '../receipt-quick.js';
import {noteCompletedReceiptWeek,restoreAutoAdjustedMeal} from '../receipt-stock.js';

const clone=x=>JSON.parse(JSON.stringify(x));
function syntheticPaidWeek(){
 const lines=[
  ['00147217 MINI N POTATO',2.40],
  ['29087914 ORG CARROTS',1.60],
  ['00233620 ORG COURGETTE',2.45],
  ['00848503 BROCCOLI CROW',1.30],
  ['00821964 CHOPPD TOMATO',.50],
  ['29329724 GIANT WG COUS',2.90],
  ['00671729 W/WHEAT PENNE',2.30],
  ['29089635 MIXED EGGS X1',5.40],
  ['29089635 MIXED EGGS X1',5.40],
  ['29091188 GRATED CHEDDA',4.50]
 ];
 const subtotal=Math.round(lines.reduce((v,x)=>v+x[1],0)*100)/100;
 return lines.map(([label,price])=>label+' £'+price.toFixed(2)+'<').join('\n')+
  '\nBalance before Saving £'+subtotal.toFixed(2)+
  '\nCar Park Refund -£1.00\nBalance to Pay £'+(subtotal-1).toFixed(2);
}
test('déclaration utilisateur enlève le saumon de semaine 1 dès ouverture, mais ne crée aucun achat',()=>{
 const month=newState().months['0'],baseline=month.meals[2].name;
 assert.match(baseline,/saumon/i);
 const before=finance(month).paid;
 const change=applyUserConfirmedNoSalmonWeek1(month);
 assert.equal(change.changed.length,1);
 assert.equal(month.meals[2].name,'Couscous complet aux courgettes, tomates et œufs');
 assert.equal(month.groceries.find(i=>i.id==='ms-fresh-salmon-week-0').hidden,true);
 assert.equal(month.receiptWeeks?.[0],undefined);
 assert.equal(finance(month).paid,before);
 assert.equal(applyUserConfirmedNoSalmonWeek1(month).changed.length,0);
 restoreAutoAdjustedMeal(month,2);
 assert.equal(month.meals[2].name,baseline);
 assert.equal(month.groceries.find(i=>i.id==='ms-fresh-salmon-week-0').hidden,false);
});
test('les recettes déjà cuisinées ou personnalisées sont protégées avant import',()=>{
 for(const change of [
  m=>m.meals[2].cooked=true,
  m=>m.meals[2].ingredients[0].quantity+=100,
  m=>m.meals[2].name='Recette du foyer'
 ]){
  const month=newState().months['0'];change(month);
  assert.equal(applyUserConfirmedNoSalmonWeek1(month).changed.length,0);
 }
 const later=newState().months['0'];later.index=1;
 assert.equal(applyUserConfirmedNoSalmonWeek1(later).changed.length,0);
});
test('ticket local complet : réconciliation exacte sans masquer les frais ou inventer des achats',()=>{
 const month=newState().months['0'];
 const preview=prepareQuickReceipt(syntheticPaidWeek(),month,0);
 assert.equal(preview.parsed.lines.length,10);
 assert.equal(preview.parsed.reconciliationGap,0);
 assert.equal(preview.hasSalmon,false);
 assert.equal(preview.parsed.discountTotal,-1);
 assert.equal(preview.rows.length,10);
 assert.ok(preview.matched>0&&preview.extras>0);
 assert.ok(preview.rows.every(r=>!!r.selectedId));
 assert.ok(preview.rows.some(r=>r.sku==='29087914'&&r.quantityConfirmed));
 assert.ok(preview.rows.filter(r=>r.sku==='29089635').every(r=>r.quantityConfirmed));
 assert.ok(preview.rows.some(r=>r.sku==='00671729'&&!r.quantityConfirmed));
 const stale=syntheticPaidWeek().replace('Balance to Pay £','Balance to Pay £999');
 assert.throws(()=>prepareQuickReceipt(stale,month,0));
});
test('semaine 1 après ticket confirmé : 7 jours, sans saumon, carottes 950g, œufs <=24, aucun faux crédit',()=>{
 const state=newState(),month=state.months['0'];
 const paidBefore=finance(month).paid;
 assert.equal(paidBefore,0);
 applyUserConfirmedNoSalmonWeek1(month);
 const preview=prepareQuickReceipt(syntheticPaidWeek(),month,0);
 const receipt=applyReceiptReview(state,month,preview.parsed,preview.rows,{supplier:'M&S'});
 const plan=noteCompletedReceiptWeek(month,0,preview.rows,{supplier:'M&S',fingerprint:preview.parsed.fingerprint});
 assert.equal(finance(month).paid,receipt.total);
 assert.equal(receipt.total,preview.expectedNet);
 assert.equal(month.receiptImports.length,1);
 assert.equal(month.receiptWeeks[0].complete,true);
 assert.ok(plan.changed.length>=3);
 assert.equal(month.meals[2].name,'Couscous complet aux courgettes, tomates et œufs');
 assert.equal(month.meals[6].name,'Fusilli complets aux brocolis, tomates et œufs');
 assert.equal(month.meals[0].ingredients.find(x=>x.name==='Carottes').quantity,450);
 assert.equal(month.meals[3].ingredients.find(x=>x.name==='Carottes').quantity,500);
 assert.equal(month.meals[3].batchRole,'prepare');
 assert.equal(month.meals[4].batchRole,'reheat');
 assert.equal(month.meals[1].ingredients.some(x=>x.name==='Fromage'),false);
 assert.ok(weeklyEggSummary(month,0).mealsUsed+weeklyEggSummary(month,0).breakfastEggs<=24);
 assert.equal(month.groceries.find(x=>x.name==='Carottes'&&x.week===0).receiptQty,1);
 const carrotLearning=state.priceBook['m et s|carottes|g']||state.priceBook['m s|carottes|g'];
 assert.ok(carrotLearning,'Référence de carottes M&S apprise par kg');
 assert.ok(Math.abs(carrotLearning.unitPrice-0.0016)<0.00000001,
   '1,60 £ divisé par 1 000 g réellement achetés, pas par 3 000 g prévus');
 const broccoli=shoppingEntries(month,0,false).find(x=>x.name==='Brocolis frais M&S');
 assert.equal(broccoli.receiptPackUnknown,true);
 assert.equal(broccoli.qty,'1 emballage · poids/format à vérifier');
 const carrots=quantityAudit(month,0).find(x=>x.name==='Carottes');
 assert.equal(carrots.actualKg,1);
 assert.equal(carrots.actualShortageKg,0);
 assert.equal(shoppingEntries(month,0,false).find(x=>x.name==='Carottes').qty,'1 kg');
 assert.ok(!suggestedPurchases(month).some(x=>x.week===0&&x.name==='Couscous complet'));
 assert.equal(month.groceries.find(x=>x.id==='month-4').bought,false);
 assert.ok(!month.meals.slice(0,7).some(x=>/saumon|salmon/i.test(x.name)));
 assert.throws(()=>applyReceiptReview(state,month,preview.parsed,preview.rows,{supplier:'M&S'}),/déjà/);
 const saved=validateImport(clone(state));
 assert.equal(saved.months['0'].receiptWeeks[0].complete,true);
 assert.equal(saved.months['0'].meals[2].name,month.meals[2].name);
});
test('import avec tickets incomplets ou total incohérent : refus avant tout paiement',()=>{
 const month=newState().months['0'];
 assert.throws(()=>prepareQuickReceipt('ORG CARROTS £1.60',month,0),/incomplet/);
 assert.throws(()=>prepareQuickReceipt('ORG CARROTS £1.60\nBalance to Pay £0.10',month,0),/incomplet/);
 assert.equal(finance(month).paid,0);
});
