# Table Familiale — menus & budget

**Application web publiée :** https://table-familiale-ibrahima-diallo-4768.vercel.app/

**Code source GitHub :** https://github.com/applicreation0-web/table-familiale

**Android :** APK de test compilé et signé en mode débogage par GitHub Actions (artefact `table-familiale-android-debug`). Cette signature de débogage ne garantit pas la continuité des mises à jour entre compilations. La signature privée définitive est une étape distincte.

Application web/PWA **en français**, entièrement statique, prête pour GitHub Pages. Pour une famille de 5 personnes, 2 adultes et 3 enfants : repas halal, un plat préparé le midi et réchauffé le soir.

## Fonctions

- Calendrier du **20 novembre au 20 décembre 2026**, puis cycles mensuels suivants, conservés séparément.
- 31 journées, avec un plat africain différent dans chacun des cinq blocs hebdomadaires. Chaque plat africain couvre deux jours consécutifs (midi et soir) et n’est cuisiné qu’une fois. 7 petits-déjeuners rotatifs, dont gâteaux ou muffins facultatifs.
- **Modifier un plat** : intitulé, catégorie, ingrédients, quantité, magasin et prix prévu ; partir d'une autre recette de base ou saisir un plat personnalisé.
- **Échanger les jours** (avec protection des journées déjà cuisinées).
- **Suggestions de courses automatiques** : différence entre les ingrédients de la recette initiale et la recette modifiée, y compris lorsqu'on déplace un plat entre deux semaines. Les ingrédients qui deviennent moins nécessaires sont signalés ; la liste achetée n'est jamais supprimée silencieusement.
- **Produit absent de la liste de base** : ajout à la recette ou directement au panier, quantité, prix et magasin. Une absence de prix est signalée et rend le budget prévisionnel incomplet.
- **Achats de début de mois** : viande halal Saffron Alley, poisson Dining Solutions, maquereau M&S et produits de l'épicerie africaine. **Chaque semaine** : légumes, fruits, produits M&S premium et **4 bouteilles Yeo Valley de 2 L = 8 L** ; 3 kg de yaourt grec sur chacune des quatre semaines complètes (2 kg les trois derniers jours), 30 œufs par semaine complète (12 dans les trois derniers jours). Deux paquets de farine blanche 1,5 kg dans la période et options gâteaux/muffins (sucre, beurre, levure, vanille).
- **Budget** plafonné initialement à **850 £** ; panier standard **974,39 £** sans pâtisserie, au lieu de 1 039,64 £ avant rationalisation (gain indicatif **65,25 £**). Pâtisserie facultative via un bouton par semaine. Les tarifs sont indicatifs et modifiables. Prix M&S indicatifs, à corriger d'après les tickets.
- Suivi des dépenses payées, achats cochés, dépenses supplémentaires, jours cuisinés, historique par mois.
- **Sauvegarde JSON** à exporter et restaurer. Le stockage est local au navigateur, pas partagé automatiquement entre plusieurs téléphones.
- PWA installable sur écran d'accueil et utilisable hors connexion après le premier chargement des ressources.

## Utilisation

1. Ouvrir l'onglet **Menus**, cliquer sur le crayon d'une journée.
2. Modifier le plat ou choisir un autre plat existant ; cliquer sur **Ajouter un ingrédient** si nécessaire. Indiquer sa quantité, son magasin et, idéalement, son prix.
3. Enregistrer. L'onglet **Courses** propose les ingrédients supplémentaires nécessaires et signale ceux qui deviennent moins nécessaires.
4. En début de mois, sélectionner **Viande & poisson · mois** ; pour les courses fraîches, sélectionner **Courses M&S · semaine**.
5. Cocher un produit acheté puis corriger son montant réel si différent ; consulter **Dépenses**.
6. Exporter régulièrement la sauvegarde dans **Suivi**.

### Conditions de calcul

Le panier de référence a été optimisé sans supprimer de repas : 1 002,19 £ si toutes les options de pâtisserie sont activées ; **974,39 £ sans pâtisserie** (situation par défaut). Le plafond de 850 £ est inchangé et le dépassement est affiché. Le détail des conditionnements a été **regroupé par fournisseur pour les achats mensuels**. Les quantités d'ingrédients par recette sont indicatives, non des ordonnances nutritionnelles.

Pour une recette modifiée, les **écarts positifs** de quantité produisent une suggestion d'achat, et les écarts négatifs une alerte de sur-achat potentiel. Si les achats initiaux sont conditionnés en paquets/cartons, l'application ne les réduit pas automatiquement pour éviter de supposer qu'un paquet partiel peut être acheté. Une suggestion sans prix reste visible comme « prix manquant », sans être artificiellement incluse à 0 £ dans une prévision présentée comme certaine. L'application n'actualise **pas** les tarifs du magasin en temps réel.

## Lancement local

Aucune dépendance à installer pour la version web ni pour les tests. Node.js 22+ est conseillé pour les tests et le build :

```bash
npm test
npm run build
python3 -m http.server 4173
```

Ouvrir `http://localhost:4173`. Le dossier `dist/` contient la version statique prête pour GitHub Pages. Le fichier `index.html` est à la racine, aucune configuration Vite/React nécessaire.

## Publication et installation

### Version web installable (recommandée)

Ouvrir **https://table-familiale-ibrahima-diallo-4768.vercel.app/** depuis Chrome sur Android, puis dans le menu du navigateur choisir **Installer l'application** ou **Ajouter à l'écran d'accueil** selon les options disponibles. La version web a été publiée sur Vercel à partir des sources vérifiées dans ce dépôt. Elle ne dépend pas de l'activation de GitHub Pages.

