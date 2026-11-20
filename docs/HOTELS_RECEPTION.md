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
