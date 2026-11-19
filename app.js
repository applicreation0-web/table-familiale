import {BASE_MENU, BASE_SHOPPING} from './data.js';
import {shareNativeBackup,downloadWebBackup} from './backup.js';
import {MEAL_INGREDIENTS} from './recipes.js';
import {applyLearnedPrices,learnFromConfirmedPurchase,forgetConfirmedPurchase,priceBookStats} from './pricing.js';
import {parseReceiptText,recommendReceiptMatches,applyReceiptReview} from './receipt.js';
import {compareReceiptToPlan} from './receipt-benchmark.js';
import {captureReceiptText,nativeReceiptAvailable} from './receipt-ocr.js';
import {FAMILY_PLAN} from './meal-plan.js';
import {
 BREAKFASTS, SUPPLIERS, KIND_NAMES, HARD_CEILING, money, period, periodDays, dateISO, clone,
 makeMonth, newState, ingredientChanges, suggestedPurchases, shoppingEntries,
 allShoppingEntries, finance, saveDish, swapDishes, toggleCooked, markBought, markInStock, setBakingWeek, isBakingWeek, weeklyEggSummary, validateImport
} from './model.js';

const STORAGE='table-familiale-github-v2';
const root=document.getElementById('app');
const dialog=document.getElementById('editor');
const toastEl=document.getElementById('toast');
let state;
try{state=validateImport(JSON.parse(localStorage.getItem(STORAGE)));localStorage.setItem(STORAGE,JSON.stringify(state))}catch{state=newState()}
let activeTab='menus', selectedWeek=0, shopMode='week', search='', draft=null, modalType=null, toastTimeout=null, receiptDraft=null;
const icon=(name,size=18)=>{
 const icons={
   calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
   basket:'<path d="M3 10h18l-2 10H5L3 10ZM8 10l4-7 4 7"/>',
   wallet:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M16 14h2"/>',
   chef:'<path d="M7 20v-6a4 4 0 0 1 0-8 5 5 0 0 1 10 0 4 4 0 0 1 0 8v6H7ZM7 17h10"/>',
   check:'<path d="m5 12 4 4L19 6"/>',
   swap:'<path d="m7 7-4 4 4 4M3 11h15M17 17l4-4-4-4M21 13H6"/>',
   pen:'<path d="m4 20 4-1 12-12-3-3L5 16l-1 4ZM15 6l3 3"/>',
   plus:'<path d="M12 5v14M5 12h14"/>',
   left:'<path d="m15 18-6-6 6-6"/>',right:'<path d="m9 18 6-6-6-6"/>',
   leaf:'<path d="M4 20c1-9 6-16 17-17-1 11-8 17-17 17Zm0 0c5-6 10-10 16-13"/>',
   fish:'<path d="M21 12c-4 5-10 7-16 0 6-7 12-5 16 0ZM5 12 2 7v10l3-5Z"/><circle cx="16" cy="11" r=".6" fill="currentColor" stroke="none"/>',
   alert:'<path d="m12 3 10 18H2L12 3ZM12 9v5M12 17h.01"/>',
   download:'<path d="M12 3v13m-5-5 5 5 5-5M4 19h16"/>',
   upload:'<path d="M12 21V8m-5 5 5-5 5 5M4 5h16"/>',
   close:'<path d="M5 5 19 19M19 5 5 19"/>',
   archive:'<path d="M3 4h18v5H3zM5 9v11h14V9M9 13h6"/>',
   trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v8M14 10v8"/>',
   cart:'<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h2l3 13h12l2-9H6"/>',
   home:'<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
   eye:'<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>'
 };
 return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.check}</svg>`;
};
const esc=(v='')=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const fmt=d=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
const long=d=>d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
function getMonth(){
 const key=String(state.selectedPeriod);
 if(!state.months[key]){state.months[key]=makeMonth(state.selectedPeriod);applyLearnedPrices(state,{onlyPeriod:state.selectedPeriod});}
 return state.months[key];
}
function persist(){localStorage.setItem(STORAGE,JSON.stringify(state));}
function save(){persist();render();}
function flash(msg,type='ok'){
 toastEl.className=type==='error'?'shown danger':'shown';toastEl.textContent=msg;
 clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>toastEl.className='',3600);
}
function activeDates(){return periodDays(state.selectedPeriod)}
function weeks(){return Math.ceil(getMonth().meals.length/7)}
function groupBySupplier(entries){
 const m=new Map();
 for(const e of entries){const group=m.get(e.supplier)||[];group.push(e);m.set(e.supplier,group)}
 return [...m];
}
function render(){
 const month=getMonth(), f=finance(month),days=activeDates(),dates=period(state.selectedPeriod);
 if(selectedWeek>=weeks())selectedWeek=weeks()-1;
 const n=month.meals.length, countProtein=month.meals.filter(m=>m.kind!=='V').length;
 document.title='Table Familiale · '+dates.start.toLocaleDateString('fr-FR',{month:'short',year:'numeric'});
 root.innerHTML=`<div class="topbar"><div class="brand"><span class="brand-icon">${icon('chef',20)}</span><strong>TABLE FAMILIALE</strong></div><span class="top-family">5 personnes · repas halal</span></div>
 <main class="app">
 <header class="intro"><div class="intro-copy"><span class="overline">CARNET DE MENUS & COURSES</span><h1>Le plaisir de <em>bien s'organiser.</em></h1><p>Les repas de toute la famille, les courses de la semaine et le budget maîtrisé.</p></div>
 <div class="period-switch"><button class="icon-button" data-action="previous-period" ${state.selectedPeriod===0?'disabled':''} aria-label="Mois précédent">${icon('left')}</button><span><small>Période suivie</small><b>${fmt(dates.start)} — ${fmt(dates.end)} ${dates.end.getFullYear()}</b></span><button class="icon-button" data-action="next-period" aria-label="Mois suivant">${icon('right')}</button></div></header>
 <section class="summary-grid" aria-label="Budget et progression"><div class="budget-card"><div class="budget-heading"><span>${icon('wallet',18)} Budget mensuel · plafond strict</span><span class="budget-pill">Maximum ${money(HARD_CEILING)}</span></div><div class="budget-number">${money(f.paid)} <small>dépensés</small></div><div class="track"><div style="width:${Math.min(100,100*f.paid/month.budget)}%"></div></div><div class="budget-bottom"><span>Prévision <b>${money(f.forecast)}</b></span><span class="${f.forecastHeadroom<0?'budget-warning':'budget-safe'}">${f.forecastHeadroom<0?'Dépassement':'Marge'} <b>${money(Math.abs(f.forecastHeadroom))}</b></span></div></div>
 <div class="stat"><div class="stat-icon">${icon('chef',22)}</div><strong>${f.cooked}<small> / ${n}</small></strong><span>journées cuisinées</span></div>
 <div class="stat"><div class="stat-icon">${icon('basket',22)}</div><strong>${f.bought}<small> / ${f.total}</small></strong><span>courses enregistrées</span></div></section>
 <div class="meta"><span>${icon('fish',16)} ${countProtein} jours viande ou poisson</span><span>${icon('leaf',16)} ${n-countProtein} journées végétariennes</span><span>1 plat africain / semaine · 10 portions sur 2 jours</span></div>
 ${f.unknownCount?`<div class="banner caution">${icon('alert')} <span>${f.unknownCount} produit(s) ajouté(s) sans prix : la prévision du budget est incomplète. Renseigne leur prix dans « Courses ».</span></div>`:''}
  ${f.forecast>HARD_CEILING?`<div class="banner caution">${icon('alert')} <span><b>Plafond strict de ${money(HARD_CEILING)} dépassé de ${money(f.forecast-HARD_CEILING)}.</b> Ne validez pas le panier avant d'avoir réajusté les achats ou vérifié les prix réels.</span></div>`:f.unknownCount?`<div class="banner caution">${icon('alert')} <span>Prévision inférieure à ${money(HARD_CEILING)}, mais impossible de confirmer la marge : des prix manquent.</span></div>`:f.forecastHeadroom<20?`<div class="banner caution">${icon('alert')} <span><b>Prévision ${money(f.forecast)} · marge fragile ${money(f.forecastHeadroom)}.</b> Les prix M&S, les conditionnements et les frais de livraison des noix bio doivent être confirmés avant achat.</span></div>`:`<div class="banner success">${icon('check')} <span><b>Prévision sous ${money(HARD_CEILING)} :</b> marge ${money(f.forecastHeadroom)}. Vérifier les tarifs à la commande.</span></div>`}
  ${month.reconcileWarnings?.length?`<div class="banner caution">${icon('alert')} <span>${month.reconcileWarnings.length} point(s) de réconciliation (achats, recettes ou stock). Vérifiez dans la sauvegarde avant de racheter des produits.</span></div>`:''}
 <nav class="tabs" aria-label="Sections">${[['menus','calendar','Menus'],['courses','basket','Courses'],['depenses','wallet','Dépenses'],['suivi','archive','Suivi']].map(([id,ico,label])=>`<button class="tab ${activeTab===id?'active':''}" data-action="tab" data-tab="${id}" aria-current="${activeTab===id?'page':'false'}">${icon(ico,18)}<span>${label}</span></button>`).join('')}</nav>
 <div id="screen">${activeTab==='menus'?renderMenus(month,days):activeTab==='courses'?renderCourses(month):activeTab==='depenses'?renderFinance(month,f):renderHistory(month,f)}</div>
 <footer>Table Familiale · Prix M&S indicatifs · Pour les enfants : noix finement moulues · Données conservées sur cet appareil · Export JSON conseillé avant désinstallation</footer>
 </main>`;
}
function weekHeader(month,months=false){
 const dayFrom=selectedWeek*7, dayTo=Math.min(month.meals.length-1,dayFrom+6),dates=activeDates();
 return `<div class="week-bar"><button class="icon-button outline" data-action="previous-week" ${selectedWeek===0?'disabled':''} aria-label="Semaine précédente">${icon('left')}</button><span><b>Semaine ${selectedWeek+1} · ${fmt(dates[dayFrom])} – ${fmt(dates[dayTo])}</b><small>${months?'Courses fraîches et épicerie M&S':`${month.meals.slice(dayFrom,dayTo+1).filter(x=>x.cooked).length} / ${dayTo-dayFrom+1} journées préparées`}</small></span><button class="icon-button outline" data-action="next-week" ${selectedWeek>=weeks()-1?'disabled':''} aria-label="Semaine suivante">${icon('right')}</button></div>`;
}
function getBreakfast(month,index){
 const label=BREAKFASTS[index%BREAKFASTS.length];
 if(!isBakingWeek(month,Math.floor(index/7))&&/Gâteau maison|Muffins maison/.test(label))
   return 'Porridge au lait Yeo Valley et fruits';
 return label;
}
function bakingSwitch(month){
 const enabled=isBakingWeek(month,selectedWeek);
 const eggs=weeklyEggSummary(month,selectedWeek);
 return `<div class="baking-switch"><div><strong>Gâteaux ou muffins cette semaine ?</strong><span>Beurre toutes les semaines · 24 œufs maximum avec ou sans pâtisserie. Plats : ${eggs.mealsUsed} œufs ; petit-déjeuner : ${eggs.breakfastEggs} ; disponibles pour pâtisserie : ${eggs.remainder} œufs.${eggs.overCap?' ATTENTION : les repas dépassent le plafond hebdomadaire.':''}</span></div><button class="button ${enabled?'primary':'outline'}" data-action="toggle-baking" aria-pressed="${enabled}">${enabled?'✓ Pâtisserie prévue':'+ Prévoir une pâtisserie'}</button></div>`;
}
function renderMenus(month,dates){
 const from=selectedWeek*7, meals=month.meals.slice(from,from+7);
 return `<div class="section-title"><div><span class="overline">MENU PROPOSÉ</span><h2>Les plats de la semaine</h2><p>Un plat africain par semaine : 10 portions cuisinées pour cinq personnes, une fois par jour pendant deux jours. Autres repas variés.</p></div><button class="button outline" data-action="goto-shopping">${icon('basket',17)} Liste M&S</button></div>
 ${weekHeader(month)}${bakingSwitch(month)}<div class="meal-grid">${meals.map((dish,i)=>{
 const j=from+i, date=dates[j],kind=dish.kind==='V'?'green':'protein';return `<article class="meal-card ${dish.cooked?'is-cooked':''}"><div class="day"><strong>${date.getDate()}</strong><small>${date.toLocaleDateString('fr-FR',{weekday:'short',month:'short'})}</small></div>
 <div class="meal-main"><div class="tags"><span class="tag ${kind}">${esc(KIND_NAMES[dish.kind]||'Plat')}</span>${dish.african?'<span class="tag protein">Africain</span>':''}${dish.batchRole==='prepare'?'<span class="tag">2 jours · 1 cuisson</span>':''}${dish.batchRole==='reheat'?'<span class="tag">Réchauffage</span>':''}${dish.cooked?'<span class="tag cooked">✓ Cuisiné</span>':''}</div><h3>${esc(dish.name)}</h3><p><b>Petit-déjeuner :</b> ${esc(getBreakfast(month,j))}</p><small class="meal-note">${dish.batchRole==='reheat'?'5 portions du deuxième jour · Aucun achat en double':dish.batchRole==='prepare'?dish.ingredients.length+' ingrédients · 10 portions (5 personnes × 2 jours, 1 repas/jour)':dish.ingredients.length+' ingrédients · 5 portions (1 repas familial)'}${dish.name.startsWith('Yassa au poisson')?' · Riz frais au deuxième service':''}</small></div>
 <div class="meal-buttons"><button class="button mini ${dish.cooked?'light':'outline'}" data-action="cook" data-index="${j}" ${dish.batchRole==='reheat'&&!month.meals[j-1]?.cooked&&!dish.cooked?'disabled':''}>${dish.cooked?(dish.batchRole==='reheat'?'✓ Servi':'✓ Fait'):dish.batchRole==='reheat'?'Réchauffé':icon('chef',15)+' Cuisiné'}</button><button class="icon-button" title="${dish.batchRole==='reheat'?'Modifier depuis le premier jour':'Modifier le plat et ses ingrédients'}" ${dish.batchRole==='reheat'?'disabled':''} data-action="edit-meal" data-index="${j}">${icon('pen',18)}</button><button class="icon-button" title="Échanger deux dates" data-action="swap-meal" data-index="${j}">${icon('swap',18)}</button></div>
 </article>`}).join('')}</div>
 <div class="tip"><span>${icon('basket',20)} Un ingrédient ajouté à un plat apparaît dans les courses à prévoir.</span><button class="button primary" data-action="goto-shopping">Voir les courses ${icon('right',15)}</button></div>`;
}
function renderShopItem(item){
 const name=esc(item.name),kind=item.kind;
 const estimate=item.estimate;
 const learned=item.learnedPrice!=null&&!item.bought&&item.overridePrice==null;
 const planned=estimate==null?`<span class="unknown">Prix manquant</span>`:money(Number(estimate));
 const bought=!!item.bought;
 const priceInput=bought?`<label class="actual-entry"><span>Payé (£)</span><input type="number" step="0.01" min="0" value="${Number(item.actual??estimate??0)}" data-action="actual-change" data-id="${esc(item.id)}" data-kind="${kind}" aria-label="Prix payé ${name}"/></label>`:kind==='auto'&&estimate==null?`<label class="actual-entry"><span>Prévision (£)</span><input type="number" step="0.01" min="0" placeholder="À saisir" data-action="auto-estimate" data-id="${esc(item.id)}" aria-label="Prix prévu ${name}" /></label>`:`<b class="listed-price">${planned}</b>`;
 const actions=kind==='auto'&&!bought?`<button class="icon-button tiny" data-action="skip-auto" data-id="${esc(item.id)}" title="Déjà en stock" aria-label="Déjà en stock : ${name}">${icon('home',15)}</button>`:kind==='auto'?'':!bought?`<button class="icon-button tiny" data-action="mark-stock" data-id="${esc(item.id)}" data-kind="${kind}" title="Déjà à la maison" aria-label="Déjà en stock : ${name}">${icon('home',14)}</button><button class="icon-button tiny" data-action="edit-product" data-id="${esc(item.id)}" data-kind="${kind}" aria-label="Modifier ${name}">${icon('pen',14)}</button><button class="icon-button tiny" data-action="hide-product" data-id="${esc(item.id)}" data-kind="${kind}" aria-label="Retirer ${name}">${icon('close',14)}</button>`:'';
 return `<div class="product ${bought?'checked':''}"><input type="checkbox" class="shop-check" ${bought?'checked':''} data-action="check-product" data-id="${esc(item.id)}" data-kind="${kind}" aria-label="Acheter ${name}"/><div class="product-description"><strong>${name}${item.priceStatus==='provisional'?' <span class="auto-tag">Prix à confirmer</span>':''}${learned?' <span class="auto-tag">Prix réel répercuté</span>':''}${kind==='auto'?' <span class="auto-tag">Nouveau</span>':''}</strong><small>${esc(item.qty)}${kind==='auto'?' · ajouté suite au menu':''}</small>${item.priceStatus==='provisional'?`<small>Tarif, emballage et livraison à confirmer ${item.sourceUrl?`· <a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Voir le produit</a>`:''}</small>`:''}</div><div class="product-right">${priceInput}${actions}</div></div>`;
}
function renderCourses(month){
 const isMonthly=shopMode==='monthly',rows=shoppingEntries(month,selectedWeek,isMonthly);
 const changes=ingredientChanges(month).filter(x=>isMonthly?x.monthOnly:x.week===selectedWeek&&!x.monthOnly);
 const cuts=changes.filter(x=>x.delta<0);
 const hidden=[...month.groceries,...month.manualItems].filter(x=>x.hidden&&(isMonthly?x.purchase==='monthly':x.purchase==='weekly'&&x.week===selectedWeek));
 const skipped=changes.filter(x=>x.delta>0&&month.autoPurchases[x.id]?.skip);
 const total=rows.reduce((a,x)=>a+Number(x.estimate??0),0), unknown=rows.filter(x=>!x.bought&&x.estimate==null).length;
 const group=groupBySupplier(rows.filter(x=>!search||x.name.toLowerCase().includes(search.toLowerCase())));
 return `<div class="section-title"><div><span class="overline">PANIER PRÉVISIONNEL</span><h2>Les courses</h2><p>Viandes halal, cabillaud Dining et deux grands contenants de noix bio en achats groupés ; saumons M&S et ingrédients des quiches répartis par semaine.</p></div><div class="action-line"><button class="button outline" data-action="scan-receipt">${icon('upload',17)} Lire un ticket</button><button class="button outline" data-action="add-product">${icon('plus',17)} Ajouter</button></div></div>
 <div class="choice-row"><button class="button ${!isMonthly?'primary':'outline'}" data-action="shopping-week">Courses M&S · semaine</button><button class="button ${isMonthly?'primary':'outline'}" data-action="shopping-month">Achats groupés · mois</button></div>
 ${isMonthly?`<div class="banner success">${icon('cart',20)} <div><b>Une seule commande au début du mois</b><span>Hubbard, agneau, cuisses halal, un carton de cabillaud Dining, fonio et 2 grands pots de noix bio à remplir. Pour les noix, la vente est en sachets de 500 g : les pots réutilisables ne sont pas fournis. Frais de port provisionnés à 5 £, à confirmer.</span></div></div>`:weekHeader(month,true)+bakingSwitch(month)}
 ${cuts.length?`<div class="banner caution">${icon('alert')} <div><b>Ingrédients moins nécessaires après modification</b><span>${cuts.map(x=>`${esc(x.name)} (−${x.quantity} ${esc(x.unit)})`).join(' · ')}. Vérifie si tu peux réduire l'achat initial, sans perdre les produits déjà achetés.</span></div></div>`:''}
 <div class="shopping-tools"><input id="search-products" placeholder="Rechercher un ingrédient..." value="${esc(search)}" aria-label="Rechercher un ingrédient"/><span>${rows.filter(x=>x.bought).length}/${rows.length} achetés</span></div>
 ${group.length?group.map(([shop,list])=>`<section class="shop-panel"><header><strong>${esc(shop)}</strong><span>${money(list.reduce((s,i)=>s+Number(i.estimate??0),0))} prévus</span></header><div class="product-list">${list.map(renderShopItem).join('')}</div></section>`).join(''):`<div class="empty">Aucun produit correspondant.</div>`}
 ${hidden.length||skipped.length?`<details class="dismissed"><summary>Déjà en stock ou retirés (${hidden.length+skipped.length}) — rétablir</summary>${hidden.map(x=>`<div><span>${x.inStock?'Déjà en stock · ':'Retiré · '}${esc(x.name)} · ${esc(x.qty)}</span><button class="button outline small" data-action="restore-product" data-id="${esc(x.id)}">Rétablir</button></div>`).join('')}${skipped.map(x=>`<div><span>${esc(x.name)} · ${x.quantity} ${esc(x.unit)}</span><button class="button outline small" data-action="restore-auto" data-id="${esc(x.id)}">Rétablir</button></div>`).join('')}</details>`:''}
 <div class="shop-bottom"><span>Prix indicatifs, notamment livraison des noix bio. Les pâtes brisées des deux quiches sont obligatoires et distinctes de la pâtisserie facultative. Vérifiez les coûts réels avant achat.</span><b>Panier affiché : ${money(total)}${unknown?' + '+unknown+' prix à renseigner':''}</b></div>`;
}
function renderFinance(month,f){
 const groups=new Map();
 for(const item of allShoppingEntries(month)){
  const g=groups.get(item.supplier)||{estimate:0,paid:0};g.estimate+=Number(item.estimate??0);if(item.bought)g.paid+=Number(item.actual??item.estimate??0);groups.set(item.supplier,g);
 }
 for(const extra of month.extraExpenses){const g=groups.get(extra.supplier)||{estimate:0,paid:0};g.paid+=Number(extra.amount);groups.set(extra.supplier,g)}
 return `<div class="section-title"><div><span class="overline">LES CHIFFRES DU MOIS</span><h2>Dépenses réelles</h2><p>Achats prévus et montants effectivement payés, par magasin.</p></div><button class="button primary" data-action="add-expense">${icon('plus',16)} Dépense</button></div>
 <div class="banner success">${icon('wallet',18)} <span>Prix unitaires confirmés suivis : <b>${priceBookStats(state).series}</b> références. Les prochains achats comparables sont actualisés automatiquement sans toucher aux achats payés.</span></div><div class="finance-grid"><div class="finance-cell"><small>Budget plafond</small><strong>${money(month.budget)}</strong></div><div class="finance-cell"><small>Dépensé</small><strong>${money(f.paid)}</strong></div><div class="finance-cell"><small>Encore à acheter</small><strong>${money(f.unpaid)}</strong></div><div class="finance-cell ${f.forecastHeadroom<0?'critical':''}"><small>Marge prévisionnelle</small><strong>${money(f.forecastHeadroom)}</strong></div></div>
 <div class="budget-adjust"><label for="budget-field">Plafond mensuel (£)</label><input type="number" id="budget-field" min="1" max="900" step="1" value="${month.budget}" /><button class="button outline" data-action="update-budget">Modifier</button><small>Limite stricte : 900 £, non relevable. Ne pas confondre panier estimé et prix définitif.</small></div>
 ${f.unknownCount?`<div class="banner caution">${icon('alert')} ${f.unknownCount} article(s) sans prix. La prévision affichée est un minimum, pas un budget garanti.</div>`:''}
 <h3 class="subheading">Par fournisseur</h3><div class="supplier-grid">${[...groups].map(([shop,g])=>`<div class="supplier-card"><strong>${esc(shop)}</strong><span>${money(g.paid)} payés / ${money(g.estimate)} prévus</span><div class="small-track"><div style="width:${g.estimate?Math.min(100,g.paid/g.estimate*100):0}%"></div></div></div>`).join('')}</div>
 <h3 class="subheading">Tickets rapprochés (${(month.receiptImports||[]).length})</h3><p>Chaque ticket est vérifié avant import. Un ticket identique ne peut pas être ajouté deux fois. Les photos et textes bruts ne sont pas conservés.</p><h3 class="subheading">Dépenses supplémentaires</h3>${month.extraExpenses.length?`<div class="extra-list">${month.extraExpenses.map(x=>`<div><span><b>${esc(x.label)}</b><small>${esc(x.supplier)} · ${esc(x.date)}</small></span><strong>${money(x.amount)}</strong><button class="icon-button tiny" data-action="delete-expense" data-id="${esc(x.id)}" aria-label="Supprimer la dépense">${icon('trash',15)}</button></div>`).join('')}</div>`:'<div class="empty">Pas de dépenses supplémentaires enregistrées.</div>'}`;
}
function renderHistory(month,f){
 const entries=Object.keys(state.months).sort((a,b)=>Number(a)-Number(b));
 return `<div class="section-title"><div><span class="overline">HISTORIQUE FAMILIAL</span><h2>Suivi & sauvegardes</h2><p>Conserve tes listes, tes repas et tes dépenses d'une période à l'autre.</p></div></div>
 <div class="history-grid"><div>${icon('chef',23)}<strong>${f.cooked} / ${f.planned}</strong><small>journées cuisinées</small></div><div>${icon('basket',23)}<strong>${f.bought} / ${f.total}</strong><small>achats cochés</small></div><div>${icon('wallet',23)}<strong>${money(f.paid)}</strong><small>dépensés</small></div></div>
 <section class="archive"><h3>Périodes disponibles</h3>${entries.map(k=>{const item=state.months[k],rng=period(Number(k)),amount=finance(item);return `<div class="archive-line"><span><b>${fmt(rng.start)} — ${fmt(rng.end)} ${rng.end.getFullYear()}</b><small>${amount.cooked} plats cuisinés · ${money(amount.paid)} dépensés</small></span><button class="button ${Number(k)===state.selectedPeriod?'light':'outline'}" data-action="open-period" data-index="${k}">${Number(k)===state.selectedPeriod?'En cours':'Ouvrir'}</button></div>`}).join('')}</section>
 <section class="archive"><h3>Mes données</h3><p>L'application fonctionne sans compte et stocke les données localement sur ton appareil. Pour éviter toute perte, sauvegarde régulièrement un fichier JSON. Tu peux restaurer ce fichier ailleurs.</p><div class="action-line"><button class="button primary" data-action="export">${icon('download',17)} Sauvegarder JSON</button><button class="button outline" data-action="import">${icon('upload',17)} Restaurer JSON</button></div></section>`;
}
function selectOptions(values,selected){return values.map(x=>`<option value="${esc(x)}" ${String(x)===String(selected)?'selected':''}>${esc(x)}</option>`).join('')}
function ingredientFields(){
 if(!draft)return '';
 return draft.ingredients.map((i,j)=>`<div class="ingredient-entry" data-ingredient="${j}"><label class="ingredient-n"><span>Ingrédient</span><input data-field="name" value="${esc(i.name)}" placeholder="ex. persil"/></label><label class="ingredient-q"><span>Quantité</span><input data-field="quantity" type="number" min="0.01" step="0.01" value="${i.quantity}" /></label><label class="ingredient-u"><span>Unité</span><select data-field="unit">${selectOptions(['g','kg','ml','L','pièce','boîte','sachet'],i.unit)}</select></label><label class="ingredient-s"><span>Magasin</span><select data-field="supplier">${selectOptions(SUPPLIERS,i.supplier)}</select></label><label class="ingredient-p"><span>Prix prévu (£)</span><input data-field="price" type="number" step="0.01" min="0" placeholder="facultatif" value="${i.price??''}"/></label><button class="icon-button tiny remove-ing" data-action="remove-ingredient" data-index="${j}" title="Enlever cet ingrédient">${icon('close',16)}</button></div>`).join('');
}
function readIngredientFields(){
 const items=[...dialog.querySelectorAll('[data-ingredient]')];
 if(!draft)return;
 draft.ingredients=items.map(el=>{
  const read=name=>el.querySelector(`[data-field="${name}"]`)?.value;
  return {name:read('name')||'',quantity:Number(read('quantity')||0),unit:read('unit')||'g',supplier:read('supplier')||'M&S',price:read('price')===''?null:Number(read('price'))};
 });
 const name=dialog.querySelector('#dish-name')?.value;const kind=dialog.querySelector('#dish-kind')?.value;
 if(name!=null)draft.name=name;if(kind!=null)draft.kind=kind;
}
function mealBatchIngredients(i,index){const ingredients=clone(MEAL_INGREDIENTS[i]);return getMonth().meals[index].batchRole==='prepare'?ingredients.map(x=>({...x,quantity:x.quantity*2})):ingredients;}
function openDialog(html){dialog.innerHTML=html;if(!dialog.open)dialog.showModal();dialog.scrollTop=0;}
function openMeal(index,swap=false){
 const month=getMonth(),meal=month.meals[index],dates=activeDates();modalType=swap?'swap':'dish';draft={index,name:meal.name,kind:meal.kind,ingredients:clone(meal.ingredients),target:index};
 if(swap){
  openDialog(`<div class="dialog-head"><div><span class="overline">RÉORGANISER</span><h2 id="editor-title">Changer le jour du repas</h2><p>${esc(long(dates[index]))} · ${esc(meal.name)}</p></div><button class="icon-button" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>
  <label class="field"><span>Échanger avec</span><select id="target-day">${month.meals.map((d,i)=>`<option value="${i}" ${i===Math.min(index+1,month.meals.length-1)?'selected':''}>${esc(fmt(dates[i]))} · ${esc(d.name)}</option>`).join('')}</select></label><div class="banner caution">${icon('alert')} Un échange entre semaines met à jour la liste des ingrédients à prévoir. Les plats déjà cuisinés sont protégés.</div><div class="dialog-actions"><button class="button outline" data-action="close-modal">Annuler</button><button class="button primary" data-action="save-swap">Échanger les jours</button></div>`);
 }else{
 openDialog(`<div class="dialog-head"><div><span class="overline">RECETTE MODIFIABLE</span><h2 id="editor-title">Modifier le plat</h2><p>${esc(long(dates[index]))} · ${meal.batchRole==='prepare'?'10 portions, une fois par jour pendant deux jours':'5 portions pour un repas familial'}</p></div><button class="icon-button" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>
 <div class="edit-body"><label class="field"><span>Partir d'une recette du programme</span><select id="template-choice"><option value="custom">Plat actuel / personnalisé</option>${BASE_MENU.map((m,i)=>![12,20].includes(i)?`<option value="${i}">${esc(m.name)}</option>`:'').join('')}<option value="quiche-salmon">${esc(FAMILY_PLAN[12].name)}</option><option value="quiche-spinach">${esc(FAMILY_PLAN[20].name)}</option></select></label>
 <div class="edit-main"><label class="field"><span>Nom du plat</span><input id="dish-name" value="${esc(draft.name)}" /></label><label class="field"><span>Type</span><select id="dish-kind">${Object.entries(KIND_NAMES).map(([v,n])=>`<option value="${v}" ${v===draft.kind?'selected':''}>${esc(n)}</option>`).join('')}</select></label></div>
 <div class="ingredient-heading"><h3>Ingrédients du plat</h3><button class="button outline small" data-action="add-ingredient">${icon('plus',15)} Ajouter un ingrédient</button></div><div id="ingredient-rows">${ingredientFields()}</div>
 <div class="banner caution">${icon('alert')} L'ajout ou la suppression d'un ingrédient modifie les besoins à acheter. Un prix non renseigné déclenche une alerte budget.</div></div><div class="dialog-actions"><button class="button outline" data-action="close-modal">Annuler</button><button class="button primary" data-action="save-dish">Enregistrer le plat</button></div>`);
 }
}
function openProduct(item=null){
 modalType='product';draft={id:item?.id||null,kind:item?.kind||'manual',name:item?.name||'',qty:item?.qty||'',price:item?.estimate??null,supplier:item?.supplier||'M&S',purchase:item?.purchase|| (shopMode==='monthly'?'monthly':'weekly'),week:item?.week??selectedWeek};
 openDialog(`<div class="dialog-head"><div><span class="overline">LISTE DE COURSES</span><h2 id="editor-title">${item?'Modifier un produit':'Ajouter un ingrédient ou produit'}</h2><p>Produits absents de la liste de base inclus.</p></div><button class="icon-button" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>
 <div class="field-grid"><label class="field"><span>Nom</span><input id="product-name" value="${esc(draft.name)}" placeholder="Ex. coriandre fraîche"/></label><label class="field"><span>Quantité / nombre</span><input id="product-qty" value="${esc(draft.qty)}" placeholder="Ex. 2 bouquets / 500 g" /></label><label class="field"><span>Prix estimé (£)</span><input id="product-price" type="number" step="0.01" min="0" value="${draft.price??''}" placeholder="ex. 2.50" /></label><label class="field"><span>Magasin</span><select id="product-supplier">${selectOptions(SUPPLIERS,draft.supplier)}</select></label><label class="field"><span>À acheter</span><select id="product-purchase"><option value="weekly" ${draft.purchase==='weekly'?'selected':''}>Avec les courses M&S de la semaine</option><option value="monthly" ${draft.purchase==='monthly'?'selected':''}>En début de mois</option></select></label></div>
 <div class="dialog-actions"><button class="button outline" data-action="close-modal">Annuler</button><button class="button primary" data-action="save-product">Enregistrer</button></div>`);
}
function openExpense(){
 modalType='expense';openDialog(`<div class="dialog-head"><div><span class="overline">DÉPENSE IMPRÉVUE</span><h2 id="editor-title">Ajouter une dépense</h2><p>Pour les achats hors liste.</p></div><button class="icon-button" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>
 <div class="field-grid"><label class="field"><span>Intitulé</span><input id="expense-label" placeholder="Ex. fruits en supplément" /></label><label class="field"><span>Prix payé (£)</span><input id="expense-amount" type="number" min="0.01" step="0.01" placeholder="0.00" /></label><label class="field"><span>Fournisseur</span><select id="expense-shop">${selectOptions(SUPPLIERS,'M&S')}</select></label><label class="field"><span>Date</span><input id="expense-date" type="date" value="${dateISO(new Date())}" /></label></div>
 <div class="dialog-actions"><button class="button outline" data-action="close-modal">Annuler</button><button class="button primary" data-action="save-expense">Ajouter</button></div>`);
}
function setAutoEstimate(itemId,cost){
 const month=getMonth();month.autoPurchases[itemId]={...month.autoPurchases[itemId],plannedPrice:cost};save();
}

