# Bordero — Cahier des charges simplifié de l’application mobile

Spécification produit du 14 novembre 2026, base de la première version de Bordero Analytics.

## 1. À quoi sert Bordero mobile ?

Consulter rapidement les ventes de billets et les recettes de Bordero Web, sur Android et iPhone. Comprendre la situation globale, ouvrir une tournée ou une date, puis identifier les tarifs et promotions qui contribuent aux ventes.

La première version est en consultation. Les saisies, imports, corrections de prix et paramétrages se font dans Bordero Web.

## 2. Ce que comprend la première version

- Un accueil avec le résumé de l’espace de travail sélectionné.
- Une navigation Projet → Tournée → Date, avec une entrée « Hors tournée ».
- Les billets vendus et quatre lectures des recettes.
- Des courbes de ventes lorsque l’historique disponible le permet.
- La liste des tarifs d’une date et leur synthèse sur une tournée.
- Une analyse générique des performances de tous les tarifs, y compris les tarifs promotionnels.
- Les seuls résumés de tableaux du bordereau d’une date.
- Le compte Bordero et ses droits existants.

Hors périmètre : Roadbook, équipes, contacts, hôtels, plannings, saisie budgétaire, budget prévisionnel, justificatifs et détail des coûts ou salaires. Les coûts servent uniquement aux résumés demandés. Les notifications et prévisions ne sont pas nécessaires à la V1.

## 3. Les écrans

### Accueil

En haut : espace de travail actif, accès au changement d’espace et au compte. Un choix de périmètre permet de consulter une saison ou une plage de représentations. Par défaut : projets non archivés, toutes leurs dates billetterie éligibles, périmètre clairement nommé.

Afficher billets cumulés, recette selon le mode choisi, évolution observée sur 7 jours, fraîcheur des données, projets principaux et prochaines dates. Le remplissage global n’apparaît que si la capacité est connue sur un périmètre comparable ; indiquer la couverture. Les dates en cession, annulées ou sans source exploitable sont identifiées séparément.

Le résumé reste dans un seul workspace à la fois. Aucune addition silencieuse d’espaces aux droits différents.

### Projets et tournées

Liste avec recherche, affiche si disponible, nom, saison, billets et recette choisie. Dans un projet, choisir une tournée ou « Toutes les tournées ». La synthèse de tournée affiche les mêmes indicateurs, une courbe et une liste de dates classable par date ou ventes.

Le passage d’une tournée à une date conserve le mode de recette et le contexte. Les moyennes sont pondérées par les billets/capacités concernés.

### Date

Afficher spectacle, date et heure, salle, ville, statut et dernière remontée. Puis billets vendus, recette sélectionnée, courbe observée, tarifs, répartition des réseaux et résumés du bordereau.

Une représentation reportée montre séparément les billets hérités et les nouvelles ventes lorsque ces informations sont disponibles. Une cession est signalée sans inventer de billetterie à partir de la fréquentation.

### Tarifs

Par date : catégorie, nom du tarif, prix public TTC, prix Hors DL TTC, billets, recette TTC/Hors DL et quota si fiable. Sur une tournée : classement par billets ou recettes, part des ventes ventilées, nombre de dates et variantes de prix.

Toucher un tarif ouvre son détail par date. Un même nom à des prix différents reste identifiable ; aucun regroupement trompeur. Les ventes non ventilables restent visibles dans un message d’écart au total officiel.

Un tarif performant n’est pas forcément le plus vendu : montrer ensemble volume, part, recettes et prix moyen. Sans historique tarifaire comparable, ne pas afficher de vitesse ou de hausse par tarif.

### Analyse générique des tarifs

Le besoin central est de connaître les ventes de chaque tarif et de comparer leur contribution sur une date ou une tournée : volume, part des billets, recettes disponibles, prix et variantes. Les filtres portent sur les catégories, tarifs, dates et réseaux disponibles.

Black Friday était uniquement un exemple de tarif ou de campagne : aucun écran, module, filtre prédéfini, règle de calcul ou système dédié à Black Friday n’est prévu. Le même parcours doit fonctionner pour tous les tarifs : normal, adhérent, groupe, promotion ou autre libellé existant.

Un rattachement existant à une opération peut apporter du contexte dans le détail du tarif. Il n’impose pas une fiche campagne autonome en V1. Une évolution temporelle n’est affichée que si l’historique du périmètre choisi est comparable ; elle ne prouve pas une causalité.

## 4. Les quatre recettes proposées

