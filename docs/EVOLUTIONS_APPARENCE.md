# Bordero 1.0 — en-tête flottant et apparence

## Changements visibles

- Le bandeau jaune est remplacé par un fond neutre. Le logo original apparaît dans un carré jaune arrondi en haut à gauche ; le raccourci du profil est dans un second carré jaune en haut à droite.
- Le sélecteur d’espace de travail est une capsule distincte, avec un libellé discret et le nom de l’espace actif. Les trois éléments possèdent des espacements et des ombres légères.
- La navigation du bas devient une capsule flottante, limitée en largeur sur les grands écrans. L’onglet actif utilise un fond neutre et des textes contrastés.
- Le profil propose Jour, Nuit et Automatique. Le choix s’applique immédiatement, sans réinitialiser la navigation ni demander un rechargement des chiffres. Automatique suit l’apparence du téléphone.
- La préférence est enregistrée localement et restaurée au lancement. Les écritures sont sérialisées pour préserver le dernier choix lors de changements rapides. Un échec d’enregistrement permet de réessayer.
- La barre d’état, les éléments natifs, la connexion et les écrans de chargement suivent l’apparence choisie. L’écran de lancement et l’icône conservent l’identité jaune de Bordero.

## Vérifications

TypeScript et 50 tests automatisés réussis, dont quatre vérifications de la préférence : système et choix explicites, restauration, changements rapides et reprise après un échec de stockage. L’en-tête, la navigation et le sélecteur ont été inspectés dans un aperçu natif iPhone distinct, en Jour et Nuit, sans accès au compte ni aux données métier. L’image du logo est conservée à l’identique.

La recette sur appareil reste à faire : ouvrir le profil, passer de Jour à Nuit puis Automatique, fermer et rouvrir l’application, vérifier une grande police et tourner le téléphone. Vérifier aussi un changement d’espace et le retour depuis une date.

Aucune modification des calculs, des données, des droits ou du service serveur. Version conservée : 1.0.0, Build 1.

## Menu inférieur en superposition

La capsule est désormais positionnée au-dessus du contenu, dans un conteneur transparent sans bande de fond. Les zones autour de la capsule laissent passer les interactions vers la page. La hauteur réelle du menu et la zone du geste système déterminent l’espace de fin de défilement, pour garder le dernier élément entièrement accessible. Cette modification mobile nécessite l’installation de la nouvelle Release.
