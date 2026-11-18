import { BASE_MENU, BASE_SHOPPING, BASE_BUDGET } from './data.js';
import { MEAL_INGREDIENTS, BREAKFASTS } from './recipes.js';
import { FAMILY_PLAN } from './meal-plan.js';
export { BREAKFASTS };
export const HARD_CEILING = 900;
export const SUPPLIERS = ['M&S', 'Supermarché (Yeo Valley)', 'Saffron Alley', 'Dining Solutions', 'JJ Foodservice', 'Épicerie africaine', 'Autre'];
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
    const plan=FAMILY_PLAN[i%FAMILY_PLAN.length];
    return {id:dateISO(d),name:plan.name,kind:plan.kind,african:plan.african,
      batchRole:plan.batchRole,servings:plan.servings,mealsPerDay:plan.mealsPerDay,ingredients:clone(plan.ingredients),originalIndex:i%31,
      cooked:false,cookedAt:null};
  });
  const groceries=BASE_SHOPPING.filter(x=>x.week<Math.ceil(dates.length/7)).map(x=>({...clone(x),bought:false,actual:null,hidden:false,overrideQty:null,overridePrice:null}));
  return {index,budget:BASE_BUDGET,meals,groceries,manualItems:[],autoPurchases:{},bakingWeeks:{},extraExpenses:[],notes:'',createdAt:new Date().toISOString()};
}
export function newState(){return {version:7, selectedPeriod:0, months:{'0':makeMonth(0)}};}
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
  for(let w=0;w<weekCount;w++){
    const original=month.meals.slice(w*7,w*7+7).flatMap((meal,offset)=>
      meal.cooked?meal.ingredients:FAMILY_PLAN[(w*7+offset)%31].ingredients);
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
export function suggestedPurchases(month){
  const recipeAdditions=ingredientChanges(month).filter(x=>x.delta>0 && !month.autoPurchases?.[x.id]?.skip).map(x=>({
    ...x,kind:'auto',qty:`${x.quantity} ${x.unit}`,estimate:month.autoPurchases?.[x.id]?.plannedPrice??x.price,
    bought:!!month.autoPurchases?.[x.id]?.bought,
    actual:month.autoPurchases?.[x.id]?.actual??null,
  }));
  const eggTopups=month.groceries.filter(x=>x.name==='Œufs'&&x.week<4&&x.bought&&
    isBakingWeek(month,x.week)&&/2 × 12/.test(x.overrideQty??x.qty)&&
    !/\+ 1 × 6/.test(x.overrideQty??x.qty)).map(x=>{
      const id='baking-eggs-'+x.week,state=month.autoPurchases?.[id]||{};
      return {id,week:x.week,kind:'auto',monthOnly:false,supplier:'M&S',name:'Œufs pour gâteaux et muffins — complément',
        quantity:6,unit:'pièce',qty:'6 œufs',estimate:state.plannedPrice??2.60,
        bought:!!state.bought,actual:state.actual??null,skip:!!state.skip};
    }).filter(x=>!x.skip);
  return [...recipeAdditions,...eggTopups];
}
// Les produits de pâtisserie ne sont prévus que si la semaine concernée est activée.
// Les articles déjà achetés ne sont jamais effacés lorsque l'option est désactivée.
export function isBakingWeek(month,week){return !!month.bakingWeeks?.[week];}
function plannedGrocery(month,item){
  if(item.hidden)return null;
  let targetWeek=item.week;
  if(item.optional&&!item.bought){
    const staple=item.week===0&&/Sucre pour gâteaux|Levure chimique|Extrait de vanille/.test(item.name);
    const active=Object.keys(month.bakingWeeks||{}).filter(w=>month.bakingWeeks[w]).map(Number).sort((a,b)=>a-b);
    if(staple){
      if(!active.length)return null;
      targetWeek=active[0]; // Les ingrédients de base apparaissent dans la semaine de cuisine.
    }else if(!isBakingWeek(month,item.week))return null;
  }
  const planned={...item,week:targetWeek,kind:'base',qty:item.overrideQty??item.qty,estimate:item.overridePrice??item.price};
  if(item.name==='Œufs'&&item.week<4&&!item.bought&&!item.overrideQty){
    planned.qty=isBakingWeek(month,item.week)?'2 × 12 + 1 × 6 (30 œufs)':'2 × 12 (24 œufs)';
    if(item.overridePrice==null)planned.estimate=isBakingWeek(month,item.week)?11.40:8.80;
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
       item.inStock||!builtIn)next.push(item);
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
export function validateImport(raw){
  if(!raw||![2,3,4,5,6,7].includes(raw.version)||!raw.months||typeof raw.months!=='object')
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
  for(const month of Object.values(raw.months)){
    month.bakingWeeks??={};
    month.reconcileWarnings??=[];
  }
  return raw;
}
