# Bordero 1.0 — graphiques et chargements

## Dans l’application

Le bloc « Le rythme des ventes » remplace le petit graphique cumulatif. Il propose indépendamment du filtre financier :

- CA public TTC ou billets ;
- histogramme par jour ou courbe de cumul total ;
- 7 jours, 30 jours, 90 jours ou tout l’historique ;
- lecture d’une valeur exacte au toucher ;
- total des jours mesurés sur la période, moyenne et meilleur jour ;
- corrections négatives distinguées en rose, barres quotidiennes bleues et période défilable sur les historiques longs.

Les cumuls gardent les ventes antérieures à la fenêtre affichée. Le journalier utilise le flux canonique du projet. Pour une date, il est calculé entre deux observations consécutives uniquement. Les remontées groupées, les ancres initiales et les journées sans observation ne sont pas transformées en ventes quotidiennes. Le total et la moyenne précisent combien de jours disposent d’une mesure.

Les classements des tarifs et des réseaux utilisent des barres plus visibles et deux couleurs distinctes. Le jaune Bordero reste la couleur d’identité.

## Chargements et recettes

Des erreurs 503 du service financier et des dépassements de délai des vues commerciales ont été constatés pendant la recette. Le correctif vise à réduire le travail et la concurrence :

- vérification des droits limitée aux dates sélectionnées, sauf lorsque le plateau exige le périmètre de répartition complet ;
- lectures des vues commerciales et économiques bornées aux identifiants des dates autorisées, par lots ;
- lectures économiques et autres sources indépendantes exécutées ensemble ;
- au plus deux lectures analytiques coûteuses simultanées côté mobile ; les lectures en attente sont annulables ;
- dynamique globale des projets accessible à la demande pour donner la priorité au résumé ;
- raison et couverture affichées lorsque la recette avec DL producteur ou la recette nette sont partielles.

La formule Hors DL + part producteur des DL reste celle du moteur Web. Aucune recette n’est reconstituée arbitrairement à partir d’un historique incomplet ou de billets hérités. Une source non réconciliée, inaccessible ou sans détail peut encore rendre un montant indisponible.

## Livraison et validation

- TypeScript et 46 tests automatisés réussis.
- Vérification Deno de la fonction serveur réussie.
- Fonction `mobile-dashboard` déployée en version 3, JWT obligatoire et lectures sous l’identité du compte connecté.
- Aucun changement de table, de politique RLS ou de formule financière.
- Aperçu natif vérifié avec des données synthétiques dans une application de test distincte ; ces données ne font pas partie de l’application livrée.
- Recette connectée et comparaison des temps avant/après à effectuer sur le téléphone. La correction ne garantit pas l’absence de toute indisponibilité serveur.

Le projet conserve le numéro 1.0.0, Build 1 demandé pour cette première version. Les modifications préexistantes du projet Xcode sont conservées séparément.
