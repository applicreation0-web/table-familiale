import { BASE_MENU, BASE_SHOPPING, BASE_BUDGET } from './data.js';
import { MEAL_INGREDIENTS, BREAKFASTS } from './recipes.js';
import { FAMILY_PLAN,LEGACY_FAMILY_PLAN } from './meal-plan.js';
import {calibrateCarrotsFromMeals,quantityAudit,FAMILY_PROFILE} from './family-portions.js';
export { BREAKFASTS, FAMILY_PROFILE, quantityAudit };
export const HARD_CEILING = 900;
export const EGG_WEEKLY_MAX = 24;
export const SUPPLIERS = ['M&S', 'Ocado', 'Supermarché (Yeo Valley)', 'Saffron Alley', 'Dining Solutions', 'JJ Foodservice', 'Healthy Supplies', 'Épicerie africaine', 'Autre'];
export const KIND_NAMES = {P:'Poulet Hubbard',T:'Cuisses halal',F:'Cabillaud',S:'Saumon frais',G:'Saumon fumé',K:'Maquereau',L:'Agneau',V:'Végétarien'};
export const START_DATE = new Date(2026,10,20,12);
const eurosafe = n => Math.round(n * 100) / 100;
export const money = n => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n);
export const dateISO = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
export const clone = item => JSON.parse(JSON.stringify(item));
export function period(index=0){
  if(index===0) return {start:new Date(2026,10,20,12),end:new Date(2026,11,20,12)};
  const end=new Date(2026,11+index,20,12);
  const start=new Date(2026,10+index,21,12);
  return {start,end};
}
export function periodDays(index=0){
  const {start,end}=period(index);
  const days=[];
  for(let t=new Date(start);t<=end;t.setDate(t.getDate()+1))days.push(new Date(t));
  return days;
}
export function makeMonth(index=0){
  const dates=periodDays(index);
  const meals=dates.map((d,i)=>{
    let plan=FAMILY_PLAN[i%FAMILY_PLAN.length];
    // Sur un cycle de 30 jours, ne jamais commencer une cuisson de 10
    // portions pour 2 jours quand il ne reste qu'un seul jour.
    if(plan.batchRole==='prepare'&&i===dates.length-1)
      plan={...plan,batchRole:null,servings:5,mealsPerDay:1,
        ingredients:plan.ingredients.map(x=>({...x,quantity:x.quantity/2}))};
    return {id:dateISO(d),name:plan.name,kind:plan.kind,african:plan.african,
      batchRole:plan.batchRole,servings:plan.servings,mealsPerDay:plan.mealsPerDay,ingredients:clone(plan.ingredients),originalIndex:i%31,
      cooked:false,cookedAt:null};
  });
  const groceries=BASE_SHOPPING.filter(x=>x.week<Math.ceil(dates.length/7)).map(x=>({...clone(x),bought:false,actual:null,
    hidden:x.name.startsWith('Poires Ocado')&&x.name.includes('sachet 2/2'),
    overrideQty:null,overridePrice:null}));
  const month={index,budget:BASE_BUDGET,meals,groceries,manualItems:[],autoPurchases:{},bakingWeeks:{},extraExpenses:[],receiptImports:[],receiptWeeks:{},notes:'',createdAt:new Date().toISOString()};
  calibrateCarrotsFromMeals(month); // Recommandation en sacs bio de 1kg au prix réellement observé.
  return month;
}
export function newState(){return {version:13, selectedPeriod:0, months:{'0':makeMonth(0)},priceBook:{}};}
export function normalize(s=''){
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[^a-z0-9]+/g,' ').trim();
}
function signature(i){
  // Une migration de fournisseur n'est pas une nouvelle consommation de cabillaud.
  const supplier=normalize(i.name)==='cabillaud'&&['Dining Solutions','JJ Foodservice'].includes(i.supplier)?'cod-approved-merchant':i.supplier;
  return normalize(i.name)+'|'+i.unit+'|'+supplier;
}
function aggregate(list){
  const map=new Map();
  for(const obj of list){
    const qty=Number(obj.quantity);
    if(!Number.isFinite(qty)||qty<=0||!obj.name?.trim())continue;
    const k=signature(obj),existing=map.get(k);
    if(existing){existing.quantity+=qty; if(obj.price!=null)existing.price=(existing.price??0)+Number(obj.price);}
    else map.set(k,{...obj,quantity:qty});
  }
  return map;
}
export function ingredientChanges(month){
  // Différentiel entre les recettes initiales du jour et les recettes actuelles.
  // Ne remplace jamais silencieusement une quantité d'achat en conditionnement.
  const weekCount=Math.ceil(month.meals.length/7), out=[];
  const reference=makeMonth(month.index??0).meals;
  for(let w=0;w<weekCount;w++){
    const original=month.meals.slice(w*7,w*7+7).flatMap((meal,offset)=>
      meal.cooked?meal.ingredients:reference[w*7+offset].ingredients);
    const current=month.meals.slice(w*7,w*7+7).flatMap(x=>x.ingredients||[]);
    const src=aggregate(original),dst=aggregate(current);
    for(const k of new Set([...src.keys(),...dst.keys()])){
      const a=src.get(k), b=dst.get(k), delta=(b?.quantity||0)-(a?.quantity||0);
      if(Math.abs(delta)<.00001)continue;
      const obj=b||a,extraPrice=b?.price==null?null:Number(b.price);
      const autoId=`suggestion-${w}-${encodeURIComponent(k)}`;
      out.push({id:autoId,week:w,monthOnly:obj.supplier==='Saffron Alley'||obj.supplier==='Dining Solutions'||obj.supplier==='Épicerie africaine',
        supplier:obj.supplier,name:obj.name,unit:obj.unit,quantity:eurosafe(Math.abs(delta)), delta:eurosafe(delta),
        price:delta>0?extraPrice:null});
    }
  }
  return out;
}
// La présence d'un ingrédient sur le ticket payé évite un NOUVEL achat
// automatique pour le même produit. Ce n'est pas une preuve de quantité suffisante.
function receiptConfirmsIngredient(month,week,name){
 const counts=month.receiptWeeks?.[week]?.complete?month.receiptWeeks[week].categories:{};
 const n=normalize(name);
 const group=/^couscous\b|^semoule\b/.test(n)?'couscous':
   /^pates\b|^penne\b|^fusilli\b/.test(n)?'pasta':
   /^courgette/.test(n)?'courgette':
   /^tomate/.test(n)?'tomato':
   /^ail\b/.test(n)?'garlic':
   /^brocoli/.test(n)?'broccoli':
   /^pomme de terre/.test(n)?'potato':
   null;
 return !!group&&Number(counts?.[group]||0)>0;
}
export function suggestedPurchases(month){
  const recipeAdditions=ingredientChanges(month).filter(x=>x.delta>0 &&
    normalize(x.name)!=='oeufs' && !month.autoPurchases?.[x.id]?.skip &&
    !receiptConfirmsIngredient(month,x.week,x.name)).map(x=>({
    ...x,kind:'auto',qty:`${x.quantity} ${x.unit}`,estimate:month.autoPurchases?.[x.id]?.plannedPrice??x.price,
    bought:!!month.autoPurchases?.[x.id]?.bought,
    actual:month.autoPurchases?.[x.id]?.actual??null,
  }));
  // Les pâtisseries utilisent le même stock de 24 œufs : aucun complément automatique.
  return recipeAdditions;
}
// Les produits de pâtisserie ne sont prévus que si la semaine concernée est activée.
// Les articles déjà achetés ne sont jamais effacés lorsque l'option est désactivée.
export function isBakingWeek(month,week){return !!month.bakingWeeks?.[week];}
function plannedGrocery(month,item){
  // Un achat historique payé reste dans les comptes même si le produit est masqué.
  if(item.hidden&&!item.bought)return null;
  let targetWeek=item.week;
  if(item.optional&&!item.bought&&!item.name.startsWith('Beurre M&S')){
    const staple=item.week===0&&/Sucre pour gâteaux|Levure chimique|Extrait de vanille/.test(item.name);
    const active=Object.keys(month.bakingWeeks||{}).filter(w=>month.bakingWeeks[w]).map(Number).sort((a,b)=>a-b);
    if(staple){
      if(!active.length)return null;
      targetWeek=active[0]; // Les ingrédients de base apparaissent dans la semaine de cuisine.
    }else if(!isBakingWeek(month,item.week))return null;
  }
  const planned={...item,week:targetWeek,kind:'base',qty:item.bought&&item.receiptQtyText?item.receiptQtyText:(item.overrideQty??item.qty),estimate:item.overridePrice??item.learnedPrice??item.price};
  if(item.name==='Œufs'&&item.week<4&&!item.bought&&!item.overrideQty){
    planned.qty='2 × 12 (24 œufs)';
    if(item.overridePrice==null)planned.estimate=item.learnedPrice??10.80;
    planned.dynamicEggs=true;
  }
  return planned;
}
export function shoppingEntries(month,week,monthly=false){
  const base=month.groceries.map(x=>plannedGrocery(month,x))
    .filter(x=>x&&(monthly?x.purchase==='monthly':x.purchase==='weekly'&&x.week===week));
  const manual=(month.manualItems||[]).filter(x=>!x.hidden&&(monthly?x.purchase==='monthly':x.purchase==='weekly'&&x.week===week))
    .map(x=>({...x,kind:'manual',estimate:x.price}));
  const auto=suggestedPurchases(month).filter(x=>monthly?x.monthOnly:!x.monthOnly&&x.week===week);
  return [...base,...manual,...auto];
}
export function allShoppingEntries(month){
  return [...month.groceries.map(x=>plannedGrocery(month,x)).filter(Boolean),
    ...(month.manualItems||[]).filter(x=>!x.hidden).map(x=>({...x,kind:'manual',estimate:x.price})),...suggestedPurchases(month)];
}
// Les œufs réservés aux plats principaux sont soustraits de la boîte hebdomadaire.
// Les petits-déjeuners et la pâtisserie partagent la quantité restante.
export function weeklyEggSummary(month,week){
  const mealsUsed=month.meals.slice(week*7,week*7+7).flatMap(x=>x.ingredients||[])
    .filter(x=>normalize(x.name)==='oeufs').reduce((sum,x)=>sum+Number(x.quantity||0),0);
  const available=week<4?24:12;
  const breakfastEggs=month.meals.slice(week*7,week*7+7).some((_,i)=>(week*7+i)%7===2)?5:0;
  const inRecipes=mealsUsed+breakfastEggs;
  return {max:EGG_WEEKLY_MAX,planned:available,mealsUsed,breakfastEggs,
    remainder:Math.max(0,available-inRecipes),overCap:inRecipes>available};
}
export function setBakingWeek(month,week,enabled){
  if(!Number.isInteger(week)||week<0||week>=Math.ceil(month.meals.length/7))throw new Error('Semaine invalide');
  month.bakingWeeks??={};
  month.bakingWeeks[week]=!!enabled;
  return month;
}
export function markInStock(month,item,stock=true){
  if(item.kind==='auto'){
    if(item.bought)throw new Error('Achat déjà enregistré');
    month.autoPurchases[item.id]={...month.autoPurchases[item.id],skip:!!stock};
    return month;
  }
  const list=item.kind==='manual'?month.manualItems:month.groceries;
  const found=list.find(x=>x.id===item.id);
  if(!found)throw new Error('Produit introuvable');
  if(found.bought)throw new Error('Achat déjà enregistré');
  found.hidden=!!stock;
  found.inStock=!!stock;
  return month;
}
export function finance(month){
  const items=allShoppingEntries(month);
  const purchasedAutoKeys=new Set(suggestedPurchases(month).map(x=>x.id));
  const staleAuto=Object.entries(month.autoPurchases||{}).filter(([id,x])=>x.bought&&!purchasedAutoKeys.has(id));
  const paidItems=items.filter(x=>x.bought).reduce((a,x)=>a+Number(x.actual??x.estimate??0),0);
  const paidStale=staleAuto.reduce((a,[,x])=>a+Number(x.actual??0),0);
  const paidExtras=(month.extraExpenses||[]).reduce((a,x)=>a+Number(x.amount),0);
  const paid=eurosafe(paidItems+paidStale+paidExtras);
  const unpaid=eurosafe(items.filter(x=>!x.bought).reduce((a,x)=>a+Number(x.estimate??0),0));
  const forecast=eurosafe(paid+unpaid);
  const uncertain=items.filter(x=>x.estimate==null&&!x.bought);
  return {paid,unpaid,forecast,available:eurosafe(month.budget-paid),forecastHeadroom:eurosafe(month.budget-forecast),
     unknownCount:uncertain.length,initialEstimate:BASE_SHOPPING.reduce((s,x)=>s+x.price,0),
     cooked:month.meals.filter(x=>x.cooked).length,planned:month.meals.length,
     bought:items.filter(x=>x.bought).length,total:items.length};
}
export function saveDish(month,index,recipe){
  if(!Number.isInteger(index)||index<0||index>=month.meals.length)throw new Error('Jour invalide');
  const current=month.meals[index];
  if(current.cooked)throw new Error('Décochez le repas cuisiné avant de le modifier.');
  if(current.batchRole==='reheat')throw new Error('Modifiez le premier jour de cette préparation de deux jours.');
  if(!String(recipe.name||'').trim())throw new Error('Le nom du plat est obligatoire.');
  if(!Array.isArray(recipe.ingredients)||!recipe.ingredients.length)throw new Error('Ajoutez au moins un ingrédient.');
  const ingredients=recipe.ingredients.filter(i=>i.name.trim()&&Number(i.quantity)>0).map(i=>({
    name:String(i.name).trim(),quantity:Number(i.quantity),unit:i.unit||'g',supplier:i.supplier||'M&S',
    price:i.price==null||i.price===''?null:Number(i.price)
  }));
  if(!ingredients.length)throw new Error('Au moins un ingrédient avec une quantité positive est nécessaire.');
  const african=recipe.african==null?!!current.african:!!recipe.african;
  month.meals[index]={...current,name:recipe.name.trim(),kind:recipe.kind,ingredients,african};
  if(current.batchRole==='prepare'){
    const next=month.meals[index+1];
    if(!next||next.batchRole!=='reheat'||next.cooked)throw new Error('La journée de réchauffage doit être disponible.');
    month.meals[index+1]={...next,name:recipe.name.trim(),kind:recipe.kind,ingredients:[],african};
  }
  return month;
}
const isBatchStart=(meals,i)=>meals[i]?.batchRole==='prepare'&&meals[i+1]?.batchRole==='reheat';
function mealBlock(month,index){
  if(!month.meals[index])throw new Error('Date invalide');
  const start=month.meals[index].batchRole==='reheat'?index-1:index;
  if(start<0)throw new Error('Préparation de deux jours incohérente');
  return {start,len:isBatchStart(month.meals,start)?2:1};
}
export function swapDishes(month,a,b){
  if(a===b)return month;
  const A=mealBlock(month,a),B=mealBlock(month,b);
  if(A.start===B.start)return month;
  if(A.start<A.start+A.len&&B.start<A.start+A.len&&B.start>=A.start||
     A.start<B.start+B.len&&A.start>=B.start)throw new Error('Les journées se chevauchent.');
  // Une préparation de deux jours peut échanger avec deux jours simples consécutifs.
  if(A.len!==B.len)throw new Error('Échangez deux préparations de même durée (1 jour ou 2 jours).');
  const touched=[...new Set([...Array(A.len)].map((_,j)=>A.start+j).concat([...Array(B.len)].map((_,j)=>B.start+j)))];
  if(touched.some(i=>month.meals[i]?.cooked))throw new Error('Un repas déjà cuisiné ne peut pas être déplacé.');
  const old=touched.map(i=>[i,clone(month.meals[i])]);
  const pick=(x)=>x.map(i=>clone(month.meals[i]));
  const aItems=pick([...Array(A.len)].map((_,j)=>A.start+j));
  const bItems=pick([...Array(B.len)].map((_,j)=>B.start+j));
  const copyFields=(src,dest)=>{for(const k of ['name','kind','ingredients','originalIndex','african','batchRole','servings','mealsPerDay'])dest[k]=clone(src[k]??null);};
  aItems.forEach((x,j)=>copyFields(x,month.meals[B.start+j]));
  bItems.forEach((x,j)=>copyFields(x,month.meals[A.start+j]));
  const tooMany=[...Array(Math.ceil(month.meals.length/7)).keys()].some(w=>month.meals.slice(w*7,w*7+7).filter(x=>x.african&&x.batchRole==='prepare').length>1);
  const splitBatch=month.meals.some((x,i)=>x.batchRole==='prepare'&&(month.meals[i+1]?.batchRole!=='reheat'||Math.floor(i/7)!==Math.floor((i+1)/7)));
  if(tooMany||splitBatch){
    for(const [i,x] of old)month.meals[i]=x;
    throw new Error('Un seul plat africain par semaine, sur deux jours consécutifs.');
  }
  return month;
}
export function toggleCooked(month,index){
  const meal=month.meals[index];
  if(!meal)throw new Error('Jour invalide');
  if(meal.batchRole==='reheat'&&!month.meals[index-1]?.cooked&&!meal.cooked)
    throw new Error('Préparez d’abord le plat du premier jour.');
  if(meal.batchRole==='prepare'&&meal.cooked&&month.meals[index+1]?.cooked)
    throw new Error('Décochez d’abord le jour de réchauffage.');
  meal.cooked=!meal.cooked;
  meal.cookedAt=meal.cooked?new Date().toISOString():null;
  return meal.cooked;
}
export function markBought(month,item,checked,actual){
  const cents=actual==null?null:Math.round(Number(actual)*100)/100;
  if(checked&&(!Number.isFinite(cents)||cents<0))throw Error('Prix réel requis (0 possible).');
  if(item.kind==='auto')month.autoPurchases[item.id]={...month.autoPurchases[item.id],bought:checked,actual:checked?cents:null,at:new Date().toISOString()};
  else {
    const list=item.kind==='manual'?month.manualItems:month.groceries;
    const found=list.find(x=>x.id===item.id);
    if(!found)throw Error('Produit introuvable');
    if(checked&&item.dynamicEggs){found.bakingLocked=true;found.overrideQty=item.qty;found.overridePrice=item.estimate;}
    if(!checked&&found.bakingLocked){found.overrideQty=null;found.overridePrice=null;found.bakingLocked=false;}
    found.bought=checked;found.actual=checked?cents:null;
  }
  return month;
}
function migrateLegacyMonth(month){
  const fresh=makeMonth(month.index??0);
  // Les jours déjà cuisinés ou personnalisés sont conservés, jamais réinitialisés.
  const preserve=month.meals.map((m,i)=>m.cooked||m.name!==BASE_MENU[i%31].name||
    m.kind!==BASE_MENU[i%31].kind||JSON.stringify(m.ingredients)!==JSON.stringify(MEAL_INGREDIENTS[i%31]));
  for(let i=0;i<fresh.meals.length;i++){
    if(fresh.meals[i].batchRole==='prepare'&&preserve[i+1])preserve[i]=true;
    if(fresh.meals[i].batchRole==='reheat'&&preserve[i-1])preserve[i]=true;
  }
  month.meals=fresh.meals.map((m,i)=>preserve[i]?{...month.meals[i],african:false,batchRole:null}:m);
  const oldById=new Map(month.groceries.map(x=>[x.id,x]));
  const extras=[];
  for(const item of fresh.groceries){
    const previous=oldById.get(item.id);
    if(!previous)continue;
    if(previous.bought){
      // Ne jamais prétendre que la nouvelle quantité a déjà été achetée.
      const oldLait=previous.name==='Lait';
      const oldEggs=previous.name==='Œufs'&&previous.week<4;
      const oldFish=previous.id==='month-4'&&previous.qty==='2 cartons (3,6 kg)';
      const oldLamb=previous.id==='month-2'&&previous.qty==='2 kg';
      if(oldLait||oldEggs||oldFish||oldLamb){
        const week=previous.week;
        const qty=oldLait?(week<4?'2 × 2 L':'1 × 2 L'):oldEggs?'6 œufs':oldFish?'1 carton (1,8 kg)':'3,5 kg';
        const price=oldLait?(week<4?6.30:3.15):oldEggs?2.60:oldFish?64.97:75.08;
        extras.push({id:'topup-v3-'+previous.id,name:item.name+' — complément',qty,price,
          supplier:item.supplier,purchase:previous.purchase,week,
          bought:false,actual:null,hidden:false});
      }
    }
    oldById.delete(item.id);
  }
  const frozen=month.groceries.filter(x=>x.bought);
  const freshNotBought=fresh.groceries.filter(x=>!oldById.has(x.id)&&!frozen.some(a=>a.id===x.id))
    .map(x=>{const previous=month.groceries.find(p=>p.id===x.id);return previous?{...x,hidden:previous.hidden,
        overrideQty:previous.overrideQty,overridePrice:previous.overridePrice}:x;});
  month.groceries=[...frozen,...freshNotBought,...[...oldById.values()].filter(x=>x.bought)];
  month.manualItems=[...(month.manualItems||[]),...extras];
  return month;
}
// La mise à jour des listes ne doit jamais convertir un achat ancien en quantité
// nouvelle supposément achetée. Les montants payés restent immuables.
function migrateOptimisedBasket(month,index){
  const fresh=makeMonth(index);
  const old=new Map(month.groceries.map(x=>[x.id,x]));
  const next=[];
  const conflicts=[];
  for(const item of fresh.groceries){
    const previous=old.get(item.id);
    if(previous){
      old.delete(item.id);
      const custom=previous.hidden||previous.inStock||previous.overrideQty!=null||previous.overridePrice!=null;
      if(previous.bought||custom){
        next.push(previous);
        if(previous.bought&&previous.qty!==item.qty)
          conflicts.push({name:previous.name,oldQty:previous.qty,newQty:item.qty});
        continue;
      }
    }
    next.push(item);
  }
  // Retenir tous les achats payés et toute modification personnelle même si le
  // produit n'est plus dans le panier théorique.
  for(const item of old.values()){
    // Les identifiants inconnus sont des créations personnelles : ne jamais
    // les effacer sous prétexte qu'ils ne figurent plus au panier de référence.
    const builtIn=/^(?:base-[0-9]+-[0-9]+|month-[0-9]+|rightsize-[0-9]+-[0-9]+|baking-[0-9]+)$/.test(item.id)||
      item.id==='yassa-poisson-moutarde'||item.id.startsWith('ms-fresh-salmon-week-')||
      item.id==='ms-smoked-salmon-week-3';
    if(item.bought||item.overrideQty!=null||item.overridePrice!=null||
       item.inStock||item.hidden||!builtIn)next.push(item);
  }
  month.groceries=next;
  month.bakingWeeks??={};
  month.reconcileWarnings=[...(month.reconcileWarnings||[]),...conflicts];
  return month;
}
// Mise à jour v4 → v5 : ne pas écraser une recette modifiée ou déjà cuisinée.
// Les deux journées restent solidaires et les dépenses effectivement payées demeurent intactes.
const legacyFishYassaDay={
 name:'Thiéboudienne au poisson et légumes',kind:'F',african:true,batchRole:'prepare',
 ingredients:[
  {name:'Cabillaud',quantity:1800,unit:'g',supplier:'Dining Solutions',price:null},
  {name:'Riz',quantity:1200,unit:'g',supplier:'M&S',price:null},
  {name:'Carottes',quantity:1200,unit:'g',supplier:'M&S',price:null},
  {name:'Chou blanc',quantity:800,unit:'g',supplier:'M&S',price:null},
  {name:'Aubergines',quantity:800,unit:'g',supplier:'M&S',price:null},
  {name:'Tomates concassées',quantity:700,unit:'g',supplier:'M&S',price:null},
  {name:'Oignons',quantity:700,unit:'g',supplier:'M&S',price:null}
 ]
};
function migrateFishYassa(month,index){
 const first=month.meals?.[24],second=month.meals?.[25];
 const untouched=first&&!first.cooked&&first.name===legacyFishYassaDay.name&&first.kind==='F'&&
   first.batchRole==='prepare'&&JSON.stringify(first.ingredients)===JSON.stringify(legacyFishYassaDay.ingredients)&&
   second&&!second.cooked&&second.name===first.name&&second.batchRole==='reheat'&&
   Array.isArray(second.ingredients)&&second.ingredients.length===0;
 if(untouched){
   const fresh=makeMonth(index);
   // Garder les identifiants de jours et toutes les validations existantes.
   for(const i of [24,25])
     month.meals[i]={...month.meals[i],...clone(fresh.meals[i]),id:month.meals[i].id};
   migrateOptimisedBasket(month,index);
 }else{
   // Une préparation passée/personnalisée ne doit ni changer de recette
   // ni voir sa liste de courses reconstituée sans contrôle.
   month.reconcileWarnings??=[];
   if(first?.name===legacyFishYassaDay.name)
     month.reconcileWarnings.push({name:'Plat africain du quatrième bloc : recette déjà cuisinée ou personnalisée'});
 }
 for(const m of month.meals||[]){
   if(m.african&&m.batchRole){m.servings??=10;m.mealsPerDay??=1;}
 }
 return month;
}
// Mise à jour v5 -> v6 : plafond réel 900£, cabillaud sauvage MSC de
// qualité comparable. Les reçus et recettes personnalisées restent inchangés.
function migrateStrictBudget(month,index){
 const fresh=makeMonth(index);
 for(let i=0;i<month.meals.length;i++){
   const m=month.meals[i],reference=fresh.meals[i];
   if(!m||!reference||m.cooked||m.name!==reference.name||m.kind!==reference.kind||
      !Array.isArray(m.ingredients)||m.ingredients.length!==reference.ingredients.length)continue;
   const onlyMerchantDifference=m.ingredients.every((old,j)=>{
     const now=reference.ingredients[j];
     return old.name===now.name&&old.quantity===now.quantity&&old.unit===now.unit&&
       (old.supplier===now.supplier||
        old.name==='Cabillaud'&&old.supplier==='Dining Solutions'&&now.supplier==='JJ Foodservice');
   });
   if(onlyMerchantDifference)
     m.ingredients=m.ingredients.map(ing=>ing.name==='Cabillaud'&&ing.supplier==='Dining Solutions'?
       {...ing,supplier:'JJ Foodservice'}:ing);
 }
 // Recalcul des seuls achats non payés et non personnalisés.
 migrateOptimisedBasket(month,index);
 const previous=Number(month.budget);
 month.budget=previous===850?HARD_CEILING:
   Number.isFinite(previous)&&previous>0?Math.min(previous,HARD_CEILING):HARD_CEILING;
 return month;
}

