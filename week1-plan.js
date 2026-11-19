import {FAMILY_PLAN} from './meal-plan.js';

// Politique pour la première semaine du premier cycle uniquement.
// La déclaration "pas de saumon acheté" change le MENU ; elle ne crée aucun achat
// ni crédit et ne préjuge pas du stock de viande acheté séparément.
const clone=x=>JSON.parse(JSON.stringify(x));
const basic=(name,quantity,unit='g')=>({name,quantity,unit,supplier:'M&S',price:null});
const originalAt=(i)=>FAMILY_PLAN[i];
const untouched=(m,i)=>{
 const baseline=originalAt(i);
 return !!m&&!m.cooked&&m.name===baseline.name&&m.kind===baseline.kind&&
  JSON.stringify(m.ingredients||[])===JSON.stringify(baseline.ingredients||[]);
};
const category=(c,k)=>Number(c?.[k]||0)>0;
const couscousMeal=()=>({
 name:'Couscous complet aux courgettes, tomates et œufs',
 kind:'V',
 ingredients:[
  basic('Couscous complet',350),basic('Courgettes',400),
  basic('Tomates concassées',250),basic('Œufs',5,'pièce')
 ]
});
const fusilliMeal=()=>({
 name:'Fusilli complets aux brocolis, tomates et œufs',
 kind:'V',
 ingredients:[
  basic('Pâtes complètes',350),basic('Brocolis',450),
  basic('Tomates concassées',250),basic('Œufs',5,'pièce')
 ]
});
function updateOriginalMeal(month,index,recipe,reason,{allowPreviousAuto=false}={}){
 const meal=month?.meals?.[index];
 if(!meal||meal.cooked||meal.batchRole==='reheat')return false;
 const canUse=untouched(meal,index)||allowPreviousAuto&&['user-confirmed-no-salmon-week1','salmon-not-on-complete-receipt'].includes(meal.autoAdjusted?.reason);
 if(!canUse)return false;
 const previous=meal.autoAdjusted?.previous||clone({
  name:meal.name,kind:meal.kind,ingredients:meal.ingredients});
 Object.assign(meal,{name:recipe.name??meal.name,kind:recipe.kind??meal.kind,
   ingredients:clone(recipe.ingredients??meal.ingredients),
   autoAdjusted:{reason,week:0,previous:clone(previous)}});
 return true;
}
function deferUnboughtSalmon(month){
 let updated=0;
 for(const x of month.groceries||[]){
  if(x.week===0&&/saumon|salmon/i.test(x.name)&&!x.bought&&!x.inStock&&
     x.overrideQty==null&&!x.hidden){
    x.hidden=true;x.autoDeferred=true;updated++;
  }
 }
 return updated;
}
export function applyUserConfirmedNoSalmonWeek1(month){
 if(!month||Number(month.index)!==0||month.receiptWeeks?.[0]?.complete)return {changed:[]};
 const original=month.meals?.[2];
 if(!untouched(original,2))return {changed:[]};
 const changed=updateOriginalMeal(month,2,couscousMeal(),'user-confirmed-no-salmon-week1');
 if(changed){
  deferUnboughtSalmon(month);
  month.firstWeekNoSalmon=true;
  return {changed:[{index:2,to:month.meals[2].name}],
   warnings:['Saumon retiré selon votre déclaration ; les achats du ticket restent à importer pour mettre à jour les montants payés.']};
 }
 return {changed:[]};
}
const freshCarrots=(rows)=>Array.isArray(rows)&&rows.filter(x=>
 x.selectedId&&x.sku==='29087914').length;
function replaceIngredientQuantity(meal,name,quantity){
 const next=clone(meal.ingredients);
 const obj=next.find(x=>x.name===name&&x.unit==='g');
 if(!obj)return null;
 obj.quantity=quantity;
 return {name:meal.name,kind:meal.kind,ingredients:next};
}
export function optimizeFirstWeekFromReceipt(month,rows,categories){
 const changed=[],warnings=[];
 if(Number(month?.index)!==0)return {changed,warnings};
 const c=categories||{};
 const salmonBought=category(c,'salmon')||
   (month.groceries||[]).some(x=>x.week===0&&x.bought&&/saumon|salmon/i.test(x.name));
 const couscousAvailable=category(c,'couscous')&&category(c,'courgette')&&
   category(c,'tomato')&&category(c,'eggs');
 if(!salmonBought&&couscousAvailable){
  const did=updateOriginalMeal(month,2,couscousMeal(),
   'complete-ms-receipt-no-salmon',{allowPreviousAuto:true});
  if(did)changed.push({index:2,to:month.meals[2].name});
  deferUnboughtSalmon(month);
 }
 // Deux portions de légumes supplémentaires sont disponibles via ce ticket.
 // Sans quantité connue sur le ticket, on ne certifie pas leur disponibilité
 // en grammes : seules les carottes EAN 29087914 ont un format connu (1 kg).
 if(freshCarrots(rows)===1){
  // Le poulet et l'agneau restent les sources de protéines de ces plats.
  // Les carottes ne sont pas le seul légume : pommes de terre / patates
  // douces / courgettes sont prévues dans les recettes existantes.
  for(const [index,grams] of [[0,450],[3,500]]){
   const meal=month.meals[index];
   if(!untouched(meal,index)){
    warnings.push('Carottes : vérifier le jour '+(index+1)+' (repas cuisiné ou personnalisé non modifié)');
    continue;
   }
   const recipe=replaceIngredientQuantity(meal,'Carottes',grams);
   if(recipe&&updateOriginalMeal(month,index,recipe,'one-kg-carrots-from-receipt')){
    changed.push({index,to:meal.name,quantity:'Carottes '+grams+' g'});
   }
  }
  warnings.push('Carottes : 1 kg sur le ticket ; deux recettes ajustées à 950 g au total, sauf repas déjà cuisiné ou personnalisé.');
 }
 // Le gratin du jour 2 contient déjà œufs, brocolis, betteraves et pommes de
 // terre. Ne pas supposer que le cheddar a une présure végétale.
 if(category(c,'eggs')&&category(c,'broccoli')&&category(c,'potato')&&
    !category(c,'vegetarian-cheese')&&untouched(month.meals[1],1)){
  const meal=month.meals[1],ingredients=clone(meal.ingredients).filter(x=>x.name!=='Fromage');
  if(updateOriginalMeal(month,1,{name:meal.name,kind:meal.kind,ingredients},
   'unverified-cheese-rennet')){
   changed.push({index:1,to:meal.name});
   warnings.push('Gratin : fromage retiré du calcul tant que la présure végétale n’est pas confirmée.');
  }
 }
 // Aucun achat de lentilles sur un ticket confirmé complet : le dernier menu
 // utilise des œufs réellement achetés, sans supposer un stock de lentilles.
 if(!category(c,'lentils')&&category(c,'pasta')&&category(c,'broccoli')&&
    category(c,'tomato')&&category(c,'eggs')){
  if(updateOriginalMeal(month,6,fusilliMeal(),'lentils-not-on-complete-receipt')){
   changed.push({index:6,to:month.meals[6].name});
  }
 }
 if(changed.length)warnings.push('Les poids des brocolis et courgettes sur le ticket ne sont pas certifiés : vérifier les quantités disponibles avant cuisson.');
 return {changed,warnings};
}