| Mode | Ce qu’il montre |
|---|---|
| Recette publique TTC | Le montant de billetterie payé par le public, avec tous les DL |
| Recette Hors DL TTC | La recette publique diminuée de tous les DL |
| Hors DL + part producteur des DL | La recette Hors DL TTC plus la part revenant au producteur sur les DL Production |
| Recette Nette | La recette hors DL, après TVA et toutes taxes/retenues configurées, avant commission du promoteur local |

La part producteur tient compte du pourcentage propre à chaque date ; 70 % est seulement le partage par défaut. La recette nette ne retire pas les dépenses de salle, personnel ou plateau.

Le mode choisi s’applique aux totaux comparables. S’il n’est pas calculable pour une courbe ou une ventilation, ce bloc explique la limite ; il ne change pas discrètement de base. En particulier, la recette nette par tarif nécessite une règle d’allocation officielle et n’est pas promise en V1.

Le libellé « Total Production » n’est pas utilisé : ses usages actuels dans les sources divergent. La définition ci-dessus de « Hors DL + part producteur » est une proposition produit à conserver explicitement lors de la validation du cahier des charges.

## 5. Les résumés de bordereau

Une liste de cartes ou de lignes compactes affiche : Taxes, Salle, Personnel, Local, Marketing, « dont Communication » et Plateau si autorisé.

Les taxes distinguent TVA et autres taxes/retenues. La commission promoteur n’est pas une taxe. Communication est déjà comprise dans Marketing : les deux montants ne sont jamais additionnés. Les bases monétaires sont explicites ; un HT incomplet ou une TVA inconnue ne devient pas un zéro.

Le plateau correspond au plateau du workspace et aux droits effectifs de l’utilisateur. Son montant complet reprend la répartition du Web. Un utilisateur non autorisé ne le reçoit pas, y compris indirectement via un total. La V1 n’affiche pas de résultat/bénéfice qui permettrait de le retrouver.

Aucun détail de personnes, de contrats ou de lignes de dépenses n’est présenté.

## 6. Les filtres et les périodes

Filtres : espace, projet, tournée, date, saison/plage de représentations, mode de recette ; catégorie/tarif/réseau dans les vues concernées. Filtres avancés regroupés dans un panneau, pas dans une longue rangée d’onglets.

Deux notions sont séparées : les dates des spectacles sélectionnés et la période d’observation des ventes. Choisir les spectacles de décembre ne signifie pas afficher uniquement les billets vendus en décembre.

Pour les courbes : 7 jours, 30 jours, toute la période disponible, puis période personnalisée si les sources la supportent. Les jours manquants et fenêtres incomplètes restent visibles. Un cumul constaté n’est pas présenté comme une liste d’achats journaliers exacts.

## 7. Présentation

Reprendre l’esprit de Roadbook mobile avec une interface moderne, simple à lire : jaune de marque `#FFEE57`, cartes sobres, mêmes familles de polices et repères visuels, modes clair/sombre et navigation familière. Barre basse proposée : Accueil, Projets, Dates, Analyses. Le compte est accessible depuis l’en-tête.

Priorité aux cartes lisibles, courbes simples, barres classées et sections repliables. Les montants doivent rester lisibles avec une grande taille de texte. Les tableaux de détail peuvent défiler horizontalement si nécessaire, mais les informations essentielles restent dans la largeur du téléphone.

### Logo fourni

Utiliser le fichier fourni `favicon-bordero-dark-32x32.png` sans le transformer : pas de recoloration, recadrage, déformation, suppression de fond ou redessin. Il est conservé à l’identique dans `../assets/logo.png`, à côté de ce document. Le placer sur un conteneur jaune `#FFEE57`, conserver ses proportions et adapter uniquement sa taille d’affichage. Les fonds et les marges appartiennent à l’interface, pas au fichier du logo.

### KPI adaptés à l’écran

À l’accueil, les cartes principales affichent les recettes et les billets en grands caractères, avec un libellé court et la base de recette clairement visible. Leur disposition dépend de l’espace disponible : une colonne sur écran étroit ou avec grandes polices, deux colonnes quand les chiffres restent lisibles, grille plus large sur tablette. Aucun montant coupé et aucune réduction excessive de la taille du texte pour le faire tenir.

Les valeurs abrégées facilitent la lecture : `k` pour milliers, `M` pour millions, `Md` pour milliards. Le choix d’unité est automatique selon la valeur ; il ne s’agit pas d’un filtre qui change les données.

Seuils sur la valeur absolue : `k` de 1 000 à moins de 1 000 000 ; `M` de 1 000 000 à moins de 1 000 000 000 ; `Md` à partir de 1 000 000 000. Chaque unité divise respectivement par mille, un million ou un milliard, uniquement pour l’affichage compact.

