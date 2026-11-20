import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMonth,newState,allShoppingEntries,finance,markBought,validateImport} from '../model.js';

test('mode sans prix actif par défaut et sauvegarde rétrocompatible',()=>{
 const state=newState();
 assert.equal(state.displayPrices,false);
 assert.equal(validateImport(structuredClone(state)).displayPrices,false);
 const old=structuredClone(state);delete old.displayPrices;
 assert.equal(validateImport(old).displayPrices,false);
 state.displayPrices=true;
 assert.equal(validateImport(structuredClone(state)).displayPrices,true);
});

test('acheter sans prix ne crée pas de dépense fictive',()=>{
 const m=makeMonth(0),item=allShoppingEntries(m).find(x=>!x.bought&&x.estimate!=null);
 assert.ok(item);
 const before=finance(m);
 markBought(m,item,true,null);
 const after=finance(m);
 assert.equal(after.bought,before.bought+1);
 assert.equal(after.paid,0);
 assert.equal(after.unpricedBoughtCount,1);
 assert.equal(after.forecast,before.forecast);
 const stored=m.groceries.find(x=>x.id===item.id);
 assert.equal(stored.actual,null);
 assert.equal(stored.bought,true);
});

test('ajouter un prix réel ultérieurement sans modifier les autres achats',()=>{
 const m=makeMonth(0),entries=allShoppingEntries(m).filter(x=>x.estimate!=null);
 const [a,b]=entries;assert.ok(a&&b);
 markBought(m,a,true,4.25);
 markBought(m,b,true,null);
 assert.equal(finance(m).paid,4.25);
 assert.equal(finance(m).unpricedBoughtCount,1);
 markBought(m,b,true,2.30);
 assert.equal(finance(m).paid,6.55);
 assert.equal(finance(m).unpricedBoughtCount,0);
 markBought(m,b,false,null);
 assert.equal(finance(m).paid,4.25);
});
