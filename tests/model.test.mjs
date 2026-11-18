import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE_MENU,BASE_SHOPPING} from '../data.js';
import {MEAL_INGREDIENTS} from '../recipes.js';
import {makeMonth,periodDays,finance,ingredientChanges,suggestedPurchases,saveDish,swapDishes,shoppingEntries,markBought,validateImport,newState} from '../model.js';

test('Le planning source couvre 31 journées et 20 repas viande/poisson',()=>{
 assert.equal(BASE_MENU.length,31);
 assert.equal(BASE_MENU.filter(x=>x.kind!=='V').length,20);
 assert.equal(MEAL_INGREDIENTS.length,31);
 assert.equal(periodDays(0).length,31);
 assert.equal(periodDays(1).length,31);
});
test('Panier premium fixe : 829,14 £, objectif 850 £',()=>{
 assert.equal(Math.round(BASE_SHOPPING.reduce((s,x)=>s+x.price,0)*100)/100,829.14);
 const f=finance(makeMonth(0));
 assert.equal(f.forecast,829.14);
 assert.equal(f.forecastHeadroom,20.86);
 assert.equal(f.paid,0);
});
test('La viande et le poisson sont achetés une fois en début de mois',()=>{
 const month=makeMonth(0);
 const stock=shoppingEntries(month,0,true);
 assert.equal(stock.length,8);
 assert.equal(stock.find(x=>x.name==='Cabillaud (carton 1,8 kg)')?.qty,'2 cartons (3,6 kg)');
 assert.equal(stock.find(x=>x.name.includes('Maquereau'))?.qty,'18 boîtes');
 assert.equal(Math.round(stock.reduce((s,x)=>s+x.price,0)*100)/100,395.29);
 assert.equal(month.groceries.filter(x=>x.supplier==='Saffron Alley').every(x=>x.purchase==='monthly'),true);
});
test('M&S premium : 3kg de yaourt grec par semaine sur 4 semaines, 2kg dernière',()=>{
 const y=makeMonth(0).groceries.filter(x=>x.name==='Yaourt grec M&S Collection');
 assert.equal(y.length,5);
 assert.equal(y.slice(0,4).every(x=>x.qty==='3 × 1 kg'),true);
 assert.equal(y[4].qty,'2 × 1 kg');
});
test('Ajout d’un ingrédient absent crée une suggestion de courses dans la bonne semaine',()=>{
 const m=makeMonth(0);
 const rec=structuredClone(m.meals[0]);
 rec.ingredients.push({name:'Persil frais',quantity:2,unit:'bouquet',supplier:'M&S',price:2.50});
 saveDish(m,0,rec);
 const auto=suggestedPurchases(m).find(x=>x.name==='Persil frais');
 assert.ok(auto);
 assert.equal(auto.week,0);
 assert.equal(auto.qty,'2 bouquet');
 assert.equal(auto.estimate,2.50);
 assert.equal(finance(m).forecast,831.64);
});
test('Prix absent est signalé et non fictivement considéré comme zéro',()=>{
 const m=makeMonth(0), rec=structuredClone(m.meals[0]);
 rec.ingredients.push({name:'Herbes fraîches de saison',quantity:1,unit:'sachet',supplier:'M&S',price:null});
 saveDish(m,0,rec);
 assert.equal(finance(m).unknownCount,1);
 assert.equal(finance(m).forecast,829.14);
});
test('Un échange de dates change les besoins par semaine sans toucher au statut',()=>{
 const m=makeMonth(0);const before=m.meals[0].name;
 swapDishes(m,0,8);
 assert.equal(m.meals[8].name,before);
 assert.equal(m.meals[0].cooked,false);
 assert.equal(ingredientChanges(m).some(x=>x.delta>0&&x.week===1),true);
});
test('On protège les repas déjà cuisinés',()=>{
 const m=makeMonth(0);m.meals[0].cooked=true;
 assert.throws(()=>swapDishes(m,0,7),/cuisiné/);
 assert.throws(()=>saveDish(m,0,{name:'Soupe',kind:'V',ingredients:[{name:'Carotte',quantity:100,unit:'g',supplier:'M&S'}]}),/cuisiné/);
});
test('Un achat réel déduit le montant payé et l’historique reste intact',()=>{
 const m=makeMonth(0), item=shoppingEntries(m,0,false)[0];
 markBought(m,item,true,6.99);
 assert.equal(finance(m).paid,6.99);
 assert.equal(finance(m).forecast,829.14-item.price+6.99);
 markBought(m,item,false,null);
 assert.equal(finance(m).paid,0);
});
test('Les suggestions achetées restent en dépenses même si le menu est corrigé',()=>{
 const m=makeMonth(0), rec=structuredClone(m.meals[0]);
 rec.ingredients.push({name:'Herbe rare',quantity:100,unit:'g',supplier:'M&S',price:4});saveDish(m,0,rec);
 const auto=suggestedPurchases(m).find(x=>x.name==='Herbe rare');
 markBought(m,auto,true,4.20);
 assert.equal(finance(m).paid,4.20);
 saveDish(m,0,{...rec,ingredients:rec.ingredients.filter(i=>i.name!=='Herbe rare')});
 assert.equal(finance(m).paid,4.20);
});
test('Export/import conserve le suivi mensuel',()=>{
 const saved=newState();saved.months['0'].meals[3].cooked=true;
 const loaded=validateImport(JSON.parse(JSON.stringify(saved)));
 assert.equal(loaded.months['0'].meals[3].cooked,true);
 assert.throws(()=>validateImport({version:2,months:{'0':{meals:[]}}}),/Structure/);
});
