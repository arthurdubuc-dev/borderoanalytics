# Bordero 1.0.0 — Build 1 · validation Release

Application distincte de Roadbook, identifiant `io.bordero.dashboard`. Xcode Run utilise Release et embarque le JavaScript.

## Vérifications réussies

- TypeScript et 64 tests automatisés ; contrôle Deno de la fonction serveur.
- Compilation Release iPhone physique, simulateur iOS et Android. L’APK Android local conserve la signature de test, sans publication Play Store.
- Installation sur l’iPhone physique et ouverture avec sa session normale : tableau de bord avec chiffres confirmé par l’utilisateur ; lecture financière réussie constatée dans les journaux du service.
- Version des binaires : 1.0.0, Build 1. Logo fourni conservé à l’identique.
- Rendu natif Jour et Nuit vérifié dans un aperçu distinct. Dispositions portrait/paysage et grandes polices couvertes par les tests de grille ; recette visuelle complète sur appareil restant à effectuer.
- Service mobile-dashboard version 5 actif, JWT obligatoire ; accès anonyme refusé. Fonctions SQL de lecture groupée sous SECURITY INVOKER et RLS, sans accès anonyme.
- Formules du moteur financier Web inchangées et empreintes de ses sources vérifiées.

## Chargements : état actuel

La lecture économique du Web remplace les vues lourdes au démarrage. Les quatre recettes sont préparées une fois par espace, puis partagées avec les projets et les dates. Le bordereau et son plateau sont chargés séparément, à l’approche de la section.

Une lecture financière réelle a réussi en environ 19,7 secondes, après des tentatives ayant dépassé le délai en base. Cette durée reste trop élevée. La migration de ciblage SQL `20261114192730_mobile_dashboard_scope_predicate_pushdown.sql` a donc été appliquée : filtres directs sur les dates et maintien des contrôles d’accès. Les plans comparés, dont un plan préparé générique avec des identifiants synthétiques, confirment l’utilisation des index au lieu des balayages globaux. Le nouveau délai réel reste à mesurer après une actualisation sur le téléphone.

Voir `CHARGEMENTS_RECETTES.md` pour le fonctionnement et les limites. Aucune garantie de temps réel n’est déduite des tests automatisés ou des estimations du plan SQL.

## Recette à poursuivre

Actualiser le tableau de bord, vérifier Hors DL + part producteur des DL et Nette, puis comparer les chiffres exacts au Web. Tester changement d’espace, déconnexion, retour depuis l’arrière-plan, portrait/paysage et grandes polices.

Une source incomplète, une continuité non résolue ou des DL hérités non certifiés restent indisponibles et signalés. Les coûts ne sont pas renommés arbitrairement HT, Communication reste incluse dans Marketing et le plateau reste protégé par les droits. Aucun résultat ne permet d’inférer un plateau masqué.