function openReceiptDialog(){
 receiptDraft=null;modalType='receipt';
 openDialog(`<div class="dialog-head"><div><span class="overline">TICKET DE CAISSE</span><h2 id="editor-title">Lire et rapprocher un ticket</h2><p>Aucun achat n’est ajouté sans confirmation. Le texte du ticket reste temporaire et local.</p></div><button class="icon-button" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>
 <div class="edit-body">
 <div class="action-line"><button class="button primary" data-action="photo-receipt" ${nativeReceiptAvailable(window.Capacitor)?'':'disabled title="Photo disponible dans la nouvelle APK Android"'}>${icon('upload',16)} Photo ou galerie Android</button></div>
 <p>Sur le site web, ou si la photo n’est pas lisible, coller le texte du ticket ci-dessous. Le total imprimé ne sera jamais compté comme un article.</p>
 <label class="field"><span>Texte reconnu (facultatif si photo Android)</span><textarea id="receipt-text" rows="8" placeholder="M&S Strawberries 4.00&#10;Red grapes 2.65&#10;TOTAL 6.65"></textarea></label>
 <div class="banner caution">Vérifiez les prix, les remises, les quantités, le magasin et le total. Les tickets flous ou les lignes ambiguës ne sont pas validés automatiquement.</div>
 </div><div class="dialog-actions"><button class="button outline" data-action="close-modal">Annuler</button><button class="button primary" data-action="parse-receipt">Analyser le ticket</button></div>`);
}
function showReceiptReview(parsed){
 if(parsed.truncatedLines>0)
   throw Error('Ticket trop long : '+parsed.truncatedLines+' ligne(s) non affichée(s). Aucun import autorisé.');
 const month=getMonth();
 if(Object.values(state.months).some(p=>(p.receiptImports||[]).some(x=>x.fingerprint===parsed.fingerprint)))
   throw Error('Ce ticket est déjà enregistré dans cette période.');
 if(!parsed.lines.length)throw Error('Aucune ligne avec description et prix reconnue. Vérifiez le texte ou recommencez la photo.');
 const rows=recommendReceiptMatches(parsed,month,selectedWeek);
 receiptDraft={parsed,rows};
 const entries=allShoppingEntries(month).filter(x=>!x.bought&&!x.hidden&&!x.inStock);
 const preferred=entries.filter(x=>x.purchase==='monthly'||x.week===selectedWeek);
 const shopOptions=selectOptions(SUPPLIERS,'M&S');
 const comparisons=compareReceiptToPlan(parsed,month,selectedWeek);
 const benchmarkHtml=comparisons.length?'<div class="receipt-benchmark"><h3>Quantités réelles / prévisions</h3>'+
   comparisons.map(x=>'<div class="receipt-line" style="padding:8px 0"><strong>'+esc(x.label)+'</strong><span>Ticket : '+x.actualQty+' '+esc(x.unit)+' · '+money(x.actualPrice)+
     (x.plannedQty!=null?' · Prévu : '+x.plannedQty+' '+esc(x.unit):' · Prévision sans correspondance')+
     (x.recipeNeed!=null?' · Recettes : '+x.recipeNeed+' kg':'')+
     (x.delta!=null&&x.delta!==0?' <strong>— Écart à vérifier</strong>':'')+
     '</span></div>').join('')+
   '<p>Une quantité achetée inférieure à la recette ne doit pas être automatiquement considérée comme suffisante. Vérifier le stock ou modifier les menus.</p></div>':'';

 const listHtml=rows.map((r,i)=>{
   const prioritized=r.candidates.map(x=>x.id);
   const selected=[...new Set([...prioritized,...preferred.map(x=>x.id)])];
   const options=selected.map(id=>{
     const item=entries.find(x=>x.id===id);
     if(!item)return '';
     const label=item.name+' · '+(item.purchase==='monthly'?'mois':'semaine '+(item.week+1));
     return `<option value="${esc(id)}" ${r.selectedId===id?'selected':''}>${esc(label)}</option>`;
   }).join('');
   return `<div class="receipt-line" style="display:grid;gap:8px;padding:12px 0;border-bottom:1px solid var(--line,#ddd)">
    <label><b>${esc(r.label)}</b> <small>· ${esc(r.confidence)}</small></label>
    <div class="field-grid"><label class="field"><span>Montant payé (£)</span><input data-receipt-amount="${i}" type="number" min="0" step="0.01" value="${r.amount.toFixed(2)}" /></label>
    <label class="field"><span>Rapprocher de</span><select data-receipt-select="${i}"><option value="">Ignorer cette ligne</option><option value="extra">Nouvelle dépense hors liste</option>${options}</select></label></div>
    <label style="display:flex;gap:8px;align-items:center"><input data-receipt-qty="${i}" type="checkbox" /> <span>J’ai vérifié que la quantité/format achetés correspondent au produit choisi (autorise le recalcul du prix futur)</span></label>
   </div>`;
 }).join('');
 openDialog(`<div class="dialog-head"><div><span class="overline">VÉRIFICATION OBLIGATOIRE</span><h2 id="editor-title">Ticket : ${rows.length} lignes reconnues</h2><p>Choisir les articles à enregistrer. Les lignes sans correspondance restent ignorées, sauf si tu sélectionnes « Nouvelle dépense hors liste ».</p></div><button class="icon-button" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>
 <div class="edit-body"><div class="finance-grid"><div class="finance-cell"><small>Montant payé sur le ticket</small><strong>${parsed.ticketTotal==null?'Non trouvé':money(parsed.ticketTotal)}</strong></div><div class="finance-cell"><small>Articles lus</small><strong>${money(parsed.recognizedTotal)}</strong></div><div class="finance-cell"><small>Remises et remboursements</small><strong>${money(parsed.discountTotal||0)}</strong></div><div class="finance-cell"><small>Écart de lecture</small><strong>${parsed.reconciliationGap==null?'À vérifier':money(parsed.reconciliationGap)}</strong></div></div>
 ${benchmarkHtml}
 <p>Vérifiez les quantités achetées et les conditionnements. Plusieurs lignes identiques (par exemple deux boîtes d’œufs) peuvent correspondre au même achat prévu : les montants seront additionnés. Une différence de total n'est jamais corrigée artificiellement.</p><p><b>Attention :</b> « Hors liste » augmente le budget sans retirer un article prévu. Rapprocher les produits du panier lorsqu'ils y figurent pour ne pas les compter deux fois.</p><div class="action-line"><button class="button outline" data-action="receipt-select-extras">Classer les lignes non associées comme hors liste</button></div>
 <label class="field"><span>Magasin du ticket (pour dépenses hors liste)</span><select id="receipt-supplier">${shopOptions}</select></label>
 ${listHtml}
 </div><div class="dialog-actions"><button class="button outline" data-action="close-modal">Annuler</button><button class="button primary" data-action="commit-receipt">Confirmer les lignes sélectionnées</button></div>`);
}
async function readReceiptPhoto(){
 try{
   flash('Lecture locale du ticket en cours…');
   const text=await captureReceiptText(window.Capacitor);
   const parsed=parseReceiptText(text);
   if(!parsed.lines.length){
     openReceiptDialog();
     const field=dialog.querySelector('#receipt-text');
     if(field)field.value=text;
     flash('Texte extrait mais aucun article isolé : corriger le texte reconnu, puis analyser.','error');
     return;
   }
   showReceiptReview(parsed);
 }catch(e){flash(e.message||'Lecture photo impossible','error');}
}
function onAction(action,btn){
 const month=getMonth(),id=btn.dataset.id,index=Number(btn.dataset.index);
 switch(action){
 case 'scan-receipt':openReceiptDialog();break;
 case 'photo-receipt':void readReceiptPhoto();break;
 case 'parse-receipt':{
   try{showReceiptReview(parseReceiptText(dialog.querySelector('#receipt-text')?.value||''))}
   catch(err){flash(err.message,'error')}
   break;
 }
 case 'receipt-select-extras':{
   let count=0;
   for(const select of dialog.querySelectorAll('[data-receipt-select]')){
     if(select.value===''){select.value='extra';count++;}
   }
   flash(count+' ligne(s) classée(s) hors liste, à contrôler avant confirmation');
   break;
 }
 case 'commit-receipt':{
   try{
     if(!receiptDraft)throw Error('Aucun ticket en cours');
     const chosen=receiptDraft.rows.map((row,i)=>{
       const input=dialog.querySelector('[data-receipt-amount="'+i+'"]');
       const sel=dialog.querySelector('[data-receipt-select="'+i+'"]');
       if(!sel||!input)throw Error('Formulaire de ticket incomplet');
       if(sel.value&&input.value.trim()==='')throw Error('Prix payé manquant à la ligne '+(i+1));
       const qtyCheck=dialog.querySelector('[data-receipt-qty="'+i+'"]');
       return {...row,selectedId:sel.value,amount:input.value===''?0:Number(input.value),quantityConfirmed:!!qtyCheck?.checked};
     });
     const supplier=dialog.querySelector('#receipt-supplier')?.value||'M&S';
     const result=applyReceiptReview(state,month,receiptDraft.parsed,chosen,{supplier});
     receiptDraft=null;dialog.close();save();
     flash(result.matched+' article(s), '+result.extras+' dépense(s) hors liste · '+money(result.total)+' réconciliés');
   }catch(err){flash(err.message,'error')}
   break;
 }
 case 'tab':activeTab=btn.dataset.tab;search='';render();break;
 case 'goto-shopping':activeTab='courses';shopMode='week';render();break;
 case 'next-period':state.selectedPeriod++;selectedWeek=0;activeTab='menus';save();break;
 case 'previous-period':if(state.selectedPeriod>0){state.selectedPeriod--;selectedWeek=0;activeTab='menus';save()}break;
 case 'open-period':state.selectedPeriod=index;selectedWeek=0;activeTab='menus';save();break;
 case 'previous-week':selectedWeek=Math.max(0,selectedWeek-1);render();break;
 case 'next-week':selectedWeek=Math.min(weeks()-1,selectedWeek+1);render();break;
 case 'cook':{try{const cooked=toggleCooked(month,index);save();flash(cooked?(month.meals[index].batchRole==='reheat'?'Repas réchauffé et servi':'Préparation validée'):'Validation retirée')}catch(err){flash(err.message,'error')}break;}
 case 'edit-meal':openMeal(index);break;
 case 'swap-meal':openMeal(index,true);break;
 case 'shopping-month':shopMode='monthly';search='';render();break;
 case 'shopping-week':shopMode='week';search='';render();break;
 case 'toggle-baking':setBakingWeek(month,selectedWeek,!isBakingWeek(month,selectedWeek));save();flash('Liste et petits-déjeuners actualisés');break;
 case 'mark-stock':{const x=allShoppingEntries(month).find(x=>x.id===id);if(x){try{markInStock(month,x,true);save();flash('Produit déjà en stock : achat évité')}catch(err){flash(err.message,'error')}}break;}
 case 'add-product':openProduct();break;
 case 'edit-product':{const item=allShoppingEntries(month).find(x=>x.id===id);if(item)openProduct(item);break;}
 case 'hide-product':{
  const group=btn.dataset.kind==='manual'?month.manualItems:month.groceries;
  const x=group.find(i=>i.id===id);if(x&&!x.bought){x.hidden=true;save();flash('Produit retiré du panier prévisionnel');}break;
 }
 case 'skip-auto':month.autoPurchases[id]={...month.autoPurchases[id],skip:true};save();flash('Produit déjà en stock : achat évité');break;
 case 'restore-product':{const x=[...month.groceries,...month.manualItems].find(x=>x.id===id);if(x){x.hidden=false;x.inStock=false;save();flash('Produit rétabli');}break;}
 case 'restore-auto':month.autoPurchases[id]={...month.autoPurchases[id],skip:false};save();flash('Ingrédient rétabli');break;
 case 'add-expense':openExpense();break;
 case 'delete-expense':month.extraExpenses=month.extraExpenses.filter(x=>x.id!==id);save();break;
 case 'update-budget':{const val=Number(document.querySelector('#budget-field')?.value);if(val>0&&val<=HARD_CEILING){month.budget=val;save();}else flash('La limite absolue est de 900 £','error');break;}
 case 'close-modal':dialog.close();draft=null;receiptDraft=null;break;
 case 'save-swap':{
  try{const target=Number(dialog.querySelector('#target-day').value);swapDishes(month,draft.index,target);dialog.close();save();flash('Repas échangés, besoins de courses actualisés');}catch(err){flash(err.message,'error')}break;
 }
 case 'add-ingredient':readIngredientFields();draft.ingredients.push({name:'',quantity:100,unit:'g',supplier:'M&S',price:null});dialog.querySelector('#ingredient-rows').innerHTML=ingredientFields();break;
 case 'remove-ingredient':readIngredientFields();draft.ingredients.splice(index,1);dialog.querySelector('#ingredient-rows').innerHTML=ingredientFields();break;
 case 'save-dish':{
   try{readIngredientFields();saveDish(month,draft.index,draft);dialog.close();save();flash('Recette et besoins de courses mis à jour');}catch(err){flash(err.message,'error')}break;
 }
 case 'save-product':{
  const name=dialog.querySelector('#product-name').value.trim(),qty=dialog.querySelector('#product-qty').value.trim(),priceText=dialog.querySelector('#product-price').value;
  const price=priceText===''?null:Number(priceText),supplier=dialog.querySelector('#product-supplier').value,purchase=dialog.querySelector('#product-purchase').value;
  if(!name||!qty||price!=null&&(!Number.isFinite(price)||price<0)){flash('Renseigne nom, quantité et un prix valide.','error');break;}
  if(draft?.id){const list=draft.kind==='base'?month.groceries:month.manualItems;const item=list.find(x=>x.id===draft.id);if(item){item.name=name;item.overrideQty=qty;item.qty=qty;item.overridePrice=price;item.price=price;item.supplier=supplier;item.purchase=purchase;item.week=purchase==='weekly'?selectedWeek:-1;}}
  else month.manualItems.push({id:'manual-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),name,qty,price,supplier,purchase,week:selectedWeek,bought:false,actual:null,hidden:false});
  dialog.close();save();flash('Produit ajouté à la liste de courses');break;
 }
 case 'save-expense':{
  const label=dialog.querySelector('#expense-label').value.trim(),amount=Number(dialog.querySelector('#expense-amount').value),supplier=dialog.querySelector('#expense-shop').value,date=dialog.querySelector('#expense-date').value;
  if(!label||!(amount>0)){flash('Intitulé et prix positif requis.','error');break;}
  month.extraExpenses.push({id:'expense-'+Date.now(),label,amount,supplier,date});dialog.close();save();flash('Dépense enregistrée');break;
 }
 case 'export':{
   const filename='table-familiale-sauvegarde-'+dateISO(new Date())+'.json';
   const json=JSON.stringify(state,null,2);
   if(window.Capacitor?.isNativePlatform?.()){
     void shareNativeBackup(json,filename,window.Capacitor)
       .then(()=>flash('Choisis où conserver la sauvegarde JSON'))
       .catch(err=>flash('Sauvegarde Android non exportée : '+err.message,'error'));
   }else{
     try{downloadWebBackup(json,filename);flash('Sauvegarde téléchargée')}
     catch(err){flash('Sauvegarde non exportée : '+err.message,'error')}
   }
   break;
 }
 case 'import':{const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',async()=>{try{const file=input.files?.[0];if(!file)return;const raw=validateImport(JSON.parse(await file.text()));state=raw;selectedWeek=0;activeTab='suivi';save();flash('Sauvegarde restaurée');}catch(e){flash('Fichier non compatible : '+e.message,'error')}});input.click();break;}
 }
}
root.addEventListener('click',e=>{
 const btn=e.target.closest('button[data-action]');if(btn){e.preventDefault();onAction(btn.dataset.action,btn)}
});
dialog.addEventListener('click',e=>{
 if(e.target===dialog){dialog.close();return;}
 const btn=e.target.closest('button[data-action]');if(btn){e.preventDefault();onAction(btn.dataset.action,btn)}
});
dialog.addEventListener('change',e=>{
 if(e.target.id==='template-choice'&&e.target.value!=='custom'){
  readIngredientFields();
   const choice=e.target.value;
   if(choice==='quiche-salmon'||choice==='quiche-spinach'){
     const template=FAMILY_PLAN[choice==='quiche-salmon'?12:20];
     draft.name=template.name;draft.kind=template.kind;
     const mult=getMonth().meals[draft.index].batchRole==='prepare'?2:1;
     draft.ingredients=clone(template.ingredients).map(x=>({...x,quantity:x.quantity*mult}));
   }else{
     const i=Number(choice);draft.name=BASE_MENU[i].name;draft.kind=BASE_MENU[i].kind;
     draft.ingredients=mealBatchIngredients(i,draft.index);
   }
  dialog.querySelector('#dish-name').value=draft.name;dialog.querySelector('#dish-kind').value=draft.kind;dialog.querySelector('#ingredient-rows').innerHTML=ingredientFields();
 }
});
root.addEventListener('change',e=>{
 const el=e.target;
 if(el.id==='search-products'){search=el.value;render();return}
 if(!el.dataset?.action)return;
 const month=getMonth(),item=allShoppingEntries(month).find(x=>x.id===el.dataset.id);
 if(el.dataset.action==='check-product'){
  if(!item)return;
  try{
   let cost=item.actual??item.estimate,manuallyEntered=false;
   if(el.checked&&cost==null){const answer=prompt(`Prix payé pour « ${item.name} » en £ ?`);if(answer===null){el.checked=false;return;}cost=Number(answer);manuallyEntered=true;}
   if(!el.checked&&item.actualConfirmed)forgetConfirmedPurchase(state,month,item);
   markBought(month,item,el.checked,el.checked?Number(cost):null);
   if(el.checked&&manuallyEntered){
     const found=item.kind==='auto'?month.autoPurchases[item.id]:
       (item.kind==='manual'?month.manualItems:month.groceries).find(x=>x.id===item.id);
     if(found)found.actualConfirmed=true;
     if(item.kind!=='auto')learnFromConfirmedPurchase(state,month,item,Number(cost));
   }
   save();
  }catch(err){el.checked=!el.checked;flash(err.message,'error')}
 }
 if(el.dataset.action==='actual-change'){
  if(item){try{
    if(el.value.trim()==='')throw Error('Saisis le montant réellement payé.');
    const price=Number(el.value);
    markBought(month,item,true,price);
    const found=item.kind==='auto'?month.autoPurchases[item.id]:
      (item.kind==='manual'?month.manualItems:month.groceries).find(x=>x.id===item.id);
    if(found)found.actualConfirmed=true;
    if(item.kind!=='auto')learnFromConfirmedPurchase(state,month,item,price);
    save();
  }catch(err){flash(err.message,'error')}}
 }
 if(el.dataset.action==='auto-estimate'){
  const cost=Number(el.value);if(Number.isFinite(cost)&&cost>=0)setAutoEstimate(el.dataset.id,cost);
 }
});
root.addEventListener('input',e=>{
 if(e.target.id==='search-products'){
  const cursor=e.target.selectionStart;search=e.target.value;
  // Ne rerendre que les produits, tout en gardant le curseur du champ de recherche.
  render();const input=document.getElementById('search-products');if(input){input.focus();input.setSelectionRange(cursor,cursor)}
 }
});
window.addEventListener('storage',e=>{
 if(e.key===STORAGE){try{state=validateImport(JSON.parse(e.newValue));render();flash('Données mises à jour depuis un autre onglet')}catch{}}
});
render();
// Installation et accès hors connexion : le stockage des dépenses reste local.
if('serviceWorker' in navigator && location.protocol!=='file:'){
 window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
