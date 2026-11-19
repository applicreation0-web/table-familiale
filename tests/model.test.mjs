import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {BASE_MENU,BASE_SHOPPING} from '../data.js';
import {MEAL_INGREDIENTS} from '../recipes.js';
import {FAMILY_PLAN} from '../meal-plan.js';
import {makeMonth,periodDays,finance,ingredientChanges,suggestedPurchases,saveDish,swapDishes,toggleCooked,shoppingEntries,markBought,markInStock,setBakingWeek,isBakingWeek,weeklyEggSummary,validateImport,newState,HARD_CEILING} from '../model.js';

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
 assert.equal(m.meals.filter(x=>x.kind!=='V').length,23);
});
test('Lait Yeo Valley 4L, 24 oeufs sans pâtisserie et yaourt 3kg chaque semaine',()=>{
 const m=makeMonth(0);
 for(let w=0;w<4;w++){
  const rows=shoppingEntries(m,w,false);
  assert.equal(rows.find(x=>x.name.includes('Yeo Valley'))?.qty,'2 × 2 L (4 L)');
  assert.equal(rows.find(x=>x.name==='Œufs')?.qty,'2 × 12 (24 œufs)');
  assert.equal(rows.find(x=>x.name==='Yaourt grec M&S Collection')?.qty,'3 × 1 kg');
 }
 const last=shoppingEntries(m,4,false);
 assert.equal(last.find(x=>x.name.includes('Yeo Valley'))?.qty,'1 × 2 L (2 L)');
 assert.equal(last.find(x=>x.name==='Œufs')?.qty,'1 × 12 (12 œufs)');
 assert.equal(last.find(x=>x.name==='Yaourt grec M&S Collection')?.qty,'2 × 1 kg');
 assert.equal(m.groceries.filter(x=>x.name.includes('Farine blanche')).length,2);
 assert.ok(m.groceries.some(x=>x.name.includes('Levure chimique')));
});
test('La prévision reste sous 900£ après substitutions de même catégorie',()=>{
 const estimated=Math.round(BASE_SHOPPING.reduce((s,x)=>s+x.price,0)*100)/100;
 assert.equal(estimated,895.18);
 const f=finance(makeMonth(0));
 assert.equal(f.forecast,887.98);
 assert.equal(f.forecastHeadroom,12.02);
 assert.equal(f.paid,0);
});
test('Achats mensuels : un carton de cabillaud Dining et 5,5kg agneau, sans double compte',()=>{
 const monthly=shoppingEntries(makeMonth(0),0,true);
 assert.equal(monthly.length,9);
 assert.equal(monthly.find(x=>x.supplier==='Dining Solutions')?.qty,'1 carton de 1,8 kg (pour 10 portions de yassa poisson)');
 assert.equal(monthly.find(x=>x.supplier==='Dining Solutions')?.estimate,64.97);
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
 assert.equal(loaded.version,13);
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
 assert.equal(finance(m).forecast,Math.round((887.98-item.estimate+6.99)*100)/100);
 markBought(m,item,false,null);
 assert.equal(finance(m).paid,0);
});

test('Pâtisserie facultative, ingrédients réservés uniquement aux semaines activées',()=>{
 const m=makeMonth(0);
 assert.equal(isBakingWeek(m,0),false);
 assert.ok(!shoppingEntries(m,0,false).some(x=>x.name.includes('Levure chimique')));
 assert.ok(shoppingEntries(m,0,false).some(x=>x.name.startsWith('Beurre M&S')));
 assert.equal(shoppingEntries(m,0,false).find(x=>x.name==='Œufs').qty,'2 × 12 (24 œufs)');
 setBakingWeek(m,3,true);
 const w3=shoppingEntries(m,3,false);
 assert.ok(w3.some(x=>x.name.includes('Levure chimique')));
 assert.ok(w3.some(x=>x.name.startsWith('Beurre M&S')));
 assert.equal(w3.find(x=>x.name==='Œufs').qty,'2 × 12 (24 œufs)');
 assert.ok(!shoppingEntries(m,0,false).some(x=>x.name.includes('Levure chimique')));
 setBakingWeek(m,3,false);
 assert.equal(finance(m).forecast,887.98);
});

