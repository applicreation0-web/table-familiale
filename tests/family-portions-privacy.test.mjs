import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FAMILY_PROFILE,quantityAudit} from '../family-portions.js';
import {LEGACY_FAMILY_PLAN,FAMILY_PLAN} from '../meal-plan.js';
import {makeMonth,newState,validateImport,finance,shoppingEntries,setBakingWeek} from '../model.js';
const clone=x=>JSON.parse(JSON.stringify(x));

test('2 adultes + 3 enfants : quantités par familles d’ingrédients, non 5 parts adultes',()=>{
 assert.equal(FAMILY_PROFILE.adults,2);
 assert.equal(FAMILY_PROFILE.children,3);
 assert.equal(FAMILY_PROFILE.adultPortionEquivalents,4);
 const m=makeMonth(0);
 const rice=m.meals[10].ingredients.find(i=>i.name==='Riz');
 assert.equal(rice.quantity,800); // 1 300 g sec dans la recette de référence.
 assert.equal(LEGACY_FAMILY_PLAN[10].ingredients.find(i=>i.name==='Riz').quantity,1300);
 const carrot=quantityAudit(m,0).find(i=>i.name==='Carottes');
 assert.equal(carrot.proposedKg,3);
 assert.equal(carrot.plannedKg,3);
 assert.ok(carrot.recipeKg>2&&carrot.recipeKg<3);
 assert.equal(m.groceries.find(i=>i.week===0&&i.name==='Carottes').price,4.8);
});
test('panier : second sachet de poires facultatif, plafond et prix non masqués',()=>{
 const m=makeMonth(0);
 for(let week=0;week<5;week++)
  assert.equal(shoppingEntries(m,week,false).filter(x=>x.name.startsWith('Poires Ocado')).length,1);
 assert.equal(finance(m).forecast,887.98);
 for(let week=0;week<5;week++)setBakingWeek(m,week,true);
 assert.equal(finance(m).forecast,893.78);
 assert.equal(finance(m).budget,900);
});
test('migration v12→v13 : préserver cuisiné, personnalisation, paiement et recette non éditée',()=>{
 const state=newState(),month=state.months['0'];
 const paid=month.groceries.find(i=>i.name==='Carottes'&&i.week===0);
 paid.bought=true;paid.actual=6.88;
 month.meals[0].ingredients=clone(LEGACY_FAMILY_PLAN[0].ingredients);
 month.meals[0].cooked=true;month.meals[0].cookedAt='2026-11-20T13:00:00.000Z';
 month.meals[1].ingredients=clone(LEGACY_FAMILY_PLAN[1].ingredients);
 month.meals[1].ingredients[0].quantity=1633;
 month.meals[2].ingredients=clone(LEGACY_FAMILY_PLAN[2].ingredients);
 state.version=12;
 const migrated=validateImport(clone(state)),m=migrated.months['0'];
 assert.equal(migrated.version,13);
 assert.equal(m.meals[0].ingredients[0].quantity,LEGACY_FAMILY_PLAN[0].ingredients[0].quantity);
 assert.equal(m.meals[0].cooked,true);
 assert.equal(m.meals[1].ingredients[0].quantity,1633);
 assert.deepEqual(m.meals[2].ingredients,FAMILY_PLAN[2].ingredients);
 assert.equal(m.groceries.find(i=>i.id===paid.id).actual,6.88);
 assert.equal(validateImport(migrated).months['0'].groceries.find(i=>i.id===paid.id).actual,6.88);
});
test('publication : fixture synthétique, documentation sans URL nominative ni paiement réel',()=>{
 const fixture=readFileSync(new URL('./receipt-ms-real-photo.test.mjs',import.meta.url),'utf8');
 const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
 assert.match(fixture,/Fixture 100 % synthétique/);
 assert.doesNotMatch(fixture,/Balance before Saving £117\.15/);
 assert.doesNotMatch(readme,/table-familiale-[a-z]+-[a-z]+-\d{4}\.vercel\.app/i);
 assert.doesNotMatch(readme,/115,65 £/);
});
