import test from 'node:test';
import assert from 'node:assert/strict';
import {newState,finance,validateImport} from '../model.js';
import {parseReceiptText,recommendReceiptMatches} from '../receipt.js';
import {FAMILY_PLAN} from '../meal-plan.js';
import {receiptIngredientCategory,noteCompletedReceiptWeek,
 rearrangeMissingSalmon,restoreAutoAdjustedMeal} from '../receipt-stock.js';

const selection=(sku,label,amount=2.5)=>({sku,label,amount,selectedId:'extra'});
const synthetic=[
 selection('00671729','W/WHEAT PENNE'),
 selection('00233620','ORG COURGETTE'),
 selection('29091188','GRATED CHEDDA'),
 selection('00199032','GARLIC BULB'),
 selection('29089635','MIXED EGGS X1',5.40),
 selection('00848503','BROCCOLI CROW')
];
test('semaines non importées : aucune substitution fondée sur un article absent',()=>{
 const m=newState().months['0'],old=m.meals[2].name;
 const p=rearrangeMissingSalmon(m,0);
 assert.equal(p.changed.length,0);
 assert.equal(m.meals[2].name,old);
});
test('ticket M&S complet sans saumon : remplacer le seul plat saumon de la première semaine',()=>{
 const m=newState().months['0'];
 const baseline=m.meals[2].name,paidBefore=finance(m).paid;
 const monthly=m.groceries.find(x=>x.supplier==='Dining Solutions').price;
 const p=noteCompletedReceiptWeek(m,0,synthetic,{supplier:'M&S',fingerprint:'anonymous-fixture'});
 assert.equal(p.changed.length,1);
 assert.equal(m.meals[2].name,'Pennes complètes aux courgettes et cheddar');
 assert.equal(m.meals[2].kind,'V');
 assert.equal(m.meals[3].batchRole,'prepare');
 assert.equal(m.meals[4].batchRole,'reheat');
 assert.equal(m.groceries.find(x=>x.id==='ms-fresh-salmon-week-0').hidden,true);
 assert.equal(m.groceries.find(x=>x.supplier==='Dining Solutions').price,monthly);
 assert.equal(m.receiptWeeks[0].categories.pasta,1);
 assert.equal(m.receiptWeeks[0].complete,true);
 assert.equal(finance(m).paid,paidBefore); // Aucun achat ou paiement inventé.
 assert.ok(m.receiptWeeks[0].absentPlanLines>0);
 assert.equal(m.meals[2].autoAdjusted.previous.name,baseline);
 restoreAutoAdjustedMeal(m,2);
 assert.equal(m.meals[2].name,baseline);
 assert.equal(m.groceries.find(x=>x.id==='ms-fresh-salmon-week-0').hidden,false);
});
test('ticket complet avec saumon confirmé : préserver le plat initial',()=>{
 const m=newState().months['0'];
 const p=noteCompletedReceiptWeek(m,0,[...synthetic,selection(null,'SCOTTISH SALMON FILLET',9)],
   {supplier:'M&S',fingerprint:'synthetic-salmon'});
 assert.equal(p.changed.length,0);
 assert.equal(m.meals[2].name,FAMILY_PLAN[2].name);
});
test('recette cuisinée ou personnalisée : jamais de remplacement automatisé',()=>{
 const m=newState().months['0'];
 m.meals[2].cooked=true;
 const p=noteCompletedReceiptWeek(m,0,synthetic,{supplier:'M&S',fingerprint:'synthetic-cooked'});
 assert.equal(p.changed.length,0);
 assert.equal(m.meals[2].name,FAMILY_PLAN[2].name);
 assert.throws(()=>restoreAutoAdjustedMeal(m,2));
 const other=newState().months['0'];
 other.meals[2].ingredients[0].quantity+=200;
 const q=noteCompletedReceiptWeek(other,0,synthetic,{supplier:'M&S',fingerprint:'synthetic-custom'});
 assert.equal(q.changed.length,0);
 assert.equal(other.meals[2].ingredients[0].quantity,FAMILY_PLAN[2].ingredients[0].quantity+200);
});
test('ne jamais considérer une semaine comme complète avec le ticket d’un autre magasin',()=>{
 const m=newState().months['0'];
 noteCompletedReceiptWeek(m,0,synthetic,{supplier:'Ocado'});
 assert.equal(m.receiptWeeks?.[0],undefined);
});
test('rapprochements de codes M&S : vraies références de catalogue, marques distinctes',()=>{
 const r=parseReceiptText([
 '00671729 W/WHEAT PENNE £2.30<','00089241 FUSILLI ONI £2.30<',
 '29091188 GRATED CHEDDA £4.50<','00848503 BROCCOLI CROW £1.30<',
 '00857406 WHITE GRAPE £2.50<'].join('\n'));
 const m=newState().months['0'],items=recommendReceiptMatches(r,m,0);
 assert.equal(items.length,5);
 assert.equal(items[0].selectedId,m.groceries.find(x=>x.name==='Pâtes complètes'&&x.week===0).id);
 assert.equal(items[1].selectedId,items[0].selectedId);
 assert.equal(items[2].selectedId,m.groceries.find(x=>x.name.startsWith('Fromage M&S')&&x.week===0).id);
 assert.equal(items[3].selectedId,m.groceries.find(x=>x.name==='Brocolis frais M&S'&&x.week===0).id);
 assert.equal(items[4].selectedId,''); // Raisins blancs ≠ raisins rouges prévus.
 assert.equal(receiptIngredientCategory(items[4]),'grapes');
});
test('migration précédente conserve inventaire sans données nominatives',()=>{
 const state=newState();
 noteCompletedReceiptWeek(state.months['0'],0,synthetic,{fingerprint:'synthetic-only'});
 const loaded=validateImport(JSON.parse(JSON.stringify(state)));
 assert.equal(loaded.months['0'].receiptWeeks[0].complete,true);
 assert.ok(!JSON.stringify(loaded).includes('credit card'));
});
