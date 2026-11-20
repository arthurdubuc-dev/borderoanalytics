# Bordero 1.0.0 — Build 1 · validation Release

Application distincte de Roadbook, identifiant `io.bordero.dashboard`. Xcode Run utilise Release et embarque le JavaScript.

## Vérifications réussies

- TypeScript et 67 tests automatisés ; contrôle Deno de la fonction serveur.
- Compilation Release iPhone physique, simulateur iOS et Android. L’APK Android local conserve la signature de test, sans publication Play Store.
- Installation sur l’iPhone physique et ouverture avec sa session normale : tableau de bord avec chiffres confirmé par l’utilisateur ; lecture financière réussie constatée dans les journaux du service.
- Menu inférieur en superposition transparente vérifié dans un aperçu natif distinct : le contenu reste visible autour de la capsule. Espacement de fin de page calculé depuis la hauteur réelle du menu.
- Version des binaires : 1.0.0, Build 1. Logo fourni conservé à l’identique.
- Rendu natif Jour et Nuit vérifié dans un aperçu distinct. Dispositions portrait/paysage et grandes polices couvertes par les tests de grille ; recette visuelle complète sur appareil restant à effectuer.
- Service mobile-dashboard version 5 actif, JWT obligatoire ; accès anonyme refusé. Fonctions SQL de lecture groupée sous SECURITY INVOKER et RLS, sans accès anonyme.
- Formules du moteur financier Web inchangées et empreintes de ses sources vérifiées.

## Chargements : état actuel

La lecture économique du Web remplace les vues lourdes au démarrage. Les quatre recettes sont préparées une fois par espace, puis partagées avec les projets et les dates. Le bordereau et son plateau sont chargés séparément, à l’approche de la section.

Une lecture financière réelle a réussi en environ 19,7 secondes, après des tentatives ayant dépassé le délai en base. Cette durée reste trop élevée. La migration de ciblage SQL `20261114192730_mobile_dashboard_scope_predicate_pushdown.sql` a donc été appliquée : filtres directs sur les dates et maintien des contrôles d’accès. Les plans comparés, dont un plan préparé générique avec des identifiants synthétiques, confirment l’utilisation des index au lieu des balayages globaux. Deux actualisations connectées ont ensuite réussi en 5,9 et 6,4 secondes côté service, sans erreur sur ces deux lectures. L’utilisateur a confirmé l’affichage de Hors DL + part producteur des DL.

Voir `CHARGEMENTS_RECETTES.md` pour le fonctionnement et les limites. Aucune garantie de temps réel n’est déduite des tests automatisés ou des estimations du plan SQL.

## Recette à poursuivre

Actualiser le tableau de bord, vérifier Hors DL + part producteur des DL et Nette, puis comparer les chiffres exacts au Web. Tester changement d’espace, déconnexion, retour depuis l’arrière-plan, portrait/paysage et grandes polices.

Une source incomplète, une continuité non résolue ou des DL hérités non certifiés restent indisponibles et signalés. Les coûts ne sont pas renommés arbitrairement HT, Communication reste incluse dans Marketing et le plateau reste protégé par les droits. Aucun résultat ne permet d’inférer un plateau masqué.


## Camembert des billetteries et seconde optimisation

La page projet/tournée et la date présentent un anneau animé des billets ventilés par billetterie. Le toucher d’une part ou d’une ligne de légende affiche son nom, le nombre exact de billets et son pourcentage. Le survol souris/stylet est prévu sur les parts et la légende. La première billetterie est indiquée en volume, sans déduire une rentabilité des billets seuls.

Le graphique utilise toutes les billetteries reçues, indépendamment du tri ou de la recherche du détail. Les parts concernent les billets ventilés ; les avertissements de ventilation partielle ou tronquée restent visibles. Les volumes invalides ou négatifs empêchent le graphique et renvoient vers le détail, sans remplacer les valeurs par zéro. La légende est accessible, le graphique s’adapte à sa largeur et respecte Réduire les animations.

Rendu iOS vérifié dans un aperçu natif isolé avec données explicitement synthétiques. TypeScript et 67 tests réussis, dont les cas sans vente, mono-billetterie, doublons, volumes invalides et sélection géométrique. La validation tactile/survol complète avec les données réelles reste à effectuer sur l’appareil. La version Release reste 1.0.0 Build 1.

La seconde optimisation de recette supprime une jointure redondante aux tarifs. Ses permissions ont été vérifiées sur la base déployée ; le nouveau temps connecté reste à mesurer. L’installation iPhone est réalisée ; son verrouillage a empêché le lancement automatique pour cette mesure.

Les trois compilations finales Release (iPhone physique, simulateur et Android) ont réussi avec le nouveau composant SVG. L’aperçu synthétique a été retiré du simulateur, puis remplacé par l’application réelle. Les fichiers de test sont exclus de Git et des versions livrées.

## Hôtels et réactivité — 20 novembre 2026

Nouvel accès Hôtels et fiche réception : échéancier, acomptes réels, solde, échéances et rooming autorisée. L’accès peut s’ouvrir avant la fin du chargement économique des ventes. Les formats de dates et de montants sont réutilisés ; le cache conserve l’heure de sa lecture initiale.

TypeScript et 84 tests réussis. Rendu de la fiche réception vérifié dans un aperçu iOS isolé avec données fictives. Contrats REST des séjours, engagements et échéances vérifiés en accès anonyme sur un identifiant synthétique : réponses valides et aucune ligne retournée. Aucune modification Supabase n’était nécessaire. Voir `HOTELS_RECEPTION.md` pour les sources, les cas incertains et les restrictions de rooming.


Après le test iPhone, l’utilisateur a confirmé l’affichage des montants et de la rooming list. Le résumé a ensuite été clarifié à sa demande : total facture, déjà réglé et reste regroupés, couleurs noir/vert/rouge, montants exacts et suppression du doublon. Détail replié pour les prix chambres, PDJ, prestations et taxes. Les calculs et le total enregistré proviennent du Web ; les situations incomplètes restent signalées. 84 tests réussis. La vérification positive des nouveaux postes détaillés avec le compte de l’utilisateur reste à poursuivre après mise à jour.

Les trois compilations Release finales (iPhone, simulateur et Android) sont réussies. Le rendu natif des trois montants et du Détail a été vérifié sur des données fictives. Version conservée : 1.0.0, Build 1. Aucun fichier de démonstration n’est inclus dans l’application réelle ni dans Git.

## Soldes sur les cartes hôtel

La liste affiche directement le reste en euros exacts : Réglé en vert, À régler en rouge, À confirmer si les données ne permettent pas la confirmation. Les lectures sont groupées par 20 séjours, avec deux groupes simultanés et sans chargement des détails tarifaires. Après un rafraîchissement ou la fermeture d’une fiche, les statuts sont revérifiés. TypeScript et 91 tests réussis. Aucun changement Supabase.

Les trois compilations finales Release (iPhone, simulateur et Android) sont réussies pour les soldes sur les cartes. L’aperçu natif montre les trois cas Réglé, À régler et À confirmer sur des données fictives. Installation sur l’iPhone ArtDBC réalisée ; version maintenue à 1.0.0 Build 1. La lecture des nouveaux soldes groupés avec le compte de l’utilisateur reste à confirmer sur appareil.