test('Fruits préférés uniquement : raisins, fraises, poires ; deux huiles de qualité',()=>{
 const m=makeMonth(0),fruit=m.groceries.filter(x=>x.week>=0&&x.category==='F');
 assert.equal(m.groceries.filter(x=>/Pommes M&S|Bananes M&S|Clémentines M&S/.test(x.name)).length,0);
 for(let w=0;w<5;w++){
   const items=shoppingEntries(m,w,false);
   const pears=items.filter(x=>x.name.startsWith('Poires Ocado à mûrir'));
   const grapes=items.filter(x=>x.name==='Raisins rouges sans pépins M&S');
   const berries=items.filter(x=>x.name==='Fraises M&S');
   assert.equal(pears.length,2);
   assert.ok(pears.every(x=>x.qty==='1 × 6 poires'&&x.estimate===1.7));
   assert.equal(grapes.length,1);
   assert.equal(grapes[0].estimate,w<4?5.3:2.65);
   assert.equal(grapes[0].qty,w<4?'2 × 500 g (1 kg)':'1 × 500 g');
   assert.equal(berries.length,w<4?1:0);
   if(w<4)assert.equal(berries[0].estimate,4);
 }
 assert.equal(m.groceries.filter(x=>x.name.startsWith('Poires Ocado à mûrir')).length,10);
 assert.equal(m.groceries.filter(x=>x.name==='Fraises M&S').length,4);
 assert.equal(m.groceries.filter(x=>x.name==='Raisins rouges sans pépins M&S').length,5);
 const olive=m.groceries.find(x=>x.name==='Huile d’olive vierge extra M&S');
 const sunflower=m.groceries.find(x=>x.name==='Huile de tournesol M&S');
 assert.equal(olive.price,9);
 assert.equal(olive.qty,'1 L');
 assert.match(olive.sourceUrl,/528611011/);
 assert.equal(sunflower.price,2);
 assert.match(sunflower.qty,/1 L/);
 assert.match(sunflower.sourceUrl,/505990011/);
 assert.equal(shoppingEntries(m,0,true).filter(x=>x.name==='Huile de tournesol M&S').length,1);
 const butter=m.groceries.filter(x=>x.name.startsWith('Beurre M&S'));
 assert.equal(butter.length,5);
 assert.ok(butter.every(x=>x.qty==='250 g'&&x.price===3.75));
 const carrots=m.groceries.filter(x=>x.name==='Carottes');
 assert.equal(carrots.reduce((s,x)=>parseInt(x.qty,10)+s,0),11);
 assert.equal(carrots.reduce((s,x)=>s+x.price,0),17.6);
 const potatoes=m.groceries.filter(x=>x.name==='Pommes de terre');
 assert.deepEqual(potatoes.map(x=>x.qty),['2 × 2 kg (4 kg)','1 × 2 kg (2 kg)','2 × 2 kg (4 kg)','1 × 2 kg (2 kg)','1 × 2 kg (2 kg)']);
 assert.equal(Math.round(potatoes.reduce((s,x)=>s+x.price,0)*100)/100,9.8);
 assert.ok(potatoes.every(x=>x.sourceUrl?.includes('white-potatoes')));
 assert.ok(carrots.every(x=>x.sourceUrl==null));
 assert.equal(finance(m).forecast,887.98);
 assert.equal(finance(m).forecastHeadroom,12.02);
});

