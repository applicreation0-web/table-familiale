import { BASE_MENU, BASE_SHOPPING, BASE_BUDGET } from './data.js';
import { MEAL_INGREDIENTS, BREAKFASTS } from './recipes.js';
import { FAMILY_PLAN } from './meal-plan.js';
export { BREAKFASTS };
export const SUPPLIERS = ['M&S', 'Supermarché (Yeo Valley)', 'Saffron Alley', 'Dining Solutions', 'Épicerie africaine', 'Autre'];
export const KIND_NAMES = {P:'Poulet Hubbard',T:'Cuisses halal',F:'Cabillaud',K:'Maquereau',L:'Agneau',V:'Végétarien'};
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
      batchRole:plan.batchRole,ingredients:clone(plan.ingredients),originalIndex:i%31,
      cooked:false,cookedAt:null};
  });
  const groceries=BASE_SHOPPING.filter(x=>x.week<Math.ceil(dates.length/7)).map(x=>({...clone(x),bought:false,actual:null,hidden:false,overrideQty:null,overridePrice:null}));
  return {index,budget:BASE_BUDGET,meals,groceries,manualItems:[],autoPurchases:{},extraExpenses:[],notes:'',createdAt:new Date().toISOString()};
}
export function newState(){return {version:3, selectedPeriod:0, months:{'0':makeMonth(0)}};}
export function normalize(s=''){
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[^a-z0-9]+/g,' ').trim();
}
function signature(i){return normalize(i.name)+'|'+i.unit+'|'+i.supplier;}
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
    const original=month.meals.slice(w*7,w*7+7).flatMap((_,offset)=>FAMILY_PLAN[(w*7+offset)%31].ingredients);
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
  return ingredientChanges(month).filter(x=>x.delta>0 && !month.autoPurchases?.[x.id]?.skip).map(x=>({
    ...x,kind:'auto',qty:`${x.quantity} ${x.unit}`,estimate:month.autoPurchases?.[x.id]?.plannedPrice??x.price,
    bought:!!month.autoPurchases?.[x.id]?.bought,
    actual:month.autoPurchases?.[x.id]?.actual??null,
  }));
}
export function shoppingEntries(month,week,monthly=false){
  const base=month.groceries.filter(x=>!x.hidden&&(monthly?x.purchase==='monthly':x.purchase==='weekly'&&x.week===week)).map(x=>({...x,kind:'base',estimate:x.overridePrice??x.price,qty:x.overrideQty??x.qty}));
  const manual=(month.manualItems||[]).filter(x=>!x.hidden&&(monthly?x.purchase==='monthly':x.purchase==='weekly'&&x.week===week)).map(x=>({...x,kind:'manual',estimate:x.price}));
  const auto=suggestedPurchases(month).filter(x=>monthly?x.monthOnly:!x.monthOnly&&x.week===week);
  return [...base,...manual,...auto];
}
export function allShoppingEntries(month){
  return [...month.groceries.filter(x=>!x.hidden).map(x=>({...x,kind:'base',estimate:x.overridePrice??x.price})),
    ...(month.manualItems||[]).filter(x=>!x.hidden).map(x=>({...x,kind:'manual',estimate:x.price})),...suggestedPurchases(month)];
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
  const aLen=A.len,bLen=B.len;
  if(aLen!==bLen){
    const single=aLen===1?A:B, pair=aLen===2?A:B;
    if(single.start+1>=month.meals.length||single.start<=pair.start+1&&single.start+1>=pair.start)
      throw new Error('Choisissez deux journées consécutives libres.');
    if(month.meals[single.start+1].batchRole)throw new Error('Choisissez deux journées simples consécutives.');
    single.len=2;
  }
  const touched=[...new Set([...Array(A.len)].map((_,j)=>A.start+j).concat([...Array(B.len)].map((_,j)=>B.start+j)))];
  if(touched.some(i=>month.meals[i]?.cooked))throw new Error('Un repas déjà cuisiné ne peut pas être déplacé.');
  const old=touched.map(i=>[i,clone(month.meals[i])]);
  const pick=(x)=>x.map(i=>clone(month.meals[i]));
  const aItems=pick([...Array(A.len)].map((_,j)=>A.start+j));
  const bItems=pick([...Array(B.len)].map((_,j)=>B.start+j));
  const copyFields=(src,dest)=>{for(const k of ['name','kind','ingredients','originalIndex','african','batchRole'])dest[k]=clone(src[k]??null);};
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
  if(item.kind==='auto')month.autoPurchases[item.id]={bought:checked,actual:checked?cents:null,at:new Date().toISOString()};
  else {
    const list=item.kind==='manual'?month.manualItems:month.groceries;
    const found=list.find(x=>x.id===item.id);
    if(!found)throw Error('Produit introuvable');
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
      const oldEggs=previous.name==='Œufs';
      if(oldLait||oldEggs){
        const week=previous.week;
        extras.push({id:'topup-v3-'+previous.id,name:item.name+' — complément',qty:oldLait?(week<4?'2 × 2 L':'1 × 2 L'):'6 œufs',
          price:oldLait?(week<4?6.30:3.15):2.60,supplier:item.supplier,purchase:'weekly',week,
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
export function validateImport(raw){
  if(!raw||![2,3].includes(raw.version)||!raw.months||typeof raw.months!=='object')throw Error('Sauvegarde non reconnue');
  for(const [key,month] of Object.entries(raw.months)){
    if(!Array.isArray(month.meals)||!Array.isArray(month.groceries)||!Array.isArray(month.manualItems)||!Array.isArray(month.extraExpenses))throw Error('Structure incorrecte');
    // Validation sans modifier les données avant la migration.
  }
  if(raw.version===2){
    for(const [key,month] of Object.entries(raw.months))raw.months[key]=migrateLegacyMonth({...month,index:Number(key)});
    raw.version=3;
  }
  return raw;
}
