# 1.0.16 — Mode courses sans prix

- À l'ouverture, **aucun prix ni budget n'est affiché** dans les menus et les listes de courses. L'onglet Dépenses est masqué ; le bouton « Afficher les prix (facultatif) » permet de retrouver le suivi financier existant. Le choix est local et conservé dans la sauvegarde JSON.
- **Cocher un article ne demande plus son prix** et n'invente pas une dépense payée sur la base du tarif estimé. Produit acheté sans montant = `bought:true`, `actual:null` ; il reste pris en compte comme estimation uniquement dans la prévision budgétaire facultative.
- Les achats déjà rapprochés avec des montants réels, les tickets importés, les recettes, les menus personnalisés, les sauvegardes et les plafonds historiques sont conservés. Le scan du ticket est facultatif pour cocher une liste ; il demande toujours une réconciliation s'il sert à enregistrer une dépense réelle.
- Les prix de recettes et de produits peuvent rester stockés en arrière-plan sans saisie obligatoire ; les anciennes dépenses ne sont pas effacées.

# Table Familiale — menus, courses, suivi local et budget de 900 £

## 1.0.15 — Semaine 1 vérifiée et menus sans saumon

**Première semaine : 20–26 novembre 2026**. Le saumon de la journée 3 est retiré dès l'ouverture de l'application, conformément à l'absence d'achat signalée. Cela ne valide **aucune dépense** et ne suppose **aucun stock** de poisson, viande, lait ou légumes. Les menus déjà cuisinés ou édités manuellement ne sont jamais remplacés.

**Ticket personnel :** les lignes de produits, montants et remboursements restent dans un fichier local transmis uniquement à l'utilisateur ; la base de code publique ne doit contenir ni photo de caisse, ni transcription, ni total personnel. L'application contrôle le montant réel au centime près pendant l'import, sans le publier. La prise en compte comptable dans l'application nécessite **une seule importation locale** de la transcription du ticket (Courses → Lire un ticket → Charger le ticket M&S .txt → vérifier le total → confirmer les achats et adapter les menus). Il n'existe pas de synchronisation automatique de la conversation ChatGPT vers le stockage du navigateur/appareil.

| Jour | Menu après import d'un ticket complet confirmé |
|---|---|
| 1 | Poulet Hubbard rôti, pommes de terre et légumes ; carottes limitées à 450 g |
| 2 | Gratin pommes de terre, brocolis, œufs et betteraves ; fromage non certifié retiré |
| 3 | Couscous complet aux courgettes, tomates et œufs — **aucun saumon** |
| 4–5 | Mafé d'agneau sur deux jours ; carottes ramenées à 500 g au total |
| 6 | Cuisses de poulet basquaise et quinoa |
| 7 | Fusilli complets aux brocolis, tomates et œufs — lentilles non identifiées remplacées |

Ces ajustements de menus ne deviennent effectifs que si les ingrédients de remplacement sont reconnus dans le ticket complet et les plats sont toujours modifiables ou annulables. Les **950 g de carottes** correspondent aux recettes adaptées, pour **1 kg acheté** par code produit connu ; les autres conditionnements non prouvés ne sont pas considérés comme des quantités garanties. L'inventaire de protéines achetées séparément (viande halal, Dining Solutions) reste à vérifier et ces achats ne sont pas crédités automatiquement.

**Import en une confirmation :** seul le rapprochement à code-barres reconnu est automatique ; les lignes restantes sont comptabilisées « hors liste » après vérification explicite du récapitulatif. Aucune ligne ne peut être omise dans le mode ticket complet ; le total doit se réconcilier au centime près (tolérance OCR de 0,02 £). La transaction entière est validée sur une copie de la sauvegarde et n'est écrite localement qu'en cas de réussite. Aucun reçu personnel ne doit être poussé dans GitHub.

**Contrôle familial :** cinq assiettes pour deux adultes et trois enfants, équivalent indicatif de quatre portions adultes, sans âges précis. Le nombre d'œufs du programme est contrôlé avec le maximum hebdomadaire et le petit-déjeuner ; vérifier l'appétit et les restes. L'APK Android officielle requiert toujours signature privée et test de la caméra sur téléphone réel.

## 1.0.14 — Réorganisation automatique sur ticket hebdomadaire M&S

Le moteur antérieur rapprochait les prix sans modifier le planning alimentaire. La nouvelle règle démarre **uniquement après validation par l'utilisateur d'un ticket complet de la semaine** : chaque ligne doit être associée à un achat prévu ou acceptée comme dépense hors liste. Sans cette confirmation, une absence sur le ticket ne signifie **jamais** une rupture de stock.

- **Importer le ticket sans caméra :** Courses → Lire un ticket → Charger un ticket .txt, puis cocher « Ce ticket couvre toutes les courses M&S de cette semaine », vérifier les correspondances et confirmer. La photo Android reste utilisable sur l'APK native ; le scanner natif sur téléphone réel reste à valider.
- L'application conserve seulement une synthèse locale de catégories reconnues, pas la photo ni la transcription détaillée du ticket. Les achats confirmés sont imputés au prix réellement payé, les doublons d'un même article sont regroupés, et les remises réconciliées seulement sur un ticket complet.
- Si un repas **non cuisiné et non personnalisé** de la semaine demande du saumon, alors que le ticket complet confirmé n'en contient pas, et que pâtes, courgettes et fromage sont effectivement identifiés, ce repas devient « Pennes complètes aux courgettes et tomates » quand les tomates sont reconnues ; le cheddar reste une possibilité à vérifier pour la présure. Une option « Rétablir » est affichée pour annuler. Les achats de saumon absents du ticket ne sont pas considérés payés.
- Les lignes de courses non achetées de cette semaine sont retirées du **reste à acheter**, avec alerte sur les ingrédients et quantités qu'il reste à vérifier ; aucun reçu ou stockage fictif n'est créé.
- La politique M&S s'applique aux courses de semaine confirmées. Les références précédentes chez Ocado redeviennent des **poires M&S à prix inconnu**, à chiffrer avant achat. Les viandes halal, Dining Solutions et références spécialisées historiquement prévues hors M&S ne peuvent pas être présentées comme disponibles ou halal chez M&S sans vérification.
- Ne pas appliquer un total théorique si le ticket déjà payé est disponible ; un reçu incomplet ne clôture pas la semaine. Les menus déjà cuisinés, les modifications manuelles, le suivi des dépenses et les anciennes sauvegardes restent protégés.

**Confidentialité :** aucun détail du ticket familial complet n'est ajouté dans le code ou les tests. Les scénarios de test utilisent des lignes fictives. L'utilisateur peut importer son propre .txt localement, qui ne doit pas être téléversé dans GitHub. Les anciennes traces de l'historique Git ne sont pas purgées par cette révision.

**Publication Android :** la version de paquet est 1.0.14. Un build Android de test n'est pas une APK privée signée ; la signature permanente et le test de la caméra sur appareil réel restent des contrôles distincts.

## Version de développement 1.0.14 · données v13

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
