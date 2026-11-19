// Repères quantitatifs confirmés par EAN et conditionnement externe.
// Les lignes manquantes ne prouvent jamais qu'un produit n'est pas consommé.
const products=[
 {ean:'5036589201601',key:'milk',label:'Lait Yeo Valley entier',qty:2,unit:'L',
   isPlanned:i=>i.name.startsWith('Lait Yeo Valley')},
 {ean:'3282380060219',key:'butter',label:'Beurre Lescure AOP doux',qty:250,unit:'g',
   isPlanned:i=>i.name.startsWith('Beurre M&S')},
 {ean:'29089635',key:'eggs',label:'Œufs bio M&S',qty:12,unit:'œufs',
   isPlanned:i=>i.name==='Œufs'},
 {ean:'29087914',key:'carrots',label:'Carottes bio M&S',qty:1,unit:'kg',
   isPlanned:i=>i.name==='Carottes'},
];
const round=n=>Math.round(n*100)/100;
function plannedQuantity(item,unit){
 const text=String(item?.overrideQty??item?.qty??'').replace(/,/g,'.');
 if(unit==='œufs'){
   const m=text.match(/\((\d+)\s*œufs\)/);return m?Number(m[1]):null;
 }
 if(unit==='L'){
   const m=text.match(/\((\d+(?:\.\d+)?)\s*L\)/);return m?Number(m[1]):null;
 }
 if(unit==='g')return text.match(/^(\d+)\s*g\b/)?Number(RegExp.$1):null;
 if(unit==='kg'){
   const m=text.match(/(\d+(?:\.\d+)?)\s*kg/);
   return m?Number(m[1]):null;
 }
 return null;
}
export function compareReceiptToPlan(parsed,month,week){
 const observed=(parsed?.lines||[]),planned=(month?.groceries||[]).filter(i=>i.week===week);
 return products.flatMap(p=>{
   const lines=observed.filter(line=>line.sku===p.ean);
   if(!lines.length)return [];
   const item=planned.find(p.isPlanned);
   const actualQty=p.qty*lines.length;
   const budgetQty=item?plannedQuantity(item,p.unit):null;
   const purchase=round(lines.reduce((n,x)=>n+x.amount,0));
   const forecast=item?Number(item.overridePrice??item.learnedPrice??item.price):null;
   const recipeNeed=p.key==='carrots'?round((month.meals||[])
     .slice(week*7,week*7+7).flatMap(x=>x.ingredients||[])
     .filter(x=>x.name==='Carottes'&&x.unit==='g')
     .reduce((n,x)=>n+x.quantity,0)/1000):null;
   return [{key:p.key,label:p.label,unit:p.unit,actualQty,plannedQty:budgetQty,
     actualPrice:purchase,plannedPrice:forecast,
     recipeNeed,delta:budgetQty==null?null:round(actualQty-budgetQty)}];
 });
}
