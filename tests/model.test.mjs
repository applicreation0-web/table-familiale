import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE_MENU,BASE_SHOPPING} from '../data.js';
import {MEAL_INGREDIENTS} from '../recipes.js';
import {FAMILY_PLAN} from '../meal-plan.js';
import {makeMonth,periodDays,finance,ingredientChanges,suggestedPurchases,saveDish,swapDishes,toggleCooked,shoppingEntries,markBought,markInStock,setBakingWeek,isBakingWeek,validateImport,newState} from '../model.js';

test('31 jours : exactement un plat africain par semaine, 2 jours et une cuisson',()=>{
 assert.equal(BASE_MENU.length,31);
 assert.equal(FAMILY_PLAN.length,31);
 assert.equal(MEAL_INGREDIENTS.length,31);
 assert.equal(periodDays(0).length,31);
 const m=makeMonth(0);
 assert.deepEqual(m.meals.map((x,i)=>x.batchRole==='prepare'?i:null).filter(x=>x!==null),[3,10,17,24,29]);
 for(let w=0;w<5;w++){
  const days=m.meals.slice(w*7,w*7+7);
  assert.equal(days.filter(x=>x.african&&x.batchRole==='prepare').length,1);
 }
 for(const i of [3,10,17,24,29]){
  assert.equal(m.meals[i+1].batchRole,'reheat');
  assert.equal(m.meals[i].name,m.meals[i+1].name);
  assert.equal(m.meals[i].servings,10);
  assert.equal(m.meals[i].mealsPerDay,1);
  assert.ok(m.meals[i].ingredients.length>0);
  assert.equal(m.meals[i+1].ingredients.length,0);
 }
 assert.equal(m.meals.filter(x=>x.kind!=='V').length,24);
});
test('Lait Yeo Valley 8L, 24 oeufs sans pâtisserie et yaourt 3kg chaque semaine',()=>{
 const m=makeMonth(0);
 for(let w=0;w<4;w++){
  const rows=shoppingEntries(m,w,false);
  assert.equal(rows.find(x=>x.name.includes('Yeo Valley'))?.qty,'4 × 2 L (8 L)');
  assert.equal(rows.find(x=>x.name==='Œufs')?.qty,'2 × 12 (24 œufs)');
  assert.equal(rows.find(x=>x.name==='Yaourt grec M&S Collection')?.qty,'3 × 1 kg');
 }
 const last=shoppingEntries(m,4,false);
 assert.equal(last.find(x=>x.name.includes('Yeo Valley'))?.qty,'2 × 2 L (4 L)');
 assert.equal(last.find(x=>x.name==='Œufs')?.qty,'1 × 12 (12 œufs)');
 assert.equal(last.find(x=>x.name==='Yaourt grec M&S Collection')?.qty,'2 × 1 kg');
 assert.equal(m.groceries.filter(x=>x.name.includes('Farine blanche')).length,2);
 assert.ok(m.groceries.some(x=>x.name.includes('Levure chimique')));
});
test('Un panier dépassant 850£ n’est pas artificiellement ramené au budget',()=>{
 const estimated=Math.round(BASE_SHOPPING.reduce((s,x)=>s+x.price,0)*100)/100;
 assert.equal(estimated,1000.19);
 const f=finance(makeMonth(0));
 assert.equal(f.forecast,972.39);
 assert.equal(f.forecastHeadroom,-122.39);
 assert.equal(f.paid,0);
});
test('Achats mensuels : 5.4kg de cabillaud et 5.5kg agneau, sans double compte',()=>{
 const monthly=shoppingEntries(makeMonth(0),0,true);
 assert.equal(monthly.length,7);
 assert.equal(monthly.find(x=>x.name.includes('Cabillaud (carton'))?.qty,'3 cartons (5,4 kg)');
 assert.equal(monthly.find(x=>x.name.includes('Agneau épaule'))?.qty,'5,5 kg');
 assert.equal(monthly.find(x=>x.name.includes('Hubbard entier grand'))?.qty,'4 pièces');
 assert.equal(monthly.find(x=>x.name.includes('Hubbard entier 1,6'))?.qty,'1 pièce');
});
test('Les jours de réchauffage ne créent pas de suggestion supplémentaire',()=>{
 const m=makeMonth(0);
 assert.deepEqual(ingredientChanges(m),[]);
 assert.deepEqual(suggestedPurchases(m),[]);
});
test('Modifier une préparation actualise aussi le deuxième jour, mais pas ses ingrédients',()=>{
 const m=makeMonth(0);
 const rec=structuredClone(m.meals[3]);
 rec.name='Mafé familial adapté';
 rec.ingredients.push({name:'Persil',quantity:2,unit:'bouquet',supplier:'M&S',price:2.50});
 saveDish(m,3,rec);
 assert.equal(m.meals[4].name,'Mafé familial adapté');
 assert.equal(m.meals[4].ingredients.length,0);
 assert.equal(suggestedPurchases(m).find(x=>x.name==='Persil')?.estimate,2.50);
 assert.throws(()=>saveDish(m,4,rec),/premier jour/);
});
test('Suivi des deux journées : cuisson puis réchauffage, sans crédit fantôme',()=>{
 const m=makeMonth(0);
 assert.throws(()=>toggleCooked(m,4),/d’abord/);
 assert.equal(toggleCooked(m,3),true);
 assert.equal(toggleCooked(m,4),true);
 assert.throws(()=>toggleCooked(m,3),/d’abord le jour de réchauffage/);
 toggleCooked(m,4);
 toggleCooked(m,3);
 assert.equal(finance(m).cooked,0);
});
test('Permutation simple et permutation de deux jours sont cohérentes',()=>{
 const m=makeMonth(0);
 const simple=m.meals[0].name;
 swapDishes(m,0,8);
 assert.equal(m.meals[8].name,simple);
 const a=m.meals[3].name,b=m.meals[10].name;
 swapDishes(m,3,10);
 assert.equal(m.meals[3].name,b);
 assert.equal(m.meals[4].name,b);
 assert.equal(m.meals[10].name,a);
 assert.equal(m.meals[11].name,a);
 assert.equal(ingredientChanges(m).some(x=>x.delta>0),true);
});
test('On refuse d’écraser deux journées en échangeant un plat groupé avec un plat simple',()=>{
 const m=makeMonth(0),name=m.meals[3].name;
 assert.throws(()=>swapDishes(m,3,7),/même durée/);
 assert.equal(m.meals[3].name,name);
 assert.equal(m.meals[4].batchRole,'reheat');
});
test('Un plat cuisiné est protégé des modifications et déplacements',()=>{
 const m=makeMonth(0);
 toggleCooked(m,3);
 assert.throws(()=>swapDishes(m,3,10),/cuisiné/);
 assert.throws(()=>saveDish(m,3,{name:'Soupe',kind:'V',ingredients:[{name:'Carotte',quantity:100,unit:'g',supplier:'M&S'}]}),/cuisiné/);
});
test('Compléments aux achats et prix incertains restent traçables',()=>{
 const m=makeMonth(0);
 const rec=structuredClone(m.meals[0]);
 rec.ingredients.push({name:'Herbe rare',quantity:100,unit:'g',supplier:'M&S',price:4});
 saveDish(m,0,rec);
 const auto=suggestedPurchases(m).find(x=>x.name==='Herbe rare');
 markBought(m,auto,true,4.20);
 saveDish(m,0,{...rec,ingredients:rec.ingredients.filter(i=>i.name!=='Herbe rare')});
 assert.equal(finance(m).paid,4.20);
 const unknown=structuredClone(m.meals[1]);
 unknown.ingredients.push({name:'Herbes fraîches',quantity:1,unit:'sachet',supplier:'M&S',price:null});
 saveDish(m,1,unknown);
 assert.equal(finance(m).unknownCount,1);
});
test('Import v2 préserve plats cuisinés et achats effectivement payés',()=>{
 const legacy=newState(); legacy.version=2;
 const m=legacy.months['0'];
 m.meals=m.meals.map((x,i)=>({...x,name:BASE_MENU[i].name,kind:BASE_MENU[i].kind,ingredients:structuredClone(MEAL_INGREDIENTS[i]),batchRole:null,african:false}));
 m.meals[3].cooked=true;
 const milk=m.groceries.find(x=>x.id==='base-0-17');milk.name='Lait';milk.qty='4 L';milk.price=3.30;milk.bought=true;milk.actual=3.30;
 const loaded=validateImport(JSON.parse(JSON.stringify(legacy)));
 assert.equal(loaded.version,5);
 assert.equal(loaded.months['0'].meals[3].cooked,true);
 assert.equal(loaded.months['0'].meals[4].batchRole,null);
 assert.equal(loaded.months['0'].groceries.find(x=>x.id===milk.id).qty,'4 L');
 assert.ok(loaded.months['0'].manualItems.some(x=>x.name.includes('complément')));
 assert.throws(()=>validateImport({version:3,months:{'0':{meals:[]}}}),/Structure/);
});
test('Les achats réels sont conservés dans les dépenses',()=>{
 const m=makeMonth(0),item=shoppingEntries(m,0,false)[0];
 markBought(m,item,true,6.99);
 assert.equal(finance(m).paid,6.99);
 assert.equal(finance(m).forecast,Math.round((972.39-item.estimate+6.99)*100)/100);
 markBought(m,item,false,null);
 assert.equal(finance(m).paid,0);
});

