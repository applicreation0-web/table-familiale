import { BASE_MENU } from './data.js';
import { MEAL_INGREDIENTS } from './recipes.js';

// Un seul plat africain par semaine : 10 portions (5 convives × 1 repas par jour × 2 jours).
// Le deuxième jour est une consommation des restes : aucun ingrédient n'est racheté.
const copy = value => JSON.parse(JSON.stringify(value));
const ingredient = (name, quantity, unit='g', supplier='M&S') => ({name,quantity,unit,supplier,price:null});
function single(source,custom={}){
  const dish=BASE_MENU[source];
  return {name:custom.name||dish.name,kind:custom.kind||dish.kind,
    ingredients:copy(custom.ingredients||MEAL_INGREDIENTS[source]),
    african:false,batchRole:null,servings:null,mealsPerDay:null};
}
// Quatre paquets de quatre filets M&S sont portionnés pour trois services de
// cinq personnes. Le 16e filet reste en réserve au congélateur.
function salmon(source,name){
  const ingredients=MEAL_INGREDIENTS[source].map(x=>x.name==='Cabillaud'?
    {...x,name:'Saumon frais',quantity:650,supplier:'M&S'}:x);
  return single(source,{name,kind:'S',ingredients});
}
// Trois plats de 5 filets à environ 130 g ; un filet est réservé pour la quiche.
// La quiche utilise quatre filets (un restant + trois du cinquième paquet).
const salmonQuiche=single(12,{name:'Grande quiche au saumon frais M&S et pommes de terre',kind:'S',
  ingredients:[
    ingredient('Saumon frais',520,'g','M&S'),
    ingredient('Œufs',6,'pièce'),
    ingredient('Pâte brisée M&S',320),
    ingredient('Pommes de terre',900),
    ingredient('Lait Yeo Valley',200,'ml','Supermarché (Yeo Valley)'),
    ingredient('Fromage',80)
  ]});
const spinachQuiche=single(20,{name:'Grande quiche aux épinards et pommes de terre',kind:'V',
  ingredients:[
    ingredient('Épinards',800),
    ingredient('Œufs',6,'pièce'),
    ingredient('Pâte brisée M&S',320),
    ingredient('Pommes de terre',1100),
    ingredient('Lait Yeo Valley',200,'ml','Supermarché (Yeo Valley)')
  ]});
const smokedSalmon=single(22,{name:'Boulgour aux œufs, poivrons et saumon fumé M&S',kind:'G',
  ingredients:[
    ingredient('Saumon fumé',200,'g','M&S'),
    ingredient('Œufs',5,'pièce'),
    ingredient('Boulgour',350),
    ingredient('Poivrons',800),
    ingredient('Tomates concassées',600)
  ]});
function batch(source,name,kind,custom){
  let ingredients=custom || MEAL_INGREDIENTS[source].map(x=>({...x,quantity:x.quantity*2}));
  ingredients=copy(ingredients);
  return [
    {name,kind,ingredients,african:true,batchRole:'prepare',servings:10,mealsPerDay:1},
    {name,kind,ingredients:[],african:true,batchRole:'reheat',servings:10,mealsPerDay:1}
  ];
}
const riceLamb=MEAL_INGREDIENTS[5].map(x=>({...x,quantity:x.name==='Riz'?1300:x.quantity*2}));
const yassa=MEAL_INGREDIENTS[0].map(x=>({...x,quantity:x.name==='Poulet Hubbard'?2600:x.name==='Riz'?1000:x.quantity*2}));
// Yassa au poisson : 10 portions, soit cinq personnes une fois par jour
// pendant deux jours. 1,8 kg de filets de cabillaud (180 g crus/portion).
// Le riz du second jour doit être cuit frais plutôt que conservé deux jours.
const fishYassa=[
  ingredient('Cabillaud',1800,'g','Dining Solutions'),
  ingredient('Riz',1200),
  ingredient('Oignons',1400),
  ingredient('Citron',6,'pièce'),
  ingredient('Moutarde de Dijon',120)
];
const thiou=[
  ingredient('Poulet Hubbard',2500,'g','Saffron Alley'),
  ingredient('Riz',1000),
  ingredient('Pommes de terre',1400),
  ingredient('Carottes',1300),
  ingredient('Tomates concassées',800),
  ingredient('Oignons',700)
];

export const FAMILY_PLAN = [
  single(6),single(1),salmon(2,'Saumon frais M&S citron, pommes de terre et courgettes'),
  ...batch(3,'Mafé d’agneau, patates douces et fonio','L'),
  single(9),single(14),
  salmon(7,'Saumon frais M&S, tomates, poivrons et boulgour'),single(4),single(8),
  ...batch(5,'Riz à la viande d’agneau, chou et carottes','L',riceLamb),
  salmonQuiche,single(13),
  salmon(17,'Saumon frais M&S citron, carottes et pommes de terre'),single(21),single(29),
  ...batch(0,'Poulet yassa, riz et haricots verts','P',yassa),
  single(19),spinachQuiche,
  single(18),smokedSalmon,single(23),
  ...batch(null,'Yassa au poisson, oignons citronnés et riz','F',fishYassa),
  single(24),single(14),
  single(28),
  ...batch(null,'Thiou au poulet, légumes et riz','P',thiou)
];
if(FAMILY_PLAN.length!==31) throw new Error('Programme familial : 31 jours attendus');
export const familyWeekStats = (meals,week) => {
  const block=meals.slice(week*7,week*7+7);
  return {africanPreparations:block.filter(m=>m.african&&m.batchRole==='prepare').length,
    cooked:block.filter(m=>m.cooked).length};
};
