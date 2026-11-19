import test from 'node:test';
import assert from 'node:assert/strict';
import {newState,finance,validateImport,shoppingEntries,suggestedPurchases} from '../model.js';
import {parseReceiptText,recommendReceiptMatches,applyReceiptReview} from '../receipt.js';
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
 assert.equal(items[2].selectedId,''); // Cheddar sans garantie de présure végétale : vérification obligatoire.
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

test('ticket complet : préférer les pâtes aux courgettes et tomates sans fromage incertain',()=>{
 const m=newState().months['0'];
 const p=noteCompletedReceiptWeek(m,0,[...synthetic,selection('00821964','CHOPPD TOMATO',.50)],{
  supplier:'M&S',fingerprint:'synthetic-tomato-safe'});
 assert.equal(p.changed.length,1);
 assert.equal(m.meals[2].name,'Pennes complètes aux courgettes et tomates');
 assert.equal(m.meals[2].ingredients.some(x=>/Fromage|cheddar/i.test(x.name)),false);
 assert.equal(m.meals[2].ingredients.find(x=>x.name==='Tomates concassées')?.quantity,300);
 const additions=suggestedPurchases(m).filter(x=>x.week===0);
 assert.ok(!additions.some(x=>['Pâtes complètes','Courgettes','Tomates concassées','Ail'].includes(x.name)),
   'Ne pas réclamer une seconde fois des ingrédients déjà relevés sur le ticket');
});

test('carottes M&S réf. 29087914 : afficher 1 kg réellement acheté, pas les 3 kg prévus',()=>{
 const state=newState(),month=state.months['0'];
 const carrots=month.groceries.find(x=>x.week===0&&x.name==='Carottes');
 assert.ok(carrots.qty.includes('3 kg')); // Besoin du menu, pas achat réel.
 const parsed=parseReceiptText('29087914 ORG CARROTS £1.60<\nBalance to Pay £1.60');
 applyReceiptReview(state,month,parsed,[{
  ...parsed.lines[0],selectedId:carrots.id,quantityConfirmed:false
 }]);
 assert.equal(carrots.receiptQty,1);
 assert.equal(carrots.receiptQtyUnit,'kg');
 assert.equal(shoppingEntries(month,0,false).find(x=>x.id===carrots.id).qty,'1 kg');
 assert.ok(carrots.qty.includes('3 kg')); // Cible théorique conservée.
 assert.equal(carrots.actual,1.60);
 assert.equal(finance(month).paid,1.60);
 const reloaded=validateImport(JSON.parse(JSON.stringify(state)));
 assert.equal(reloaded.months['0'].groceries.find(x=>x.id===carrots.id).receiptQty,1);
});
test('deux boîtes de 12 œufs du même ticket = 24 œufs payés sans doublon',()=>{
 const state=newState(),month=state.months['0'];
 const eggs=month.groceries.find(x=>x.week===0&&x.name==='Œufs');
 const parsed=parseReceiptText('29089635 MIXED EGGS X1 £5.40<\n29089635 MIXED EGGS X1 £5.40<\nBalance to Pay £10.80');
 const rows=parsed.lines.map(x=>({...x,selectedId:eggs.id,quantityConfirmed:false}));
 applyReceiptReview(state,month,parsed,rows);
 assert.equal(eggs.actual,10.80);
 assert.equal(eggs.receiptQty,24);
 assert.equal(shoppingEntries(month,0,false).find(x=>x.id===eggs.id).qty,'2 × 12 œufs (24 œufs)');
 assert.equal(finance(month).paid,10.80);
});
