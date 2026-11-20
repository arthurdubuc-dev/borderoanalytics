export class PaymentRejected extends Error {}
export function paymentRejection(message: string): PaymentRejected {
  const rules: Array<[RegExp, string]> = [
    [
      /Finance write denied|permission denied|not authenticated/i,
      "Tu ne disposes plus des droits financiers nécessaires.",
    ],
    [
      /Amount exceeds|already settled/i,
      "Le reste dû a changé ou cette échéance est déjà réglée. Actualise les règlements.",
    ],
    [
      /cancelled.*(payment|settlement)|cancelled settlement/i,
      "Ce règlement ou cette échéance a été annulé. Actualise les règlements.",
    ],
    [
      /does not belong|not found in workspace/i,
      "Cette échéance ou ce règlement n’est plus accessible dans ce séjour.",
    ],
    [
      /historical paid/i,
      "Ce paiement historique doit être régularisé dans Bordero Web.",
    ],
    [
      /future|Actual payment date/i,
      "La date réelle du paiement est obligatoire et ne peut pas être future.",
    ],
    [/Payment means/i, "Renseigne le moyen de paiement."],
    [
      /Positive.*amount|cents required/i,
      "Renseigne un montant positif, avec deux décimales au maximum.",
    ],
    [/Reason required/i, "Le motif de correction est obligatoire."],
    [
      /Idempotency key payload conflict/i,
      "Cette tentative correspond à une autre saisie. Vérifie l’historique avant toute nouvelle opération.",
    ],
  ];
  return new PaymentRejected(
    rules.find(([pattern]) => pattern.test(message))?.[1] ??
      "Enregistrement refusé. Actualise l’échéancier avant de réessayer.",
  );
}
