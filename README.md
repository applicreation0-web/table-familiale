# Table Familiale — menus & budget

**Application web publiée :** https://table-familiale-ibrahima-diallo-4768.vercel.app/

**Code source GitHub :** https://github.com/applicreation0-web/table-familiale

**Android :** APK de test compilé et signé en mode débogage par GitHub Actions (artefact `table-familiale-android-debug`). Cette signature de débogage ne garantit pas la continuité des mises à jour entre compilations. La signature privée définitive est une étape distincte.

Application web/PWA **en français**, entièrement statique, prête pour GitHub Pages. Pour une famille de 5 personnes, 2 adultes et 3 enfants : repas halal, un plat préparé le midi et réchauffé le soir.

## Fonctions

- Calendrier du **20 novembre au 20 décembre 2026**, puis cycles mensuels suivants, conservés séparément.
- 31 plats de base, dont 20 journées avec viande ou poisson ; trois petits-déjeuners récurrents.
- **Modifier un plat** : intitulé, catégorie, ingrédients, quantité, magasin et prix prévu ; partir d'une autre recette de base ou saisir un plat personnalisé.
- **Échanger les jours** (avec protection des journées déjà cuisinées).
- **Suggestions de courses automatiques** : différence entre les ingrédients de la recette initiale et la recette modifiée, y compris lorsqu'on déplace un plat entre deux semaines. Les ingrédients qui deviennent moins nécessaires sont signalés ; la liste achetée n'est jamais supprimée silencieusement.
- **Produit absent de la liste de base** : ajout à la recette ou directement au panier, quantité, prix et magasin. Une absence de prix est signalée et rend le budget prévisionnel incomplet.
- **Achats de début de mois** : viande halal Saffron Alley, poisson Dining Solutions, maquereau M&S et produits de l'épicerie africaine. **M&S chaque semaine** : légumes, fruits, laitages premium, épicerie, dont 3 kg de yaourt grec pour chacune des quatre semaines complètes (2 kg pendant les 3 derniers jours).
- **Budget** plafonné initialement à **850 £**, panier de référence de **829,14 £**. Prix M&S indicatifs, à corriger d'après les tickets.
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

Le panier initial provient de la liste optimisée du 18 novembre 2026, avec 850 £ de plafond et 829,14 £ de montant estimé. Le détail des conditionnements a été **regroupé par fournisseur pour les achats mensuels**. Les quantités d'ingrédients par recette sont indicatives, non des ordonnances nutritionnelles.

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

Tests du calendrier, budget, fournisseurs, yogourt grec, ajout d'ingrédient, prix manquant, échange de jours, historique des achats et import/export.
