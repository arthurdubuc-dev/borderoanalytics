# Bordero Analytics

Application React Native et Expo pour Android et iOS : consultation des ventes et recettes de Bordero Web.

## Tester dans Xcode

1. Ouvrir `ios/Bordero.xcworkspace` dans Xcode.
2. Choisir le schéma **Bordero** et un iPhone connecté ou un simulateur.
3. Lancer **Run**. Le schéma est configuré en **Release** et embarque le JavaScript : aucun serveur Metro n’est nécessaire.
4. Se connecter avec son compte Bordero Web.

Identifiants distincts de Roadbook : `io.bordero.dashboard` sur iOS et Android. En cas de demande de signature pour un iPhone physique, choisir son équipe Apple dans **Signing & Capabilities**. Le build simulateur ne nécessite pas de signature.

## Installation sur une nouvelle machine

Node 24.14.1, Xcode et CocoaPods pour iOS ; Android Studio / SDK Android et Java 17 pour Android.

```sh
nvm use
npm ci
cp .env.example .env.local
```

Renseigner dans `.env.local` l’URL Supabase et la clé publique du projet. Aucun secret serveur ou `service_role` ne doit figurer dans l’application.

```sh
npm run prebuild
npx pod-install ios
npm run ios
```

Pour Android, connecter un appareil ou démarrer un émulateur, puis :

```sh
npm run android
```

Le build Android Release local utilise la signature de test du projet généré. Il ne constitue pas un AAB de publication Play Store.

## Fonctionnalités

- Connexion Bordero existante et changement d’espace de travail.
- Accueil, projets, tournées et représentations ; filtres de saison et de dates.
- KPI adaptatifs, abréviations k / M / Md et dépliage animé du chiffre exact.
- Recettes publique TTC, Hors DL TTC, Hors DL + part producteur des DL, et Recette Nette avant commission promoteur.
- Tarifs et réseaux : classements, recherches, catégories, variantes de prix et écarts au total officiel.
- Historique observé des ventes ; les mesures sans historique certifié restent indisponibles.
- Résumés de bordereaux, avec « dont Communication » et plateau seulement si autorisé.
- Logo fourni conservé dans `assets/logo.png`, modes clair/sombre, prise en charge des grandes polices.

Aucun module Roadbook, équipe, budget ou campagne événementielle dédiée. Les données de production ne sont jamais remplacées par des données de démonstration.

## Données et sécurité

Les lectures commerciales utilisent les vues et fonctions canoniques existantes, avec le JWT de l’utilisateur et RLS. Les sessions sont conservées dans le stockage sécurisé du téléphone ; les données financières ne sont pas persistées hors ligne. Les chargements sont annulés au changement de périmètre.

Les résumés financiers proviennent de `supabase/functions/mobile-dashboard`. Cette fonction authentifie le compte, vérifie son cycle de vie et les droits par date, puis utilise les moteurs du Web. Elle ne retourne ni lignes de paie, ni détail du budget, ni résultat permettant de déduire un plateau interdit. Aucun accès `service_role` n’y est utilisé.

Les sommes non réconciliées, les historiques manquants et les sources indisponibles sont signalés. Le net par tarif n’est pas inventé ; les billets hérités d’un report restent distincts des nouvelles ventes.

## Maintenir les calculs communs

Le fichier `canonical.mjs` est généré depuis le dépôt Web voisin, jamais corrigé à la main. La liste des sources et leurs empreintes est conservée dans `canonical-sources.json`. Le générateur extrait également les fonctions financières pures des hooks historiques pour éviter une seconde implémentation.

```sh
npm run backend:bundle
npm run check
```

Chemin Web par défaut : `../../borderoapp`. Il peut être fourni par `BORDERO_WEB_ROOT` sur une autre arborescence. Une évolution du Web exige une régénération, une validation de parité et un déploiement explicite du service. Aucun déploiement automatique de production n’est configuré.

## Vérification

```sh
npm run check
npm run export:check
deno check --config supabase/functions/mobile-dashboard/deno.json supabase/functions/mobile-dashboard/index.ts
```

Voir `docs/RELEASE_TEST.md` pour les vérifications réellement effectuées et les limites du premier build. Les relevés d’audit internes et configurations locales ne sont pas publiés dans ce dépôt.