| Valeur exacte | Affichage principal |
|---|---|
| 153 687,13 € | 153k € |
| 153 687 billets | 153k billets |
| 2 456 789,12 € | 2M € |
| 3 456 789 012 billets | 3Md billets |

Pour respecter l’exemple demandé `153 687,13 € → 153k €`, la partie décimale de la valeur mise à l’échelle est supprimée pour l’affichage compact : ce n’est pas un arrondi au millier le plus proche, qui donnerait 154k €. Conserver une règle commune aux trois unités. En dessous de 1 000, afficher la valeur complète sans suffixe. Les valeurs négatives conservent leur signe. Ce format ne modifie jamais les montants stockés, calculs, pourcentages ou exports.

Un appui sur la carte KPI ouvre un panneau directement en dessous, avec une animation verticale douce et un chevron qui change d’état. Il affiche le chiffre exact : montant avec séparateurs français et deux décimales, ou nombre entier de billets avec séparateurs de milliers. Un second appui le replie. Aucun nouvel écran n’est nécessaire. La valeur exacte et le résumé abrégé proviennent du même chiffre, du même périmètre et du même instant de données ; le dépliage ne nécessite pas de nouvelle requête.

Le dépliage ne doit pas entrer en conflit avec un éventuel raccourci de navigation. Il expose son état ouvert/fermé aux lecteurs d’écran, annonce la valeur exacte et respecte le réglage de réduction des animations du téléphone. Une donnée absente reste « indisponible », jamais `0k`.

Les graphiques disposent d’une lecture textuelle accessible. Les états « chargement », « aucune donnée », « donnée partielle », « erreur » et « accès non autorisé » sont distincts.

## 8. Solution technique retenue pour la préparation

React Native + TypeScript + Expo, avec builds natifs Android/iOS et navigation native. Nom affiché : **Bordero**. Dossier prévu : `app-mobile/bordero`.

La nouvelle application partage le langage visuel de Roadbook et utilise le compte Bordero. Elle dispose de ses propres identifiants d’application et de son propre cache. Elle ne reprend pas les fonctionnalités ou les droits Crew.

Les calculs restent centralisés dans les services Bordero. L’application reçoit des résumés sécurisés ; elle ne télécharge pas toutes les ventes ou tous les coûts pour recomposer les chiffres. Les historiques et filtres doivent être paginés et optimisés.

Connexion requise pour les données financières en V1. Le stockage sécurisé conserve la session ; pas de téléchargement financier hors ligne automatique. Chaque changement de compte/espace efface les données affichées de l’ancien périmètre.

## 9. Travail préalable au développement des écrans

1. Valider le sens exact des quatre recettes et le partage des DL décrit ici.
2. Préparer une API de lecture commune, avec droits, qualité et fraîcheur ; calculs réutilisés du Web.
3. Compléter le résumé de bordereau pour Communication et le plateau mutualisé.
4. Vérifier les bases HT/TTC des coûts et empêcher les totaux qui dévoilent une section interdite.
5. Réutiliser la ventilation tarifaire réconciliée pour tous les tarifs, avec leurs variantes de prix et leur contexte promotionnel éventuel.
6. Préparer des cas de recette représentatifs, dont reports et droits restreints.

Les dates de mise en vente et la famille tarifaire commune sont des améliorations souhaitables du Web. Leur absence ne doit pas bloquer toute la V1 : seuls les indicateurs qui en dépendent restent indisponibles.

## 10. Quand la première version est-elle terminée ?

- Les résumés d’accueil, tournée et date correspondent aux sources Web validées avec les mêmes périmètres et libellés.
- Les quatre recettes sont exactes au centime sur les cas de référence.
- Les tarifs se rapprochent du total officiel, ou expliquent clairement l’écart.
- Tous les tarifs utilisent le même parcours d’analyse ; aucun système dédié à Black Friday.
- Les KPI abrégés utilisent k / M / Md et se déplient vers le bas pour afficher exactement la valeur source.
- Le logo fourni reste inchangé, sur son conteneur jaune #FFEE57 ; la grille KPI reste lisible sur téléphone et tablette.
- Les sept résumés de bordereaux sont cohérents, sans double comptage ; le plateau respecte les droits.
- Aucun accès Roadbook, équipes ou budget n’apparaît.
- Les grands projets ne perdent pas de lignes à cause de la pagination.
- Les changements de workspace, pertes réseau et sessions expirées ne montrent pas d’anciennes données à tort.
- La navigation, le mode sombre, les grandes polices et les graphiques sont vérifiés sur Android et iPhone.

Les critères de cette spécification définissent la recette fonctionnelle. Les résultats et limites du build de test sont consignés dans RELEASE_TEST.md.
