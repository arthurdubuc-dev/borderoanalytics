# Bordero 1.0 — version 1.0.0, Build 1

## Ce qui change dans l’application

- Les indicateurs se rangent en grille : généralement deux cartes sur un téléphone en portrait, jusqu’à quatre en paysage ou sur tablette. Le nombre de colonnes dépend de la place réellement disponible et de la taille de police. Toucher une carte déplie le chiffre exact et ses précisions.
- Les résumés de bordereaux reprennent les couleurs du Web : violet pour TVA/taxes, bleu pour Salle, turquoise pour Personnel, vert pour Local, orange pour Marketing, rose pour Communication et neutre pour Plateau. Les restrictions du plateau restent appliquées. Communication est toujours incluse dans Marketing.
- Les affiches accompagnent les projets dans les listes et dans l’en-tête des projets et tournées. Les fichiers privés utilisent le service de téléchargement authentifié déjà présent dans Bordero. Une affiche manquante ou inaccessible ne bloque pas les chiffres.
- L’accueil ajoute le prix moyen public TTC par billet et le nombre de dates disposant de ventes. Le prix moyen est pondéré par les billets des seules dates dont les billets et la recette publique sont tous deux connus ; la couverture est indiquée. Il ne suit pas le filtre de recette nette.
- Le raccourci « À venir » permet de retrouver les représentations à venir dans le périmètre choisi, selon la date à Paris.
- Une indication distingue l’actualisation en cours, l’heure de consultation et une actualisation échouée.

## Chargements renforcés

Les erreurs temporaires de réseau et du serveur sont retentées deux fois. Les lectures identiques sont regroupées, et le détail d’un tarif utilise des lectures par lots plutôt qu’une lecture complète par date. Une session expirée peut être renouvelée avant de relire la réponse.

Un petit cache mémoire limite les allers-retours pendant la navigation. Il est propre au compte et à l’espace de travail ; il est abandonné à leur changement et n’est pas enregistré sur disque. Une actualisation échouée peut conserver une lecture précédente dans le même périmètre, avec une indication visible. Les refus d’accès ne sont pas traités comme des données disponibles.

Ces changements visent les causes côté application des échecs intermittents. Ils ne prouvent pas que toute indisponibilité du serveur ou toute restriction d’accès a disparu.

## Ce qui doit être validé sur le téléphone

Ouvrir l’accueil puis tourner l’iPhone : les cartes doivent changer de colonnes et conserver leur lisibilité. Toucher une recette et les billets pour ouvrir les valeurs exactes. Ouvrir une date pour retrouver les couleurs du bordereau. Consulter un projet avec affiche puis le détail d’un tarif.

Tester une actualisation et un retour dans l’application, puis changer d’espace de travail. Vérifier que les valeurs exactes restent identiques au Web et qu’un compte sans accès au plateau ne le voit pas. Tester aussi une grande police et le mode sombre.

Aucun changement de calcul financier, de table, de politique d’accès ou de fonction serveur n’est requis par cette mise à jour.
