# Bordero 0.1.0 — build de test Release

Application distincte de Roadbook, nom affiché Bordero, identifiant `io.bordero.dashboard`. Le lancement Run de Xcode utilise Release et le JavaScript est embarqué dans le binaire.

## Vérifications

- TypeScript et 23 tests automatisés réussis : formats exacts/compacts, filtres, calculs issus du Web, part producteur des DL, recette nette avant commission promoteur, communication et protection du plateau.
- Fonction serveur mobile-dashboard déployée sur autorisation explicite ; authentification JWT requise.
- Vérifications distantes : requêtes sans session et avec session invalide refusées (401), clé publique seule sans utilisateur refusée (403).
- Build iOS Release compilé et lancé sur simulateur iPhone iOS 27.2 ; écran de connexion vérifié visuellement, sans serveur Metro. Adaptation du cycle de vie des scènes iOS 27 reprise de la configuration mobile existante.
- Build Android Release compilé avec succès (`assembleRelease`), APK local de test. Aucun appareil Android n’a été utilisé pour la recette connectée.

## Recette avec le compte utilisateur

La connexion et la consultation de données réelles doivent être vérifiées avec un compte Bordero autorisé, sur le téléphone cible. Aucun identifiant utilisateur n’est fourni dans les sources et aucun accès artificiel n’a été créé pour les tests.

Tester l’accueil, le changement de workspace, une tournée, une date, les quatre recettes, la grille tarifaire, les réseaux et les résumés du bordereau. Comparer les valeurs exactes au Web. Tester aussi la déconnexion, le mode sombre et les grandes polices.

Les observations globales sans ventilation certifiée restent partielles. Le net et les DL hérités d’un report ne sont pas reconstitués à partir des prix actuels. Les totaux indiquent leur couverture ; le plateau reste indisponible si ses sources ou ses droits ne permettent pas un calcul complet.

Les montants de coûts reprennent les agrégats historiques du bordereau Web sans les renommer arbitrairement HT. Le sous-total Communication est inclus dans Marketing. Aucun bénéfice ou total de dépenses n’est exposé.

Ce build sert à la recette ; il ne constitue pas une publication App Store ou Play Store.
