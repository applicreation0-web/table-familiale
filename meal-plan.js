import { BASE_MENU } from './data.js';
import { MEAL_INGREDIENTS } from './recipes.js';

// Un seul plat africain par semaine : 10 portions (5 convives × 1 repas par jour × 2 jours).
// Le deuxième jour est une consommation des restes : aucun ingrédient n'est racheté.
const copy = value => JSON.parse(JSON.stringify(value));
const ingredient = (name, quantity, unit='g', supplier='M&S') => ({name,quantity,unit,supplier,price:null});
function single(source){
  const dish=BASE_MENU[source];
  return {name:dish.name,kind:dish.kind,ingredients:copy(MEAL_INGREDIENTS[source]),african:false,batchRole:null,servings:null,mealsPerDay:null};
}
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
  ingredient('Cabillaud',1800,'g','JJ Foodservice'),
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
  single(6),single(1),single(2),
  ...batch(3,'Mafé d’agneau, patates douces et fonio','L'),
  single(9),single(14),
  single(7),single(4),single(8),
  ...batch(5,'Riz à la viande d’agneau, chou et carottes','L',riceLamb),
  single(12),single(13),
  single(17),single(21),single(29),
  ...batch(0,'Poulet yassa, riz et haricots verts','P',yassa),
  single(19),single(20),
  single(18),single(22),single(23),
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
