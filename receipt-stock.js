import {FAMILY_PLAN} from './meal-plan.js';

// Moteur local : ne conserve ni photo, ni texte brut, ni identité, ni paiement.
// Un article absent d'un ticket PARTIEL ne prouve jamais une absence de stock.
const labelMap=[
 [/\b(?:SALMON|SAUMON|SMOKED SALM)\b/i,'salmon'],
 [/\b(?:W\/WHEAT PENNE|PENNE|FUSILLI|PASTA|P[AÂ]TES)\b/i,'pasta'],
 [/\b(?:COURGETTE|COURGETTES|ZUCCHINI)\b/i,'courgette'],
 [/\b(?:GRATED CHEDDA|CHEDDAR|FROMAGE R[AÂ]P[EÉ])\b/i,'cheddar'],
 [/\b(?:BROCCOLI|BROCOLI)\b/i,'broccoli'],
 [/\b(?:MIXED EGGS|EGGS|ŒUFS|OEUFS)\b/i,'eggs'],
 [/\b(?:MINI N POTATO|POTATO|POMMES DE TERRE)\b/i,'potato'],
 [/\b(?:CHOPPD TOMATO|CHOPPED TOMATO|TOMATE)\b/i,'tomato'],
 [/\b(?:GARLIC|AIL)\b/i,'garlic'],
 [/\b(?:VEGETABLE OIL|SUNFLOWER OIL|HUILE)\b/i,'oil'],
 [/\b(?:QUINOA)\b/i,'quinoa'],
 [/\b(?:COUSCOUS|SEMOULE)\b/i,'couscous'],
 [/\b(?:STILTON)\b/i,'blue-cheese'],
 [/\b(?:GRK YG|GREEK YOG|YAOURT)\b/i,'yogurt'],
 [/\b(?:WHITE GRAPE|RAISIN)\b/i,'grapes'],
];
const skuMap={
 '00671729':'pasta','00089241':'pasta',
 '00233620':'courgette','29091188':'cheddar',
 '00848503':'broccoli','29089635':'eggs',
 '00147217':'potato','00821964':'tomato',
 '00199032':'garlic','00807395':'oil',
 '29330812':'quinoa','29329724':'couscous',
 '00857406':'grapes'
};
export function receiptIngredientCategory(line){
 if(line?.sku&&skuMap[line.sku])return skuMap[line.sku];
 const label=String(line?.label||'');
 return labelMap.find(([r])=>r.test(label))?.[1]||null;
}
export function summarizeConfirmedReceipt(rows){
 const counts={};
 for(const row of rows||[]){
  if(!row.selectedId||Number(row.amount)<0)continue;
  const category=receiptIngredientCategory(row);
  if(category)counts[category]=(counts[category]||0)+1;
 }
 return counts;
}
const clone=x=>JSON.parse(JSON.stringify(x));
const categoryHas=(counts,key)=>Number(counts?.[key]||0)>0;
const isSalmon=x=>/\bsaumon\b|salmon/i.test(String(x||''));
const isSalmonGrocery=x=>isSalmon(x?.name)&&x?.week>=0;
const isUnedited=(meal,index)=>{
 const baseline=FAMILY_PLAN[index%FAMILY_PLAN.length];
 return meal.name===baseline.name&&meal.kind===baseline.kind&&
   JSON.stringify(meal.ingredients||[])===JSON.stringify(baseline.ingredients||[]);
};
function nonSalmonRecipe(counts){
 if(categoryHas(counts,'pasta')&&categoryHas(counts,'courgette')&&categoryHas(counts,'cheddar')){
  return {name:'Pennes complètes aux courgettes et cheddar',kind:'V',
   ingredients:[
    {name:'Pâtes complètes',quantity:350,unit:'g',supplier:'M&S',price:null},
    {name:'Courgettes',quantity:450,unit:'g',supplier:'M&S',price:null},
    {name:'Fromage',quantity:120,unit:'g',supplier:'M&S',price:null},
    ...(categoryHas(counts,'garlic')?[{name:'Ail',quantity:1,unit:'pièce',supplier:'M&S',price:null}]:[])
   ]};
 }
 if(categoryHas(counts,'potato')&&categoryHas(counts,'broccoli')&&categoryHas(counts,'eggs')){
  return {name:'Gratin de pommes de terre, brocolis et œufs',kind:'V',
   ingredients:[
    {name:'Pommes de terre',quantity:800,unit:'g',supplier:'M&S',price:null},
    {name:'Brocolis',quantity:500,unit:'g',supplier:'M&S',price:null},
    {name:'Œufs',quantity:5,unit:'pièce',supplier:'M&S',price:null},
   ]};
 }
 return null;
}
export function canReorganizeFromTicket(month,week){
 return !!month?.receiptWeeks?.[week]?.complete;
}
// Replanifie un jour seulement : ni les plats familiaux de deux jours, ni une
// recette personnalisée, ni un plat déjà cuisiné ne sont réécrits.
export function rearrangeMissingSalmon(month,week,{force=false}={}){
 const snap=month?.receiptWeeks?.[week];
 if(!snap?.complete&&!force)return {changed:[],warnings:['Un ticket complet doit être confirmé avant de déduire une absence de saumon.']};
 const counts=snap?.categories||{};
 if(categoryHas(counts,'salmon')||
   (month.groceries||[]).some(x=>x.bought&&x.week===week&&isSalmonGrocery(x)))
  return {changed:[],warnings:[]};
 const alt=nonSalmonRecipe(counts);
 if(!alt)return {changed:[],warnings:['Saumon absent ; ingrédients de remplacement insuffisamment identifiés : aucun plat modifié.']};
 const changed=[],warnings=[];
 for(let index=week*7;index<Math.min((week+1)*7,month.meals.length);index++){
  const meal=month.meals[index];
  if(!meal||meal.cooked||meal.batchRole||!isSalmon(meal.name)&&!(meal.ingredients||[]).some(x=>isSalmon(x.name)))continue;
  if(!isUnedited(meal,index)){warnings.push('Jour '+(index+1)+' : recette personnalisée conservée.');continue;}
  const previous=clone({name:meal.name,kind:meal.kind,ingredients:meal.ingredients});
  Object.assign(meal,{name:alt.name,kind:alt.kind,ingredients:clone(alt.ingredients),
    autoAdjusted:{reason:'salmon-not-on-complete-receipt',week,previous}});
  changed.push({index,from:previous.name,to:alt.name});
 }
 // Un filet non acheté n'est ni un achat payé, ni un stock fictif.
 // La ligne prévue peut être retirée uniquement si aucun plat de la semaine
 // ne requiert encore ce produit.
 if(changed.length){
  const remaining=(month.meals||[]).slice(week*7,(week+1)*7)
    .some(meal=>isSalmon(meal.name)||(meal.ingredients||[]).some(x=>isSalmon(x.name)));
  if(!remaining){
   for(const item of month.groceries||[]){
    if(item.week===week&&isSalmonGrocery(item)&&!item.bought&&!item.inStock&&
       !item.hidden&&item.overrideQty==null){
      item.hidden=true;
      item.autoDeferred=true;
    }
   }
  }
 }
 if(changed.length)warnings.push('Vérifier les quantités restantes : le ticket confirme des produits, pas leurs portions disponibles après chaque repas.');
 return {changed,warnings};
}
export function restoreAutoAdjustedMeal(month,index){
 const meal=month?.meals?.[index];
 if(!meal?.autoAdjusted||meal.cooked)throw Error('Ce repas ne peut pas être restauré automatiquement.');
 const old=meal.autoAdjusted.previous;
 Object.assign(meal,{...clone(old)});
 delete meal.autoAdjusted;
 for(const item of month.groceries||[])if(item.autoDeferred&&item.week===Math.floor(index/7)){
   item.hidden=false;delete item.autoDeferred;
 }
 return meal;
}
export function noteCompletedReceiptWeek(month,week,rows,{supplier='M&S',fingerprint=null}={}){
 if(supplier!=='M&S')return {changed:[],warnings:['Réorganisation automatique limitée aux tickets M&S vérifiés.']};
 month.receiptWeeks??={};
 const old=month.receiptWeeks[week];
 if(old?.fingerprint===fingerprint)return {changed:[],warnings:[]};
 month.receiptWeeks[week]={complete:true,supplier:'M&S',
   categories:summarizeConfirmedReceipt(rows),fingerprint};
 month.preferredStore='M&S';
 const result=rearrangeMissingSalmon(month,week);
 // Le ticket confirmé clôt la liste M&S de la semaine. On ne transforme PAS
 // un produit absent en achat réglé ; les lignes restent récupérables.
 let absent=0,otherStores=0;
 for(const item of month.groceries||[]){
  if(item.purchase==='weekly'&&item.supplier==='Supermarché (Yeo Valley)'&&item.week>=week)
   item.supplier='M&S'; // Même Yeo Valley, mais acheté à la caisse M&S.
  if(item.purchase==='weekly'&&item.supplier==='Ocado'&&item.week>week&&!item.bought){
   item.supplier='M&S';item.name=item.name.replace('Poires Ocado à mûrir','Poires M&S (format à confirmer)');
   if(item.overridePrice==null){item.price=null;item.priceStatus='provisional';delete item.learnedPrice;}
   otherStores++;
  }
  if(item.purchase==='weekly'&&item.week===week&&!item.bought&&!item.inStock&&!item.hidden){
   item.hidden=true;item.awaitingReceiptReview=true;absent++;
  }
 }
 month.receiptWeeks[week].absentPlanLines=absent;
 if(absent)result.warnings.push(absent+' références non identifiées sur le ticket : retirées des dépenses futures de cette semaine, sans les compter comme achetées. Vérifier la réserve et les ingrédients indispensables.');
 if(otherStores)result.warnings.push('Poires futures : achat M&S préféré, format et prix à confirmer plutôt que conserver le prix Ocado.');
 return result;
}
