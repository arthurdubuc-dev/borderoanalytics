# Bordero 1.0.0 · Build 1 — build de test Release

Application distincte de Roadbook, nom affiché Bordero, identifiant `io.bordero.dashboard`. Le lancement Run de Xcode utilise Release et le JavaScript est embarqué dans le binaire.

## Vérifications

- TypeScript et 46 tests automatisés réussis : formats exacts/compacts, filtres, calculs issus du Web, part producteur des DL, recette nette avant commission promoteur, communication et protection du plateau.
- Fonction serveur mobile-dashboard version 3 déployée sur autorisation explicite ; authentification JWT requise.
- Vérifications distantes : requêtes sans session et avec session invalide refusées (401), clé publique seule sans utilisateur refusée (403).
- Build iOS Release compilé et lancé sur simulateur iPhone iOS 27.2 ; écran de connexion vérifié visuellement, sans serveur Metro. Adaptation du cycle de vie des scènes iOS 27 reprise de la configuration mobile existante.
- Build iOS Release destiné à un iPhone physique compilé avec la signature Apple du projet. Installation et recette sur le téléphone à effectuer dans Xcode.
- Version vérifiée dans le binaire iOS compilé : `CFBundleShortVersionString=1.0.0`, `CFBundleVersion=1`.
- Nouvelle couverture automatisée : colonnes portrait/paysage/grandes polices, palette du Web, moyenne pondérée, reprises bornées, cache/annulation, renouvellement de session et isolation entre comptes.
- Build Android Release compilé avec succès (`assembleRelease`), APK local de test. Aucun appareil Android n’a été utilisé pour la recette connectée.

## Recette avec le compte utilisateur

La connexion et la consultation de données réelles doivent être vérifiées avec un compte Bordero autorisé, sur le téléphone cible. Aucun identifiant utilisateur n’est fourni dans les sources et aucun accès artificiel n’a été créé pour les tests.

La grille en paysage est couverte par les tests de disposition ; sa recette visuelle avec les données réelles sur appareil reste à effectuer. Le simulateur de cette livraison est sur l’écran de connexion.

Tester l’accueil, le changement de workspace, une tournée, une date, les quatre recettes, la grille tarifaire, les réseaux et les résumés du bordereau. Comparer les valeurs exactes au Web. Tester aussi la déconnexion, le mode sombre et les grandes polices.

Les observations globales sans ventilation certifiée restent partielles. Le net et les DL hérités d’un report ne sont pas reconstitués à partir des prix actuels. Les totaux indiquent leur couverture ; le plateau reste indisponible si ses sources ou ses droits ne permettent pas un calcul complet.

Les montants de coûts reprennent les agrégats historiques du bordereau Web sans les renommer arbitrairement HT. Le sous-total Communication est inclus dans Marketing. Aucun bénéfice ou total de dépenses n’est exposé.

Ce build sert à la recette ; il ne constitue pas une publication App Store ou Play Store.

La mise à jour graphique et les optimisations de lecture sont décrites dans `EVOLUTIONS_ANALYTICS.md`. Le contrôle natif du graphique a utilisé un aperçu distinct avec des données synthétiques, absent du build livré. Une lecture sans connexion du service version 3 est toujours refusée (401).
