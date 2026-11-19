# Table Familiale — identité de signature Android de référence

**Date de création : 19 novembre 2026**

Cette fiche référence la nouvelle identité cryptographique **permanente**, utilisée pour signer les futures APK privées de Table Familiale. Elle ne contient **aucun secret**.

| Champ | Valeur |
| --- | --- |
| Android applicationId | `app.tablefamiliale.menus` |
| Keystore | `table-familiale-release-permanent.jks` (stockage privé, hors dépôt) |
| Alias | `tablefamiliale-private-release` |
| Algorithme | RSA 4096 bits |
| Validité | 10 000 jours à compter du 19 novembre 2026 |
| Certificat SHA-256 | `AC:9D:55:8B:77:EC:F8:9A:AC:18:46:0C:DA:14:D1:23:1D:5D:D0:89:FC:B7:88:CD:F5:51:61:AF:6A:E2:20:DA` |

## Conditions impératives

1. L'identité de signature permanente est **nouvelle** et **différente** des certificats de débogage générés temporairement par GitHub Actions. Les APK de test antérieures ne peuvent pas être mises à jour sur place avec cette clé : faire un export JSON des données, puis désinstaller l'ancienne APK, installer la première APK signée avec la clé permanente, réimporter le JSON.
2. Les **quatre secrets GitHub Actions** requis sont `TABLE_FAMILIALE_KEYSTORE_BASE64`, `TABLE_FAMILIALE_STORE_PASSWORD`, `TABLE_FAMILIALE_KEY_ALIAS`, `TABLE_FAMILIALE_KEY_PASSWORD`. Ils doivent être configurés dans les **Repository secrets**, jamais committés.
3. Le workflow de signature est `.github/workflows/android-release-private.yml`. Il faut que le job réussisse et que le certificat affiché par `apksigner verify --print-certs` soit identique à l'empreinte ci-dessus.
4. Une APK n'est qualifiée de **release officielle privée** qu'après vérification de la signature, du `versionName`, du `versionCode` croissant, du package, des permissions et du SHA256 de l'APK, et récupération de l'artefact signé.
5. Garder **des sauvegardes indépendantes et privées** du keystore et de ses mots de passe. Une fois la clé perdue, aucune reconstitution à partir d'une APK n'est possible.

**État au 19/11/2026 :** la clé a été générée et vérifiée localement. Les secrets GitHub n'ont pas encore été configurés ; aucune APK officielle signée avec cette nouvelle identité n'a été produite.