test('Pain £3.50, beurre hebdomadaire et 24 œufs maxi avec ou sans pâtisserie',()=>{
 const m=makeMonth(0);
 for(let w=0;w<5;w++){
   for(const baking of [false,true]){
     setBakingWeek(m,w,baking);
     const rows=shoppingEntries(m,w,false);
     assert.equal(rows.filter(x=>x.name.startsWith('Beurre M&S')).length,1);
     assert.equal(rows.find(x=>x.name.startsWith('Beurre M&S')).estimate,3.75);
     assert.equal(rows.find(x=>x.name==='Pain complet M&S')?.estimate,3.5);
     const eggs=rows.find(x=>x.name==='Œufs');
     assert.equal(eggs.qty,w<4?'2 × 12 (24 œufs)':'1 × 12 (12 œufs)');
     assert.ok(!rows.some(x=>/complément/i.test(x.name)&&/œufs/i.test(x.name)));
     const summary=weeklyEggSummary(m,w);
     assert.ok(summary.mealsUsed+summary.breakfastEggs<=24);
     assert.equal(summary.max,24);
   }
   setBakingWeek(m,w,false);
 }
 assert.equal(finance(m).forecast,887.98);
 assert.equal(finance(m).forecastHeadroom,12.02);
});
test('Budget avec pâtisserie sur cinq semaines : aucun réassort d’œufs et plafond respecté',()=>{
 const m=makeMonth(0);
 for(let w=0;w<5;w++)setBakingWeek(m,w,true);
 const f=finance(m);
 assert.equal(f.forecast,893.78);
 assert.equal(f.forecastHeadroom,6.22);
 assert.ok(!suggestedPurchases(m).some(x=>/œufs/i.test(x.name)));
 for(let w=0;w<5;w++){
   const eggs=shoppingEntries(m,w,false).find(x=>x.name==='Œufs');
   assert.ok(eggs);
   assert.ok(!/30 œufs/.test(eggs.qty));
   const summary=weeklyEggSummary(m,w);
   assert.ok(summary.mealsUsed+summary.breakfastEggs<=summary.planned);
 }
});
test('Migration v8 : nouveau panier sans modifier anciens reçus ou repas cuisinés',()=>{
 const old=newState();old.version=8;
 const m=old.months['0'];
 const bread=m.groceries.find(x=>x.id==='rightsize-0-4');
 bread.bought=true;bread.actual=3.75;bread.price=1.6;
 const eggs=m.groceries.find(x=>x.id==='base-0-19');
 eggs.bought=true;eggs.qty='2 × 12 + 1 × 6 (30 œufs)';eggs.actual=11.40;
 m.meals[0].cooked=true;m.meals[0].cookedAt='2026-11-19';
 m.groceries=m.groceries.filter(x=>x.id!=='baking-9');
 const newer=validateImport(structuredClone(old));
 assert.equal(newer.version,13);
 const x=newer.months['0'];
 assert.equal(x.groceries.find(z=>z.id===bread.id).actual,3.75);
 assert.equal(x.groceries.find(z=>z.id===eggs.id).qty,'2 × 12 + 1 × 6 (30 œufs)');
 assert.equal(x.groceries.find(z=>z.id==='rightsize-1-1').price,3.5);
 assert.equal(x.groceries.find(z=>z.id==='base-1-19').qty,'2 × 12 (24 œufs)');
 assert.ok(x.groceries.some(z=>z.id==='baking-9'));
 assert.equal(x.meals[0].cooked,true);
 assert.ok(x.reconcileWarnings.some(z=>/30 œufs/.test(z.name)));
});
test('Migration v9→v10 : reçus fruits/huiles préservés et nouveaux articles non achetés',()=>{
 const raw=newState();raw.version=9;
 const m=raw.months['0'];
 const oldApple=m.groceries.find(x=>x.id==='base-0-13');
 Object.assign(oldApple,{name:'Pommes M&S Braeburn britanniques',qty:'12 pièces',price:3.60,bought:true,actual:3.60});
 const oldBanana=m.groceries.find(x=>x.id==='base-0-16');
 Object.assign(oldBanana,{name:'Bananes M&S',qty:'6 pièces',price:1.80,bought:true,actual:1.80});
 const oldOlive=m.groceries.find(x=>x.id==='base-0-27');
 Object.assign(oldOlive,{name:'Huile d’olive vierge extra Ocado',price:7.75,bought:true,actual:7.75});
 const result=validateImport(structuredClone(raw)),newer=result.months['0'];
 assert.equal(result.version,13);
 assert.equal(newer.groceries.find(x=>x.id===oldApple.id).actual,3.60);
 assert.equal(newer.groceries.find(x=>x.id===oldApple.id).name,'Pommes M&S Braeburn britanniques');
 assert.equal(newer.groceries.find(x=>x.id===oldBanana.id).actual,1.80);
 assert.equal(newer.groceries.find(x=>x.id===oldOlive.id).actual,7.75);
 assert.ok(newer.groceries.some(x=>x.id==='sunflower-oil-ms-1l'&&!x.bought));
 assert.equal(newer.groceries.find(x=>x.id==='base-1-13').name,'Raisins rouges sans pépins M&S');
 assert.ok(newer.reconcileWarnings.some(x=>x.name.includes('Fruits/huiles déjà achetés')));
 assert.equal(finance(newer).paid,13.15);
 assert.equal(newer.meals[0].cooked,false);
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
 assert.ok(!suggestedPurchases(m).some(x=>x.id==='baking-eggs-0'));
 assert.equal(finance(m).paid,e.estimate);
});
test('Réconciliation v3 : aucune perte de dépense ou de correction personnelle',()=>{
 const raw=newState();raw.version=3;
 const m=raw.months['0'];
 const item=m.groceries.find(x=>x.id==='base-0-0');
 item.qty='3 kg';item.price=3.60;item.bought=true;item.actual=3.85;
 m.manualItems.push({id:'manual-original',name:'Épice achetée',qty:'1',price:2,supplier:'M&S',purchase:'weekly',week:0,bought:true,actual:2,hidden:false});
 const updated=validateImport(JSON.parse(JSON.stringify(raw)));
 assert.equal(updated.version,13);
 const next=updated.months['0'];
 assert.equal(next.groceries.find(x=>x.id==='base-0-0').qty,'3 kg');
 assert.equal(next.groceries.find(x=>x.id==='base-0-0').actual,3.85);
 assert.equal(next.manualItems.find(x=>x.id==='manual-original')?.actual,2);
 assert.ok(next.reconcileWarnings.some(x=>x.name==='Pommes de terre'));
});
test('Achats optimisés : pas de niébé ni de maquereau dans les achats actifs, fonio suffisant',()=>{
 const m=makeMonth(0), monthly=shoppingEntries(m,0,true);
 assert.equal(monthly.some(x=>x.name.includes('Niébé')),false);
 assert.ok(!monthly.some(x=>x.name.includes('Maquereau')));
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
 assert.equal(fish.ingredients.find(x=>x.name==='Cabillaud')?.quantity,1575);
 assert.equal(fish.ingredients.find(x=>x.name==='Riz')?.quantity,750);
 assert.equal(fish.ingredients.find(x=>x.name==='Oignons')?.quantity,1125);
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
 assert.equal(finance(m).forecast,887.98);
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
 assert.equal(loaded.version,13);
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
 assert.equal(loaded.version,13);
 assert.equal(n.meals[24].name,'Yassa poisson version familiale');
 assert.ok(n.meals[24].ingredients.some(x=>x.name==='Persil'));
 assert.ok(n.groceries.some(x=>x.id==='custom-fish-item'));
});

