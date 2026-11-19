# AUDIT CONTRADICTOIRE & RELEASE — Table Familiale 1.0.12

**Date :** 19 novembre 2026  
**Périmètre :** prix unitaires réellement payés, réestimation des semaines et périodes suivantes, tickets OCR Android, import et sauvegarde v11, plafond 900 £, sécurité de publication, compatibilité Android.  
**Code testé et packagé :** `4729c66ec0836c82b2dde75f436494dbc9828966`  
**CI web :** https://github.com/applicreation0-web/table-familiale/actions/runs/44510353250  
**CI Android :** https://github.com/applicreation0-web/table-familiale/actions/runs/44510353118

## Résultat — GO pour release APK signée, sous réserve du test physique du scanner

| Contrôle | Résultat |
|---|---|
| Tests métier et stress | **88 réussis / 88** |
| Compilation statique web et vérification de syntaxe | **Réussies** |
| Compilation Android debug et release non signée | **Réussies** |
| Identifiant Android | `app.tablefamiliale.menus` |
| Version APK | `1.0.12` |
| VersionCode | **112065** (> 111058 de 1.0.11) |
| Permissions auditées | `INTERNET`, `ACCESS_NETWORK_STATE`, permission interne de récepteur non exporté ; absence de micro/SMS/contacts/localisation fine |
| Certificat de signature | Identité permanente du 19/11/2026, **RSA 4096**, empreinte SHA-256 `AC:9D:55:8B:77:EC:F8:9A:AC:18:46:0C:DA:14:D1:23:1D:5D:D0:89:FC:B7:88:CD:F5:51:61:AF:6A:E2:20:DA` |
| Signature APK | **v2 et v3 vérifiées**, un signataire |
| Alignement ZIP préalable | 267 fichiers non compressés alignés à 4 octets ; **4 bibliothèques natives alignées à 16 Ko** |
| SHA-256 de l'APK privée signée | `e6a551deb0c4a4255f2ff9aa3605bf5dd0780e65986777b81a962c95eadfd149` |
| Taille de l'APK | **51 513 989 octets** |

## Stress tests appliqués

**22 nouveaux scénarios** : panier de 31 jours avec pâtisserie 5 semaines, inflation simulée de 12 % sur tous les produits, 100 frais additionnels, 180 corrections répétées d'un prix, différenciation 1 kg / 500 g et fournisseurs, médiane robuste à une promotion isolée, 250 observations plafonnées à 12, gratuités, produits en stock/masqués/prix manuels, tickets OCR de 2 000 lignes et 120 lignes autorisées, 120 achats hors liste, transaction atomique refusée à la dernière ligne incorrecte, 25 tickets répétés sur deux périodes, prix négatifs/non finis, doublons de rapprochement, confidentialité des reçus, 20 périodes exportées/importées, dépassement du plafond, prix payés historiques immuables, héritage des prix dans 12 périodes, absence de création de faux achats.

**3 corrections de non-régression :**
1. Une facture OCR n'est utilisée pour apprendre le prix **qu'après vérification explicite** du conditionnement/poids. Le prix payé est comptabilisé, mais ne peut fausser le coût au kg sans validation.
2. Un achat historique `bought=true` reste comptabilisé même si l'article est marqué `hidden=true`.
3. Les tickets tronqués au-delà de 120 lignes visibles sont **refusés avant mutation** ; le total des lignes OCR ne peut plus inclure silencieusement des lignes invisibles.

**Conservation des données :** migration version d'état 11, articles déjà payés et quantités personnalisées conservés, données locales et sauvegarde JSON. La photo et le texte brut du ticket ne sont pas persistés dans l'historique ; seules les lignes approuvées et l'empreinte anti-doublon sont inscrites.

## Plafond budgétaire et limites

La prévision initiale demeure **889,08 £** hors pâtisserie facultative, **894,88 £** si toutes les semaines de pâtisserie sont activées, avec des marges respectives **10,92 £** et **5,12 £**. Le moteur laisse apparaître honnêtement une marge négative lorsque les prix réels, les dépenses complémentaires ou la livraison dépassent le plafond de **900 £**. Il **ne falsifie ni recettes ni achats** pour maquiller un dépassement. Les tarifs de l'enseigne et les frais réels sont indépendants de l'application.

## Signature et distribution

La clé permanente a été contrôlée par `keytool`, et l'APK alignée issue de la CI a été signée **hors dépôt** via l'outil officiel Android `apksigner`. Les schémas v2/v3 et le certificat ont été contrôlés sur le fichier final. **Ni la clé, ni ses mots de passe ne sont stockés dans le dépôt.** Le workflow GitHub de signature automatisée reste bloqué tant que les quatre GitHub Actions Secrets ne sont pas installés. La release privée 1.0.12 est distribuée directement sous forme d'APK signée ; aucune « GitHub Release » publique n'est revendiquée.

## Limites restant à vérifier sur appareil

- Scanner un **vrai ticket M&S/Ocado** sur un téléphone Android : luminosité, cadrage, deux lignes successives, remises et total.
- Vérifier la demande de photo/galerie et que les modules natifs ML Kit sont correctement chargés dans la WebView.
- Vérifier l'import/export JSON et les valeurs monétaires après une vraie transaction, notamment dans une installation déjà utilisée.
- Première installation avec cette clé permanente : les anciennes APK de débogage n'ont pas le même certificat, donc **sauvegarde JSON préalable**, désinstallation de l'ancienne APK si nécessaire, installation puis restauration.
- Le modèle de prix apprend uniquement les formats comparables : ne pas cocher confirmation d'un format différent de celui effectivement acheté.

**Décision :** GO release **signée et vérifiée** ; aucune déclaration de recette OCR « testée en réel » sans contrôle matériel.
