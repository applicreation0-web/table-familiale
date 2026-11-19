// Historique de prix local. Seuls les montants réellement confirmés alimentent ce carnet.
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
export const norm=(s='')=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/&/g,' et ').replace(/[^a-z0-9]+/g,' ').trim();
function quantity(qty=''){
 const s=String(qty).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .replace(/œ/g,'oe').replace(/,/g,'.').replace(/×/g,' x ').replace(/[^a-z0-9.]+/g,' ').trim();
 let m=s.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pieces?|poires?|oeufs?|unites?)/);
 let number,unit;
 if(m){number=Number(m[1])*Number(m[2]);unit=m[3]}
 else{
   m=s.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pieces?|poires?|oeufs?|unites?)(?:\s|$)/);
   if(!m)return null;
   number=Number(m[1]);unit=m[2];
 }
 if(!Number.isFinite(number)||number<=0)return null;
 if(unit==='kg'){number*=1000;unit='g'}
 if(unit==='l'){number*=1000;unit='ml'}
 if(/pieces?|poires?|oeufs?|unites?/.test(unit))unit='unit';
 return {amount:number,unit};
}
export function priceIdentity(item){
 const supplier=norm(item.supplier),name=norm(item.name).replace(/ sachet [12] 2$/,'');
 if(!supplier||!name)return null;
 const q=quantity(item.qty);
 if(!q)return null;
 return {key:supplier+'|'+name+'|'+q.unit,quantity:q.amount,unit:q.unit};
}
function median(nums){
 const sorted=[...nums].sort((a,b)=>a-b);
 return sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
}
export function recordActualPrice(state,source,paid,at=new Date().toISOString(),receiptReference=null){
 const ident=priceIdentity(source);
 if(!ident||!Number.isFinite(paid)||paid<0||paid>10000)return false;
 state.priceBook??={};
 const existing=state.priceBook[ident.key]?.observations||[];
 const clean=receiptReference?existing.filter(x=>x.ref!==receiptReference):existing;
 // Un prix gratuit ou une remise à 100 % n'est pas une référence durable.
 if(paid===0)return false;
 const observations=[...clean,{unitPrice:paid/ident.quantity,at,ref:receiptReference}].slice(-12);
 const unitPrice=median(observations.slice(-3).map(x=>x.unitPrice));
 state.priceBook[ident.key]={observations,unitPrice,updatedAt:at};
 return true;
}
export function applyLearnedPrices(state,{afterPeriod=-1,afterWeek=-2,onlyPeriod=null}={}){
 const out=[];
 for(const [k,month] of Object.entries(state.months||{})){
   const period=Number(k);
   if(onlyPeriod!=null&&period!==onlyPeriod)continue;
   if(period<afterPeriod)continue;
   for(const item of month.groceries||[]){
     if(item.bought||item.hidden||item.inStock||item.overridePrice!=null)continue;
     if(period===afterPeriod&&item.week<=afterWeek)continue;
     const id=priceIdentity(item),record=id&&state.priceBook?.[id.key];
     if(!record){
       if(item.learnedPrice!=null){out.push({period,week:item.week,name:item.name,from:item.learnedPrice,to:item.price});
         delete item.learnedPrice;delete item.learnedAt;}
       continue;
     }
     const next=round(record.unitPrice*id.quantity);
     if(next<0||!Number.isFinite(next)||next>10000)continue;
     const prev=item.learnedPrice??item.price;
     item.learnedPrice=next;
     item.learnedAt=record.updatedAt;
     if(prev!==next)out.push({period,week:item.week,name:item.name,from:prev,to:next});
   }
 }
 return out;
}
export function learnFromConfirmedPurchase(state,month,item,paid){
 const period=month.index??state.selectedPeriod??0;
 const reference=period+'|'+item.id;
 if(!recordActualPrice(state,item,paid,new Date().toISOString(),reference))return [];
 return applyLearnedPrices(state,{afterPeriod:period,afterWeek:item.week??-1});
}
export function forgetConfirmedPurchase(state,month,item){
 const id=priceIdentity(item);
 if(!id||!state.priceBook?.[id.key])return [];
 const period=month.index??state.selectedPeriod??0,reference=period+'|'+item.id;
 const book=state.priceBook[id.key];
 const observations=book.observations.filter(x=>x.ref!==reference);
 if(!observations.length)delete state.priceBook[id.key];
 else state.priceBook[id.key]={...book,observations,unitPrice:median(observations.slice(-3).map(x=>x.unitPrice)),
   updatedAt:observations.at(-1).at};
 return applyLearnedPrices(state,{afterPeriod:period,afterWeek:item.week??-1});
}
export function priceBookStats(state){
 return {series:Object.keys(state.priceBook||{}).length,observations:Object.values(state.priceBook||{}).reduce((v,x)=>v+(x.observations?.length||0),0)};
}