test('Le plafond de 900£ est réellement appliqué et la marge reste visible',()=>{
 const m=makeMonth(0),f=finance(m);
 assert.equal(HARD_CEILING,900);
 assert.equal(m.budget,900);
 assert.equal(f.forecast,887.98);
 assert.equal(f.forecastHeadroom,12.02);
 assert.equal(f.unknownCount,0);
});

test('Poissons : 2 jours cabillaud, 4 saumon frais et 1 saumon fumé ; quiche épinards végé',()=>{
 const m=makeMonth(0);
 const cod=m.groceries.find(x=>x.id==='month-4');
 assert.equal(cod.supplier,'Dining Solutions');
 assert.equal(cod.price,64.97);
 assert.match(cod.qty,/1,8 kg/);
 const idx=m.meals.map((dish,i)=>[dish.kind,i]);
 assert.deepEqual(idx.filter(x=>x[0]==='S').map(x=>x[1]),[2,7,12,14]);
 assert.deepEqual(idx.filter(x=>x[0]==='G').map(x=>x[1]),[22]);
 assert.deepEqual(idx.filter(x=>x[0]==='F').map(x=>x[1]),[24,25]);
 assert.deepEqual(idx.filter(x=>x[0]==='K').map(x=>x[1]),[]);
 assert.equal(m.meals[20].kind,'V');
 assert.equal(m.meals[2].ingredients.find(x=>x.name==='Saumon frais')?.quantity,575);
 assert.equal(m.meals[7].ingredients.find(x=>x.name==='Saumon frais')?.quantity,575);
 assert.equal(m.meals[14].ingredients.find(x=>x.name==='Saumon frais')?.quantity,575);
 assert.equal(m.meals[22].ingredients.find(x=>x.name==='Saumon fumé')?.quantity,175);
 assert.equal(m.meals[22].ingredients.find(x=>x.name==='Œufs')?.quantity,5);
 assert.equal(m.meals[22].ingredients.find(x=>x.name==='Boulgour')?.quantity,275);
 assert.equal(m.meals.flatMap(x=>x.ingredients).filter(x=>x.name==='Cabillaud').reduce((t,x)=>t+x.quantity,0),1575);
 assert.deepEqual(ingredientChanges(m),[]);
 assert.deepEqual(suggestedPurchases(m),[]);
});
test('Quatre paquets de saumon frais répartis sans rachat, deux paquets fumés',()=>{
 const m=makeMonth(0);
 const salmon=[0,1,2].map(w=>shoppingEntries(m,w,false).find(x=>x.id==='ms-fresh-salmon-week-'+w));
 assert.deepEqual(salmon.map(x=>x?.estimate),[20.50,10.25,10.25]);
 assert.equal(salmon.reduce((v,x)=>v+x.estimate,0),41);
 const smoked=shoppingEntries(m,3,false).find(x=>x.id==='ms-smoked-salmon-week-3');
 assert.equal(smoked.estimate,10);
 assert.equal(finance(m).forecast,887.98);
 assert.equal(finance(m).forecastHeadroom,12.02);
});
test('Migration v6 des quatre plats au cabillaud vers le saumon sans perdre les reçus',()=>{
 const legacy=newState();legacy.version=6;
 const m=legacy.months['0'];
 m.groceries=m.groceries.filter(x=>!x.id.startsWith('ms-'));
 const cod=m.groceries.find(x=>x.id==='month-4');
 Object.assign(cod,{name:'Dos de cabillaud sauvage Atlantique MSC IQF (JJ Foodservice, livraison à confirmer)',
   qty:'3 cartons × 10 dos (5,67 kg net) · livraison incluse',price:112.97,supplier:'JJ Foodservice'});
 for(const [day,source] of [[2,2],[7,7],[14,17],[22,22]]){
   m.meals[day].name=BASE_MENU[source].name;
   m.meals[day].kind='F';
   m.meals[day].ingredients=structuredClone(MEAL_INGREDIENTS[source]).map(x=>
     x.name==='Cabillaud'?{...x,supplier:'JJ Foodservice'}:x);
 }
 m.meals[24].ingredients.find(x=>x.name==='Cabillaud').supplier='JJ Foodservice';
 const bought=m.groceries.find(x=>x.id==='base-0-17');
 bought.bought=true;bought.actual=12.70;
 const out=validateImport(structuredClone(legacy));
 assert.equal(out.version,13);
 const restored=out.months['0'];
 assert.equal(restored.groceries.find(x=>x.id==='base-0-17').actual,12.70);
 assert.equal(restored.meals[2].name.includes('Saumon frais M&S'),true);
 assert.equal(restored.meals[22].kind,'G');
 assert.equal(restored.meals[24].ingredients.find(x=>x.name==='Cabillaud').supplier,'Dining Solutions');
 assert.equal(restored.groceries.find(x=>x.id==='month-4').price,64.97);
 assert.equal(finance(restored).forecast,Math.round((887.98-6.20+12.70)*100)/100);
 assert.deepEqual(suggestedPurchases(restored),[]);
});
test('Ancien poisson déjà payé : la facture JJ est préservée et la marge ne doit pas être inventée',()=>{
 const raw=newState();raw.version=6;const m=raw.months['0'];
 m.groceries=m.groceries.filter(x=>!x.id.startsWith('ms-'));
 const cod=m.groceries.find(x=>x.id==='month-4');
 Object.assign(cod,{name:'Dos de cabillaud sauvage Atlantique MSC IQF',
   qty:'3 cartons (5,67 kg net)',price:112.97,supplier:'JJ Foodservice',
   bought:true,actual:115.00});
 const loaded=validateImport(structuredClone(raw)).months['0'];
 assert.equal(loaded.groceries.find(x=>x.id==='month-4').actual,115.00);
 assert.equal(loaded.groceries.find(x=>x.id==='month-4').supplier,'JJ Foodservice');
 assert.ok(finance(loaded).forecast>900);
 assert.ok(loaded.reconcileWarnings.some(x=>x.name.includes('Cabillaud JJ')));
});
test('Un cabillaud déjà cuisiné est conservé sans générer de nouvelle suggestion poisson',()=>{
 const raw=newState();raw.version=6;
 const m=raw.months['0'];
 m.meals[2].name=BASE_MENU[2].name;
 m.meals[2].kind='F';
 m.meals[2].ingredients=structuredClone(MEAL_INGREDIENTS[2]);
 m.meals[2].cooked=true;
 const after=validateImport(structuredClone(raw)).months['0'];
 assert.equal(after.meals[2].cooked,true);
 assert.match(after.meals[2].name,/Cabillaud/);
 assert.ok(!suggestedPurchases(after).some(x=>x.name==='Cabillaud'));
});
test('Plafond v5 historique réconcilié sans augmenter un budget plus bas que 900£',()=>{
 const old=newState();old.version=5;
 old.months['0'].budget=850;
 let loaded=validateImport(structuredClone(old)).months['0'];
 assert.equal(loaded.budget,900);
 old.months['0'].budget=800;
 loaded=validateImport(structuredClone(old)).months['0'];
 assert.equal(loaded.budget,800);
 old.months['0'].budget=1200;
 loaded=validateImport(structuredClone(old)).months['0'];
 assert.equal(loaded.budget,900);
});

