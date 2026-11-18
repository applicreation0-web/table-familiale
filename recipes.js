// Quantités de préparation indicatives : une journée = déjeuner + dîner pour cinq.
// Les ingrédients servent à signaler les changements du menu ; les achats de référence
// proviennent du panier du PDF vérifié à 829,14 £.
const ing = (name, quantity, unit='g', supplier='M&S', price=null) => ({
  name, quantity, unit, supplier, price,
});
const g=(name,q,supplier='M&S')=>ing(name,q,'g',supplier);
const n=(name,q,supplier='M&S')=>ing(name,q,'pièce',supplier);
export const MEAL_INGREDIENTS = [
  [g('Poulet Hubbard',900,'Saffron Alley'),g('Riz',350),g('Haricots verts',500),g('Oignons',500),n('Citron',2)],
  [g('Pommes de terre',1400),g('Brocolis',850),n('Œufs',8),g('Betteraves',400),g('Fromage',120)],
  [g('Cabillaud',900,'JJ Foodservice'),g('Pommes de terre',1300),g('Courgettes',950),g('Carottes',500),n('Citron',1)],
  [g('Agneau',1100,'Saffron Alley'),g('Patates douces',650),g('Carottes',900),g('Fonio',300,'Épicerie africaine'),g('Purée de cacahuètes',160)],
  [g('Poulet Hubbard',900,'Saffron Alley'),g('Pois chiches',600),g('Courgettes',650),g('Carottes',500),g('Tomates concassées',500)],
  [g('Agneau',900,'Saffron Alley'),g('Riz',350),g('Chou blanc',800),g('Carottes',650),g('Oignons',350)],
  [g('Poulet Hubbard',1000,'Saffron Alley'),g('Pommes de terre',1300),g('Carottes',900),g('Courgettes',500)],
  [g('Cabillaud',900,'JJ Foodservice'),g('Tomates concassées',600),g('Poivrons',800),g('Boulgour',350)],
  [n('Œufs',9),g('Épinards',800),g('Betteraves',500),g('Pommes de terre',900),g('Fromage',150)],
  [g('Cuisses de poulet',1000,'Saffron Alley'),g('Poivrons',850),g('Quinoa',350),g('Tomates concassées',650)],
  [g('Niébé',400,'Épicerie africaine'),g('Patates douces',950),g('Carottes',700),g('Courgettes',650)],
  [g('Semoule',350),g('Pois chiches',650),g('Carottes',650),g('Courgettes',650),g('Navets',400)],
  [n('Maquereau en boîte',6),g('Haricots blancs',650),g('Pommes de terre',900),g('Concombre',350)],
  [g('Poulet Hubbard',950,'Saffron Alley'),g('Semoule',400),g('Carottes',800),g('Olives',150),n('Citron',2)],
  [g('Pâtes complètes',450),g('Lentilles',420),g('Tomates concassées',650),g('Courgettes',850)],
  [g('Poulet Hubbard',900,'Saffron Alley'),g('Riz',350),g('Haricots verts',500),g('Oignons',500),n('Citron',2)],
  [g('Brocolis',850),g('Pommes de terre',1400),n('Œufs',8),g('Fromage',120)],
  [g('Cabillaud',900,'JJ Foodservice'),g('Carottes',800),g('Pommes de terre',1250),n('Citron',1)],
  [g('Poulet Hubbard',1000,'Saffron Alley'),g('Carottes',1050),g('Pommes de terre',900)],
  [g('Lentilles',450),g('Épinards',800),n('Œufs',8),g('Concombre',450)],
  [n('Maquereau en boîte',6),g('Pommes de terre',1100),g('Haricots verts',650),g('Betteraves',350)],
  [g('Poulet Hubbard',1000,'Saffron Alley'),g('Pommes de terre',1300),g('Carottes',900),g('Courgettes',500)],
  [g('Cabillaud',900,'JJ Foodservice'),g('Tomates concassées',600),g('Poivrons',800),g('Boulgour',350)],
  [n('Œufs',9),g('Épinards',800),g('Betteraves',500),g('Pommes de terre',900),g('Fromage',150)],
  [g('Cuisses de poulet',1000,'Saffron Alley'),g('Tomates concassées',650),g('Courgettes',800),g('Quinoa',350)],
  [g('Niébé',400,'Épicerie africaine'),g('Patates douces',950),g('Carottes',700),g('Courgettes',650)],
  [g('Semoule',350),g('Pois chiches',650),g('Carottes',650),g('Courgettes',650),g('Navets',400)],
  [n('Maquereau en boîte',6),g('Haricots blancs',650),g('Brocolis',850),g('Pommes de terre',600)],
  [g('Poulet Hubbard',950,'Saffron Alley'),g('Semoule',400),g('Carottes',800),g('Olives',150),n('Citron',2)],
  [g('Pâtes complètes',450),g('Lentilles',420),g('Courgettes',850),g('Brocolis',700)],
  [g('Poulet Hubbard',900,'Saffron Alley'),g('Riz',350),g('Haricots verts',500),g('Oignons',500),n('Citron',2)]
];
export const BREAKFASTS = [
  'Flocons d’avoine au lait Yeo Valley',
  'Yaourt grec M&S et noix finement moulues',
  'Œufs et pain complet',
  'Porridge au lait Yeo Valley et fruits',
  'Muffins maison (option) ou yaourt grec',
  'Tartines, fruits et lait Yeo Valley',
  'Gâteau maison (option) ou flocons d’avoine'
];