test('Pâtisserie facultative, ingrédients réservés uniquement aux semaines activées',()=>{
 const m=makeMonth(0);
 assert.equal(isBakingWeek(m,0),false);
 assert.ok(!shoppingEntries(m,0,false).some(x=>x.name.includes('Levure chimique')));
 assert.ok(!shoppingEntries(m,0,false).some(x=>x.name.startsWith('Beurre M&S')));
 assert.equal(shoppingEntries(m,0,false).find(x=>x.name==='Œufs').qty,'2 × 12 (24 œufs)');
 setBakingWeek(m,3,true);
 const w3=shoppingEntries(m,3,false);
 assert.ok(w3.some(x=>x.name.includes('Levure chimique')));
 assert.ok(w3.some(x=>x.name.startsWith('Beurre M&S')));
 assert.equal(w3.find(x=>x.name==='Œufs').qty,'2 × 12 + 1 × 6 (30 œufs)');
 assert.ok(!shoppingEntries(m,0,false).some(x=>x.name.includes('Levure chimique')));
 setBakingWeek(m,3,false);
 assert.equal(finance(m).forecast,972.39);
});

test('Le garde-manger n’est pas compté dans le panier, mais reste rétablissable',()=>{
 const m=makeMonth(0);
 const first=shoppingEntries(m,0,false)[0];
 const initial=finance(m).forecast;
 markInStock(m,first,true);
 assert.equal(shoppingEntries(m,0,false).some(x=>x.id===first.id),false);
 assert.equal(finance(m).forecast,Math.round((initial-first.estimate)*100)/100);
 const original=m.groceries.find(x=>x.id===first.id);
 assert.equal(original.inStock,true);
 markInStock(m,{...first,kind:'base'},false);
 assert.equal(finance(m).forecast,initial);
});
test('Un achat de 24 œufs ne devient pas fictivement 30 lors d’une pâtisserie ajoutée',()=>{
 const m=makeMonth(0);
 const e=shoppingEntries(m,0,false).find(x=>x.name==='Œufs');
 markBought(m,e,true,e.estimate);
 setBakingWeek(m,0,true);
 assert.equal(shoppingEntries(m,0,false).find(x=>x.name==='Œufs').qty,'2 × 12 (24 œufs)');
 assert.equal(suggestedPurchases(m).find(x=>x.id==='baking-eggs-0')?.qty,'6 œufs');
 assert.equal(finance(m).paid,e.estimate);
});
test('Réconciliation v3 : aucune perte de dépense ou de correction personnelle',()=>{
 const raw=newState();raw.version=3;
 const m=raw.months['0'];
 const item=m.groceries.find(x=>x.id==='base-0-0');
 item.qty='3 kg';item.price=3.60;item.bought=true;item.actual=3.85;
 m.manualItems.push({id:'manual-original',name:'Épice achetée',qty:'1',price:2,supplier:'M&S',purchase:'weekly',week:0,bought:true,actual:2,hidden:false});
 const updated=validateImport(JSON.parse(JSON.stringify(raw)));
 assert.equal(updated.version,5);
 const next=updated.months['0'];
 assert.equal(next.groceries.find(x=>x.id==='base-0-0').qty,'3 kg');
 assert.equal(next.groceries.find(x=>x.id==='base-0-0').actual,3.85);
 assert.equal(next.manualItems.find(x=>x.id==='manual-original')?.actual,2);
 assert.ok(next.reconcileWarnings.some(x=>x.name==='Pommes de terre'));
});
test('Achats optimisés : pas de niébé inutile, 12 conserves de maquereau, fonio suffisant',()=>{
 const m=makeMonth(0), monthly=shoppingEntries(m,0,true);
 assert.equal(monthly.some(x=>x.name.includes('Niébé')),false);
 assert.equal(monthly.find(x=>x.name.includes('Maquereau'))?.qty,'12 boîtes');
 assert.equal(monthly.find(x=>x.name==='Fonio')?.qty,'2 × 500 g (1 kg)');
 assert.ok(shoppingEntries(m,0,false).some(x=>x.name==='Quinoa'));
 assert.ok(!shoppingEntries(m,3,false).some(x=>x.name==='Aubergines'));
 assert.ok(shoppingEntries(m,3,false).some(x=>x.name.includes('Moutarde de Dijon')));
 assert.ok(shoppingEntries(m,3,false).some(x=>x.name==='Pâtes complètes'));
 assert.ok(shoppingEntries(m,3,false).some(x=>x.name==='Lentilles sèches'));
});