test('Quiches saumon et épinards : recettes familiales complètes sans maquereau',()=>{
 const m=makeMonth(0),salmon=m.meals[12],spinach=m.meals[20];
 assert.equal(salmon.servings,5);assert.equal(spinach.servings,5);
 assert.equal(salmon.mealsPerDay,1);assert.equal(spinach.mealsPerDay,1);
 assert.match(salmon.name,/quiche au saumon frais/i);
 assert.match(spinach.name,/quiche aux épinards/i);
 assert.equal(salmon.kind,'S');assert.equal(spinach.kind,'V');
 assert.equal(salmon.ingredients.find(x=>x.name==='Saumon frais')?.quantity,450);
 assert.equal(salmon.ingredients.find(x=>x.name==='Œufs')?.quantity,6);
 assert.equal(spinach.ingredients.find(x=>x.name==='Œufs')?.quantity,6);
 assert.equal(spinach.ingredients.find(x=>x.name==='Épinards')?.quantity,650);
 for(const dish of [salmon,spinach])
   assert.equal(dish.ingredients.find(x=>x.name==='Pâte brisée M&S')?.quantity,300);
 assert.ok(!m.meals.some(d=>d.name.toLowerCase().includes('maquereau')));
 assert.ok(!m.groceries.some(d=>d.name.toLowerCase().includes('maquereau')));
 assert.ok(!m.meals.some(d=>d.kind==='K'));
});