// Mise à jour v6 -> v7 : le yassa conserve un seul carton de cabillaud Dining,
// les trois repas isolés passent au saumon frais M&S et un au saumon fumé.
// Préserver absolument les repas cochés, les recettes personnelles et les reçus.
function migrateSalmonPlan(month,index){
 const fresh=makeMonth(index);
 for(const [day,source] of [[2,2],[7,7],[14,17],[22,22]]){
   const previous=month.meals[day],reference=fresh.meals[day];
   if(!previous||!reference||previous.cooked||previous.name!==BASE_MENU[source].name||
      previous.kind!=='F')continue;
   const legacy=MEAL_INGREDIENTS[source].map(item=>item.name==='Cabillaud'?
     {...item,supplier:'JJ Foodservice'}:item);
   const sameLegacy=JSON.stringify(previous.ingredients)===JSON.stringify(legacy)||
      JSON.stringify(previous.ingredients)===JSON.stringify(MEAL_INGREDIENTS[source]);
   if(sameLegacy)
     month.meals[day]={...previous,...clone(reference),id:previous.id};
 }
 const a=month.meals[24],b=month.meals[25],updated=fresh.meals[24];
 if(a&&b&&!a.cooked&&!b.cooked&&a.name===updated.name&&a.kind==='F'&&
    b.batchRole==='reheat'&&b.name===a.name){
   const classic=FAMILY_PLAN[24].ingredients.map(i=>i.name==='Cabillaud'?
     {...i,supplier:'JJ Foodservice'}:i);
   if(JSON.stringify(a.ingredients)===JSON.stringify(classic)||
      JSON.stringify(a.ingredients)===JSON.stringify(updated.ingredients)){
     month.meals[24]={...a,...clone(updated),id:a.id};
     month.meals[25]={...b,...clone(fresh.meals[25]),id:b.id};
   }
 }
 const paidOldCod=month.groceries.some(x=>x.id==='month-4'&&x.bought&&
   x.supplier==='JJ Foodservice');
 migrateOptimisedBasket(month,index);
 if(paidOldCod){
   month.reconcileWarnings??=[];
   month.reconcileWarnings.push({name:'Cabillaud JJ déjà acheté : utiliser le stock et replanifier les achats de saumon M&S, ne pas racheter automatiquement'});
 }
 month.budget=Math.min(Number(month.budget)||HARD_CEILING,HARD_CEILING);
 return month;
}

