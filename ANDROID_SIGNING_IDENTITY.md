# Table Familiale — identité Android privée permanente

**Date d'entrée en service : 21 novembre 2026 — première APK officielle privée 1.0.16.**

Cette page contient seulement les informations publiques de vérification. **La clé privée et ses mots de passe ne sont pas conservés dans GitHub.**

| Champ | Identité permanente |
| --- | --- |
| Android applicationId | `app.tablefamiliale.menus` |
| Version initialement signée | `1.0.16` (`versionCode=116144`) |
| Source | `81030555c9ff1ed25e742ba86efc24785693db7c` |
| Alias | `tablefamiliale-private-release` |
| Keystore privé | `Table-Familiale-cle-permanente-2026-11-21.jks` |
| Algorithme | RSA 4096, SHA-256 |
| Certificat SHA-256 | `B7:4C:CD:10:66:75:5D:16:99:4A:48:77:C4:9E:45:ED:C9:E3:CA:DD:EF:44:B3:FA:B5:09:E8:90:E3:14:7C:FE` |
| SHA-256 de l'APK signée 1.0.16 | `cf28b6f0047d89c03faf9335096bd8ec003476aae2f839d239bf0d0bace4057d` |
| Vérification | `apksigner verify` : schémas v2 et v3 vérifiés |

## Note sur le certificat historique du 19/11/2026

Une identité portant le certificat `AC:9D:55:8B:77:EC:F8:9A:AC:18:46:0C:DA:14:D1:23:1D:5D:D0:89:FC:B7:88:CD:F5:51:61:AF:6A:E2:20:DA` avait été documentée le 19 novembre, mais son fichier de clé n'était plus accessible au moment de finaliser la release. **Aucune APK officielle signée avec cet ancien certificat n'avait été distribuée** selon les exécutions GitHub consultées. La première release privée 1.0.16 a été signée hors dépôt, avec la nouvelle identité ci-dessus. Ne jamais confondre ces certificats : Android refuse une mise à jour en place si la signature change.

## Mises à jour futures

1. **Conserver hors dépôt** le fichier `.jks` et le document confidentiel des mots de passe, avec sauvegardes privées indépendantes. Sans la clé, les prochaines versions ne pourront pas remplacer l'APK 1.0.16 en place.
2. Les workflows GitHub Actions ne fonctionneront que si les quatre secrets `TABLE_FAMILIALE_KEYSTORE_BASE64`, `TABLE_FAMILIALE_STORE_PASSWORD`, `TABLE_FAMILIALE_KEY_ALIAS` et `TABLE_FAMILIALE_KEY_PASSWORD` sont configurés explicitement. Au 21/11/2026, la signature privée a été réalisée localement, pas via des secrets GitHub.
3. Toute future APK doit passer le contrôle de l'empreinte ci-dessus, conserver `app.tablefamiliale.menus` et augmenter `versionCode`. Ne jamais signer une mise à jour avec une clé Android de debug.
4. **Avant d'installer un certificat différent de celui de l'APK actuellement installée**, exporter la sauvegarde JSON depuis l'application, vérifier la présence du fichier puis seulement ensuite désinstaller/réinstaller et restaurer. Éviter de supprimer l'application sans cette sauvegarde.
5. Le scanner de tickets en conditions réelles et la migration locale doivent encore être validés sur un téléphone physique.

Aucune clé privée, mot de passe ou ticket familial personnel ne doit être publié dans GitHub.