test('Deux grands contenants de noix bio : un kilo et aucun réassort hebdomadaire',()=>{
 const m=makeMonth(0),all=m.groceries;
 const nuts=all.find(x=>x.id==='organic-walnuts-large-2x500');
 assert.equal(nuts.supplier,'Healthy Supplies');
 assert.equal(nuts.qty,'1 sachet × 1 kg, à répartir dans 2 pots réutilisables de 500 g');
 assert.equal(nuts.price,15);
 assert.equal(nuts.priceStatus,'provisional');
 assert.ok(all.some(x=>x.id==='organic-walnuts-delivery'&&x.price===5));
 assert.ok(!all.some(x=>x.name==='Noix à moudre'));
 assert.ok(!all.some(x=>x.id==='month-5'));
 assert.equal(finance(m).forecast,887.98);
 assert.equal(finance(m).forecastHeadroom,12.02);
});

test('Conditionnement des quiches : deux pâtes, un paquet de saumon en plus, épinards et œufs suffisants',()=>{
 const m=makeMonth(0);
 const w1=shoppingEntries(m,1,false),w2=shoppingEntries(m,2,false);
 assert.equal(w1.find(x=>x.id==='quiche-salmon-fresh-week1')?.estimate,10.25);
 assert.equal(w1.find(x=>x.id==='quiche-pastry-week1')?.estimate,2);
 assert.equal(w2.find(x=>x.id==='quiche-pastry-week2')?.estimate,2);
 assert.equal(w2.find(x=>x.id==='base-2-6')?.qty,'2 × 900 g (1,8 kg)');
 const eggNeedWeek1=m.meals.slice(7,14).flatMap(x=>x.ingredients)
   .filter(x=>x.name==='Œufs').reduce((v,x)=>v+x.quantity,0);
 const eggNeedWeek2=m.meals.slice(14,21).flatMap(x=>x.ingredients)
   .filter(x=>x.name==='Œufs').reduce((v,x)=>v+x.quantity,0);
 assert.equal(eggNeedWeek1,14);assert.equal(eggNeedWeek2,14);
 assert.equal(w1.find(x=>x.name==='Œufs').qty,'2 × 12 (24 œufs)');
 assert.equal(w2.find(x=>x.name==='Œufs').qty,'2 × 12 (24 œufs)');
 const fresh=m.meals.flatMap(x=>x.ingredients)
   .filter(x=>x.name==='Saumon frais').reduce((v,x)=>v+x.quantity,0);
 assert.equal(fresh,2175);
 assert.equal(5*520,2600);
});