// v7 -> v8 : deux recettes de maquereau remplacées ; les deux grandes réserves
// de noix bio remplacent le réassort hebdomadaire de noix non bio.
// Aucune validation culinaire, modification personnelle ni facture ne peut être effacée.
function migrateQuichesWalnuts(month,index){
  const fresh=makeMonth(index);
  const replaced=[];
  for(const day of [12,20]){
    const previous=month.meals[day],reference=fresh.meals[day];
    const legacy=MEAL_INGREDIENTS[day];
    const alreadyUpdated=previous&&reference&&previous.name===reference.name&&
      previous.kind===reference.kind&&
      JSON.stringify(previous.ingredients)===JSON.stringify(reference.ingredients);
    const unchanged=previous&&reference&&!previous.cooked&&
      previous.name===BASE_MENU[day].name&&previous.kind==='K'&&
      JSON.stringify(previous.ingredients)===JSON.stringify(legacy);
    if(alreadyUpdated||unchanged){
      if(unchanged)month.meals[day]={...previous,...clone(reference),id:previous.id};
      replaced.push(day);
    }else if(previous){
      month.reconcileWarnings??=[];
      month.reconcileWarnings.push({name:'Jour '+(day+1)+' : recette maquereau déjà faite ou personnalisée ; quiche non substituée'});
    }
  }
  const oldPaid=month.groceries.filter(item=>item.bought&&
    (item.id==='month-5'||['base-0-22','base-1-22','base-2-21'].includes(item.id)));
  migrateOptimisedBasket(month,index);
  // Ne pas réclamer de quiche de remplacement si la recette historique doit rester.
  if(!replaced.includes(12))
    for(const id of ['quiche-salmon-fresh-week1','quiche-pastry-week1']){
      const x=month.groceries.find(item=>item.id===id);
      if(x&&!x.bought){x.hidden=true;x.inStock=false;}
    }
  if(!replaced.includes(20)){
    const pastry=month.groceries.find(item=>item.id==='quiche-pastry-week2');
    if(pastry&&!pastry.bought){pastry.hidden=true;pastry.inStock=false;}
    const spinach=month.groceries.find(item=>item.id==='base-2-6');
    if(spinach&&!spinach.bought&&!spinach.overrideQty){
      spinach.overrideQty='900 g';
      spinach.overridePrice=2.50;
    }
  }
  if(oldPaid.length){
    month.reconcileWarnings??=[];
    month.reconcileWarnings.push({name:'Articles poisson/noix déjà payés : vérifier les stocks avant de commander les quiches et les grands pots bio'});
  }
  for(const dish of month.meals){
    if(!dish)continue;
    dish.servings??=dish.batchRole?10:5;
    dish.mealsPerDay??=1;
  }
  month.budget=Math.min(Number(month.budget)||HARD_CEILING,HARD_CEILING);
  return month;
}
// v8 → v9 : corriger les achats futurs sans modifier l'historique payé.
function migrateWeeklyButterEggsBread(month,index){
  migrateOptimisedBasket(month,index);
  month.reconcileWarnings??=[];
  for(const item of month.groceries){
    if(item.name==='Œufs'&&item.week>=0&&item.week<4){
      if(item.bought){
        if(/30 œufs|\\+ 1 × 6/.test(item.overrideQty??item.qty))
          month.reconcileWarnings.push({name:'Semaine '+(item.week+1)+' : ancien achat de 30 œufs conservé ; plafond futur 24'});
      }else{
        if(/30 œufs|\\+ 1 × 6/.test(item.overrideQty??item.qty)){
          item.overrideQty=null;
          item.overridePrice=null;
          month.reconcileWarnings.push({name:'Semaine '+(item.week+1)+' : ancien panier de 30 œufs ramené à 24'});
        }
        item.qty='2 × 12 (24 œufs)';
        item.price=10.80;
      }
    }
    if(item.name.startsWith('Beurre M&S')&&!item.bought){
      item.name='Beurre M&S (usage hebdomadaire)';
      item.optional=false;
    }
    if(item.name==='Pain complet M&S'&&!item.bought&&item.overridePrice==null)
      item.price=3.50;
  }
  for(const [id,entry] of Object.entries(month.autoPurchases||{})){
    if(id.startsWith('baking-eggs-')&&entry.bought)
      month.reconcileWarnings.push({name:'Ancien complément œufs payé : reçu conservé sans réachat automatique'});
  }
  month.budget=Math.min(Number(month.budget)||HARD_CEILING,HARD_CEILING);
  return month;
}
// v9 -> v10 : uniquement préférences fruits et deux huiles.
// Garder intacts les articles payés ou marqués en stock (aucun faux reçu).
function migrateFruitOilPreferences(month,index){
  const previouslyBought=(month.groceries||[]).filter(x=>x.bought&&
    (/^(Pommes M&S|Bananes M&S|Clémentines M&S|Poires M&S)/.test(x.name)||
     x.id==='base-0-27'));
  migrateOptimisedBasket(month,index);
  if(previouslyBought.length){
    month.reconcileWarnings??=[];
    month.reconcileWarnings.push({
      name:'Fruits/huiles déjà achetés : reçus conservés ; vérifier le stock avant les nouveaux achats raisins, fraises, poires et huiles'
    });
  }
  month.budget=Math.min(Number(month.budget)||HARD_CEILING,HARD_CEILING);
  return month;
}
// v11 -> v12 : calibration confirmée sur ticket M&S complet, hors
// viande et Dining Solutions. Ne jamais modifier les achats payés, stocks
// personnalisés ni les prix explicitement saisis par l'utilisateur.
function migrateRealStaplePrices(month,{addSupplementalMilk=true}={}){
 for(const item of month.groceries||[]){
   if(item.bought||item.overridePrice!=null)continue;
   if(item.name==='Œufs'){
     item.price=item.week<4?10.80:5.40;
   }else if(item.name==='Lait Yeo Valley biologique 2 L (entier ou demi-écrémé)'&&
           item.overrideQty==null){
     // Deux bouteilles de 2L pour 7 jours ; une bouteille la semaine partielle.
     const full=item.week<4;
     const newQty=full?'2 × 2 L (4 L)':'1 × 2 L (2 L)';
     if(item.qty!==newQty){
       // Un prix appris sur l'ancien format 8L/4L doit être ramené au
       // nouveau conditionnement ; conserver l'observation historique.
       if(item.learnedPrice!=null)item.learnedPrice=Math.round(item.learnedPrice*50)/100;
       item.qty=newQty;
     }
     item.price=full?6.20:3.10;
   }else if(item.name==='Beurre M&S (usage hebdomadaire)'){
     // Le code-barres 3282380060219 correspond au Lescure AOP 250g.
     item.price=3.75;
   }
 }
 // La troisième bouteille du ticket est un lait M&S bio de 4 pintes,
 // différent des deux flacons Yeo Valley. Ne pas l'attribuer au prix de Yeo.
 // Ajout aux périodes à venir uniquement : les achats historiques restent intacts.
 if(addSupplementalMilk){
   const present=new Set(month.groceries.map(i=>i.id));
   for(const item of BASE_SHOPPING.filter(i=>i.id.startsWith('receipt-ms-organic-milk-week'))){
     if(item.week>=Math.ceil(month.meals.length/7)||present.has(item.id))continue;
     month.groceries.push({...clone(item),bought:false,actual:null,hidden:false,overrideQty:null,overridePrice:null});
   }
 }
 return month;
}
// v12 -> v13 : redimensionner uniquement les plats encore inchangés et
// non cuisinés. Toute édition personnalisée, achat payé et ancien reçu reste intact.
function migrateChildPortions(month){
 month.reconcileWarnings??=[];
 const count=(month.meals||[]).length;
 let kept=0,scaled=0;
 for(let i=0;i<count;i++){
  const meal=month.meals[i],old=LEGACY_FAMILY_PLAN[i%31],next=FAMILY_PLAN[i%31];
  if(!old||!next||meal.cooked||meal.name!==old.name){kept++;continue;}
  const isFinalHalf=i===count-1&&old.batchRole==='prepare';
  const oldIngredients=isFinalHalf?old.ingredients.map(x=>({...x,quantity:x.quantity/2})):old.ingredients;
  const nextIngredients=isFinalHalf?next.ingredients.map(x=>({...x,quantity:x.quantity/2})):next.ingredients;
  // Un changement manuel de poids ou d'ingrédient ne doit pas être écrasé.
  if(JSON.stringify(meal.ingredients)!==JSON.stringify(oldIngredients)){kept++;continue;}
  meal.ingredients=clone(nextIngredients);
  scaled++;
 }
 // Un seul sachet de 6 poires par semaine en hypothèse de départ.
 // Le second reste rétablissable depuis Courses, sans supprimer d'historique.
 let optionalPearBags=0;
 for(const item of month.groceries||[]){
  if(!item.name.startsWith('Poires Ocado')||!item.name.includes('sachet 2/2')||
     item.bought||item.hidden||item.inStock||item.overrideQty!=null||item.overridePrice!=null)continue;
  item.hidden=true;optionalPearBags++;
 }
 if(optionalPearBags)month.reconcileWarnings.push({name:
   'Poires : deuxième sachet de 6 rendu facultatif (rétablissable depuis Courses)'});
 const carrots=calibrateCarrotsFromMeals(month);
 if(kept>0)month.reconcileWarnings.push({name:
   'Portions : '+kept+' journée(s) cuisinée(s) ou personnalisée(s) préservées ; vérifier leurs besoins de courses'});
 if(carrots.length)month.reconcileWarnings.push({name:
   'Carottes bio : '+carrots.length+' semaine(s) à sacs de 1 kg, prix ticket 1,60 £/kg (achats antérieurs préservés)'});
 return {scaled,kept,carrots:carrots.length};
}
export function validateImport(raw){
  if(!raw||![2,3,4,5,6,7,8,9,10,11,12,13].includes(raw.version)||!raw.months||typeof raw.months!=='object')
    throw Error('Sauvegarde non reconnue');
  for(const [key,month] of Object.entries(raw.months)){
    if(!Array.isArray(month.meals)||!Array.isArray(month.groceries)||
      !Array.isArray(month.manualItems)||!Array.isArray(month.extraExpenses))
      throw Error('Structure incorrecte');
  }
  if(raw.version===2){
    for(const [key,month] of Object.entries(raw.months))
      raw.months[key]=migrateLegacyMonth({...month,index:Number(key)});
  }
  if(raw.version<=3){
    for(const [key,month] of Object.entries(raw.months))
      raw.months[key]=migrateOptimisedBasket({...month,index:Number(key)},Number(key));
    raw.version=4;
  }
  if(raw.version===4){
    for(const [key,month] of Object.entries(raw.months))
      raw.months[key]=migrateFishYassa({...month,index:Number(key)},Number(key));
    raw.version=5;
  }
  if(raw.version===5){
    for(const [key,month] of Object.entries(raw.months))
      raw.months[key]=migrateStrictBudget({...month,index:Number(key)},Number(key));
    raw.version=6;
  }
  if(raw.version===6){
    for(const [key,month] of Object.entries(raw.months))
      raw.months[key]=migrateSalmonPlan({...month,index:Number(key)},Number(key));
    raw.version=7;
  }
  if(raw.version===7){
    for(const [key,month] of Object.entries(raw.months))
      raw.months[key]=migrateQuichesWalnuts({...month,index:Number(key)},Number(key));
    raw.version=8;
  }
  if(raw.version===8){
    for(const [key,month] of Object.entries(raw.months))
      raw.months[key]=migrateWeeklyButterEggsBread({...month,index:Number(key)},Number(key));
    raw.version=9;
  }
  if(raw.version===9){
    for(const [key,month] of Object.entries(raw.months))
      raw.months[key]=migrateFruitOilPreferences({...month,index:Number(key)},Number(key));
    raw.version=10;
  }
  if(raw.version===10)raw.version=11;
  if(raw.version===11){
    for(const [key,month] of Object.entries(raw.months))
      migrateRealStaplePrices(month,{addSupplementalMilk:Number(key)>=Number(raw.selectedPeriod??0)});
    raw.version=12;
  }
  if(raw.version===12){
    for(const month of Object.values(raw.months))migrateChildPortions(month);
    raw.version=13;
  }
  raw.priceBook??={};
  for(const month of Object.values(raw.months)){
    month.receiptImports??=[];
    month.receiptWeeks??={};
    month.bakingWeeks??={};
    month.reconcileWarnings??=[];
  }
  return raw;
}
