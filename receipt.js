import {allShoppingEntries, markBought} from './model.js';
import {norm,learnFromConfirmedPurchase} from './pricing.js';
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const EXCLUDED=/\b(total|sub\s*total|sous\s*total|balance|cash|payment|tender|change|refund|credit|debit|visa|mastercard|card|loyalty|saving|discount|vat|tva|tax|points|you saved|delivery fee|paid|amount due)\b/i;
const WORDS=new Set(['the','and','et','sans','pepin','pepins','seedless','avec','pour','pack','pcs','piece','pieces','british','collection','nature','fresh','frais','fraiche','m','s','ms','ocado','produit','selected','standard','de','du','des','la','le','les','a','en','origine','gram','grams','each','mixed','x1','x2','org','organic']);
const ALIASES={red:'rouge',green:'vert',grapes:'raisin',grape:'raisin',raisin:'raisin',strawberries:'fraise',strawberry:'fraise',fraises:'fraise',pears:'poire',pear:'poire',poires:'poire',apples:'pomme',apple:'pomme',potatoes:'pomme terre',potato:'pomme terre',bread:'pain',loaf:'pain',milk:'lait',eggs:'oeuf',egg:'oeuf',oeufs:'oeuf',yoghurt:'yaourt',yogurt:'yaourt',greek:'grec',butter:'beurre',carrots:'carotte',carrot:'carotte',sunflower:'tournesol',olive:'olive',oil:'huile',salmon:'saumon',smoked:'fume',walnut:'noix',walnuts:'noix',rice:'riz',chicken:'poulet',onions:'oignon',onion:'oignon',lemons:'citron',lemon:'citron',cucumber:'concombre',cucumbers:'concombre',mlk:'lait',vly:'valley',whle:'entier',grk:'grec',yg:'yaourt',yogh:'yaourt',beetro:'betterave',beetroot:'betterave',cooked:'cuit',broccoli:'brocoli',courgette:'courgette',brwn:'brun',onion:'oignon',peanut:'cacahuete',garlic:'ail',grated:'rape',chedda:'cheddar'};
function tokens(value){
 return new Set(norm(value).replace(/\b\d+\s*(?:g|kg|ml|l)\b/g,' ').split(' ')
   .filter(x=>x.length>=2&&!WORDS.has(x)&&!/^[0-9]+$/.test(x))
   .map(x=>ALIASES[x]||(x.length>4&&x.endsWith('s')?x.slice(0,-1):x)));
}
export function receiptFingerprint(text){
 // Deux hash indépendants : détection locale des rescans identiques, sans conserver le ticket brut.
 const s=String(text||'').replace(/\s+/g,' ').trim().toLowerCase();
 let a=2166136261,b=5381;
 for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,16777619);b=(Math.imul(b,33)^c)>>>0;}
 return s.length.toString(36)+'-'+(a>>>0).toString(36)+'-'+(b>>>0).toString(36);
}
function amount(s){
 if(!/^\d{1,5}[.,]\d{2}$/.test(s))return null;
 const n=Number(s.replace(',','.'));
 return Number.isFinite(n)&&n>=0&&n<=10000?round(n):null;
}
// Les tickets M&S réels peuvent commencer par un EAN et finir par "<"
// après le prix. On sépare toujours la remise du montant des articles.
function cleanReceiptLabel(label){
 return String(label||'').replace(/^\s*\d{8,14}\s+/,'').replace(/\s*[<«]+\s*$/,'').trim();
}
function signedReceiptAmount(value){
 const valueText=String(value||'').replace(/[£€\s]/g,'').replace(/[−–]/g,'-').replace(',','.');
 if(!/^-?\d{1,5}\.\d{2}$/.test(valueText))return null;
 const valueNumber=Number(valueText);
 return Number.isFinite(valueNumber)&&Math.abs(valueNumber)<=10000?round(valueNumber):null;
}
export function parseReceiptText(raw){
 const text=String(raw||'').slice(0,100000);
 const input=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!input.length)throw new Error('Ticket vide');
 const lines=[];let ticketTotal=null,discountTotal=0,discountCount=0,subtotal=null;
 const date=text.match(/\b(\d{2})[\/.-](\d{2})[\/.-](20\d{2})\b/);
 let previous='';
 function accept(label,value,i){
   const cost=signedReceiptAmount(value),clean=cleanReceiptLabel(label);
   if(cost==null)return;
   if(/^(?:grand\s+)?total\b|^amount due\b|\bbalance to pay\b/i.test(clean)){
     ticketTotal=cost;previous='';return;
   }
   if(/^balance before sav(?:ing|ings)\b|^subtotal\b|^sub total\b/i.test(clean)){
     subtotal=cost;previous='';return;
   }
   if(EXCLUDED.test(clean)||/car\s*park\s*(refund|voucher)/i.test(clean)){
     // Une réduction confirmée sur le ticket ne doit pas devenir un achat.
     if(cost<0&&/\b(refund|discount|saving|voucher|coupon|promo)\b/i.test(clean)){
       discountTotal=round(discountTotal+cost);discountCount++;
     }
     previous='';return;
   }
   if(cost<=0||clean.length<2||/^[\d£\s.,-]+$/.test(clean)||
      /\b\d{2}[\/.-]\d{2}[\/.-](?:20\d{2})\b/.test(clean)||
      !/[A-Za-zÀ-ÿ]{2}/.test(clean)){previous='';return;}
   const sku=String(label||'').match(/^\s*(\d{8,14})\s+/)?.[1];
   lines.push({id:'line-'+i,label:clean,amount:cost,...(sku?{sku}:{})});
   previous='';
 }
 for(let i=0;i<input.length;i++){
   const line=input[i].replace(/[−–]/g,'-').replace(/[£€]/g,' £ ').replace(/\s+/g,' ').trim();
   const match=line.match(/^(.*?)\s+(-?\s*(?:£\s*)?\d{1,5}[.,]\d{2})\s*[<«*]*$/);
   // Montant seul: rattacher uniquement au libellé de la ligne précédente.
   const standalone=line.match(/^(-?\s*(?:£\s*)?\d{1,5}[.,]\d{2})\s*[<«*]*$/);
   if(standalone){
     if(previous)accept(previous,standalone[1],i);
     continue;
   }
   if(match){
     const label=match[1].trim()||previous;
     accept(label,match[2],i);
   }else if(!EXCLUDED.test(line)&&!/\d{1,5}[.,]\d{2}/.test(line)&&line.length>=3){
     previous=cleanReceiptLabel(line);
   }else if(EXCLUDED.test(line)){
     // Le libellé d'une remise peut être séparé de son montant sur l'image.
     previous=line;
   }
 }
 const visible=lines.slice(0,120),truncatedLines=Math.max(0,lines.length-visible.length);
 const recognizedTotal=round(visible.reduce((sum,x)=>sum+x.amount,0));
 return {fingerprint:receiptFingerprint(text),lines:visible,ticketTotal,subtotal,
   discountTotal,discountCount,truncatedLines,recognizedTotal,
   expectedPaid:round(recognizedTotal+discountTotal),
   reconciliationGap:ticketTotal==null?null:round(recognizedTotal+discountTotal-ticketTotal),
   date:date?date[3]+'-'+date[2]+'-'+date[1]:null,rawLineCount:input.length};
}
export function recommendReceiptMatches(parsed,month,week){
 const entries=allShoppingEntries(month).filter(e=>!e.bought&&!e.hidden&&!e.inStock);
 const used=new Set(),byPrintedLabel=new Map();
 const result=[];
 for(const line of parsed.lines){
   const t=tokens(line.label),candidates=[];
   for(const item of entries){
     const nt=tokens(item.name);
     if(!t.size||!nt.size)continue;
     const hit=[...t].filter(w=>nt.has(w)).length;
     const score=hit/Math.max(t.size,nt.size);
     const inPeriod=item.purchase==='monthly'||item.week===week;
     const adjusted=score+(inPeriod?0.12:0);
     if(score>=0.45)candidates.push({id:item.id,label:item.name,week:item.week,adjusted,score});
   }
   candidates.sort((a,b)=>b.adjusted-a.adjusted);
   const first=candidates[0],second=candidates[1];
   // Pas de rapprochement automatique pour les descriptions trop vagues/ambiguës.
   const canSuggest=!!first&&first.score>=0.65&&first.adjusted>=0.77&&
     (!second||first.adjusted-second.adjusted>=0.10)&&!used.has(first.id);
   // Plusieurs lignes identiques d'un ticket désignent souvent des emballages
   // d'un même article prévu. Les regrouper, avec vérification à l'import.
   const earlier=byPrintedLabel.get(norm(line.label));
   const repeated=earlier&&candidates.some(x=>x.id===earlier&&x.score>=0.65);
   const selectedId=repeated?earlier:canSuggest?first.id:'';
   if(selectedId){used.add(selectedId);byPrintedLabel.set(norm(line.label),selectedId);}
   result.push({...line,selectedId,confidence:canSuggest?'probable':'à vérifier',candidates:candidates.slice(0,5)});
 }
 return result;
}
export function applyReceiptReview(state,month,receipt,rows,{supplier='M&S'}={}){
 if(!receipt?.fingerprint||!Array.isArray(rows))throw Error('Ticket invalide');
 if(receipt.truncatedLines>0)throw Error('Ticket trop long : certaines lignes sont masquées. Aucun import autorisé.');
 month.receiptImports??=[];
 if(Object.values(state.months||{}).some(period=>(period.receiptImports||[]).some(x=>x.fingerprint===receipt.fingerprint)))
   throw Error('Ce ticket a déjà été rapproché : aucun achat ajouté en double.');
 const byId=new Map(allShoppingEntries(month).map(x=>[x.id,x]));
 const pending=[],grouped=new Map();
 for(const row of rows){
   if(!row.selectedId)continue;
   const cost=Number(row.amount);
   if(!Number.isFinite(cost)||cost<0||cost>10000)throw Error('Prix de ticket invalide');
   if(row.selectedId==='extra'){
     pending.push({kind:'extra',label:String(row.label||'Article hors liste').slice(0,120),price:round(cost)});
     continue;
   }
   const item=byId.get(row.selectedId);
   if(!item||item.bought||item.hidden||item.inStock)throw Error('Produit déjà acheté ou non disponible dans la liste');
   if(grouped.has(item.id)){
     const group=grouped.get(item.id);
     group.price=round(group.price+cost);
     group.quantityConfirmed=group.quantityConfirmed&&row.quantityConfirmed===true;
     group.lineCount++;
   }else{
     const group={kind:'existing',item,price:round(cost),
       quantityConfirmed:row.quantityConfirmed===true,lineCount:1};
     grouped.set(item.id,group);
     pending.push(group);
   }
 }
 if(!pending.length)throw Error('Choisir au moins une ligne à importer.');
 // Toutes les validations précèdent les mutations : échec = aucune dépense fantôme.
 const now=new Date().toISOString(),adjustments=[];
 for(const row of pending){
   if(row.kind==='extra'){
     month.extraExpenses.push({id:'ticket-extra-'+receipt.fingerprint+'-'+month.extraExpenses.length,
       label:row.label,supplier,amount:row.price,date:receipt.date||now.slice(0,10),receiptId:receipt.fingerprint});
   }else{
     markBought(month,row.item,true,row.price);
     const found=row.item.kind==='manual'?month.manualItems.find(x=>x.id===row.item.id):
       row.item.kind==='auto'?month.autoPurchases[row.item.id]:month.groceries.find(x=>x.id===row.item.id);
     if(found){found.actualConfirmed=true;found.receiptId=receipt.fingerprint;}
     // On n'apprend pas de prix unitaire si le poids ou le conditionnement du ticket n'a pas été vérifié.
     if(row.item.kind!=='auto'&&row.quantityConfirmed)adjustments.push(...learnFromConfirmedPurchase(state,month,row.item,row.price));
   }
 }
 // N'appliquer une remise que si toutes les lignes ont été approuvées et si
 // la remise OCR réconcilie exactement le total imprimé. Jamais de correction implicite.
 const selectedAmount=round(pending.reduce((v,x)=>v+x.price,0));
 const complete=rows.length===receipt.lines.length&&rows.every(r=>!!r.selectedId);
 const reconciles=complete&&receipt.ticketTotal!=null&&
   Math.abs(round(selectedAmount+(receipt.discountTotal||0)-receipt.ticketTotal))<=0.02&&
   Math.abs(round(selectedAmount-receipt.recognizedTotal))<=0.02;
 const appliedDiscount=reconciles&&receipt.discountTotal<0?round(receipt.discountTotal):0;
 if(appliedDiscount){
   month.extraExpenses.push({id:'ticket-discount-'+receipt.fingerprint,
     label:'Remise ou remboursement sur ticket',supplier,
     amount:appliedDiscount,date:receipt.date||now.slice(0,10),receiptId:receipt.fingerprint});
 }
 month.receiptImports.push({fingerprint:receipt.fingerprint,at:now,
   ticketTotal:receipt.ticketTotal,recognizedTotal:receipt.recognizedTotal,
   discountTotal:appliedDiscount,reconciledTotal:round(selectedAmount+appliedDiscount),lineCount:rows.length,
   matched:pending.filter(x=>x.kind==='existing').length,extras:pending.filter(x=>x.kind==='extra').length,
   skipped:rows.length-pending.length});
 return {matched:pending.filter(x=>x.kind==='existing').length,extras:pending.filter(x=>x.kind==='extra').length,
   total:round(selectedAmount+appliedDiscount),discountApplied:appliedDiscount,repriced:adjustments.length};
}