test('Audit 31 jours : 16 viande, 7 poisson, 8 végétariens, cinq préparations africaines',()=>{
 const m=makeMonth(0);
 const meat=new Set(['P','L','T']),fish=new Set(['S','F','G','K']);
 assert.equal(m.meals.filter(x=>meat.has(x.kind)).length,16);
 assert.equal(m.meals.filter(x=>fish.has(x.kind)).length,7);
 assert.equal(m.meals.filter(x=>x.kind==='V').length,8);
 for(const meal of m.meals)assert.equal(meal.mealsPerDay,1);
 for(const meal of m.meals)
   assert.equal(meal.servings,meal.batchRole?10:5);
 assert.equal(m.meals.filter(x=>x.batchRole==='prepare').length,5);
 assert.equal(m.meals.filter(x=>x.batchRole==='reheat').length,5);
 assert.equal(ingredientChanges(m).length,0);
});

test('Migration v7 : maquereau non préparé devient quiche sans valider de repas fantôme',()=>{
 const raw=newState();raw.version=7;const m=raw.months['0'];
 for(const day of [12,20]){
   m.meals[day].name=BASE_MENU[day].name;
   m.meals[day].kind='K';
   m.meals[day].ingredients=structuredClone(MEAL_INGREDIENTS[day]);
   m.meals[day].cooked=false;
 }
 m.groceries=m.groceries.filter(x=>!['organic-walnuts-large-2x500','organic-walnuts-delivery','quiche-salmon-fresh-week1','quiche-pastry-week1','quiche-pastry-week2'].includes(x.id));
 m.groceries.push({id:'month-5',name:'Maquereau M&S nature 125 g',qty:'12 boîtes',
   price:18.60,supplier:'M&S',purchase:'monthly',week:-1,bought:false,actual:null,hidden:false});
 for(const [id,week] of [['base-0-22',0],['base-1-22',1],['base-2-21',2]])
   m.groceries.push({id,name:'Noix à moudre',qty:'200 g',price:3.20,supplier:'M&S',
     purchase:'weekly',week,bought:false,actual:null,hidden:false});
 const loaded=validateImport(structuredClone(raw));
 assert.equal(loaded.version,13);
 const out=loaded.months['0'];
 assert.match(out.meals[12].name,/quiche au saumon/i);
 assert.match(out.meals[20].name,/quiche aux épinards/i);
 assert.equal(out.meals[12].cooked,false);
 assert.equal(out.groceries.some(x=>x.id==='month-5'),false);
 assert.equal(out.groceries.some(x=>x.id==='base-1-22'),false);
 assert.equal(out.groceries.find(x=>x.id==='organic-walnuts-large-2x500').price,15);
 assert.deepEqual(suggestedPurchases(out),[]);
 assert.equal(finance(out).forecast,887.98);
});

