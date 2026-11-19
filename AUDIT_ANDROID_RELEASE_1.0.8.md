# Audit de release — Table Familiale Android 1.0.8

**Périmètre :** code source v8 du menu et panier, configuration Capacitor 8, APK Android, sauvegarde, permissions, signature privée, non-régression.

## Vérifications effectuées avant fusion

- **43 tests Node.js : 43 réussis, 0 échoué.**
- **Construction web et contrôles de syntaxe : réussis** : [CI web](https://github.com/applicreation0-web/table-familiale/actions/runs/44426922730).
- **Compilation de l'APK de test : réussie**, après installation des plugins Filesystem et Share : [CI Android sur PR](https://github.com/applicreation0-web/table-familiale/actions/runs/44426922776).
- **Icône native** : ressources PNG Android générées en cinq densités depuis `icons/icon.svg`, avec versions adaptées à Android 8+ (adaptive icons).
- **Package vérifié par aapt** : `app.tablefamiliale.menus`.
- **Permissions déclarées** : `android.permission.INTERNET` et permission interne du récepteur non exporté `app.tablefamiliale.menus.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. Absence constatée de Camera, Micro, Contacts, SMS, géolocalisation fine et QUERY_ALL_PACKAGES.
- **Données métier** : prix indicatifs 894,88 £, plafond strict 900 £, 16 jours viande / 7 poisson / 8 végétariens, deux quiches, noix bio 1 kg divisées dans deux grands pots, migration v2→v8.
- **Export JSON** : le navigateur continue à télécharger le JSON ; dans la WebView native, le JSON est écrit dans le cache privé de l'application puis proposé via la feuille de partage Android, le destinataire doit enregistrer la copie. Tests unitaires contre faux succès si modules absents ou URI invalide.
- **Contrôle de version release** : versionName `1.0.8`, versionCode `108000 + numéro du workflow` (croissant), tests unitaires.
- **Script de signature** : `zipalign`, `apksigner sign`, `apksigner verify --print-certs`, validation `aapt`, rapport de permissions et checksum SHA256. La clé de signature n'est ni commise ni renvoyée dans les logs.
- **Distribution** : APK signée prévue comme **artefact GitHub Actions** avec conservation de 7 jours ; pas de publication publique GitHub Release ni de diffusion dans un magasin.

## Condition de publication signée

Le workflow `.github/workflows/android-release-private.yml` s'exécute par commande manuelle ou déclenchement exceptionnel de sa modification sur `main`. Il exige les **quatre secrets GitHub Actions** suivants :

- `TABLE_FAMILIALE_KEYSTORE_BASE64`
- `TABLE_FAMILIALE_STORE_PASSWORD`
- `TABLE_FAMILIALE_KEY_ALIAS`
- `TABLE_FAMILIALE_KEY_PASSWORD`

**Ne pas présenter l'APK de test comme une version officielle signée.** Si les secrets n'existent pas, le job de signature échoue intentionnellement en précontrôle. Il faut conserver **durablement le même keystore et le même alias** pour que les prochaines mises à jour Android puissent être installées sans désinstallation.

## Vérifications restant nécessaires sur appareil

- Ouvrir les quatre onglets sur téléphone Android réel et vérifier débordement, tailles et navigation.
- Tester **export JSON via partage Android**, puis import d'une sauvegarde et comparaison des dépenses et reçus.
- Tester une mise à jour avec la **même clé privée** sur un appareil où la version précédente est déjà installée.
- Vérifier l'ouverture hors connexion et les liens produits dans le navigateur.

La CI confirme les tests automatisés et le contenu de l'APK de test ; elle **ne constitue pas** une certification visuelle ou un test physique sur téléphone.

## Décision technique

- **GO fusion pour préparer la release** si les deux CI sont vertes.
- **GO APK signée uniquement** si le workflow privé se termine en succès et crée effectivement une APK et son SHA256.
- **NO-GO signature** si les quatre secrets n'ont pas été configurés, sans substitution trompeuse par une APK de débogage.
