# Bordero 1.0 — premières lectures et recettes

## Ce qui change

À l’ouverture d’un espace, l’application prépare automatiquement les quatre recettes, sans attendre le choix du filtre. Les projets et les dates réutilisent cette lecture. Si le résumé global échoue, une lecture ciblée reste possible pour le projet ou la date.

Les billets, la recette publique et le Hors DL passent par la lecture économique déjà utilisée par Bordero Web, au lieu d’interroger directement les deux vues lourdes. Les dates de cession, les continuités non résolues et les recettes masquées par les droits ne sont pas remplacées par des chiffres inventés.

Les entrées du moteur financier sont lues ensemble dans un instantané SQL par lot de 20 dates : ventes, tarifs, taxes, paramètres, source officielle et état économique. Cela supprime les contrôles de droits HTTP date par date et évite de mélanger des ventes récentes avec d’anciens tarifs pendant un import. Deux lots maximum sont lancés simultanément.

Le bordereau complet se charge à l’approche de sa section pendant le défilement. Le calcul du plateau et les lectures des coûts ne retardent donc plus les recettes du résumé.

## Hors DL + part producteur des DL

La formule reste celle du moteur financier Web, dont les sources et empreintes ont été vérifiées sans divergence. Les données détaillées doivent être complètes et réconciliées. Un tarif utilisé mais manquant ne peut plus produire une recette certifiée à zéro.

Les billets hérités sans ventilation certifiée des DL, les sources sans détail tarifaire et les restrictions d’accès restent distingués d’une panne de chargement. Le message de la date ou du projet explique pourquoi une recette reste indisponible. Les avertissements sont limités au périmètre consulté.

## Déploiement

- Fonction `mobile-dashboard` version 5 déployée, JWT requis.
- Migration `20261114183323_mobile_dashboard_batch_capabilities.sql` appliquée : deux fonctions de lecture, SECURITY INVOKER, sous les RLS existantes, sans accès anonyme ni modification des données métier.
- Copie de la migration conservée dans le dépôt mobile et dans le dossier des migrations du Web, pour garder l’historique de la base partagée cohérent. Aucun autre travail du dépôt Web n’est inclus.
- Diagnostics limités à la durée et au nombre de recettes disponibles ; aucun montant, identifiant de compte ou jeton n’est journalisé.

## Vérification et limites

TypeScript, 64 tests et contrôle Deno réussis. Les tests couvrent un premier appel qui retourne les quatre recettes, la cohérence des paramètres de l’instantané, les lots, les refus d’accès, les sources absentes, les tarifs manquants et les billets hérités. Les permissions des nouvelles fonctions et le refus d’une lecture anonyme ont été vérifiés sur la base déployée.

Les tests automatisés ne donnent pas un temps réel garanti sur le téléphone. La vérification alternative avec la session normale de l’iPhone de test a été préparée et la version Release installée ; le lancement a été bloqué par le verrouillage du téléphone. La recette connectée de première ouverture et les temps avant/après restent à confirmer sur cet appareil.

Pour la recette : déverrouiller le téléphone, ouvrir Bordero, attendre la première lecture puis choisir Hors DL + part producteur des DL et Nette. Ouvrir ensuite un projet et une date : les valeurs du résumé doivent être immédiatement réutilisées. Faire défiler jusqu’au bordereau pour charger ses résumés. Comparer les chiffres exacts au Web, puis changer d’espace et vérifier qu’aucune ancienne donnée ne reste affichée.