test('Migration v7 : repas cuisiné et achat maquereau déjà payé restent inchangés',()=>{
 const raw=newState();raw.version=7;const m=raw.months['0'];
 m.meals[12].name=BASE_MENU[12].name;m.meals[12].kind='K';
 m.meals[12].ingredients=structuredClone(MEAL_INGREDIENTS[12]);m.meals[12].cooked=true;
 m.meals[20].name='Quiche maison personnalisée';
 m.meals[20].ingredients.push({name:'Herbes',quantity:2,unit:'g',supplier:'M&S',price:1});
 const paid={id:'month-5',name:'Maquereau M&S nature',qty:'12 boîtes',price:18.6,
   supplier:'M&S',purchase:'monthly',week:-1,bought:true,actual:18.40};
 m.groceries.push(paid);
 m.manualItems.push({id:'manual-saved',name:'Oignons spéciaux',qty:'500 g',price:2,
   supplier:'M&S',purchase:'weekly',week:2,bought:true,actual:2});
 const loaded=validateImport(structuredClone(raw)).months['0'];
 assert.equal(loaded.meals[12].cooked,true);
 assert.equal(loaded.meals[12].name,BASE_MENU[12].name);
 assert.equal(loaded.meals[20].name,'Quiche maison personnalisée');
 assert.equal(loaded.groceries.find(x=>x.id==='month-5').actual,18.40);
 assert.ok(loaded.reconcileWarnings.some(x=>x.name.includes('Articles poisson/noix déjà payés')));
 assert.ok(loaded.groceries.find(x=>x.id==='quiche-pastry-week1').hidden);
 assert.ok(loaded.groceries.find(x=>x.id==='quiche-pastry-week2').hidden);
 assert.equal(loaded.manualItems.find(x=>x.id==='manual-saved').actual,2);
 assert.ok(finance(loaded).paid>=20.40);
});

test('Stress budget : les frais réels et les ajouts déclenchent un dépassement sans faux rabais',()=>{
 const m=makeMonth(0);
 let f=finance(m);
 assert.equal(f.forecast,887.98);
 m.extraExpenses.push({id:'shipping-extra',amount:45.49,supplier:'Healthy Supplies',label:'Surcoût livraison',date:'2026-11-18'});
 f=finance(m);
 assert.equal(f.forecast,933.47);
 assert.equal(f.forecastHeadroom,-33.47);
 const item=shoppingEntries(m,1,false).find(x=>x.id==='quiche-salmon-fresh-week1');
 markBought(m,item,true,11.25);
 assert.equal(finance(m).paid,56.74);
 assert.equal(finance(m).forecast,934.47);
});

test('Nouveaux mois 28, 30 et 31 jours : intégrité du calendrier, recettes et quantités',()=>{
 for(const i of [0,1,2,3,4,5,6,7,8,9,10,11,12]){
   const m=makeMonth(i),dates=periodDays(i);
   assert.equal(m.meals.length,dates.length);
   assert.ok(m.meals.length>=28&&m.meals.length<=31);
   assert.ok(m.meals.every(x=>x.id&&x.ingredients&&Number(x.servings)>0));
   assert.ok(finance(m).forecast>=0);
   assert.equal(finance(m).unknownCount,0);
 }
});

test('Cycle de 30 jours : la dernière préparation est ramenée à 5 portions sans réchauffage fantôme',()=>{
 const months=[...Array(24).keys()].map(i=>makeMonth(i));
 const m=months.find(x=>x.meals.length===30);
 assert.ok(m,'Une période de 30 jours doit exister');
 const last=m.meals.at(-1);
 assert.match(last.name,/Thiou au poulet/);
 assert.equal(last.batchRole,null);
 assert.equal(last.servings,5);
 assert.equal(last.mealsPerDay,1);
 assert.equal(last.ingredients.find(x=>x.name==='Poulet Hubbard')?.quantity,1100);
 assert.equal(m.meals.filter(x=>x.batchRole==='prepare').length,4);
 assert.equal(m.meals.filter(x=>x.batchRole==='reheat').length,4);
 assert.deepEqual(ingredientChanges(m),[]);
 assert.deepEqual(suggestedPurchases(m),[]);
 assert.equal(finance(m).unknownCount,0);
});
test('Audit du catalogue UI : quiches disponibles, anciennes recettes au maquereau absentes des choix courants',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(source,/quiche-salmon/);
 assert.match(source,/quiche-spinach/);
 assert.match(source,/!\[12,20\]\.includes\(i\)/);
 assert.ok(!source.includes('cabillaud MSC JJ et maquereau'));
});
