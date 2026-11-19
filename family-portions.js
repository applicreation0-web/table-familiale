// Profil non nominatif. Âges exacts, noms, dates de naissance et identifiants
// des membres du foyer ne sont jamais demandés ni stockés.
export const FAMILY_PROFILE=Object.freeze({
 adults:2,children:3,childAgeRange:'3 à 10 ans',adultPortionEquivalents:4,
 provisional:true
});
const clean=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe');
const round2=x=>Math.round(x*100)/100;
function ingredientFactor(name){
 const n=clean(name);
 // Une approximation nutritionnelle, pas une limite pour un enfant :
 // les portions servies restent ajustables à la faim et à la croissance.
 if(/\briz\b/.test(n))return .62; // 1,3 kg secs / 10 parts -> ~800 g
 if(/boulgour|semoule|fonio|quinoa|pates/.test(n))return .75;
 if(/pommes de terre|patates douces/.test(n))return .75;
 if(/poulet|agneau|cuisses|cabillaud|saumon/.test(n))return .88;
 if(/oeufs/.test(n))return .88; // Arrondir au nombre entier supérieur
 if(/citron|ail|moutarde|olives|bouillon|epice/.test(n))return 1;
 if(/lait|fromage|pate brisee/.test(n))return .90;
 return .80;
}
export function scaleFamilyIngredients(ingredients){
 return (ingredients||[]).map(item=>{
  const quantity=Number(item.quantity);
  if(!Number.isFinite(quantity)||quantity<=0)return {...item};
  const factor=ingredientFactor(item.name);
  if(factor===1)return {...item}; // Ne pas arrondir les assaisonnements préservés.
  const adjusted=quantity*factor;
  let target=item.unit==='pièce'?Math.max(1,Math.ceil(adjusted)):
    item.unit==='g'?Math.max(25,Math.round(adjusted/25)*25):
    item.unit==='ml'?Math.max(25,Math.round(adjusted/25)*25):round2(adjusted);
  return {...item,quantity:target};
 });
}
const PRODUCE=[
 {name:'Carottes',names:['Carottes'],packKg:1,buffer:1.08,confirmedPricePerKg:1.60},
 {name:'Pommes de terre',names:['Pommes de terre'],packKg:2,buffer:1.08},
 {name:'Patates douces',names:['Patates douces'],packKg:.5,buffer:1.08},
 {name:'Courgettes',names:['Courgettes'],packKg:.5,buffer:1.08},
 {name:'Brocolis frais M&S',names:['Brocolis'],packKg:.5,buffer:1.08},
];
function purchasedKg(item){
 const text=String(item?.overrideQty??item?.qty??'').replace(/,/g,'.');
 const parent=text.match(/\((\d+(?:\.\d+)?)\s*kg\)/i);
 if(parent)return Number(parent[1]);
 const one=text.match(/(\d+(?:\.\d+)?)\s*kg/i);
 return one?Number(one[1]):null;
}
export function weeklyProduceNeeds(meals,week){
 const block=(meals||[]).slice(week*7,week*7+7);
 return PRODUCE.map(spec=>{
  const grams=block.flatMap(x=>x.ingredients||[])
    .filter(x=>x.unit==='g'&&spec.names.includes(x.name))
    .reduce((n,x)=>n+Number(x.quantity||0),0);
  if(grams<=0)return null;
  const kg=round2(grams/1000);
  const packs=Math.ceil((grams/1000)*spec.buffer/spec.packKg-1e-9);
  return {...spec,week,recipeKg:kg,proposedKg:round2(packs*spec.packKg)};
 }).filter(Boolean);
}
export function quantityAudit(month,week){
 const groceries=(month?.groceries||[]).filter(x=>x.week===week&&!x.hidden);
 return weeklyProduceNeeds(month?.meals||[],week).map(need=>{
  const item=groceries.find(x=>x.name===need.name);
  const plannedKg=item?purchasedKg(item):null;
  return {...need,plannedKg,deltaKg:plannedKg==null?null:round2(plannedKg-need.proposedKg),
    paid:!!item?.bought,manuallyChanged:item?.overrideQty!=null};
 });
}
// Seul le conditionnement des carottes (1 kg bio / £1.60) est connu sur ticket.
// Aucun prix d'un autre légume n'est diminué artificiellement.
export function calibrateCarrotsFromMeals(month,{onlyUnbought=true}={}){
 const changes=[];
 for(let week=0;week<Math.ceil((month.meals||[]).length/7);week++){
  const need=weeklyProduceNeeds(month.meals,week).find(x=>x.name==='Carottes');
  if(!need)continue;
  const item=(month.groceries||[]).find(x=>x.week===week&&x.name==='Carottes');
  if(!item||item.overrideQty!=null||item.overridePrice!=null||item.inStock||item.hidden||
     (onlyUnbought&&item.bought))continue;
  const oldQty=item.qty,oldPrice=item.price;
  item.qty=need.proposedKg+' × 1 kg ('+need.proposedKg+' kg)';
  item.price=round2(need.proposedKg*1.60);
  // Ne pas réutiliser un prix appris pour un emballage d'une autre taille.
  if(item.qty!==oldQty){delete item.learnedPrice;delete item.learnedAt;}
  item.sourceUrl=null; // La référence historique concernait des carottes non bio.
  if(item.qty!==oldQty||item.price!==oldPrice)changes.push({week,oldQty,newQty:item.qty,price:item.price});
 }
 return changes;
}