test('Yassa poisson remplace le thiéboudienne : dix portions, même cabillaud',()=>{
 const m=makeMonth(0),fish=m.meals[24],day2=m.meals[25];
 assert.match(fish.name,/Yassa au poisson/);
 assert.equal(fish.name,day2.name);
 assert.equal(fish.servings,10);
 assert.equal(fish.mealsPerDay,1);
 assert.equal(fish.ingredients.find(x=>x.name==='Cabillaud')?.quantity,1800);
 assert.equal(fish.ingredients.find(x=>x.name==='Riz')?.quantity,1200);
 assert.equal(fish.ingredients.find(x=>x.name==='Oignons')?.quantity,1400);
 assert.equal(fish.ingredients.find(x=>x.name==='Citron')?.quantity,6);
 assert.equal(fish.ingredients.find(x=>x.name==='Moutarde de Dijon')?.quantity,120);
 assert.ok(!fish.ingredients.some(x=>['Carottes','Aubergines','Chou blanc','Tomates concassées'].includes(x.name)));
 assert.equal(day2.ingredients.length,0);
 assert.deepEqual(ingredientChanges(m),[]);
 const w3=shoppingEntries(m,3,false);
 assert.equal(w3.find(x=>x.name==='Oignons')?.qty,'1,5 kg');
 assert.equal(w3.find(x=>x.name==='Citrons')?.qty,'6 pièces');
 assert.equal(w3.find(x=>x.name==='Riz')?.qty,'2 × 1 kg');
 assert.ok(w3.some(x=>x.name.includes('Moutarde de Dijon')));
 assert.ok(!w3.some(x=>x.name==='Chou blanc'||x.name==='Aubergines'));
 assert.equal(finance(m).forecast,972.39);
});
test('Migration v4 : yassa poisson apparaît sans effacer les achats payés',()=>{
 const raw=newState();raw.version=4;
 const m=raw.months['0'];
 const oldIngredients=[
  ['Cabillaud',1800,'g','Dining Solutions'],
  ['Riz',1200,'g','M&S'],
  ['Carottes',1200,'g','M&S'],
  ['Chou blanc',800,'g','M&S'],
  ['Aubergines',800,'g','M&S'],
  ['Tomates concassées',700,'g','M&S'],
  ['Oignons',700,'g','M&S']
 ].map(([name,quantity,unit,supplier])=>({name,quantity,unit,supplier,price:null}));
 m.meals[24].name='Thiéboudienne au poisson et légumes';
 m.meals[24].ingredients=oldIngredients;
 m.meals[25].name='Thiéboudienne au poisson et légumes';
 const lemon=m.groceries.find(x=>x.id==='base-3-11');
 lemon.qty='4 pièces';lemon.price=1.40;lemon.bought=true;lemon.actual=1.50;
 m.groceries.push({id:'rightsize-3-1',name:'Aubergines',qty:'1 kg',price:3,supplier:'M&S',
   purchase:'weekly',week:3,bought:false,actual:null,hidden:false});
 const loaded=validateImport(JSON.parse(JSON.stringify(raw))),n=loaded.months['0'];
 assert.equal(loaded.version,5);
 assert.match(n.meals[24].name,/Yassa au poisson/);
 assert.equal(n.meals[25].name,n.meals[24].name);
 assert.equal(n.meals[24].servings,10);
 assert.ok(n.groceries.some(x=>x.id==='yassa-poisson-moutarde'));
 assert.ok(!n.groceries.some(x=>x.id==='rightsize-3-1'));
 assert.equal(n.groceries.find(x=>x.id==='base-3-11').qty,'4 pièces');
 assert.equal(n.groceries.find(x=>x.id==='base-3-11').actual,1.50);
 assert.ok(n.reconcileWarnings.some(x=>x.name==='Citrons'));
});
test('Migration v4 : une recette poisson personnalisée ou déjà cuisinée reste intacte',()=>{
 const raw=newState();raw.version=4;const m=raw.months['0'];
 m.meals[24].name='Yassa poisson version familiale';
 m.meals[25].name='Yassa poisson version familiale';
 m.meals[24].ingredients.push({name:'Persil',quantity:100,unit:'g',supplier:'M&S',price:null});
 m.groceries.push({id:'custom-fish-item',name:'Persil',qty:'1 botte',price:1.5,supplier:'M&S',
   purchase:'weekly',week:3,bought:false,actual:null,hidden:false});
 const loaded=validateImport(JSON.parse(JSON.stringify(raw))),n=loaded.months['0'];
 assert.equal(loaded.version,5);
 assert.equal(n.meals[24].name,'Yassa poisson version familiale');
 assert.ok(n.meals[24].ingredients.some(x=>x.name==='Persil'));
 assert.ok(n.groceries.some(x=>x.id==='custom-fish-item'));
});