Les modifications du code GitHub ne redéploient **pas automatiquement** cette version Vercel : il faut publier la version mise à jour.

### APK Android de test

Le workflow `.github/workflows/android-debug.yml` compile l'APK Android et place `app-debug.apk` dans l'artefact **table-familiale-android-debug** de l'exécution GitHub Actions réussie. Le débogage est signé avec une clé de test propre à la compilation ; pour des mises à jour sans désinstallation, établir une signature privée permanente conservée en sécurité. Aucune clé de l'application sport n'est réutilisée.

### Intégration GitHub

`.github/workflows/pages.yml` exécute les tests et construit la version web en archive GitHub Actions. GitHub Pages n'est pas activé sur ce dépôt ; le site web est publié sur Vercel.

Les achats réels et les recettes modifiées sont stockés dans le navigateur ou l'application locale. Prévoir une exportation JSON régulière (onglet **Suivi**) avant changement de téléphone ou effacement des données.

## Vérifications

```bash
npm test
```

Tests du calendrier, cuisson de deux jours, budget, lait Yeo Valley, œufs, farine, yaourt grec, modification des plats, prix manquant, déplacement de blocs, achats réels et migration des sauvegardes antérieures.

### Repas africains en deux jours — fonctionnement

Le premier jour comprend toutes les quantités de la cuisson (quatre services pour cinq personnes : deux déjeuners et deux dîners). Le lendemain est noté « Réchauffage » : aucun ingrédient supplémentaire n'est additionné. La validation du jour 2 est refusée tant que la préparation du jour 1 n'est pas validée. Une modification du jour de préparation est répercutée sur le jour de réchauffage. Les permutations entre paires sont permises et les blocs restent consécutifs ; un déplacement qui créerait deux plats africains dans la même semaine est bloqué.

| Semaine du programme | Plat africain (2 jours) |
| --- | --- |
| 1 | Mafé d'agneau |
| 2 | Riz à la viande d'agneau |
| 3 | Poulet yassa |
| 4 | Thiéboudienne au poisson |
| 5 (3 jours) | Thiou au poulet |

La farine et les ingrédients de pâtisserie sont des **réserves** : le choix de préparer un gâteau ou des muffins reste facultatif. La prévision financière inclut cette réserve tant qu'elle n'est pas retirée des courses. Lait Yeo Valley 2 L estimé à 3,15 £ par bouteille, vendu chez différents supermarchés ; l'utilisateur peut choisir entier ou demi-écrémé. Les prix des viandes sont indicatifs sauf les Hubbard au tarif fournisseur (1,6 kg+ = 25,95 £ ; 2,6 kg+ = 34,45 £).

**Sauvegardes existantes :** les données v2 sont migrées vers v3. Les plats déjà cuisinés et les achats payés ne sont pas écrasés ; si un ancien achat de lait ou de protéines est inférieur au nouveau besoin, un complément non coché est créé.

### Optimisation financière et qualité — mise à jour du 18 novembre

Aucune réduction des 8 L de lait Yeo Valley par semaine complète, des 3 kg de yaourt grec M&S, des portions de Hubbard/agneau/cabillaud nécessaires ou des fruits quotidiens. Le panier est désormais ajusté aux quantités par recette et aux conditionnements : 12 boîtes de maquereau au lieu de 18, niébé inutilisé retiré, fonio augmenté de 500 g à 1 kg pour la cuisson réelle, certains légumes hebdomadaires diminués, d'autres augmentés pour couvrir les plats, accompagnements oubliés ajoutés (quinoa, pâtes, riz, poivrons, aubergines, lentilles, pain complet).

La pâtisserie n'est plus supposée hebdomadaire : sans pâtisserie, panier de **24 œufs** par semaine complète ; si activée, **30 œufs** et ingrédients en option. Les œufs déjà achetés sont respectés et un complément distinct est suggéré si besoin. Un bouton « déjà en stock » évite les achats redondants et peut être annulé. Les achats et prix payés ne sont jamais recalculés fictivement. Les économies dépendent de l'inventaire réel.

Comparaison de prix : le lait Yeo Valley 2 L reste valorisé à 3,15 £ dans le budget ; des offres identiques moins chères peuvent être vérifiées auprès d'autres enseignes. Aucun prix promotionnel temporaire n'est supposé permanent.

Les anciennes sauvegardes v2 et v3 sont reconnues et migrées en v4, avec conservation des reçus, des menus déjà cuisinés, des achats payés et des modifications manuelles ; les écarts de conditionnement pour les achats déjà enregistrés donnent lieu à une alerte de réconciliation.

### Circuit Android officiel (signature privée)

Le workflow **.github/workflows/android-release-private.yml** construit, signe et vérifie un APK stable pour les mises à jour successives, avec empreinte SHA-256. Il doit être déclenché manuellement par GitHub Actions sur une branche officielle vérifiée ; aucune signature automatique de débogage ne doit être appelée « officielle ».

Avant son premier lancement, configurer les quatre secrets GitHub Actions du dépôt : `TABLE_FAMILIALE_KEYSTORE_BASE64` (clé JKS de Table Familiale encodée en base64), `TABLE_FAMILIALE_STORE_PASSWORD`, `TABLE_FAMILIALE_KEY_ALIAS`, `TABLE_FAMILIALE_KEY_PASSWORD`. **Sauvegarder hors ligne le keystore initial** : une clé différente empêcherait une mise à jour sans désinstallation. Ne jamais committer, publier, journaliser ou envoyer la clé ni les mots de passe en clair.

La release Android privée n'est pas considérée comme publiée tant que le workflow n'a pas terminé avec succès sur la branche officielle et produit l'artefact `table-familiale-android-officiel`. L'APK de débogage reste un canal de test distinct.
