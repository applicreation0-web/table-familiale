import {parseReceiptText,recommendReceiptMatches} from './receipt.js';
import {receiptIngredientCategory} from './receipt-stock.js';
const cents=x=>Math.round((Number(x)+Number.EPSILON)*100)/100;
// Préparer SANS MUTATION une importation complète depuis un fichier local
// explicitement choisi : seuls EAN connus + match magasin/semaine sont liés
// au panier, tout le reste est comptabilisé comme hors liste, jamais inventé.
// L'écran de confirmation présente les totaux avant toute écriture.
export function prepareQuickReceipt(text,month,week){
 const parsed=parseReceiptText(text);
 if(parsed.truncatedLines||!parsed.lines.length||
   parsed.ticketTotal==null||parsed.reconciliationGap==null||
   Math.abs(parsed.reconciliationGap)>0.02)
  throw Error('Ticket incomplet : vérifier les colonnes, les remises et le total avant import.');
 const candidates=recommendReceiptMatches(parsed,month,week);
 const rows=candidates.map(x=>({...x,
  selectedId:x.confidence==='code-barres à confirmer'&&x.selectedId?x.selectedId:'extra',
  quantityConfirmed:false
 }));
 const lineTotal=cents(rows.reduce((n,x)=>n+Number(x.amount),0));
 if(Math.abs(cents(lineTotal+(parsed.discountTotal||0)-parsed.ticketTotal))>0.02)
  throw Error('Écart de caisse : le montant payé ne correspond pas aux articles du fichier.');
 const hasSalmon=rows.some(x=>receiptIngredientCategory(x)==='salmon');
 const categories={};
 for(const x of rows){const k=receiptIngredientCategory(x);if(k)categories[k]=(categories[k]||0)+1;}
 return {parsed,rows,
  matched:rows.filter(x=>x.selectedId!=='extra').length,
  extras:rows.filter(x=>x.selectedId==='extra').length,
  hasSalmon,categories,week,
  amount:parsed.ticketTotal,
  expectedNet:cents(lineTotal+(parsed.discountTotal||0)),
  warnings:[
   'Les lignes sans correspondance certifiée sont des dépenses hors liste, pas des produits inventés.',
   'Les quantités des emballages sans poids connu restent à vérifier, même lorsque le total du ticket est exact.',
   'Les viandes halal et achats Dining Solutions sont hors du périmètre de ce ticket.'
  ]
 };
}
