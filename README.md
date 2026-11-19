# Table Familiale — menus, courses, suivi local et budget de 900 £

## Version de développement 1.0.13 · données v13

Cette branche est une **proposition de mise à jour** : elle n'est pas la version Android officielle tant qu'une APK signée avec le certificat de référence n'a pas été produite et vérifiée. Le code est soumis aux tests GitHub Actions. La caméra réelle doit encore être contrôlée sur téléphone.

### Composition anonyme du foyer

- **Deux adultes et trois enfants**, âgés approximativement de **3 à 10 ans**. Aucun nom, aucune date de naissance ni âge individuel ne sont requis.
- Portions de travail : **quatre équivalents adultes** répartis en **cinq assiettes**, avec possibilités de resservir et d'ajuster à l'appétit ; ce n'est pas une prescription nutritionnelle.
- Les ingrédients des 31 journées sont recalculés selon leur nature : féculents, pommes de terre, légumes, protéines, œufs et ingrédients techniques. Les plats africains restent cuisinés pour deux jours sans deuxième achat.
- Les quantités de carottes bio sont ajustées en sacs de 1 kg à un tarif de référence **1,60 £/kg**. Les autres légumes sont confrontés aux besoins calculés dans l'écran Courses, mais les prix d'emballage incertains ne sont pas artificiellement réduits.
- Les achats de viandes halal et de Dining Solutions ne changent pas lors de cette mise à jour. Les menus, achats et prix saisis par l'utilisateur, les recettes déjà cuisinées et les achats payés sont préservés lors de la migration.
- Le plafond de **900 £ par cycle** n'est pas une garantie : prix, formats, stocks, besoins et factures doivent être vérifiés avant toute conclusion financière.

### Courses et prix observés

- Lait entier Yeo Valley bio : **2 × 2 L**, à **3,10 £ la bouteille** dans la référence initiale.
- Lait entier M&S bio : **1 × 4 pintes (2,272 L)** à **2,65 £** pour les semaines complètes.
- Œufs bio M&S : boîte de 12 à **5,40 £**, plafond de **24 œufs par semaine**, pâtisserie comprise.
- Beurre AOP : **250 g chaque semaine** à **3,75 £**.
- Pain complet : **3,50 £** selon le prix communiqué.
- Fruits autorisés au panier initial : raisins, fraises et poires. Huiles : olive et tournesol, avec préférence pour la qualité.
- Les autres produits, notamment réserves et emballages, restent à confirmer par une suite de tickets.

### Scanner privé

Le scanner lit les tickets **sur l'appareil** via ML Kit, recompose les colonnes d'impression, détecte les EAN connus, les produits répétés et les remises. L'utilisateur doit confirmer les correspondances et les conditionnements avant l'enregistrement des achats et l'apprentissage d'un prix.

Les tests de régression s'appuient uniquement sur un **ticket synthétique**, sans transcription complète d'un achat familial réel, sans identité et sans moyen de paiement. Les tickets photographiés, leur texte brut et leurs images ne sont pas transférés au dépôt GitHub par la fonction de scan. Les données de l'application sont conservées dans le stockage local du navigateur ou de l'APK, et peuvent être exportées sous forme de JSON par décision de l'utilisateur.

**Attention à la confidentialité :** cette modification du contenu courant du dépôt n'efface **pas** les anciennes versions de fichiers présentes dans l'historique Git, ni d'anciens journaux de publication ou déploiements. Pour effacer toute trace publique historique, un traitement séparé de l'historique et des copies/miroirs est nécessaire. Une sauvegarde JSON peut contenir des données d'achats personnelles : ne jamais la publier.

### Développement

```bash
npm test
npm run build
```

L'application doit conserver les règles : cinq portions familiales par service, un seul repas principal par jour, plat africain cuisiné une fois pour deux jours, réutilisation des restes, achats groupés halal mensuels séparés des courses M&S hebdomadaires, sauvegardes sans perte et dépassements budgétaires non masqués.

Le workflow `.github/workflows/android-debug.yml` construit une APK de test. Le workflow `.github/workflows/android-release-private.yml` nécessite le certificat privé historique dans les secrets du dépôt. Aucun nouveau certificat ne doit être substitué silencieusement à celui des versions officielles.

Dépôt : https://github.com/applicreation0-web/table-familiale

Les rapports d'audit antérieurs sont conservés à titre **historique** et peuvent contenir des chiffres ou des conditions dépassés.
