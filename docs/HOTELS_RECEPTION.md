# Hôtels — fiche réception · 20 novembre 2026

Un cinquième accès « Hôtels » ouvre les séjours en cours, les départs du jour puis les prochaines arrivées. Recherche par hôtel, ville ou projet. La période par défaut couvre aujourd’hui et les six prochains mois ; une seconde vue inclut les trois derniers mois. Les séjours des projets archivés ou non présents au catalogue accessible ne sont pas affichés.

## À la réception

Une fiche présente le reste de l’échéancier enregistré, les acomptes réellement réglés, les échéances dues et les prochaines échéances. Les chiffres sont exacts en euros. Le total ne constitue pas une facture finale : les extras et sommes absentes de Bordero ne sont pas déduits ou inventés.

- Un acompte payé ne suffit pas à déclarer le séjour soldé : sans ligne de solde, la fiche affiche « Solde à confirmer ».
- Les paiements partiels utilisent le cache serveur des règlements actifs, conformément à `hotelLineState` du Web.
- Un ancien paiement marqué payé sans règlement réel identifiable reste « à confirmer ».
- Les lignes annulées ne comptent pas. Les montants invalides, paiements supérieurs aux montants prévus ou divergences avec le suivi comptable empêchent la certification du reste.
- Un échéancier vide ou masqué ne devient jamais zéro. Pendant une actualisation ou une erreur de lecture, le montant principal n’est pas présenté comme actuel.

La rooming list se lit à la demande : référence de réservation, chambres, numéros renseignés et noms des voyageurs. Le regroupement utilise l’identité de la chambre, pas le seul type de chambre. Les contradictions sont signalées. Le bouton d’appel utilise le numéro de l’hôtel.

## Sources et droits

Lectures avec le compte connecté et ses RLS existantes : `hotel_stays`, référentiel `hotels`, `payment_tracking` puis `hotel_payment_schedule`. Le détail financier n’est demandé que lorsqu’un engagement comptable correspondant au séjour est visible. La liste de chambres utilise exclusivement le service Web opérationnel `get_roadbook_operational_rooming`, dans le même espace, projet et jour. Une réponse refusée ne déclenche aucun accès de remplacement aux noms des voyageurs. Ce service exige les droits opérationnels du Roadbook ; un simple lecteur peut donc avoir une fiche hôtel accessible sans rooming list.

Les séjours doivent être enregistrés dans `hotel_stays` ; les entrées hôtel non compilées ne sont pas reconstituées arbitrairement. Aucune création de séjour, saisie de paiement ou modification de chambre n’est effectuée par l’app. Pas de migration, de changement de politique ni de déploiement serveur pour cette évolution.

Les règles de paiement Web sont générées sans modification dans `src/canonical/hotels/` par `scripts/bundle-hotel-rules.mjs`. Le manifeste conserve leurs empreintes ; les règles ne sont pas copiées manuellement dans les écrans.

## Chargement et présentation

L’interface et l’accès Hôtels sont disponibles dès le chargement du catalogue, sans attendre les lectures économiques des ventes. Les chiffres de vente ne sont pas remplacés par des zéros pendant cette préparation. Le nombre de séjours rendus à la fois est limité, et les paiements/rooming ne sont chargés qu’à l’ouverture de la fiche correspondante.

Les formats EUR et dates sont réutilisés plutôt que reconstruits à chaque rendu. Le cache en mémoire fournit immédiatement une lecture encore fraîche et conserve son heure réelle de lecture. Il reste limité à la session et à l’espace ; aucune rooming list ni donnée financière n’est enregistrée sur disque. Retour au premier plan et bouton Actualiser relancent la lecture Hôtels.

## Vérification

TypeScript et 84 tests réussis : règlements partiels, historique, échéancier absent, refus d’accès, divergence comptable, annulations, centimes, chambres distinctes, contexte de jour ambigu et âge réel du cache. Les trois contrats REST ont répondu correctement avec un identifiant synthétique et un accès anonyme, sans retourner de ligne. RLS actives constatées sur les quatre tables concernées.

Aperçu iOS natif vérifié avec données fictives explicites. L’utilisateur a confirmé sur iPhone l’affichage du montant et de la rooming list avec son compte. Les montants n’ont pas été comparés indépendamment à ses factures par l’agent. Aucun nouveau délai global de démarrage n’est déduit de ces tests.


## Lecture des trois montants et Détail

Le résumé regroupe trois chiffres exacts, sans abréviation : total facture en gras, déjà réglé en vert (acompte et éventuels paiements partiels du solde inclus) et reste à régler en rouge. Le doublon entre acompte réglé et total déjà réglé a été supprimé.

Le total facture provient des montants enregistrés de l’entrée hôtel, via `roadbook_entries_with_financials` (SECURITY INVOKER, RLS de la table financière). Seuls les champs monétaires nécessaires sont sélectionnés ; aucune note libre ni rooming textuelle n’est lue par ce chemin. L’absence du montant protégé ne devient pas zéro : un échéancier complet peut fournir un « Total prévu du séjour », explicitement distinct d’un total facture.

Le reste utilise le calcul Web `summarizeHotelPlan` lorsque le total facture est disponible. Si ce total diffère de l’échéancier, la divergence est indiquée et les anciennes échéances ne sont pas présentées comme une confirmation du montant à payer aujourd’hui. Un trop-versé ou un brouillon à zéro demande une vérification.

