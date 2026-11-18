# Audit global — Table Familiale — 18 novembre 2026
**Branche examinée :** `feat/quiches-walnuts-bio-audit-20261118`  
**Pipeline CI :** https://github.com/applicreation0-web/table-familiale/actions/runs/44421308891  
**Périmètre :** menus, coût, conditionnements, produits alimentaires, progression cuisinée, données historiques, navigateur/PWA, et préparation de la publication web.

## Résultat du contrôle automatique : conforme
- **38 tests métier réussis** sous Node.js, vérifications de syntaxe JavaScript, build web et archive CI.
- Première période **31 jours** ; répartition **16 journées viande / 7 poisson / 8 végétariennes**, aucun repas actif au maquereau.
- Cinq plats africains, chacun préparé pour **10 portions réparties sur deux jours**. Toutes les journées simples fournissent **5 portions** pour un repas familial, jamais « midi et soir » fictifs.
- Quiche saumon frais M&S (jour 13) et quiche épinards (jour 21) : chacune 5 portions, 6 œufs, pâte brisée 320 g ; saumon quiche 520 g, épinards quiche 800 g. Les **deux pâtes brisées sont achetées même si la pâtisserie facultative est désactivée**.
- Saumon frais M&S **5 paquets de 4 filets (2,6 kg)** : cinq filets sur chacun des trois autres repas saumon (environ 650 g), puis quatre filets pour la quiche (520 g). Un filet reste à congeler. Cabillaud Dining **1 carton 1,8 kg**, yassa poisson sur deux jours. Saumon fumé **2 × 100 g**, sur son jour de repas, inchangé.
- Épinards de la troisième semaine **2 × 900 g** pour couvrir 800 g du plat lentilles/œufs et 800 g de la quiche épinards, sans devoir acheter d'autres lots.
- **Noix bio 1 kg = 2 grands contenants de 500 g**, obtenus par transvasement d'un sachet Sussex Wholefoods 1 kg. Les deux pots hermétiques **ne sont pas vendus avec les noix**.
- Les 12 conserves de maquereau et trois réassorts hebdomadaires de noix non bio ont disparu de la **nouvelle liste active**. Les éventuels achats déjà payés restent enregistrés dans les anciens mois.
- Les produits Yeo Valley **4 × 2 L/semaine complète**, yaourt grec M&S **3 × 1 kg/semaine**, œufs **24/semaine hors pâtisserie optionnelle** restent dans le panier. Recettes des deux quiches exigent 15 œufs au total sur la semaine 2 du programme et 14 sur la semaine 3 ; les paquets de 24 permettent les petits-déjeuners prévus.
- Panier par défaut **894,88 £**, plafond **900 £**, marge **5,12 £**. Projection **non garantie** ; tout dépassement est affiché et aucune facture payée ne peut être réécrite pour faire croire à une économie.
- Migrations **v2→v8** : recettes cuisinées/personnalisées, reçus, produits ajoutés, stock et notes conservés ; un ancien maquereau déjà cuisiné n'est pas remplacé rétroactivement. Tests spécifiques sur les conditions historiques, le prix payé et les articles personnels.
- Tests des mois de **28, 30 et 31 jours** : le dernier jour d'une période de 30 jours ne crée pas un faux réchauffage de lendemain ; la recette est réduite à 5 portions sans suggestion d'achat fictive.
- Sélecteur des recettes courantes : quiches ajoutées, anciennes entrées maquereau masquées mais conservées dans les données historiques de migration.
- Cache PWA versionné pour mise à jour de l'application installée.

## Audit financier / provenance
| Poste | Prix indicatif | Statut |
|---|---:|---|
| Saumon frais M&S pour la quiche (520 g) | 10,25 £ | Produit et format à vérifier |
| Pâte brisée M&S 320 g, deux unités | 4,00 £ | Prix en ligne |
| Épinards supplémentaires 900 g | 2,50 £ | Prix prévisionnel de référence |
| Noix bio Sussex Wholefoods 1 kg | 15,00 £ | Fiche fournisseur à vérifier |
| Livraison noix bio | 5,00 £ | **Simple provision** : montant réel non établi |
| Réduction d'achats inutiles | Selon le panier | Prix au conditionnement réel à confirmer |

Sources publiques : [pâte brisée M&S](https://www.ocado.com/products/M-S-Ready-Rolled-Shortcrust-Pastry/606567011), [noix bio 1 kg](https://www.healthysupplies.co.uk/walnuts-organic-1kg-sussex.html), [livraison noix](https://www.healthysupplies.co.uk/deliveryoptions.html). Tarifs disponibles en ligne lors du contrôle, sans réservation, ni confirmation locale.

## Limites et risques non clos
1. **Les 5,12 £ de marge sont très faibles.** Un frais de livraison supérieur à 10,12 £ au lieu de la provision de 5 £, un prix de remplacement ou des achats supplémentaires peuvent amener un dépassement. L'application signale le dépassement mais ne peut pas garantir les prix du magasin ou bloquer une dépense externe.
2. Les noix sont livrées **en sachet de 1 kg**, pas dans deux pots ; deux contenants de 500 g doivent exister ou être acquis séparément. La fourniture de pots ne figure **pas** dans le budget.
3. Les réductions d'ail et de courgettes utilisent les prix unitaires estimés ; si M&S ne vend qu'un gros conditionnement, la facture peut être différente.
4. Les prix M&S/Healthy Supplies et les stocks n'ont **pas** été confirmés dans un panier de caisse avec code postal. Aucun achat n'a été passé.
5. Les contrôles sont des **tests automatisés et une revue du code**, pas un audit visuel interactif exécuté sur appareil Android. Les éléments tactiles et l'affichage sur écran réel n'ont pas été certifiés par capture d'écran.
6. **Pas d'APK officielle Android signée** sans secret de signature stable et compilation de release. Une APK de débogage, si compilée, n'est qu'un canal de test.
7. Un groupe de produits utilisé pour un plat déjà cuisiné dans une sauvegarde historique peut demander une vérification des stocks à la migration ; un avertissement de rapprochement est conservé.

## Décision de publication
- **Version web/PWA : GO** sous réserve de CI vert sur le commit final, puis vérification de déploiement Vercel `READY`.
- **Version APK privée signée : NO-GO** tant que le workflow de signature et la clé permanente ne sont pas confirmés.
- **Plafond 900 £ : conforme en prévision seulement**, avec alerte explicite et frais de livraison provisoires.