L’accordéon « Détail », fermé par défaut, rassemble chambres et prix unitaires TTC, petits-déjeuners, autres repas/prestations renseignés, taxe de séjour, TVA comprise et total des taxes comprises. La TVA n’est pas ajoutée aux postes TTC. Les calculs reprennent `invoiceCalc.ts` du Web, généré sans modification ; le détail est présenté uniquement s’il se rapproche du total facture enregistré au centime. Sinon, les prix manquants ou la divergence restent explicites. L’échéancier détaillé est également rangé dans Détail.

84 tests et TypeScript réussis. Le nouvel accès anonyme à la vue financière est refusé ; le rôle authentifié possède SELECT, toujours soumis aux RLS sous-jacentes. Aucun changement de données, de schéma ou de droits n’a été effectué.

## Soldes dans la liste

Chaque carte présente le reste exact à régler et un statut : Réglé en vert, À régler en rouge, À confirmer lorsque la lecture est impossible ou non certifiée. Le statut Réglé exige un total facture accessible et des règlements réconciliés ; un échéancier apparemment soldé sans total facture ne suffit pas.

Les cartes sont lues par groupes de 20 séjours, avec deux groupes maximum en parallèle. Les engagements, échéances et seuls totaux facture nécessaires sont groupés ; les prix détaillés et la rooming list ne sont pas chargés pour la liste. Toutes les lectures gardent les filtres d’espace et de projets, les identités demandées et les RLS du compte connecté. Des lignes incohérentes ou hors périmètre font échouer la lecture, sans produire de statut vert.

Le rafraîchissement de la liste, le retour au premier plan et la fermeture d’une fiche réception relancent la vérification. Pendant une actualisation, l’ancien statut n’est pas affiché comme confirmé. Une erreur conserve l’accès à la fiche et affiche À confirmer, avec la possibilité de relancer les soldes.

TypeScript et 91 tests réussis, dont sept nouveaux tests des lectures groupées, des frontières de projets/espaces, des sources masquées et des cas Réglé/À régler/À confirmer. Aucun changement serveur, de droits ou de données métier.

## Enregistrer et corriger les règlements

Les chambres et la rooming list restent en lecture seule. Un utilisateur disposant du droit financier Web `finance / budget_global / write` peut ouvrir « Enregistrer ou corriger un règlement » sur un séjour, puis choisir une échéance d’acompte ou de solde existante. Le formulaire enregistre un paiement déjà effectué : montant, date réelle et moyen de paiement. Les paiements partiels sont possibles ; le reste de l’échéance limite la saisie. Les échéances et tarifs restent préparés dans Bordero Web.

La correction sélectionne un règlement réel précis, y compris lorsqu’une échéance a reçu plusieurs paiements. Le motif est obligatoire, comme sur le Web. Le serveur annule historiquement le règlement remplacé et crée son remplacement dans une même transaction. Si le montant change, les justificatifs doivent être revérifiés dans Bordero Web, conformément au comportement du service existant.

Le mobile appelle exclusivement `mark_hotel_payment_paid` et `correct_hotel_payment_paid`. Les fonctions déployées et leurs droits ont été vérifiés en lecture : exécution authentifiée autorisée, anonyme refusée, contrôle financier côté serveur, verrouillage des lignes, plafonnement et audit. Aucun changement de fonction, de politique ou de table n’a été nécessaire. Le client ne modifie jamais directement les colonnes de paiement.

Chaque tentative possède un UUID sécurisé et conserve exactement sa charge avant l’envoi. Un double clic ou deux instances du formulaire sur le même séjour ne lancent pas deux écritures simultanées. Après une réponse incertaine, le formulaire propose « Vérifier cette tentative », avec la même clé et les mêmes valeurs, sans nouvel envoi automatique. Une réponse perdue ne devient pas un succès présumé. Un ancien paiement seulement déclaré payé reste à régulariser dans le Web.

Exception ciblée au cache de lecture en mémoire : la seule tentative non confirmée est conservée dans le trousseau chiffré de l’appareil, accessible uniquement déverrouillé, liée au compte, espace, projet et séjour. Elle contient la clé de reprise, les identités nécessaires et les champs saisis, sans jeton d’accès ni données de voyageurs. Elle est supprimée après confirmation. Une reprise après fermeture de l’app utilise la même opération, sans duplication. Les historiques et rooming lists ne sont pas enregistrés sur disque par ce mécanisme.

Après confirmation serveur, les totaux sont relus et les soldes des cartes sont revérifiés à la fermeture de la fiche. Une erreur de relecture ne nie pas un paiement confirmé ; les actions restent bloquées jusqu’à l’actualisation des données. Les refus de droits et changements de compte restent bloquants.

TypeScript et 112 tests réussis : protocoles, correction ciblée, montants/dates français, plafonds, permissions Web, double clic, concurrence entre formulaires, pertes de réponse et reprise après redémarrage simulé. Les tests utilisent des données synthétiques et des doubles de transport. Aucun règlement réel de production n’a été créé ou corrigé pour les tests.

La date réelle se choisit désormais dans le calendrier natif : toucher la date ouvre le calendrier iOS ; Android présente un calendrier avec Choisir/Annuler. Les jours futurs sont exclus, en cohérence avec la règle serveur Europe/Paris. Trois tests couvrent la valeur initiale, les limites de jour et les changements d’heure. Le montant et le moyen de paiement restent inchangés lors du choix de la date.

L’utilisateur a confirmé avoir enregistré avec succès un solde avec sa date avant cette évolution du sélecteur. Aucun règlement fictif n’a été envoyé en production par l’agent.
